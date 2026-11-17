/**
 * Helpers for the per-store pages at /store/{slug} (added 2026-11-16).
 *
 * Every Trader Joe's gets a page so a search like "Trader Joe's mascot
 * Spokane Valley" has somewhere to land, even before anyone has spotted
 * the mascot. Rules:
 *   - A page is built for EVERY store, so its address never 404s later.
 *   - Stores WITH an active mascot point their canonical link at the
 *     mascot's page and are left out of the sitemap (the mascot page is
 *     the one we want in search results).
 *   - Stores WITHOUT a mascot are self-canonical and listed in the sitemap.
 *
 * Slug: {city}-{state}-{store_number}, e.g. spokane-valley-wa-296.
 */
import mascotsRaw from '@/data/mascots.json';
import storesData from '@/data/tj-stores.json';
import type { Store } from './types';
import { slugForCity } from './slug';

export interface StorePageMascot {
  id: number;
  name: string;
  animal: string;
  store: string;
  state: string;
  notes: string;
  photo: string | null;
  has_photo: boolean;
  retired?: boolean;
  store_number?: string;
}

export const allStores = storesData as Store[];
export const activeMascots = (mascotsRaw as { mascots: StorePageMascot[] }).mascots.filter(
  (m) => !m.retired,
);

export function slugForStore(s: Pick<Store, 'city' | 'state' | 'store_number'>): string {
  return `${slugForCity(s.city, s.state)}-${s.store_number}`;
}

export function findStoreBySlug(slug: string): Store | null {
  return allStores.find((s) => slugForStore(s) === slug) ?? null;
}

/**
 * Active mascots at a store, lead first. Same order as the map:
 * mascot with a photo first, then lowest id.
 */
export function mascotsAtStore(storeNumber: string): StorePageMascot[] {
  return activeMascots
    .filter((m) => m.store_number === storeNumber)
    .sort((a, b) => Number(b.has_photo) - Number(a.has_photo) || a.id - b.id);
}

/** Stores with no active mascot — the ones whose page goes in the sitemap. */
export function storesWithoutMascot(): Store[] {
  const withMascot = new Set(activeMascots.map((m) => m.store_number).filter(Boolean));
  return allStores.filter((s) => !withMascot.has(s.store_number));
}

export function cityStoreCount(s: Pick<Store, 'city' | 'state'>): number {
  return allStores.filter((x) => x.city === s.city && x.state === s.state).length;
}

function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** The closest stores that DO have a known mascot, nearest first. */
export function nearestMascotStores(
  origin: Store,
  limit = 4,
): { store: Store; mascot: StorePageMascot; miles: number }[] {
  const out: { store: Store; mascot: StorePageMascot; miles: number }[] = [];
  for (const s of allStores) {
    if (s.store_number === origin.store_number) continue;
    const lead = mascotsAtStore(s.store_number)[0];
    if (!lead) continue;
    out.push({ store: s, mascot: lead, miles: milesBetween(origin.lat, origin.lng, s.lat, s.lng) });
  }
  return out.sort((a, b) => a.miles - b.miles).slice(0, limit);
}
