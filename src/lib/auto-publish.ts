/**
 * Auto-publish workflow for approved submissions.
 *
 * David's rule: "a user uploads a photo for a store, the admin approves
 * it and the photo goes live on the site on the store's page. fix this.
 * do not create any duplicates and do not make the admin download or
 * edit anything."
 *
 * What this module does, in order, when the admin clicks Approve:
 *
 *   1. Pull the photo bytes out of the private `submissions` Supabase
 *      bucket.
 *   2. Read the current `mascots.json` from GitHub (so we can mutate
 *      against the latest committed copy, not a stale local snapshot).
 *   3. Decide whether to MERGE into an existing entry (placeholder
 *      mascot at the same store_number with the same animal — Phil
 *      the Parrot's case) or APPEND a new entry.
 *   4. Pick the photo's filename (`{mascot.id}.{ext}`).
 *   5. Upload the photo bytes to `public/photos/{id}.{ext}` in GitHub
 *      (the repo root IS the Next.js app directory).
 *   6. Upload the updated `mascots.json` in GitHub.
 *   7. Move the photo from the private to the public Supabase bucket
 *      (so the submitter-thank-you email's deep-link still works while
 *      DigitalOcean is rebuilding) and mark the submission approved.
 *
 * DigitalOcean App Platform watches `main` and rebuilds on push, so the
 * mascot is live on tjmascots.com (or the dolphin-app preview URL) about
 * 3 minutes after step 6.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  commitFilesAtomic,
  existsOnMain,
  readFileFromMain,
  REPO_PATHS,
} from './github';
import { resizeForPublish, type PendingSubmission } from './admin';

/** Subset of mascot fields we care about for matching/merging. The on-disk
 *  shape has more, but we preserve unknown fields by spreading in place. */
interface MascotRow {
  id: number;
  store: string;
  state?: string;
  animal: string;
  name?: string | null;
  notes?: string | null;
  photo?: string | null;
  has_photo?: boolean;
  retired?: boolean;
  source_url?: string | null;
  store_number?: string | null;
  created_at?: string;
  submitted_by?: string | null;
  // Allow forward-compat fields:
  [k: string]: unknown;
}

interface MascotsFile {
  mascots: MascotRow[];
}

export interface PublishResult {
  /** Did we merge into an existing placeholder, or create a new entry? */
  mode: 'merged' | 'created';
  /** The mascot id that was published. */
  mascotId: number;
  /** Photo filename inside `public/photos/` (repo path). */
  photoFilename: string | null;
  /** GitHub commit SHA of the mascots.json update. */
  jsonCommitSha: string;
  /** GitHub commit SHA of the photo upload (if any). */
  photoCommitSha: string | null;
}

/* --------------------- Matching / merge logic --------------------- */

/** Find an existing mascot row that should be MERGED with this submission
 *  (rather than creating a duplicate). We look for a same-store,
 *  same-animal mascot that has no photo yet — the classic placeholder
 *  case (Phil the Parrot at Camarillo, etc.).
 *
 *  We deliberately do NOT match on name, because submitters often type
 *  a slightly different spelling than what's in the catalog. If multiple
 *  candidates match, we prefer the one without a photo. */
function findMergeCandidate(
  mascots: MascotRow[],
  submission: PendingSubmission,
): MascotRow | null {
  if (!submission.store_number) return null;
  const sameStoreSameAnimal = mascots.filter(
    (m) =>
      m.store_number === submission.store_number &&
      normalizeAnimal(m.animal) === normalizeAnimal(submission.animal) &&
      !m.retired,
  );
  if (sameStoreSameAnimal.length === 0) return null;
  // Prefer a placeholder (no photo). If everything has a photo already,
  // there's nothing to merge into → fall through to "create new".
  const placeholder = sameStoreSameAnimal.find(
    (m) => !m.has_photo && !m.photo,
  );
  return placeholder ?? null;
}

function normalizeAnimal(a: string | null | undefined): string {
  return (a ?? '').trim().toLowerCase().replace(/s$/, ''); // strip trivial plural
}

/* ------------------------- Public entry point -------------------- */

export async function publishApproval(args: {
  pat: string;
  sb: SupabaseClient;
  submission: PendingSubmission;
  storeMatch?: { city: string; state: string; store_number: string } | null;
}): Promise<PublishResult> {
  const { pat, sb, submission, storeMatch } = args;

  // ---------- 0. Idempotency guard ----------------------------------
  // If the submission was already approved (e.g. the previous click
  // succeeded on GitHub but the page didn't refresh, OR the user
  // double-clicked Approve), don't re-run the GitHub write — that's
  // exactly how we end up with orphan files + 409/422 errors. Refetch
  // the submission and short-circuit if it's no longer pending.
  const { data: fresh, error: fetchErr } = await sb
    .from('submissions')
    .select('status, approved_mascot_id')
    .eq('id', submission.id)
    .single();
  if (fetchErr) {
    throw new Error(`failed to refetch submission: ${fetchErr.message}`);
  }
  if (fresh.status === 'approved' && fresh.approved_mascot_id) {
    return {
      // We don't know whether the original was a merge or a new entry
      // from here. "merged" is the safer default for the banner copy —
      // it just says "Published as mascot #N" without implying anything
      // novel happened on this click.
      mode: 'merged',
      mascotId: fresh.approved_mascot_id as number,
      photoFilename: null,
      jsonCommitSha: '',
      photoCommitSha: null,
    };
  }

  // ---------- 1. Pull photo bytes from Supabase (if any) -----------
  // Phone photos are routinely 3-5 MB; we resize to max 1600px / JPEG
  // quality 85 before they ever touch the repo. Same target the May 2026
  // bulk-cleanup script used to recover ~200 MB after a DigitalOcean
  // build timed out cloning the bloated repo. Falls back to the original
  // bytes if the browser can't decode the image — never blocks publish.
  let photoBytes: Uint8Array | null = null;
  let photoExt = 'jpg';
  if (submission.photo_path) {
    const { data: blob, error } = await sb.storage
      .from('submissions')
      .download(submission.photo_path);
    if (error) throw new Error(`download failed: ${error.message}`);
    const originalExt = (submission.photo_path.split('.').pop() || 'jpg').toLowerCase();
    const resized = await resizeForPublish(blob);
    const finalBlob = resized?.blob ?? blob;
    photoExt = resized?.ext ?? originalExt;
    photoBytes = new Uint8Array(await finalBlob.arrayBuffer());
  }

  // ---------- 2. Read mascots.json from GitHub (Git Data API) -------
  // We use the Git Data API tree+blob endpoints instead of the Contents
  // API because the Contents API's per-file cache served stale SHAs for
  // 5–10 seconds after every commit, which produced the 409/422 failures
  // we kept hitting in the old single-PUT-per-file flow.
  const jsonText = await readFileFromMain(pat, REPO_PATHS.mascotsJson);
  const file = JSON.parse(jsonText) as MascotsFile;

  // ---------- 3. Merge or append ------------------------------------
  const merge = findMergeCandidate(file.mascots, submission);
  const submittedBy = submission.email ? deriveDisplayName(submission.email) : null;
  const today = new Date().toISOString().slice(0, 10);
  let mascotId: number;
  let mode: 'merged' | 'created';

  if (merge) {
    mode = 'merged';
    mascotId = merge.id;
    merge.has_photo = Boolean(photoBytes);
    merge.photo = photoBytes ? `${mascotId}.${photoExt}` : (merge.photo ?? null);
    if (submittedBy && !merge.submitted_by) merge.submitted_by = submittedBy;
    if (!merge.source_url || merge.source_url.startsWith('https://www.reddit.com')) {
      merge.source_url = `User-submitted (${formatTodayShort()})`;
    }
    if (submission.notes && !merge.notes) merge.notes = submission.notes;
    if (photoBytes) merge.created_at = today;
  } else {
    mode = 'created';
    mascotId = nextId(file.mascots);
    const cityLabel = storeMatch ? storeMatch.city : submission.store;
    file.mascots.push({
      id: mascotId,
      store: cityLabel,
      state: storeMatch?.state ?? '',
      animal: submission.animal,
      name: submission.name ?? null,
      notes: submission.notes ?? null,
      photo: photoBytes ? `${mascotId}.${photoExt}` : null,
      has_photo: Boolean(photoBytes),
      retired: false,
      source_url: `User-submitted (${formatTodayShort()})`,
      store_number: submission.store_number ?? storeMatch?.store_number ?? null,
      created_at: today,
      submitted_by: submittedBy,
    });
  }

  const photoFilename = photoBytes ? `${mascotId}.${photoExt}` : null;
  const photoPath = photoFilename
    ? `${REPO_PATHS.photosDir}/${photoFilename}`
    : null;

  // ---------- 4. Build the events.json update (if file exists) -----
  // Best-effort: if events.json doesn't exist yet (older repo states),
  // we skip the events.json entry but still publish the rest.
  let updatedEventsJson: string | null = null;
  let eventsText: string | null = null;
  try {
    eventsText = await readFileFromMain(pat, REPO_PATHS.eventsJson);
  } catch {
    // events.json missing — skip the events entry, leave updatedEventsJson null
  }
  if (eventsText) {
    try {
      updatedEventsJson = buildUpdatedEventsJson(eventsText, {
        mode,
        mascotId,
        submission,
        storeMatch: storeMatch ?? null,
        photoAdded: Boolean(photoBytes),
        today,
        submittedBy,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        '[auto-publish] events.json parse failed — skipping event entry:',
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  // ---------- 5. ATOMIC: one commit, all three files ---------------
  // This is the key reliability change. The photo, the mascots.json
  // update, and the events.json update all go to GitHub in a SINGLE
  // commit via the Git Data API. Either everything lands or nothing
  // does — no more partial state.
  const updatedJson = JSON.stringify(file, null, 2) + '\n';
  const commitMessage =
    mode === 'merged'
      ? `Publish photo for ${displayLabel(submission, mascotId)} (merge)`
      : `Add ${displayLabel(submission, mascotId)} (new entry)`;

  const commitFiles: Array<{ path: string; content: Uint8Array | string }> = [
    { path: REPO_PATHS.mascotsJson, content: updatedJson },
  ];
  if (photoBytes && photoPath) {
    commitFiles.push({ path: photoPath, content: photoBytes });
  }
  if (updatedEventsJson) {
    commitFiles.push({ path: REPO_PATHS.eventsJson, content: updatedEventsJson });
  }

  const jsonCommitSha = await commitFilesAtomic(pat, commitFiles, commitMessage);

  // ---------- 6. Mirror photo into public Supabase bucket ----------
  // Lets the submitter's thank-you email's deep-link work for the ~3
  // minutes it takes DigitalOcean to rebuild with the new photo.
  if (photoBytes && photoFilename) {
    const blob = new Blob([photoBytes.slice().buffer as ArrayBuffer], {
      type: contentTypeFor(photoExt),
    });
    const { error: upErr } = await sb.storage
      .from('mascot-photos')
      .upload(photoFilename, blob, {
        contentType: contentTypeFor(photoExt),
        upsert: true,
      });
    if (upErr) {
      // eslint-disable-next-line no-console
      console.warn('[auto-publish] mascot-photos mirror failed:', upErr.message);
    }
    if (submission.photo_path) {
      await sb.storage.from('submissions').remove([submission.photo_path]);
    }
  }

  // ---------- 7. Mark submission approved in Supabase --------------
  // Retried up to 3 times. If this step fails the GitHub state is
  // already correct, but the submission would re-appear on the next
  // page refresh — which is the exact state that drove us into the
  // orphan-file/409 cascade. The idempotency guard at step 0 will
  // catch any retry click, but we still want to clear the row so the
  // dashboard reflects reality.
  let updErr: { message: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await sb
      .from('submissions')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        admin_notes: `Auto-published as mascot ${mascotId} (${mode}). Commit ${jsonCommitSha.slice(0, 7)}.`,
        approved_mascot_id: mascotId,
      })
      .eq('id', submission.id);
    if (!result.error) {
      updErr = null;
      break;
    }
    updErr = result.error;
    await new Promise((r) => setTimeout(r, 300 + attempt * 500));
  }
  if (updErr) {
    // eslint-disable-next-line no-console
    console.warn('[auto-publish] submission status update failed:', updErr.message);
  }

  // Sanity check: confirm the photo actually landed on main. If for
  // some reason it didn't, the warning gives us a clearer signal than
  // the 409 cascade we used to surface.
  if (photoPath && !(await existsOnMain(pat, photoPath))) {
    // eslint-disable-next-line no-console
    console.warn(
      `[auto-publish] post-commit check: ${photoPath} not visible on main yet (cache lag — should appear shortly).`,
    );
  }

  return {
    mode,
    mascotId,
    photoFilename,
    jsonCommitSha,
    photoCommitSha: jsonCommitSha, // single atomic commit covers both
  };
}

/* -------------------------- Small helpers ------------------------- */

function nextId(mascots: MascotRow[]): number {
  return Math.max(...mascots.map((m) => m.id)) + 1;
}

/** Display name from email — "jason.dawson@gmail.com" → "Jason D." */
function deriveDisplayName(email: string): string {
  const local = email.split('@')[0] || '';
  const parts = local.split(/[._\-]/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  if (parts.length === 1) return first;
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}

function formatTodayShort(): string {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(
    d.getDate(),
  ).padStart(2, '0')}/${d.getFullYear()}`;
}

function displayLabel(s: PendingSubmission, id: number): string {
  const name = s.name?.trim();
  return name ? `${name} the ${s.animal} (#${id})` : `${s.animal} #${id}`;
}

/* ---------------- events.json append (best-effort) ---------------- */

interface FeedEvent {
  date: string;
  kind: 'added' | 'renamed' | 'photo' | 'credit' | 'notes' | 'store_added' | 'store_removed' | 'site';
  store_number?: string;
  mascot_id?: number;
  summary: string;
  reason?: string;
}

interface EventsFile {
  _doc?: string;
  events: FeedEvent[];
}

/** Pure: parse events.json text, prepend an event for this approval,
 *  and return the new JSON text. No GitHub I/O. Used by publishApproval
 *  to bundle events.json into the atomic commit alongside the photo +
 *  mascots.json update. Throws on parse errors. */
function buildUpdatedEventsJson(
  eventsText: string,
  args: {
    mode: 'merged' | 'created';
    mascotId: number;
    submission: PendingSubmission;
    storeMatch: { city: string; state: string; store_number: string } | null;
    photoAdded: boolean;
    today: string;
    submittedBy: string | null;
  },
): string {
  const { mode, mascotId, submission, storeMatch, photoAdded, today, submittedBy } = args;
  const file = JSON.parse(eventsText) as EventsFile;
  if (!Array.isArray(file.events)) {
    throw new Error('events.json: .events is not an array');
  }

  const cityLabel = storeMatch ? `${storeMatch.city}, ${storeMatch.state}` : submission.store;
  const storeRef = submission.store_number
    ? `#${submission.store_number} ${cityLabel}`
    : cityLabel;
  const animalLower = submission.animal.toLowerCase();
  const subjectName = submission.name?.trim()
    ? `${submission.name.trim()} the ${animalLower}`
    : `the ${animalLower}`;

  const summary =
    mode === 'created'
      ? `${capitalize(subjectName)} joined ${storeRef}`
      : `First photo for ${subjectName} at ${storeRef}`;

  const reasonBits: string[] = [];
  reasonBits.push(
    submittedBy
      ? `Community submission from ${submittedBy}.`
      : 'Community submission via the Submit form.',
  );
  if (submission.notes?.trim()) {
    const trimmed = submission.notes.replace(/\s+/g, ' ').trim();
    reasonBits.push(
      trimmed.length > 240 ? `${trimmed.slice(0, 237)}…` : trimmed,
    );
  }
  if (!photoAdded && mode === 'created') {
    reasonBits.push('No photo yet — spotters welcome!');
  }

  const event: FeedEvent = {
    date: today,
    kind: mode === 'created' ? 'added' : 'photo',
    mascot_id: mascotId,
    summary,
    reason: reasonBits.join(' '),
  };
  if (submission.store_number) {
    event.store_number = submission.store_number;
  }

  // Prepend so newest sits at the top of the array (matches the format
  // convention in the file's _doc string).
  file.events.unshift(event);
  return JSON.stringify(file, null, 2) + '\n';
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function contentTypeFor(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'heic':
      return 'image/heic';
    default:
      return 'application/octet-stream';
  }
}
