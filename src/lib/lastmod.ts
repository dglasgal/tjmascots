/**
 * Honest "last changed" dates for sitemap.xml.
 *
 * Google only trusts <lastmod> when it matches real content changes, and
 * stops trusting a site's dates entirely once they look made up. Before
 * 2026-11-16 every URL got `new Date()` (the build time), so every page
 * claimed to change on every deploy. These helpers derive each page's date
 * from the data that actually drives it:
 *
 *   - a mascot's `created_at` in mascots.json
 *   - any events.json entry that names that mascot (`mascot_id`) or its
 *     store (`store_number`)
 *
 * Pages with no data-driven date (About, Privacy, FAQ, Data) get none —
 * Google's guidance is that no lastmod is better than a wrong one.
 */
import mascotsRaw from '@/data/mascots.json';
import eventsRaw from '@/data/events.json';

interface LmMascot {
  id: number;
  animal?: string;
  state?: string;
  store_number?: string | null;
  created_at?: string;
  retired?: boolean;
  submitted_by?: string | null;
}
interface LmEvent {
  date: string;
  kind: string;
  mascot_id?: number;
  store_number?: string;
}

const mascots = (mascotsRaw as { mascots: LmMascot[] }).mascots;
const events = (eventsRaw as { events: LmEvent[] }).events;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function maxDay(days: (string | undefined | null)[]): string | undefined {
  let best: string | undefined;
  for (const d of days) {
    if (!d || !ISO_DAY.test(d)) continue;
    if (!best || d > best) best = d;
  }
  return best;
}

const mascotDay = new Map<number, string>();
for (const m of mascots) {
  const day = maxDay([
    m.created_at,
    ...events.filter((e) => e.mascot_id === m.id).map((e) => e.date),
  ]);
  if (day) mascotDay.set(m.id, day);
}

const storeEventDay = new Map<string, string>();
for (const e of events) {
  if (!e.store_number) continue;
  const cur = storeEventDay.get(e.store_number);
  if (!cur || e.date > cur) storeEventDay.set(e.store_number, e.date);
}

/** Converts a YYYY-MM-DD day into the Date the sitemap expects. */
function toDate(day: string | undefined): Date | undefined {
  return day ? new Date(`${day}T00:00:00Z`) : undefined;
}

/** Last change to one mascot (its record or any event naming it). */
export function mascotLastMod(id: number): Date | undefined {
  return toDate(mascotDay.get(id));
}

/** Last change to anything shown for these stores (store events + their mascots). */
export function storesLastMod(storeNumbers: string[]): Date | undefined {
  const set = new Set(storeNumbers);
  return toDate(
    maxDay([
      ...storeNumbers.map((n) => storeEventDay.get(n)),
      ...mascots
        .filter((m) => m.store_number && set.has(m.store_number))
        .map((m) => mascotDay.get(m.id)),
    ]),
  );
}

/** Last change across a list of mascots (state, animal, spotter pages). */
export function mascotsLastMod(ids: number[]): Date | undefined {
  return toDate(maxDay(ids.map((id) => mascotDay.get(id))));
}

/** Most recent change anywhere — for the homepage map and /recent. */
export function siteLastMod(): Date | undefined {
  return toDate(maxDay([...events.map((e) => e.date), ...mascotDay.values()]));
}
