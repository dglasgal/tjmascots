#!/usr/bin/env node
/**
 * indexnow.mjs — tells Bing (and the other IndexNow search engines:
 * Yandex, Naver, Seznam) which tjmascots.com pages just changed, so they
 * re-crawl within hours instead of days. Google does not use IndexNow.
 *
 * How it works: IndexNow trusts us because public/67e2647793a79186c5143f89371f7ea9.txt is live on
 * the site and contains the same key. The key is public by design (it's
 * served to anyone) — it is NOT a password.
 *
 * Modes:
 *   node .github/scripts/indexnow.mjs           → pages whose sitemap
 *       <lastmod> is within the last 3 days, plus / and /recent/
 *   node .github/scripts/indexnow.mjs --all     → every URL in the sitemap
 *       (use once after big changes, e.g. new page types)
 *
 * Run by .github/workflows/indexnow.yml after each push to main.
 */
const SITE = 'https://tjmascots.com';
const KEY = '67e2647793a79186c5143f89371f7ea9';
const KEY_URL = `${SITE}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const ALL = process.argv.includes('--all');
const DAYS = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wait (up to ~12 min) for the deploy to finish: the key file must be live.
async function waitForKeyFile() {
  for (let i = 0; i < 24; i++) {
    try {
      const res = await fetch(`${KEY_URL}?t=${Date.now()}`);
      if (res.ok && (await res.text()).trim() === KEY) return;
    } catch {}
    console.log('Key file not live yet — waiting 30s for the deploy…');
    await sleep(30_000);
  }
  throw new Error(`Key file never went live at ${KEY_URL}`);
}

async function sitemapEntries() {
  const xml = await (await fetch(`${SITE}/sitemap.xml?t=${Date.now()}`)).text();
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, block]) => ({
    loc: block.match(/<loc>([^<]+)<\/loc>/)?.[1],
    lastmod: block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1],
  })).filter((e) => e.loc);
}

await waitForKeyFile();
const entries = await sitemapEntries();
const cutoff = Date.now() - DAYS * 86_400_000;
const urls = ALL
  ? entries.map((e) => e.loc)
  : [
      ...new Set([
        `${SITE}/`,
        `${SITE}/recent/`,
        ...entries.filter((e) => e.lastmod && Date.parse(e.lastmod) >= cutoff).map((e) => e.loc),
      ]),
    ];

console.log(`Submitting ${urls.length} URL(s) to IndexNow (${ALL ? 'all' : `changed in last ${DAYS} days`})`);
for (let i = 0; i < urls.length; i += 10_000) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: 'tjmascots.com', key: KEY, keyLocation: KEY_URL, urlList: urls.slice(i, i + 10_000) }),
  });
  console.log(`IndexNow answered HTTP ${res.status} ${await res.text()}`);
  // 200 = accepted, 202 = accepted (key check pending). Anything else is a real problem.
  if (res.status !== 200 && res.status !== 202) process.exit(1);
}
