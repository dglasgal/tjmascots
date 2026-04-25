import type { MetadataRoute } from 'next';

const SITE_URL = 'https://tjmascots.com';

/**
 * Lists every page on the site so search engines know where to look. The map
 * itself is a single page (the mascot detail panes don't have their own URLs),
 * so this is short by design — homepage, about, privacy.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
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
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
