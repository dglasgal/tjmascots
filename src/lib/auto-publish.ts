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
import { resizeForPublish, type PendingSubmission, type PendingCorrection } from './admin';

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

/* --------------------- Publish serialization ---------------------- */

/** All publishes in this browser session run ONE AT A TIME through this
 *  promise chain. Why: on 2026-08-02 two Approve clicks ~4s apart ran
 *  concurrently — both read mascots.json before either committed, both
 *  computed nextId 482, and the second commit's retry overwrote the
 *  first (Norbert was silently erased; his submission still said
 *  "approved"). Serializing here removes the same-session race
 *  entirely; the `rebuild` callback passed to commitFilesAtomic guards
 *  the (rarer) cross-session/cross-device race. */
let publishChain: Promise<unknown> = Promise.resolve();

function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = publishChain.then(fn, fn);
  // Keep the chain alive whether this run succeeds or fails.
  publishChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/* ------------------------- Public entry point -------------------- */

export function publishApproval(args: {
  pat: string;
  sb: SupabaseClient;
  submission: PendingSubmission;
  storeMatch?: { city: string; state: string; store_number: string } | null;
}): Promise<PublishResult> {
  return serialized(() => publishApprovalInner(args));
}

async function publishApprovalInner(args: {
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

  // ---------- 2–5. Read repo state, merge/append, commit (atomic) ---
  // Everything that DEPENDS ON current repo state lives inside
  // `buildCommit`, which is passed to commitFilesAtomic as its rebuild
  // callback. If the commit loses a race with another writer, the
  // callback runs again against the fresh branch tip — re-reading
  // mascots.json, re-deriving the next id, and re-building events.json —
  // so a retry can never overwrite someone else's just-landed publish
  // (the 2026-08-02 Norbert/Ollie #482 bug).
  //
  // We use the Git Data API tree+blob endpoints instead of the Contents
  // API because the Contents API's per-file cache served stale SHAs for
  // 5–10 seconds after every commit, which produced the 409/422 failures
  // we kept hitting in the old single-PUT-per-file flow.
  const submittedBy = submission.email ? deriveDisplayName(submission.email) : null;
  const today = new Date().toISOString().slice(0, 10);
  // Outputs of the last buildCommit run (re-assigned on every attempt,
  // so after the commit lands they reflect what was actually committed).
  let mascotId = 0;
  let mode: 'merged' | 'created' = 'created';
  let photoFilename: string | null = null;
  let photoPath: string | null = null;

  const buildCommit = async (): Promise<{
    files: Array<{ path: string; content: Uint8Array | string }>;
    message: string;
  }> => {
    const jsonText = await readFileFromMain(pat, REPO_PATHS.mascotsJson);
    const file = JSON.parse(jsonText) as MascotsFile;

    // ----- Merge or append -----
    const merge = findMergeCandidate(file.mascots, submission);
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

    photoFilename = photoBytes ? `${mascotId}.${photoExt}` : null;
    photoPath = photoFilename
      ? `${REPO_PATHS.photosDir}/${photoFilename}`
      : null;

    // ----- events.json update (best-effort; re-read fresh too) -----
    let updatedEventsJson: string | null = null;
    let eventsText: string | null = null;
    try {
      eventsText = await readFileFromMain(pat, REPO_PATHS.eventsJson);
    } catch {
      // events.json missing — skip the events entry
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

    // ----- Assemble the atomic commit payload -----
    const updatedJson = JSON.stringify(file, null, 2) + '\n';
    const message =
      mode === 'merged'
        ? `Publish photo for ${displayLabel(submission, mascotId)} (merge)`
        : `Add ${displayLabel(submission, mascotId)} (new entry)`;
    const files: Array<{ path: string; content: Uint8Array | string }> = [
      { path: REPO_PATHS.mascotsJson, content: updatedJson },
    ];
    if (photoBytes && photoPath) {
      files.push({ path: photoPath, content: photoBytes });
    }
    if (updatedEventsJson) {
      files.push({ path: REPO_PATHS.eventsJson, content: updatedEventsJson });
    }
    return { files, message };
  };

  // One commit, all files. Either everything lands or nothing does —
  // and on a ref race the buildCommit callback recomputes from fresh
  // repo state before the retry.
  const firstBuild = await buildCommit();
  const jsonCommitSha = await commitFilesAtomic(
    pat,
    firstBuild.files,
    firstBuild.message,
    buildCommit,
  );

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

/* ============================================================== */
/*  Correction photo approval                                      */
/* ============================================================== */

export interface CorrectionPublishResult {
  /** The mascot id whose photo was swapped. */
  mascotId: number;
  /** New photo filename inside public/photos/ (e.g. "1.jpg"). */
  photoFilename: string;
  /** GitHub commit SHA of the atomic commit. */
  commitSha: string;
  /** True if we also applied the reporter's suggested store. */
  storeApplied: boolean;
}

/**
 * Approve a correction that includes a NEW PHOTO and publish it live.
 *
 * Unlike publishApproval (which handles brand-new submissions and has to
 * decide whether to merge or create), a correction always targets an
 * EXISTING mascot — we know exactly which one from `correction.mascot_id`.
 * So this is fundamentally a photo SWAP on that mascot:
 *
 *   1. (idempotency) Re-fetch the correction; bail if it's no longer pending.
 *   2. Download the reporter's photo from the private `submissions` bucket
 *      (resize to max 1600px / JPEG 85, same as submissions).
 *   3. Read mascots.json from GitHub, find the row by id.
 *   4. Point that row's `photo` at `{id}.{ext}` and set has_photo:true.
 *      (Overwrites the existing photo file at the same id-based path.)
 *   5. Optionally apply the reporter's corrected store — but ONLY if they
 *      used the structured store-picker (corrected_store_number is a real
 *      TJ store number we can trust). Free-text name/animal stay manual.
 *   6. Prepend a `photo` event to events.json.
 *   7. One atomic commit (photo + mascots.json + events.json).
 *   8. Mirror the photo into the public `mascot-photos` bucket, delete the
 *      private original, and mark the correction `resolved`.
 *
 * Throws on any hard failure so the admin UI can surface it; the
 * idempotency guard means a retry click is safe.
 */
export function publishCorrectionPhoto(args: {
  pat: string;
  sb: SupabaseClient;
  correction: PendingCorrection;
  /** Pass true to apply correction.corrected_store_number (structured pick). */
  applySuggestedStore?: boolean;
}): Promise<CorrectionPublishResult> {
  // Serialized with all other publishes — see publishChain above.
  return serialized(() => publishCorrectionPhotoInner(args));
}

async function publishCorrectionPhotoInner(args: {
  pat: string;
  sb: SupabaseClient;
  correction: PendingCorrection;
  applySuggestedStore?: boolean;
}): Promise<CorrectionPublishResult> {
  const { pat, sb, correction, applySuggestedStore } = args;

  if (!correction.photo_path) {
    throw new Error('This correction has no photo to publish.');
  }

  // ---------- 1. Idempotency guard ----------------------------------
  const { data: fresh, error: fetchErr } = await sb
    .from('corrections')
    .select('status')
    .eq('id', correction.id)
    .single();
  if (fetchErr) throw new Error(`failed to refetch correction: ${fetchErr.message}`);
  if (fresh.status !== 'pending') {
    throw new Error('This correction was already handled (refresh the page).');
  }

  // ---------- 2. Download + resize the reporter's photo -------------
  const { data: blob, error: dlErr } = await sb.storage
    .from('submissions')
    .download(correction.photo_path);
  if (dlErr) throw new Error(`download failed: ${dlErr.message}`);
  const originalExt = (correction.photo_path.split('.').pop() || 'jpg').toLowerCase();
  const resized = await resizeForPublish(blob);
  const finalBlob = resized?.blob ?? blob;
  const photoExt = resized?.ext ?? originalExt;
  const photoBytes = new Uint8Array(await finalBlob.arrayBuffer());

  // ---------- 3–7. Read repo state, swap photo, commit (atomic) -----
  // Same rebuild-callback pattern as publishApproval: everything that
  // depends on current repo state runs inside `buildCommit`, so a lost
  // commit race re-reads fresh state instead of overwriting whatever
  // landed in between.
  const today = new Date().toISOString().slice(0, 10);
  const photoFilename = `${correction.mascot_id}.${photoExt}`;
  const photoPath = `${REPO_PATHS.photosDir}/${photoFilename}`;
  let storeApplied = false;

  const buildCommit = async (): Promise<{
    files: Array<{ path: string; content: Uint8Array | string }>;
    message: string;
  }> => {
    const jsonText = await readFileFromMain(pat, REPO_PATHS.mascotsJson);
    const fileObj = JSON.parse(jsonText) as MascotsFile;
    const mascot = fileObj.mascots.find((m) => m.id === correction.mascot_id);
    if (!mascot) {
      throw new Error(
        `Mascot #${correction.mascot_id} not found in mascots.json — it may have been removed.`,
      );
    }

    // ----- Swap the photo -----
    mascot.photo = photoFilename;
    mascot.has_photo = true;

    // ----- Optionally apply the suggested store -----
    storeApplied = false;
    if (applySuggestedStore && correction.corrected_store_number) {
      mascot.store_number = correction.corrected_store_number;
      storeApplied = true;
    }

    // ----- events.json entry (best-effort) -----
    let updatedEventsJson: string | null = null;
    let eventsText: string | null = null;
    try {
      eventsText = await readFileFromMain(pat, REPO_PATHS.eventsJson);
    } catch {
      // events.json missing — skip
    }
    if (eventsText) {
      try {
        const ev = JSON.parse(eventsText) as EventsFile;
        if (!Array.isArray(ev.events)) throw new Error('.events is not an array');
        const label = mascot.name?.trim()
          ? `${mascot.name.trim()} the ${(mascot.animal || 'mascot').toLowerCase()}`
          : `the ${(mascot.animal || 'mascot').toLowerCase()}`;
        const summaryBits = [`New photo for ${label}`];
        if (storeApplied) summaryBits.push('(store corrected)');
        const event: FeedEvent = {
          date: today,
          kind: 'photo',
          mascot_id: mascot.id,
          summary: summaryBits.join(' '),
          reason: correction.details?.trim()
            ? `Community correction: ${correction.details.replace(/\s+/g, ' ').trim().slice(0, 200)}`
            : 'Community-submitted replacement photo, approved via admin.',
        };
        if (mascot.store_number) event.store_number = mascot.store_number;
        ev.events.unshift(event);
        updatedEventsJson = JSON.stringify(ev, null, 2) + '\n';
      } catch (e) {
        console.warn(
          '[auto-publish] correction events.json parse failed — skipping entry:',
          e instanceof Error ? e.message : String(e),
        );
      }
    }

    const updatedJson = JSON.stringify(fileObj, null, 2) + '\n';
    const files: Array<{ path: string; content: Uint8Array | string }> = [
      { path: REPO_PATHS.mascotsJson, content: updatedJson },
      { path: photoPath, content: photoBytes },
    ];
    if (updatedEventsJson) {
      files.push({ path: REPO_PATHS.eventsJson, content: updatedEventsJson });
    }
    return {
      files,
      message: `Update photo for mascot #${mascot.id} (community correction)`,
    };
  };

  const firstBuild = await buildCommit();
  const commitSha = await commitFilesAtomic(
    pat,
    firstBuild.files,
    firstBuild.message,
    buildCommit,
  );

  // ---------- 8. Mirror to public bucket, clean up, mark resolved --
  const mirrorBlob = new Blob([photoBytes.slice().buffer as ArrayBuffer], {
    type: contentTypeFor(photoExt),
  });
  const { error: upErr } = await sb.storage
    .from('mascot-photos')
    .upload(photoFilename, mirrorBlob, {
      contentType: contentTypeFor(photoExt),
      upsert: true,
    });
  if (upErr) {
    console.warn('[auto-publish] correction mascot-photos mirror failed:', upErr.message);
  }
  // Remove the reporter's original from the private bucket.
  await sb.storage.from('submissions').remove([correction.photo_path]);

  // Mark the correction resolved (retry a few times).
  let updErr: { message: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await sb
      .from('corrections')
      .update({
        status: 'resolved',
        reviewed_at: new Date().toISOString(),
        admin_notes: `Photo published to mascot ${correction.mascot_id}${
          storeApplied ? ' (store corrected)' : ''
        }. Commit ${commitSha.slice(0, 7)}.`,
      })
      .eq('id', correction.id);
    if (!result.error) {
      updErr = null;
      break;
    }
    updErr = result.error;
    await new Promise((r) => setTimeout(r, 300 + attempt * 500));
  }
  if (updErr) {
    console.warn('[auto-publish] correction status update failed:', updErr.message);
  }

  if (!(await existsOnMain(pat, photoPath))) {
    console.warn(
      `[auto-publish] post-commit check: ${photoPath} not visible on main yet (cache lag).`,
    );
  }

  return { mascotId: correction.mascot_id, photoFilename, commitSha, storeApplied };
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
