/**
 * Canonical site URL — the absolute base every "tell the world about
 * this URL" piece (Open Graph image, canonical link, sitemap.xml,
 * JSON-LD) uses.
 *
 * Configurable via env var so we can keep working *before* DNS migrates
 * to tjmascots.com:
 *
 *   - Until DNS migration:  NEXT_PUBLIC_SITE_URL = 'https://dolphin-app-aj5qf.ondigitalocean.app'
 *   - After DNS migration:  NEXT_PUBLIC_SITE_URL = 'https://tjmascots.com'
 *
 * Default fallback is the production domain so prod-after-migration
 * still does the right thing if the env var is dropped accidentally.
 *
 * IMPORTANT: never use a trailing slash here. Every consumer expects
 * to append `/path` — a trailing slash would double up.
 */
export const SITE_URL: string = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://tjmascots.com'
).replace(/\/$/, '');
