/**
 * Display helpers for naming a Trader Joe's store.
 *
 * Format rules:
 *   • Multi-store city (store has a `neighborhood`):
 *       "Atlanta — Buckhead TJ's"
 *   • Single-store city (no neighborhood):
 *       "Bedford TJ's"
 *
 * The "TJ's" suffix is added everywhere the store/city is shown in
 * the UI so the brand reads consistently. Use these helpers instead
 * of inlining city + neighborhood logic per-page.
 */

import type { Store } from './types';

/**
 * "Atlanta — Buckhead TJ's" / "Bedford TJ's".
 * Pass a partial when you only have the parts (e.g., from mascots.json
 * before joining against tj-stores.json).
 */
export function formatStoreLabel(
  s: Pick<Store, 'city' | 'neighborhood'>,
): string {
  const city = (s.city || '').trim();
  const hood = (s.neighborhood || '').trim();
  if (!city) return hood ? `${hood} TJ's` : `TJ's`;
  if (hood) return `${city} — ${hood} TJ's`;
  return `${city} TJ's`;
}

/**
 * Same as `formatStoreLabel` but **without** the trailing "TJ's" —
 * used in places where the surrounding context already says "Trader
 * Joe's" and a redundant suffix would look silly (e.g., the
 * `<title>` of a page that's already titled "TJ Mascots").
 */
export function formatStoreLocation(
  s: Pick<Store, 'city' | 'neighborhood'>,
): string {
  const city = (s.city || '').trim();
  const hood = (s.neighborhood || '').trim();
  if (!city) return hood;
  if (hood) return `${city} — ${hood}`;
  return city;
}

/**
 * Convenience: produce a store label for a mascot record. When we have
 * a matching Store record (from tj-stores.json), use its city +
 * neighborhood for the canonical formatted label. When we don't (rare
 * — usually free-text submissions before they're geocoded), fall back
 * to the mascot's free-text store field with a "TJ's" suffix.
 */
export function formatMascotStoreLabel(
  mascotStore: string | null | undefined,
  storeRecord: Pick<Store, 'city' | 'neighborhood'> | null | undefined,
): string {
  if (storeRecord && storeRecord.city) {
    return formatStoreLabel(storeRecord);
  }
  const txt = (mascotStore || '').trim();
  if (!txt) return `TJ's`;
  return `${txt} TJ's`;
}
