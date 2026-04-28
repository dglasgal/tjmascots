import type { MetadataRoute } from 'next';

/**
 * PWA manifest — lets visitors install TJ Mascots as an app from
 * their phone's home screen ("Add to Home Screen" on iOS, install
 * prompt on Android Chrome). Works alongside our existing favicon
 * and apple-touch-icon.
 *
 * No service worker yet — the site is already a static export so
 * load times are fast, and offline support doesn't add much for a
 * map of physical TJ stores you'd be walking into.
 */

// REQUIRED for `output: 'export'` in next.config — without this, Next refuses
// to bake the manifest at build time and the deploy fails. The manifest is
// fully static; nothing in it changes per-request.
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TJ Mascots — the unofficial map of every Trader Joe's store mascot",
    short_name: 'TJ Mascots',
    description:
      "An unofficial fan map of every Trader Joe's hidden store mascot across the U.S.",
    start_url: '/',
    display: 'standalone',
    background_color: '#fdf6ec', // matches --cream
    theme_color: '#C8102E', // matches --tj-red
    orientation: 'portrait',
    categories: ['shopping', 'lifestyle', 'travel'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
