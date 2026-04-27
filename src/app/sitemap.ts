import type { MetadataRoute } from 'next';
import mascotsRaw from '@/data/mascots.json';
import { slugForMascot } from '@/lib/slug';

// Required for static export (output: 'export' in next.config.js)
export const dynamic = 'force-static';

const SITE_URL = 'https://tjmascots.com';

interface RawMascot {
  id: number;
  name: string;
  animal: string;
  store: string;
  store_number?: string;
  retired?: boolean;
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
    // Per-mascot SEO pages
    ...activeMascots.map((m) => ({
      url: `${SITE_URL}/mascot/${slugForMascot(m)}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
