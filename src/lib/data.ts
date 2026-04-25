/**
 * Data provider. Reads from Supabase when env vars are set, otherwise falls back
 * to the static JSON files bundled with the repo.
 *
 * This indirection lets us:
 *  1. Ship today with the seed dataset (no backend needed).
 *  2. Swap in live Supabase-backed data with no component changes.
 */
import type { Mascot, Store } from './types';
import { emojiForAnimal } from './emoji';
import { getSupabase } from './supabase';
import localMascotsRaw from '@/data/mascots.json';
import localStores from '@/data/tj-stores.json';

interface LocalMascot {
  id: number;
  name: string;
  animal: string;
  store: string;
  state: string;
  notes: string;
  photo: string | null;
  has_photo: boolean;
  retired?: boolean;
  source_url: string;
  lat?: number;
  lng?: number;
  /** Optional exact store number pin. When set, wins over fuzzy matching —
   *  useful when multiple stores share a city (e.g. Oakland has Lakeshore & Rockridge). */
  store_number?: string;
}

function enrichWithEmoji(m: LocalMascot, storeMatch?: Store): Mascot {
  return {
    id: m.id,
    name: m.name || '',
    animal: m.animal || '',
    store: m.store || '',
    state: m.state || '',
    notes: m.notes || '',
    photo: m.has_photo ? m.photo : null,
    has_photo: Boolean(m.has_photo),
    source_url: m.source_url || '',
    lat: storeMatch?.lat ?? m.lat ?? 39.5,
    lng: storeMatch?.lng ?? m.lng ?? -98.5,
    street: storeMatch?.street,
    zip: storeMatch?.zip,
    store_number: storeMatch?.store_number ?? null,
    emoji: emojiForAnimal(m.animal),
  };
}

function matchStore(mascot: LocalMascot, stores: Store[]): Store | undefined {
  // Explicit pin wins over fuzzy matching.
  if (mascot.store_number) {
    const pinned = stores.find((s) => s.store_number === mascot.store_number);
    if (pinned) return pinned;
  }
  if (!mascot.state) return undefined;
  const candidates = stores.filter((s) => s.state === mascot.state);
  if (!candidates.length) return undefined;

  const mascotTokens = new Set(
    (mascot.store || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean),
  );
  const zipInMascot = [...mascotTokens].find((t) => /^\d{5}$/.test(t));

  let best: { score: number; store?: Store } = { score: 0 };
  for (const s of candidates) {
    let score = 0;
    const cityLower = s.city.toLowerCase();
    if ((mascot.store || '').toLowerCase().includes(cityLower)) score += 5;
    const cityTokens = new Set(cityLower.split(/\s+/));
    if ([...cityTokens].some((t) => mascotTokens.has(t))) score += 3;
    const streetTokens = new Set(s.street.toLowerCase().split(/\s+/));
    if ([...streetTokens].some((t) => t.length > 3 && mascotTokens.has(t))) score += 2;
    if (zipInMascot && s.zip === zipInMascot) score += 10;
    if (score > best.score) best = { score, store: s };
  }
  return best.store;
}

export async function getStores(): Promise<Store[]> {
  return localStores as Store[];
}

export async function getMascots(): Promise<Mascot[]> {
  // Source of truth: the local JSON file that David edits directly.
  // (Supabase is kept around for user submissions / form writes, but reads
  // at build time come from the repo so updates land with a commit + push.)
  const stores = await getStores();
  const raw = (localMascotsRaw as { mascots: LocalMascot[] }).mascots || [];
  return raw
    .filter((m) => !m.retired)
    .map((m) => enrichWithEmoji(m, matchStore(m, stores)));
}

/** Retired / historical mascots — not shown as pins on the map, but surfaced
 *  in the "Previous mascots at this store" section of each store card. */
export async function getPreviousMascots(): Promise<Mascot[]> {
  const stores = await getStores();
  const raw = (localMascotsRaw as { mascots: LocalMascot[] }).mascots || [];
  return raw
    .filter((m) => m.retired === true)
    .map((m) => enrichWithEmoji(m, matchStore(m, stores)));
}

/** Build a public URL for a mascot photo given its filename.
 *  Photos are bundled with the site under /public/photos/ and served from
 *  the static CDN. (The Supabase `mascot-photos` bucket is reserved for
 *  future user-submitted photos once a moderator approves them.) */
export function photoUrl(photoFilename: string | null): string | null {
  if (!photoFilename) return null;
  return `/photos/${photoFilename}`;
}

export interface SubmissionInput {
  store: string;
  /** Exact TJ store_number — captured by the StorePicker so we never
   *  ambiguously place a submission in the wrong city/store. */
  store_number?: string;
  animal: string;
  name?: string;
  email?: string;
  notes?: string;
  photoFile?: File;
}

export interface CorrectionInput {
  mascot_id: number;
  mascot_name?: string;
  store?: string;
  issues: string[];
  details?: string;
  reporter_email?: string;
  /** When the user picks "store/location is wrong" they can use the picker to
   *  tell us the actual correct TJ store. */
  corrected_store_number?: string;
}

/** Submits a correction report for an existing mascot to the Supabase
 *  `corrections` table. Anyone can INSERT (open RLS), but only David can
 *  read via the dashboard — no email is sent.
 *
 *  Resilience:
 *   - Retries up to 3 times with exponential backoff against Supabase blips.
 *   - On total failure, the report is queued in localStorage and retried
 *     next time the user loads the page. No report is lost to a transient
 *     database outage. */
export async function submitCorrection(
  input: CorrectionInput,
): Promise<{ ok: true; queued?: boolean } | { ok: false; error: string }> {
  const sb = getSupabase();
  if (!sb) {
    console.info('[prototype] correction received (Supabase not configured):', input);
    return { ok: true };
  }
  try {
    await retryInsert(() =>
      sb.from('corrections').insert({
        mascot_id: input.mascot_id,
        mascot_name: input.mascot_name || null,
        store: input.store || null,
        issues: input.issues,
        details: input.details || null,
        reporter_email: input.reporter_email || null,
        corrected_store_number: input.corrected_store_number || null,
      }),
    );
    return { ok: true };
  } catch (e) {
    console.error('[data] submitCorrection failed after retries. Raw:', e);
    // Last-ditch: queue it in localStorage so nothing is lost.
    const queued = queueCorrectionForLater(input);
    if (queued) return { ok: true, queued: true };
    return { ok: false, error: extractErrorMessage(e) };
  }
}

/** Run a Supabase insert with exponential backoff. Throws the last error
 *  if all attempts fail. The `op` closure returns a thenable — we let TypeScript
 *  infer anything with an .error property so the Supabase builder type fits. */
async function retryInsert(
  op: () => PromiseLike<{ error: unknown }>,
  attempts = 3,
): Promise<void> {
  const delays = [0, 1000, 3000, 7000]; // 1st try = 0 delay, then 1s, 3s, 7s
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
    try {
      const { error } = await op();
      if (!error) return;
      lastErr = error;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

const QUEUE_KEY = 'tjmascots:pending-corrections';

interface QueuedCorrection extends CorrectionInput {
  __queued_at: number;
}

/** Save a failed correction to localStorage so we can retry later.
 *  Returns true if queued. */
function queueCorrectionForLater(input: CorrectionInput): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    const queue: QueuedCorrection[] = raw ? JSON.parse(raw) : [];
    queue.push({ ...input, __queued_at: Date.now() });
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return true;
  } catch (e) {
    console.warn('[data] failed to queue correction:', e);
    return false;
  }
}

/** Drains the offline queue in the background. Safe to call on every
 *  page load — if there's nothing queued, it's a no-op. */
export async function flushQueuedCorrections(): Promise<void> {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const sb = getSupabase();
  if (!sb) return;
  let queue: QueuedCorrection[];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return;
    queue = JSON.parse(raw);
  } catch {
    return;
  }
  if (!queue.length) return;
  console.info(`[data] retrying ${queue.length} queued correction(s)…`);
  const remaining: QueuedCorrection[] = [];
  for (const item of queue) {
    try {
      const { error } = await sb.from('corrections').insert({
        mascot_id: item.mascot_id,
        mascot_name: item.mascot_name || null,
        store: item.store || null,
        issues: item.issues,
        details: item.details || null,
        reporter_email: item.reporter_email || null,
        corrected_store_number: item.corrected_store_number || null,
      });
      if (error) {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }
  if (remaining.length) {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    console.info(`[data] ${remaining.length} correction(s) still queued.`);
  } else {
    window.localStorage.removeItem(QUEUE_KEY);
    console.info('[data] queue drained.');
  }
}

/** Pull a useful human-readable message out of any error-shaped value.
 *  Handles Supabase PostgrestError (plain object with .message/.details/.hint). */
function extractErrorMessage(e: unknown): string {
  if (!e) return 'unknown';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  if (typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    const parts = [obj.message, obj.details, obj.hint, obj.code]
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (parts.length) return parts.join(' — ');
    try {
      return JSON.stringify(e);
    } catch {
      return 'unknown';
    }
  }
  return String(e);
}

export async function submitMascot(
  submission: SubmissionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getSupabase();
  if (!sb) {
    console.info('[prototype] submission received (Supabase not configured):', submission);
    return { ok: true };
  }

  try {
    // 1. Upload photo (if provided) to the private `submissions` bucket.
    let photoPath: string | null = null;
    if (submission.photoFile) {
      const ext = submission.photoFile.name.split('.').pop() || 'jpg';
      const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
      const filename = `pending/${crypto.randomUUID()}.${safeExt}`;
      const { error: uploadErr } = await sb.storage
        .from('submissions')
        .upload(filename, submission.photoFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: submission.photoFile.type || 'image/jpeg',
        });
      if (uploadErr) throw uploadErr;
      photoPath = filename;
    }

    // 2. Insert the submission row.
    const { error: insertErr } = await sb.from('submissions').insert({
      store: submission.store,
      store_number: submission.store_number || null,
      animal: submission.animal,
      name: submission.name || null,
      email: submission.email || null,
      notes: submission.notes || null,
      photo_path: photoPath,
    });
    if (insertErr) throw insertErr;

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('[data] submitMascot failed:', msg);
    return { ok: false, error: msg };
  }
}
