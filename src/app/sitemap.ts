import type { MetadataRoute } from 'next';
import mascotsRaw from '@/data/mascots.json';
import { slugForAnimal, slugForCity, slugForMascot, spotterSlugMap } from '@/lib/slug';
import storesData from '@/data/tj-stores.json';
import type { Store } from '@/lib/types';
import { stateSlug, statesWithMascots } from '@/lib/state';
import { SITE_URL } from '@/lib/site-url';
import { mascotLastMod, mascotsLastMod, siteLastMod, storesLastMod } from '@/lib/lastmod';
import { slugForStore, storesWithoutMascot } from '@/lib/store-pages';

// Required for static export (output: 'export' in next.config.js)
export const dynamic = 'force-static';

interface RawMascot {
  id: number;
  name: string;
  animal: string;
  store: string;
  state: string;
  store_number?: string;
  retired?: boolean;
  submitted_by?: string | null;
}

/**
 * Sitemap for search engines. Lists the static landing pages, every
 * per-mascot page, the state/city/animal/spotter browse pages, and a
 * page for every store that doesn't have a mascot yet.
 * Retired mascots aren't included — they'd 404.
 *
 * lastModified comes from src/lib/lastmod.ts (real content dates), NOT
 * the build time. Pages with no data-driven date get no lastModified.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const activeMascots = (mascotsRaw as { mascots: RawMascot[] }).mascots.filter(
    (m) => !m.retired,
  );
  const stores = storesData as Store[];
  const siteDay = siteLastMod();
  const allMascotsDay = mascotsLastMod(activeMascots.map((m) => m.id));

  const spotterIds = new Map<string, number[]>();
  const nameToSlug = spotterSlugMap(activeMascots);
  for (const m of activeMascots) {
    const slug = m.submitted_by ? nameToSlug.get(m.submitted_by.trim()) : undefined;
    if (!slug) continue;
    if (!spotterIds.has(slug)) spotterIds.set(slug, []);
    spotterIds.get(slug)!.push(m.id);
  }

  const entry = (
    path: string,
    lastModified: Date | undefined,
    changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>,
    priority: number,
  ): MetadataRoute.Sitemap[number] => {
    // trailingSlash: true in next.config.js, so every page's canonical
    // address ends in "/". The sitemap must list that exact form.
    const url = `${SITE_URL}${path.endsWith('/') ? path : `${path}/`}`;
    return lastModified
      ? { url, lastModified, changeFrequency, priority }
      : { url, changeFrequency, priority };
  };

  return [
    entry('/', siteDay, 'daily', 1.0),
    entry('/about', undefined, 'monthly', 0.7),
    entry('/recent', siteDay, 'daily', 0.8),
    entry('/privacy', undefined, 'yearly', 0.3),
    entry('/data', allMascotsDay, 'monthly', 0.4),
    entry('/faq', undefined, 'monthly', 0.6),
    entry('/animal', allMascotsDay, 'weekly', 0.6),
    // Per-mascot SEO pages
    ...activeMascots.map((m) =>
      entry(`/mascot/${slugForMascot(m)}`, mascotLastMod(m.id), 'monthly', 0.6),
    ),
    // Per-state browse pages (one per state with at least one mascot)
    ...statesWithMascots(activeMascots).map((code) =>
      entry(
        `/state/${stateSlug(code)}`,
        mascotsLastMod(activeMascots.filter((m) => m.state === code).map((m) => m.id)),
        'weekly',
        0.7,
      ),
    ),
    // Per-spotter Hall of Fame pages
    ...[...spotterIds.entries()].map(([slug, ids]) =>
      entry(`/spotter/${slug}`, mascotsLastMod(ids), 'monthly', 0.5),
    ),
    // Per-city pages (only for cities with 2+ TJ stores)
    ...multiStoreCities(stores).map((c) =>
      entry(
        `/city/${slugForCity(c.city, c.state)}`,
        storesLastMod(c.storeNumbers),
        'weekly',
        0.65,
      ),
    ),
    // Per-animal browse pages (one per unique animal, including singletons)
    ...allAnimals(activeMascots).map((animal) =>
      entry(
        `/animal/${slugForAnimal(animal)}`,
        mascotsLastMod(
          activeMascots.filter((m) => (m.animal || '').trim() === animal).map((m) => m.id),
        ),
        'weekly',
        0.6,
      ),
    ),
    // Per-store pages, only for stores with no mascot yet (stores that have
    // one point search engines at the mascot page instead).
    ...storesWithoutMascot().map((s) =>
      entry(`/store/${slugForStore(s)}`, storesLastMod([s.store_number]), 'monthly', 0.5),
    ),
  ];
}

/** Every unique animal gets its own /animal/{slug} page. */
function allAnimals(active: RawMascot[]): string[] {
  const seen = new Set<string>();
  for (const m of active) {
    const a = (m.animal || '').trim();
    if (a) seen.add(a);
  }
  return [...seen];
}

/** Cities with 2+ TJ stores get their own /city/{slug} pages. */
function multiStoreCities(
  stores: Store[],
): { city: string; state: string; storeNumbers: string[] }[] {
  const byCity = new Map<string, { city: string; state: string; storeNumbers: string[] }>();
  for (const s of stores) {
    const key = `${s.city}|${s.state}`;
    const cur = byCity.get(key);
    if (cur) cur.storeNumbers.push(s.store_number);
    else byCity.set(key, { city: s.city, state: s.state, storeNumbers: [s.store_number] });
  }
  return [...byCity.values()].filter((v) => v.storeNumbers.length >= 2);
}
