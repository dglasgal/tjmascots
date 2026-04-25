import type { MetadataRoute } from 'next';

const SITE_URL = 'https://tjmascots.com';

/**
 * Tells search engines what they can and can't crawl. Since the whole point
 * of TJ Mascots is to be findable, we allow everything by default and just
 * point at the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
