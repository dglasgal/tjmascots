#!/usr/bin/env node
/**
 * validate-mascot-stores.mjs
 * -------------------------------------------------------------
 * Build-time guard against the most common content bug we've hit:
 * a mascot is assigned a store_number whose TJ city doesn't match
 * the mascot's `store` label, causing the pin to land in the wrong
 * city on the live map (e.g. Clyde labeled "Canoga Park" but pinned
 * in Menlo Park because store_number was 69).
 *
 * Strategy
 *   For every mascot:
 *     1. Look up the TJ store record by store_number.
 *     2. Compare the mascot's `store` label tokens (primary text +
 *        anything in parentheses) against the TJ store's official
 *        city, allowing substring matches in either direction.
 *     3. Consult an explicit alias allow-list for known
 *        neighborhood → city pairs (Hollywood → Los Angeles, etc.)
 *        so legit naming doesn't trip the alarm.
 *     4. Cross-state mismatches are always errors.
 *
 * Wired into `npm run build` via a "prebuild" hook so DigitalOcean
 * (and every local build) refuses to ship if a real mismatch is
 * detected.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const mascotsPath = path.join(root, 'src/data/mascots.json');
const storesPath = path.join(root, 'src/data/tj-stores.json');

const mascots = JSON.parse(fs.readFileSync(mascotsPath, 'utf8')).mascots;
const stores = JSON.parse(fs.readFileSync(storesPath, 'utf8'));
const byNum = new Map(stores.map((s) => [s.store_number, s]));

/**
 * Aliases for cases where the neighborhood label in our data
 * legitimately differs from TJ's official city for that store.
 * Add new entries as we encounter them; keep keys lowercased.
 *
 * Each value is the set of acceptable TJ official cities for a
 * label that mentions the key. e.g. "ahwatukee" lives inside the
 * city of Phoenix, so a label "Ahwatukee" with TJ city "Phoenix"
 * is fine.
 */
const ALIASES = {
  'nyc': ['new york'],
  'manhattan': ['new york'],
  'brooklyn': ['brooklyn', 'new york'],
  'queens': ['new york', 'queens'],
  'long island city': ['queens'],
  'hollywood': ['los angeles', 'portland'],          // both LA and Portland have a Hollywood
  'silver lake': ['los angeles'],
  'la brea': ['los angeles'],
  'west hollywood': ['los angeles', 'west hollywood'],
  'sherman oaks': ['sherman oaks', 'los angeles'],
  'studio city': ['los angeles'],
  'culver city': ['culver city', 'los angeles'],
  'venice': ['los angeles'],
  'rancho palos verdes': ['rancho palos verdes'],
  'lakeshore': ['oakland'],
  'rockridge': ['oakland'],
  'hayes valley': ['san francisco'],
  'nob hill': ['san francisco'],
  'north beach': ['san francisco'],
  'soma': ['san francisco'],
  'stonestown': ['san francisco'],
  'hayes': ['san francisco'],
  'sdsu': ['san diego'],
  'hillcrest': ['san diego'],
  'liberty station': ['san diego'],
  'scripps ranch': ['san diego'],
  'carmel mountain ranch': ['san diego'],
  'ahwatukee': ['phoenix'],
  'east liberty': ['pittsburgh'],
  'south hills': ['pittsburgh'],
  'shadyside': ['pittsburgh'],
  'foggy bottom': ['washington'],
  'capitol hill': ['washington', 'denver'],
  'upper west side': ['new york'],
  'upper east side': ['new york'],
  'east village': ['new york'],
  'west village': ['new york'],
  'soho': ['new york'],
  'union square': ['new york'],
  'harlem': ['new york'],
  'harlem 125': ['new york'],
  'bridgemarket': ['new york'],
  'williamsburg': ['brooklyn'],
  'patriot place': ['foxborough'],
  'newington': ['portsmouth'],          // TJ #520 is officially "Portsmouth" but the address is in Newington NH
  'peachtree corners': ['norcross'],
  'queen anne': ['seattle'],
  'ballard': ['seattle'],
  'tanasbourne': ['hillsboro'],
  'university mall': ['davis'],
  'creedmoor': ['raleigh'],
  'creedmoor rd': ['raleigh'],
  'campus dr': ['irvine'],
  'culver dr': ['irvine'],
  'woodbury': ['irvine'],
  'old almaden': ['san jose'],
  'coleman': ['san jose'],
  'eastlake': ['chula vista'],
  'garden home': ['portland'],
  'easton': ['columbus'],
  'castleton': ['indianapolis'],
  'stony point': ['richmond'],
  'ft myers': ['fort myers'],
  'far north': ['dallas', 'plano'],
  'canoga park': ['encino', 'west hills', 'woodland hills'],  // SFV cluster — Canoga Park has no TJ
};

/**
 * Mascots whose store_number/label mismatch is *known* and pending a
 * decision from David. These are downgraded from build-failing errors
 * to non-fatal warnings, so the site can still deploy. ANY new mismatch
 * not on this list will fail the build. Empty this list as decisions
 * land — it's a checklist, not a permanent escape hatch.
 */
const PENDING_REVIEW = new Set([
  121, // Felix — Denver, currently store #308 Westminster CO. Source data
       // is the Carlos Gomez Bay Area archive — not authoritative for CO.
       // David needs to verify which Denver-area store Felix actually lives at.
]);

const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

function tokenize(label) {
  if (!label) return [];
  const parens = [...label.matchAll(/\(([^)]+)\)/g)].map((m) => m[1]);
  const primary = label.replace(/\(.*?\)/g, '').trim();
  // For parens content, take the first segment before commas / dashes
  const parenCities = parens.map((p) => p.split(/[,—\-]/)[0].trim());
  return [primary, ...parenCities].map(norm).filter(Boolean);
}

function tokensAcceptCity(tokens, actualCity) {
  const ac = norm(actualCity);
  if (!ac) return true;
  // Build a superset of token candidates: each phrase plus each individual
  // word, so "College Ave (near SDSU)" yields ["college ave", "near sdsu",
  // "college", "ave", "near", "sdsu"] — letting "sdsu" hit ALIASES.
  const allTokens = new Set();
  for (const t of tokens) {
    if (!t) continue;
    allTokens.add(t);
    for (const word of t.split(/\s+/)) {
      if (word) allTokens.add(word);
    }
  }
  for (const t of allTokens) {
    if (t === ac || t.includes(ac) || ac.includes(t)) return true;
    const aliasTargets = ALIASES[t];
    if (aliasTargets && aliasTargets.some((a) => norm(a) === ac)) return true;
  }
  return false;
}

const errors = [];
let checked = 0;
for (const m of mascots) {
  if (!m.store_number) continue; // skip entries without a pinned store
  const tj = byNum.get(m.store_number);
  if (!tj) {
    errors.push({
      id: m.id,
      name: m.name || '(unnamed)',
      reason: `store_number "${m.store_number}" is not in tj-stores.json`,
    });
    continue;
  }
  // Cross-state checks
  if (m.state && tj.state && norm(m.state) !== norm(tj.state)) {
    errors.push({
      id: m.id,
      name: m.name || '(unnamed)',
      reason:
        `state mismatch: mascot says "${m.state}" but store #${tj.store_number} is in ${tj.state}` +
        ` (${tj.city})`,
    });
    continue;
  }
  const tokens = tokenize(m.store);
  if (!tokensAcceptCity(tokens, tj.city)) {
    errors.push({
      id: m.id,
      name: m.name || '(unnamed)',
      reason:
        `label "${m.store}" doesn't match TJ city "${tj.city}" for store #${tj.store_number}` +
        ` — either fix the store_number, the label, or add an entry to ALIASES in this script`,
    });
  }
  checked++;
}

// Split into fatal errors (new problems) vs warnings (in PENDING_REVIEW).
const fatal = errors.filter((e) => !PENDING_REVIEW.has(e.id));
const warned = errors.filter((e) => PENDING_REVIEW.has(e.id));

if (warned.length) {
  console.warn(
    `\n⚠ validate-mascot-stores: ${warned.length} pending-review mascot(s) ` +
      `(downgraded — fix decisions outstanding):\n`,
  );
  for (const e of warned) {
    console.warn(`  id=${e.id}  ${JSON.stringify(e.name)}  — ${e.reason}`);
  }
}

if (fatal.length === 0) {
  console.log(
    `\n✓ validate-mascot-stores: ${checked} mascots OK` +
      (warned.length ? ` (${warned.length} pending review)` : '') +
      '\n',
  );
  process.exit(0);
}

console.error(`\n✗ validate-mascot-stores: ${fatal.length} new problem(s) found:\n`);
for (const e of fatal) {
  console.error(`  id=${e.id}  ${JSON.stringify(e.name)}  — ${e.reason}`);
}
console.error(
  '\nFix each row above by:\n' +
    '  (a) updating the mascot\'s store_number to the correct TJ store, OR\n' +
    '  (b) updating the mascot\'s `store` label to match the TJ city, OR\n' +
    '  (c) adding a known-good alias to ALIASES in scripts/validate-mascot-stores.mjs, OR\n' +
    '  (d) (last resort) adding the mascot id to PENDING_REVIEW with a note.\n',
);
process.exit(1);
