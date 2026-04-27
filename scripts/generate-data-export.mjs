#!/usr/bin/env node
/**
 * generate-data-export.mjs
 * --------------------------------------------------------------
 * Writes the public dataset to two static files served alongside
 * the rest of the site:
 *
 *   public/data/mascots.json — full mascot catalog with derived
 *                              store info (city, state, address,
 *                              lat/lng, etc.) joined in for
 *                              consumer convenience
 *   public/data/mascots.csv  — same data, flat CSV
 *
 * These files are the "open data export" referenced from the
 * /data landing page. They give researchers, journalists, and
 * other fans a clean machine-readable copy of every mapped
 * mascot. Re-runs every build via the prebuild hook in
 * package.json so the export stays fresh as new mascots ship.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const mascots = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/mascots.json'), 'utf8'),
).mascots;
const stores = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/tj-stores.json'), 'utf8'),
);
const byNum = new Map(stores.map((s) => [s.store_number, s]));

const generatedAt = new Date().toISOString();

const enriched = mascots
  .filter((m) => !m.retired)
  .map((m) => {
    const s = m.store_number ? byNum.get(m.store_number) : null;
    return {
      id: m.id,
      name: m.name || null,
      animal: m.animal || null,
      store_number: m.store_number || null,
      store_label: m.store || null,
      city: s?.city || null,
      state: m.state || s?.state || null,
      zip: s?.zip || null,
      street: s?.street || null,
      lat: s?.lat ?? null,
      lng: s?.lng ?? null,
      has_photo: Boolean(m.has_photo),
      photo_url: m.has_photo && m.photo ? `/photos/${m.photo}` : null,
      submitted_by: m.submitted_by || null,
      created_at: m.created_at || null,
      notes: m.notes || null,
      source_url: m.source_url || null,
    };
  });

// Emit JSON
const jsonOut = path.join(root, 'public/data/mascots.json');
fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
fs.writeFileSync(
  jsonOut,
  JSON.stringify(
    {
      generated_at: generatedAt,
      license:
        'Open data — please attribute "TJ Mascots fan project (tjmascots.com)" if you publish derivative works.',
      record_count: enriched.length,
      mascots: enriched,
    },
    null,
    2,
  ) + '\n',
);

// Emit CSV
const cols = [
  'id', 'name', 'animal', 'store_number', 'store_label', 'city', 'state',
  'zip', 'street', 'lat', 'lng', 'has_photo', 'photo_url', 'submitted_by',
  'created_at', 'notes', 'source_url',
];

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Quote if contains comma, quote, newline, or leading whitespace
  if (/[",\n\r]/.test(s) || s !== s.trim()) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const csvLines = [cols.join(',')];
for (const r of enriched) {
  csvLines.push(cols.map((c) => csvCell(r[c])).join(','));
}
fs.writeFileSync(
  path.join(root, 'public/data/mascots.csv'),
  csvLines.join('\n') + '\n',
);

console.log(
  `✓ generate-data-export: wrote ${enriched.length} mascots to public/data/mascots.{json,csv}`,
);
