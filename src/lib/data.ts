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
  animal: string;
  name?: string;
  email?: string;
  notes?: string;
  photoFile?: File;
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
