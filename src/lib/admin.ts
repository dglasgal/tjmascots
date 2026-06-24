/**
 * Admin helpers — used only by the /admin moderation dashboard.
 *
 * The admin authenticates by pasting their Supabase **service_role** key
 * (sb_secret_*) once. We store it in localStorage and use it to talk to
 * Supabase as a privileged user. The service_role key bypasses RLS, so the
 * dashboard can read submissions and corrections (which are write-only to
 * the public anon role).
 *
 * The key NEVER appears in the deployed JS bundle — it only enters via the
 * admin's browser at runtime.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'tjmascots:admin-key';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export interface PendingSubmission {
  id: string;
  store: string;
  store_number: string | null;
  animal: string;
  name: string | null;
  email: string | null;
  notes: string | null;
  photo_path: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  /** EXIF GPS verification fields. Null when no photo, no EXIF, or
   *  the columns haven't been migrated into Supabase yet. */
  photo_lat: number | null;
  photo_lng: number | null;
  photo_distance_m: number | null;
  photo_location_status: 'match' | 'mismatch' | 'no_gps' | 'error' | null;
}

export interface PendingCorrection {
  id: string;
  mascot_id: number;
  mascot_name: string | null;
  store: string | null;
  issues: string[];
  details: string | null;
  reporter_email: string | null;
  corrected_store_number: string | null;
  status: 'pending' | 'resolved' | 'dismissed';
  admin_notes: string | null;
  created_at: string;
  /** Path in the private `submissions` bucket to a reporter-supplied photo
   *  (when they picked "I have a new/better photo"), or null. */
  photo_path: string | null;
}

export interface PendingMessage {
  id: string;
  message: string;
  reply_to: string | null;
  status: 'pending' | 'resolved' | 'dismissed';
  admin_notes: string | null;
  created_at: string;
}

/** localStorage helpers for the admin key. */
export function getAdminKey(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}
export function setAdminKey(key: string): void {
  window.localStorage.setItem(STORAGE_KEY, key);
}
export function clearAdminKey(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Build a privileged Supabase client using the admin key from localStorage.
 *  Returns null if no key is set or env vars are missing. */
export function getAdminClient(): SupabaseClient | null {
  const key = getAdminKey();
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

/** Verify the admin key works (it should be able to SELECT from submissions). */
export async function verifyAdminKey(key: string): Promise<{ ok: boolean; error?: string }> {
  if (!SUPABASE_URL) return { ok: false, error: 'Supabase URL not configured.' };
  const sb = createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
  const { error } = await sb.from('submissions').select('id').limit(1);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function listPendingSubmissions(sb: SupabaseClient): Promise<PendingSubmission[]> {
  const { data, error } = await sb
    .from('submissions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PendingSubmission[];
}

export async function listPendingCorrections(sb: SupabaseClient): Promise<PendingCorrection[]> {
  const { data, error } = await sb
    .from('corrections')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PendingCorrection[];
}

export async function listPendingMessages(sb: SupabaseClient): Promise<PendingMessage[]> {
  const { data, error } = await sb
    .from('messages')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PendingMessage[];
}

/** Get a temporary signed URL for a private submissions-bucket object. */
export async function signedSubmissionUrl(
  sb: SupabaseClient,
  path: string,
): Promise<string | null> {
  const { data, error } = await sb.storage.from('submissions').createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

/**
 * Resize a photo blob for publishing — max 1600px on the long edge,
 * re-encoded as JPEG quality 85. Same target as the May 2026 bulk-cleanup
 * script that recovered ~200 MB after a DigitalOcean build timed out
 * trying to clone the bloated repo.
 *
 * Returns null on any failure (codec unsupported, canvas blocked, etc.)
 * so the caller can fall back to uploading the original bytes — an
 * approval should never break because of a resize hiccup.
 */
export async function resizeForPublish(
  blob: Blob,
  maxEdge = 1600,
  quality = 0.85,
): Promise<{ blob: Blob; ext: 'jpg' } | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    // Don't upscale: if the photo is already smaller than maxEdge, leave it.
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!out) return null;
    return { blob: out, ext: 'jpg' };
  } catch (e) {
    console.warn('[admin] resizeForPublish failed, will upload original:', e);
    return null;
  }
}

/** Approve a submission:
 *   1. Move the photo from the private `submissions` bucket to the public
 *      `mascot-photos` bucket, renaming to `{newId}.{ext}` and resizing
 *      to max 1600px / JPEG quality 85 so giant phone photos don't bloat
 *      the repo (see resizeForPublish above).
 *   2. Mark the row approved and stash the new mascot id in admin_notes.
 *   3. Return a JSON snippet the admin can paste into mascots.json. */
export async function approveSubmission(
  sb: SupabaseClient,
  submission: PendingSubmission,
  newMascotId: number,
  storeMatch?: { city: string; state: string; store_number: string },
): Promise<{ photoFilename: string | null; jsonSnippet: object }> {
  let photoFilename: string | null = null;

  if (submission.photo_path) {
    const originalExt = (submission.photo_path.split('.').pop() || 'jpg').toLowerCase();
    // 1a. Download from private bucket
    const { data: blob, error: dlErr } = await sb.storage
      .from('submissions')
      .download(submission.photo_path);
    if (dlErr) throw new Error(`download failed: ${dlErr.message}`);

    // 1b. Resize/re-encode for the public bucket. Falls back to the
    //     original bytes if the browser can't handle it — approval
    //     should never break because of a resize hiccup.
    const resized = await resizeForPublish(blob);
    const toUpload: Blob = resized?.blob ?? blob;
    const finalExt = resized?.ext ?? originalExt;
    photoFilename = `${newMascotId}.${finalExt}`;

    // 1c. Upload to public bucket under mascot id
    const { error: upErr } = await sb.storage
      .from('mascot-photos')
      .upload(photoFilename, toUpload, {
        contentType: toUpload.type || 'image/jpeg',
        upsert: true,
      });
    if (upErr) throw new Error(`upload failed: ${upErr.message}`);
    // 1d. Delete from private bucket
    await sb.storage.from('submissions').remove([submission.photo_path]);
  }

  // 2. Mark approved.
  //    `approved_mascot_id` is what the submitter-thank-you email trigger
  //    reads to build a deep-link back to the live mascot pin
  //    (e.g. /?mascot=217). Without this column set, the email's
  //    "See your mascot live" button would just go to the homepage.
  const { error: updErr } = await sb
    .from('submissions')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      admin_notes: `Mapped to mascot id ${newMascotId}${
        photoFilename ? ` with photo ${photoFilename}` : ''
      }`,
      approved_mascot_id: newMascotId,
    })
    .eq('id', submission.id);
  if (updErr) throw new Error(`status update failed: ${updErr.message}`);

  // 3. Generate JSON snippet
  // For the leaderboard, derive a display name from the email (e.g.
  // "jason.dawson@gmail.com" → "Jason D."). Only set when the submitter
  // gave an email — anonymous submissions stay blank.
  const submittedBy = submission.email ? deriveDisplayName(submission.email) : null;

  const jsonSnippet = {
    id: newMascotId,
    store: storeMatch ? storeMatch.city : submission.store,
    state: storeMatch?.state ?? '',
    animal: submission.animal,
    name: submission.name ?? '',
    notes: submission.notes ?? '',
    photo: photoFilename,
    has_photo: Boolean(photoFilename),
    retired: false,
    source_url: submittedBy
      ? `User-submitted photo by ${submittedBy} (Trader Joe's ${
          storeMatch ? `${storeMatch.city} #${storeMatch.store_number}` : submission.store
        })`
      : 'User-submitted photo',
    store_number: submission.store_number ?? storeMatch?.store_number ?? null,
    created_at: new Date().toISOString().slice(0, 10),
    submitted_by: submittedBy,
  };
  return { photoFilename, jsonSnippet };
}

/** "jason.dawson@gmail.com" → "Jason D.". Best-effort. */
function deriveDisplayName(email: string): string {
  const local = email.split('@')[0] || '';
  const parts = local.split(/[._\-]/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  if (parts.length === 1) return first;
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}

/** Reject a submission: delete its photo + flip status to rejected. */
export async function rejectSubmission(
  sb: SupabaseClient,
  submission: PendingSubmission,
  reason?: string,
): Promise<void> {
  if (submission.photo_path) {
    await sb.storage.from('submissions').remove([submission.photo_path]);
  }
  const { error } = await sb
    .from('submissions')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      admin_notes: reason ?? null,
    })
    .eq('id', submission.id);
  if (error) throw error;
}

/** Mark a correction resolved or dismissed. */
export async function setCorrectionStatus(
  sb: SupabaseClient,
  correction: PendingCorrection,
  status: 'resolved' | 'dismissed',
  adminNotes?: string,
): Promise<void> {
  const { error } = await sb
    .from('corrections')
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      admin_notes: adminNotes ?? null,
    })
    .eq('id', correction.id);
  if (error) throw error;
}

/** Mark a contact message resolved or dismissed (same shape as
 *  corrections; lets us share UI patterns in the dashboard). */
export async function setMessageStatus(
  sb: SupabaseClient,
  message: PendingMessage,
  status: 'resolved' | 'dismissed',
  adminNotes?: string,
): Promise<void> {
  const { error } = await sb
    .from('messages')
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      admin_notes: adminNotes ?? null,
    })
    .eq('id', message.id);
  if (error) throw error;
}
