/**
 * URL slug helpers for per-mascot SEO pages.
 *
 * Slug shape: `{name-or-unnamed}-{store-city-or-region}-{store-number}`
 *   e.g. mcquackers-oakland-203
 *        bixby-long-beach-116
 *        steven-sparkles-west-hollywood-192
 *        unnamed-pelican-foggy-bottom-653 (anonymous mascot fallback)
 *
 * Why include the store_number suffix:
 *   - Name+city alone collides (multiple "Rosie" mascots, multiple
 *     "Frank"s, etc.). Store_number disambiguates without making the
 *     slug ugly.
 *   - Store_number is also forever-stable — even if a mascot is
 *     renamed, the slug stays valid (we'd just regenerate at build).
 *
 * When store_number is missing, fall back to the mascot's id so we
 * still get a unique slug.
 */

import type { Mascot } from './types';

export function slugForMascot(m: Pick<Mascot, 'id' | 'name' | 'animal' | 'store' | 'store_number'>): string {
  const namePart = m.name ? slugify(m.name) : `unnamed-${slugify(m.animal || 'mascot')}`;
  const storePart = slugify(stripParens(m.store || ''));
  const numberPart = m.store_number || `id${m.id}`;
  // Concatenate, then collapse any consecutive dashes that show up if
  // a part was empty.
  return [namePart, storePart, numberPart]
    .filter(Boolean)
    .join('-')
    .replace(/-+/g, '-');
}

/**
 * Reverse: parse a slug to extract the trailing store_number (or `idN`)
 * which is the only stable lookup key. Returns null if we can't parse.
 */
export function lookupKeyFromSlug(slug: string): { store_number?: string; id?: number } | null {
  const last = slug.split('-').pop();
  if (!last) return null;
  if (/^id\d+$/.test(last)) return { id: parseInt(last.slice(2), 10) };
  if (/^\d+$/.test(last)) return { store_number: last };
  return null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    // Strip diacritics
    .replace(/[̀-ͯ]/g, '')
    // Drop everything that isn't alphanumeric or whitespace/dash
    .replace(/[^a-z0-9\s-]/g, '')
    // Collapse whitespace runs to a single dash
    .replace(/\s+/g, '-')
    // Collapse dash runs
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function stripParens(s: string): string {
  return s.replace(/\s*\([^)]*\)/g, '').trim();
}
