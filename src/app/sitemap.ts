import type { MetadataRoute } from 'next';
import mascotsRaw from '@/data/mascots.json';
import { slugForAnimal, slugForCity, slugForMascot, spotterSlugMap } from '@/lib/slug';
import storesData from '@/data/tj-stores.json';
import type { Store } from '@/lib/types';
import { stateSlug, statesWithMascots } from '@/lib/state';
import { SITE_URL } from '@/lib/site-url';

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
 * Sitemap for search engines. Lists the static landing pages plus every
 * per-mascot SEO page (one URL per active mascot, ~284 of them today).
 * Retired mascots aren't included — they'd 404.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const activeMascots = (mascotsRaw as { mascots: RawMascot[] }).mascots.filter(
    (m) => !m.retired,
  );

  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/recent`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/data`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/animal`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    // Per-mascot SEO pages
    ...activeMascots.map((m) => ({
      url: `${SITE_URL}/mascot/${slugForMascot(m)}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    // Per-state browse pages (one per state with at least one mascot)
    ...statesWithMascots(activeMascots).map((code) => ({
      url: `${SITE_URL}/state/${stateSlug(code)}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    // Per-spotter Hall of Fame pages
    ...Array.from(spotterSlugMap(activeMascots).values()).map((slug) => ({
      url: `${SITE_URL}/spotter/${slug}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    // Per-city pages (only for cities with 2+ TJ stores)
    ...multiStoreCitySlugs().map((slug) => ({
      url: `${SITE_URL}/city/${slug}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.65,
    })),
    // Per-animal browse pages (only animals with 2+ mascots)
    ...multiMascotAnimalSlugs(activeMascots).map((slug) => ({
      url: `${SITE_URL}/animal/${slug}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}

/** Animals with 2+ mascots get their own /animal/{slug} page. */
function multiMascotAnimalSlugs(active: RawMascot[]): string[] {
  const counts = new Map<string, number>();
  for (const m of active) {
    const a = (m.animal || '').trim();
    if (!a) continue;
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .map(([animal]) => slugForAnimal(animal));
}

/** Cities with 2+ TJ stores get their own /city/{slug} pages. */
function multiStoreCitySlugs(): string[] {
  const stores = storesData as Store[];
  const counts = new Map<string, { count: number; city: string; state: string }>();
  for (const s of stores) {
    const key = `${s.city}|${s.state}`;
    const cur = counts.get(key);
    if (cur) cur.count++;
    else counts.set(key, { count: 1, city: s.city, state: s.state });
  }
  return [...counts.values()]
    .filter((v) => v.count >= 2)
    .map((v) => slugForCity(v.city, v.state));
}
