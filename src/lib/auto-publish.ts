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
 *   5. Upload the photo bytes to `site/public/photos/{id}.{ext}` in
 *      GitHub.
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
  getRepoFile,
  putRepoBinaryFile,
  putRepoTextFile,
  REPO_PATHS,
} from './github';
import type { PendingSubmission } from './admin';

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
  /** Photo filename inside `site/public/photos/`. */
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

  // ---------- 1. Pull photo bytes from Supabase (if any) ----------
  let photoBytes: Uint8Array | null = null;
  let photoExt = 'jpg';
  if (submission.photo_path) {
    const { data: blob, error } = await sb.storage
      .from('submissions')
      .download(submission.photo_path);
    if (error) throw new Error(`download failed: ${error.message}`);
    photoBytes = new Uint8Array(await blob.arrayBuffer());
    photoExt = (submission.photo_path.split('.').pop() || 'jpg').toLowerCase();
  }

  // ---------- 2. Read mascots.json from GitHub ----------
  const { sha: jsonSha, content: jsonText } = await getRepoFile(
    pat,
    REPO_PATHS.mascotsJson,
  );
  const file = JSON.parse(jsonText) as MascotsFile;

  // ---------- 3. Merge or append ----------
  const merge = findMergeCandidate(file.mascots, submission);
  const submittedBy = submission.email ? deriveDisplayName(submission.email) : null;
  const today = new Date().toISOString().slice(0, 10);
  let mascotId: number;
  let mode: 'merged' | 'created';

  if (merge) {
    mode = 'merged';
    mascotId = merge.id;
    // Update only the fields that changed. Don't clobber the existing
    // store/state/animal/name — those came from the canonical catalog
    // and are usually better than free-text user input.
    merge.has_photo = Boolean(photoBytes);
    merge.photo = photoBytes ? `${mascotId}.${photoExt}` : (merge.photo ?? null);
    if (submittedBy && !merge.submitted_by) merge.submitted_by = submittedBy;
    if (!merge.source_url || merge.source_url.startsWith('https://www.reddit.com')) {
      merge.source_url = `User-submitted (${formatTodayShort()})`;
    }
    if (submission.notes && !merge.notes) merge.notes = submission.notes;
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

  // ---------- 4 + 5. Upload photo first, then JSON ----------
  // Order matters: if JSON shipped first and the build started before the
  // photo arrived, we'd serve a broken image for a few seconds.
  let photoCommitSha: string | null = null;
  if (photoBytes && photoFilename) {
    const photoPath = `${REPO_PATHS.photosDir}/${photoFilename}`;
    // Photo files at this path generally don't exist yet. If one does
    // (very rare — id reused), pick up its sha so the PUT updates it.
    let existingPhotoSha: string | undefined;
    try {
      const existing = await getRepoFile(pat, photoPath);
      existingPhotoSha = existing.sha;
    } catch {
      // 404 — file doesn't exist yet, which is the expected case
    }
    photoCommitSha = await putRepoBinaryFile(
      pat,
      photoPath,
      photoBytes,
      `Add photo for mascot ${mascotId}${
        submission.name ? ` (${submission.name})` : ''
      }`,
      existingPhotoSha,
    );
  }

  // ---------- 6. Push updated mascots.json ----------
  const updatedJson = JSON.stringify(file, null, 2) + '\n';
  const commitMessage =
    mode === 'merged'
      ? `Publish photo for ${displayLabel(submission, mascotId)} (merge)`
      : `Add ${displayLabel(submission, mascotId)} (new entry)`;
  const jsonCommitSha = await putRepoTextFile(
    pat,
    REPO_PATHS.mascotsJson,
    updatedJson,
    commitMessage,
    jsonSha,
  );

  // ---------- 7. Mirror photo into public Supabase bucket + mark approved ----------
  // The public bucket copy keeps the submitter-thank-you email's "see
  // your mascot live" deep-link working in the ~3 min before
  // DigitalOcean finishes redeploying with the new image.
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
      // Non-fatal — the GitHub copy is already canonical. Log and continue.
      // eslint-disable-next-line no-console
      console.warn('[auto-publish] mascot-photos mirror failed:', upErr.message);
    }
    // Best-effort: clear the private bucket copy.
    if (submission.photo_path) {
      await sb.storage.from('submissions').remove([submission.photo_path]);
    }
  }

  const { error: updErr } = await sb
    .from('submissions')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      admin_notes: `Auto-published as mascot ${mascotId} (${mode}). Commit ${jsonCommitSha.slice(0, 7)}.`,
      approved_mascot_id: mascotId,
    })
    .eq('id', submission.id);
  if (updErr) {
    // The mascot is already live in GitHub; the only failure here is the
    // submitter won't get the celebration email. Surface but don't
    // unwind the whole publish.
    // eslint-disable-next-line no-console
    console.warn('[auto-publish] submission status update failed:', updErr.message);
  }

  return {
    mode,
    mascotId,
    photoFilename,
    jsonCommitSha,
    photoCommitSha,
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
