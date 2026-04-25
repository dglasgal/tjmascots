/**
 * Analytics
 *
 * Privacy-friendly page-view tracking via Umami Cloud (free up to 100K events
 * per month, clean dashboard, shows country + region + city, no cookies, no
 * GDPR consent banner needed).
 *
 * To enable:
 *   1. Sign up at https://cloud.umami.is/signup, add a website (use
 *      "tjmascots.com" as the domain), and copy the website ID it gives
 *      you (a UUID).
 *   2. Set the env var NEXT_PUBLIC_UMAMI_WEBSITE_ID on DigitalOcean App
 *      Platform to that UUID.
 *   3. (Optional) If you self-host Umami, also set NEXT_PUBLIC_UMAMI_SCRIPT_URL
 *      to your script URL. Otherwise it defaults to Umami Cloud's script.
 *   4. Force-rebuild the app on DO so the new env var is baked into the build.
 *
 * Until step 2 is done, this component renders nothing — the site ships
 * untrackable. There's zero risk of broken analytics or stray script tags,
 * and even if Umami is down the site is unaffected (the script fires-and-
 * forgets, failures don't break the page).
 */

const WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
const SCRIPT_URL =
  process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL || 'https://cloud.umami.is/script.js';

export default function Analytics() {
  if (!WEBSITE_ID) return null;
  return <script defer src={SCRIPT_URL} data-website-id={WEBSITE_ID} />;
}
