/**
 * Analytics
 *
 * Privacy-friendly page-view tracking via GoatCounter (free for personal /
 * non-commercial use, no cookies, no PII, no GDPR consent banner needed).
 *
 * To enable:
 *   1. Sign up at https://www.goatcounter.com/signup, choose a subdomain
 *      (e.g. "tjmascots" → tjmascots.goatcounter.com).
 *   2. Set the env var NEXT_PUBLIC_GOATCOUNTER on DigitalOcean App Platform
 *      to your GoatCounter URL, e.g. https://tjmascots.goatcounter.com
 *   3. Force-rebuild the app on DO so the new env var is baked into the build.
 *
 * Until step 2 is done, this component renders nothing — the site ships
 * untrackable. There's no risk of broken analytics or stray script tags.
 */

const GOATCOUNTER_URL = process.env.NEXT_PUBLIC_GOATCOUNTER;

export default function Analytics() {
  if (!GOATCOUNTER_URL) return null;
  // Strip trailing slash if present
  const base = GOATCOUNTER_URL.replace(/\/$/, '');
  return (
    <script
      data-goatcounter={`${base}/count`}
      async
      src="//gc.zgo.at/count.js"
    />
  );
}
