#!/usr/bin/env node
/**
 * check-new-stores.mjs
 *
 * Scrapes locations.traderjoes.com to detect new (or removed/changed) Trader
 * Joe's stores, and updates `site/src/data/tj-stores.json` so the map always
 * has the current chain.
 *
 * Run manually:
 *   node site/scripts/check-new-stores.mjs
 *
 * Or by GitHub Actions on a daily cron (.github/workflows/check-new-stores.yml).
 *
 * Behavior:
 *   • Fetches https://locations.traderjoes.com/sitemap.xml
 *   • Filters to URLs matching /STATE/CITY/STORENUM/ (the canonical store URL)
 *   • Diffs against the local tj-stores.json
 *   • For any NEW store_number on the live site: fetches the page and parses
 *     the JSON-LD GroceryStore block (street, city, state, zip, lat, lng, phone)
 *   • Adds them to tj-stores.json (sorted by store_number ascending)
 *   • Reports stores that were on our list but are no longer on the live site
 *     (likely closures or temporary takedowns) — does NOT auto-remove; needs
 *     human review.
 *   • Exit code 0 if no changes, 0 if changes were applied, non-zero on error.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORES_PATH = path.resolve(__dirname, '..', 'src', 'data', 'tj-stores.json');
const SITEMAP_URL = 'https://locations.traderjoes.com/sitemap.xml';
const CONCURRENCY = 15;

async function main() {
  const localText = await fs.readFile(STORES_PATH, 'utf8');
  const local = JSON.parse(localText);
  const localByNum = new Map(local.map((s) => [s.store_number, s]));

  console.log(`📍 Local: ${local.length} stores in tj-stores.json`);

  const sitemapXml = await fetchText(SITEMAP_URL);
  const urls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const liveUrls = urls
    .map((u) => {
      const m = u.match(/\/([a-z]{2})\/([a-z0-9\-]+)\/(\d+)\/?$/i);
      return m ? { url: u, state: m[1].toUpperCase(), citySlug: m[2], store_number: m[3] } : null;
    })
    .filter(Boolean);
  const liveByNum = new Map(liveUrls.map((s) => [s.store_number, s]));

  console.log(`🌐 Live: ${liveUrls.length} stores on locations.traderjoes.com`);

  const newOnLive = liveUrls.filter((s) => !localByNum.has(s.store_number));
  const removedFromLive = local.filter((s) => !liveByNum.has(s.store_number));

  if (newOnLive.length === 0 && removedFromLive.length === 0) {
    console.log('✓ No changes. Local store list matches live site exactly.');
    return { changed: false };
  }

  console.log('');
  if (newOnLive.length > 0) {
    console.log(`🆕 ${newOnLive.length} new store(s) on live site:`);
    for (const s of newOnLive) console.log(`   #${s.store_number} ${s.citySlug}, ${s.state} → ${s.url}`);
  }
  if (removedFromLive.length > 0) {
    console.log(`⚠️ ${removedFromLive.length} store(s) on our list but NOT on live site (closures? human review needed):`);
    for (const s of removedFromLive) console.log(`   #${s.store_number} ${s.city}, ${s.state} (${s.street})`);
  }

  // Fetch full details for each new store
  const fetched = [];
  let idx = 0;
  async function worker() {
    while (idx < newOnLive.length) {
      const i = idx++;
      const s = newOnLive[i];
      try {
        const html = await fetchText(s.url);
        const ld = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1].trim());
        const storeJson = ld
          .map((blob) => { try { return JSON.parse(blob); } catch { return null; } })
          .find((j) => j && j['@type'] === 'GroceryStore');
        if (!storeJson) {
          console.warn(`   ⚠️ no GroceryStore JSON-LD on ${s.url}, skipping`);
          continue;
        }
        const a = storeJson.address || {};
        const g = storeJson.geo || {};
        fetched.push({
          store_number: s.store_number,
          city: a.addressLocality || s.citySlug,
          state: a.addressRegion || s.state,
          zip: a.postalCode || '',
          street: a.streetAddress || '',
          lat: g.latitude ?? null,
          lng: g.longitude ?? null,
          phone: storeJson.telephone || '',
          url: s.url,
        });
      } catch (e) {
        console.warn(`   ⚠️ fetch failed for ${s.url}: ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // Merge new stores into local list
  const merged = [...local, ...fetched].sort((a, b) => parseInt(a.store_number, 10) - parseInt(b.store_number, 10));
  await fs.writeFile(STORES_PATH, JSON.stringify(merged, null, 2) + '\n');

  console.log('');
  console.log(`💾 Wrote ${merged.length} stores to tj-stores.json (added ${fetched.length} new)`);

  // Emit a summary file the GitHub Action can post into the PR body.
  const summaryLines = [];
  summaryLines.push(`## TJ store list update`);
  summaryLines.push('');
  summaryLines.push(`**Local before:** ${local.length} stores`);
  summaryLines.push(`**Live now:** ${liveUrls.length} stores`);
  summaryLines.push(`**Local after:** ${merged.length} stores`);
  summaryLines.push('');
  if (fetched.length > 0) {
    summaryLines.push(`### 🆕 New stores added (${fetched.length})`);
    summaryLines.push('| # | City, State | Address |');
    summaryLines.push('|---|---|---|');
    for (const s of fetched) summaryLines.push(`| ${s.store_number} | ${s.city}, ${s.state} | ${s.street} ${s.zip} |`);
    summaryLines.push('');
  }
  if (removedFromLive.length > 0) {
    summaryLines.push(`### ⚠️ Stores no longer on live site (${removedFromLive.length}) — review needed`);
    summaryLines.push(`These are still in tj-stores.json. They may be temporarily removed or permanently closed.`);
    summaryLines.push('| # | City, State | Address |');
    summaryLines.push('|---|---|---|');
    for (const s of removedFromLive) summaryLines.push(`| ${s.store_number} | ${s.city}, ${s.state} | ${s.street} |`);
    summaryLines.push('');
  }
  await fs.writeFile(path.resolve(__dirname, '..', '..', 'STORE_UPDATE_SUMMARY.md'), summaryLines.join('\n'));

  return { changed: fetched.length > 0, added: fetched.length, removed: removedFromLive.length };
}

async function fetchText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'tjmascots-store-watcher/1.0 (https://tjmascots.com)' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.text();
}

main().then(
  (result) => {
    if (result?.changed) process.exit(0);
    else process.exit(0);
  },
  (err) => {
    console.error('FATAL:', err);
    process.exit(1);
  },
);
