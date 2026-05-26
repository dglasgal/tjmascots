import Link from 'next/link';
import mascotsRaw from '@/data/mascots.json';
import eventsRaw from '@/data/events.json';
import { emojiForAnimal } from '@/lib/emoji';
import { photoUrl } from '@/lib/data';
import { slugForMascot, slugForSpotter } from '@/lib/slug';
import MallardHead from '@/components/MallardHead';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Recently spotted — TJ Mascots',
  description:
    "The newest Trader Joe's mascots added to the map, plus a leaderboard of the top spotters who keep this thing alive.",
};

interface RawMascot {
  id: number;
  name: string;
  animal: string;
  store: string;
  state: string;
  notes: string;
  photo: string | null;
  has_photo: boolean;
  retired?: boolean;
  store_number?: string;
  created_at?: string;
  submitted_by?: string | null;
}

const allMascots = (mascotsRaw as { mascots: RawMascot[] }).mascots;
// Filter to active mascots only
const active = allMascots.filter((m) => !m.retired);
const mascotsById = new Map(active.map((m) => [m.id, m]));

// --- Unified change-log feed -----------------------------------------------
//
// The /recent page used to just show the 24 most-recently-added mascots,
// which meant edits-after-the-fact (a renamed mascot, a swapped photo,
// a removed wine-shop store) never showed up — they had no row in
// mascots.json with a timestamp newer than the original add.
//
// Now we maintain an explicit change log at src/data/events.json. Each
// time we touch a record (rename, replace a photo, add or remove a
// store, etc.) we append an entry. The feed below merges:
//   1. Every explicit event in events.json (new mascots, renames,
//      photo swaps, credits, store add/remove, site-wide changes).
//   2. Auto-synthesized "added" events for any mascot whose creation
//      pre-dates events.json — derived from its created_at timestamp.
//      This keeps the feed pleasantly populated even before the log
//      had many entries.
//
// Sort is newest-first. Cards link to the affected mascot or store.
type EventKind =
  | 'added'
  | 'renamed'
  | 'photo'
  | 'credit'
  | 'notes'
  | 'store_added'
  | 'store_removed'
  | 'site';

interface FeedEvent {
  date: string;
  kind: EventKind;
  store_number?: string;
  mascot_id?: number;
  summary: string;
  reason?: string;
  /** True if this entry was auto-generated from a mascot's created_at;
   *  false (or missing) means it was an explicit hand-written entry. */
  synthetic?: boolean;
  /** Per-entry opt-out from the public /recent feed. Use for back-office
   *  corrections (e.g. credit fixes) that we want preserved in events.json
   *  for the audit trail but that aren't worth showing to visitors. */
  hidden?: boolean;
}

interface EventsFile {
  events: FeedEvent[];
}

// Public-facing feed: filter out kinds that are interesting to me as
// the maintainer but noise for visitors. "site" entries are backend /
// programming / security changes (e.g. RLS hardening, header tweaks)
// — those still live in events.json for the historical record, but
// shouldn't appear on /recent.
const HIDDEN_KINDS_ON_RECENT: ReadonlySet<EventKind> = new Set(['site']);

const explicitEvents = (eventsRaw as EventsFile).events
  .filter((e) => !HIDDEN_KINDS_ON_RECENT.has(e.kind))
  .filter((e) => !e.hidden)
  .map((e) => ({
    ...e,
    synthetic: false,
  }));

// Build a set of (mascot_id) that already have an explicit "added" event,
// so we don't double-list them when synthesizing from created_at.
const explicitlyAddedIds = new Set(
  explicitEvents
    .filter((e) => e.kind === 'added' && typeof e.mascot_id === 'number')
    .map((e) => e.mascot_id as number),
);

// Synthesize an "added" event for every active mascot that doesn't
// already have one in the explicit log. created_at is required.
const syntheticAddedEvents: FeedEvent[] = active
  .filter((m) => !explicitlyAddedIds.has(m.id) && m.created_at)
  .map((m) => ({
    date: m.created_at!,
    kind: 'added' as const,
    store_number: m.store_number,
    mascot_id: m.id,
    summary: `${m.name || `Unnamed ${m.animal}`} the ${m.animal}${
      m.store_number ? ` joined #${m.store_number} ${m.store}` : ` joined ${m.store}`
    }${m.state ? `, ${m.state}` : ''}`,
    synthetic: true,
  }));

const allEvents: FeedEvent[] = [...explicitEvents, ...syntheticAddedEvents].sort(
  (a, b) => {
    if (a.date === b.date) {
      // Within the same day, explicit events appear before synthetic
      // ones (so today's hand-written notes sit at the top of today's
      // bucket), and within each group higher mascot_id wins.
      if (a.synthetic !== b.synthetic) return a.synthetic ? 1 : -1;
      return (b.mascot_id ?? 0) - (a.mascot_id ?? 0);
    }
    return b.date.localeCompare(a.date);
  },
);

const FEED_LIMIT = 36;
const feed = allEvents.slice(0, FEED_LIMIT);

// Top contributors — group by submitted_by, count, sort
const contributorCounts = new Map<string, { count: number; latest: RawMascot }>();
for (const m of active) {
  if (!m.submitted_by) continue;
  const cur = contributorCounts.get(m.submitted_by);
  if (!cur || m.id > cur.latest.id) {
    contributorCounts.set(m.submitted_by, {
      count: (cur?.count ?? 0) + 1,
      latest: m,
    });
  } else {
    cur.count += 1;
  }
}
const topContributors = [...contributorCounts.entries()]
  .map(([name, { count, latest }]) => ({ name, count, latest }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 10);

const totalContributors = contributorCounts.size;
const totalSubmitted = [...contributorCounts.values()].reduce((sum, v) => sum + v.count, 0);

export default function RecentPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="relative z-[1000] flex items-center justify-between gap-3 bg-[var(--tj-red)] px-6 py-3 text-[var(--cream)] shadow-card max-sm:gap-2 max-sm:px-3">
        <div className="flex flex-shrink-0 items-center gap-3.5 max-sm:gap-2">
          <Link
            href="/"
            aria-label="Back to the map"
            title="Back to the map"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--cream)] text-2xl shadow-[inset_0_0_0_3px_var(--tj-red-dark)] transition hover:scale-105"
          >
            <MallardHead className="h-7 w-7" />
          </Link>
          <Link href="/" className="block">
            <h1 className="font-display text-2xl font-black leading-none tracking-tight">TJ Mascots</h1>
            <p className="mt-0.5 text-xs font-semibold opacity-80 max-[700px]:hidden">
              an unofficial map of every Trader Joe&apos;s store mascot
            </p>
          </Link>
        </div>
        <Link
          href="/"
          aria-label="Back to the map"
          className="flex-shrink-0 rounded-full bg-[var(--cream)] px-[18px] py-2.5 text-sm font-extrabold text-[var(--tj-red)] shadow-[0_2px_0_var(--tj-red-dark)] transition hover:-translate-y-px hover:shadow-[0_4px_0_var(--tj-red-dark)] max-sm:px-3 max-sm:text-xs"
        >
          <span className="max-sm:hidden">← Back to the map</span>
          <span className="hidden max-sm:inline">← Map</span>
        </Link>
      </header>

      <div className="bg-[var(--cream-dark)] px-6 py-1.5 text-center text-[11px] font-bold text-[var(--ink-soft)]">
        Fan project. Not affiliated with Trader Joe&apos;s Company. &ldquo;Trader Joe&apos;s&rdquo; is a
        trademark of Trader Joe&apos;s Company.{' '}
        <Link href="/faq" className="underline underline-offset-2 hover:text-[var(--tj-red)]">FAQ</Link>
        {' · '}
        <Link href="/animal" className="underline underline-offset-2 hover:text-[var(--tj-red)]">Animals</Link>
        {' · '}
        <Link href="/data" className="underline underline-offset-2 hover:text-[var(--tj-red)]">Data</Link>
        {' · '}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-[var(--tj-red)]">Privacy</Link>

        {' · '}

        <Link href="/terms" className="underline underline-offset-2 hover:text-[var(--tj-red)]">Terms</Link>
      </div>

      <main className="flex-1 overflow-y-auto bg-[var(--cream)]">
        <div className="mx-auto max-w-6xl px-6 py-12 max-sm:px-4 sm:py-16">
          {/* Hero */}
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.4em] text-[var(--accent)]">
              Fresh from the aisles
            </p>
            <h2 className="font-display text-5xl font-black leading-[0.9] tracking-tight text-[var(--tj-red)] sm:text-7xl md:text-8xl">
              RECENTLY
              <br />
              SPOTTED
            </h2>
            <div className="mx-auto mt-4 h-1.5 w-24 rounded-full bg-[var(--accent)]" />
            <p className="mx-auto mt-5 max-w-xl text-base font-semibold text-[var(--ink-soft)]">
              Every mascot below was added to the map by someone who actually
              walked into a TJ&apos;s, looked behind the bananas, and snapped a
              photo. <span className="text-[var(--tj-red)]">You&apos;re next.</span>
            </p>
          </div>

          {/* Top contributors strip */}
          {topContributors.length > 0 && (
            <section className="mb-16">
              <div className="mb-5 flex items-baseline justify-between">
                <h3 className="font-display text-2xl font-extrabold text-[var(--ink)]">
                  🏆 Hall of Fame
                </h3>
                <span className="text-sm font-bold text-[var(--ink-soft)]">
                  {totalContributors} {totalContributors === 1 ? 'spotter' : 'spotters'} ·{' '}
                  {totalSubmitted} {totalSubmitted === 1 ? 'mascot' : 'mascots'} contributed
                </span>
              </div>
              <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                {topContributors.map((c, i) => (
                  <li key={c.name}>
                    <Link
                      href={`/spotter/${slugForSpotter(c.name)}`}
                      title={`See all ${c.count} of ${c.name}'s spotted mascots`}
                      className="group relative flex items-center gap-3 rounded-2xl bg-[var(--cream-dark)] p-3.5 transition hover:-translate-y-px hover:bg-[var(--cream)] hover:shadow-card"
                    >
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[var(--cream)] text-2xl group-hover:bg-[var(--cream-dark)]">
                        {medalForRank(i)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-display text-base font-extrabold text-[var(--ink)] group-hover:text-[var(--tj-red)]">
                          {c.name}
                        </div>
                        <div className="text-[12px] font-bold text-[var(--ink-soft)]">
                          {c.count} {c.count === 1 ? 'mascot' : 'mascots'} · most recent:{' '}
                          <span className="text-[var(--tj-red)]">
                            {c.latest.name || c.latest.animal}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-center text-[12px] font-semibold italic text-[var(--ink-soft)]">
                Want your name here? Submit a mascot photo (with your email for credit) and you&apos;re in.
              </p>
            </section>
          )}

          {/* Unified change-log feed: new mascots, renames, photo updates,
              credit changes, store additions/removals, all in one timeline. */}
          <section>
            <div className="mb-5 flex items-baseline justify-between">
              <h3 className="font-display text-2xl font-extrabold text-[var(--ink)]">
                ✨ Latest updates
              </h3>
              <span className="text-sm font-bold text-[var(--ink-soft)]">
                showing the {feed.length} newest
              </span>
            </div>
            <ol className="flex flex-col gap-3">
              {feed.map((e, i) => (
                <FeedRow key={`${e.date}-${e.kind}-${e.mascot_id ?? e.store_number ?? i}`} event={e} />
              ))}
            </ol>
            <p className="mt-5 text-center text-[12px] font-semibold italic text-[var(--ink-soft)]">
              Every site change shows up here — new mascots, renames,
              photo updates, even store removals.
            </p>
          </section>

          {/* CTA footer */}
          <div className="mt-16 rounded-3xl bg-[var(--cream-dark)] px-6 py-10 text-center sm:px-10">
            <div className="text-5xl">🦆</div>
            <h3 className="mt-3 font-display text-3xl font-extrabold text-[var(--tj-red)]">
              Help fill in the map
            </h3>
            <p className="mx-auto mt-2 max-w-md text-base font-semibold text-[var(--ink-soft)]">
              There are still hundreds of stores without a mascot photo. Next
              time you&apos;re grocery shopping, look up — and send us what you
              find.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/"
                className="rounded-full bg-[var(--tj-red)] px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--cream)] shadow-[0_3px_0_var(--tj-red-dark)] transition hover:-translate-y-px"
              >
                Open the map →
              </Link>
              <Link
                href="/about"
                className="rounded-full border-2 border-[var(--tj-red)] bg-[var(--cream)] px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--tj-red)] transition hover:-translate-y-px"
              >
                The story
              </Link>
            </div>
          </div>

          <footer className="mt-16 border-t border-[var(--cream-dark)] pt-6 text-center text-xs font-semibold text-[var(--ink-soft)]">
            A fan project. Unaffiliated with Trader Joe&apos;s Company.
          </footer>
        </div>
      </main>
    </div>
  );
}

/* -------------------------- helpers -------------------------- */

function medalForRank(rank: number): string {
  if (rank === 0) return '🥇';
  if (rank === 1) return '🥈';
  if (rank === 2) return '🥉';
  return '⭐';
}

/* ---------------------- unified feed row ----------------------- */

/** Visual style + label per event kind. The accent color appears as a
 *  left border on each card so the feed is scannable at a glance. */
const KIND_STYLE: Record<
  EventKind,
  { icon: string; label: string; accent: string }
> = {
  added:         { icon: '✨', label: 'New mascot',     accent: 'var(--tj-red)' },
  renamed:       { icon: '✏️', label: 'Renamed',         accent: '#c79100' },
  photo:         { icon: '📷', label: 'New photo',       accent: '#1f7a4d' },
  credit:        { icon: '🙏', label: 'Photo credit',    accent: '#5b6cff' },
  notes:         { icon: '📝', label: 'Notes updated',   accent: '#888' },
  store_added:   { icon: '🏬', label: 'Store added',     accent: '#0f8e7e' },
  store_removed: { icon: '🗑️', label: 'Store removed',   accent: '#a3322a' },
  site:          { icon: '🛠️', label: 'Site update',     accent: '#444' },
};

function FeedRow({ event }: { event: FeedEvent }) {
  const style = KIND_STYLE[event.kind] ?? KIND_STYLE.site;

  // Where this card links to. Mascot link wins; store link is the fallback.
  let href: string | null = null;
  let thumbEmoji: string | null = null;
  let thumbPhoto: string | null = null;
  if (event.mascot_id) {
    const m = mascotsById.get(event.mascot_id);
    if (m) {
      href = `/mascot/${slugForMascot(m)}`;
      thumbEmoji = emojiForAnimal(m.animal, Boolean(m.has_photo));
      thumbPhoto = m.has_photo && m.photo ? photoUrl(m.photo) : null;
    }
  }
  if (!href && event.store_number) {
    href = `/?store=${encodeURIComponent(event.store_number)}`;
  }

  const inner = (
    <article
      className="group flex items-stretch gap-3 overflow-hidden rounded-2xl bg-[var(--cream-dark)] p-3.5 transition hover:-translate-y-px hover:bg-[var(--cream)] hover:shadow-card"
      style={{ borderLeft: `4px solid ${style.accent}` }}
    >
      {/* Thumb: photo if we have one, otherwise emoji on tinted bg */}
      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--cream)] text-2xl">
        {thumbPhoto ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={thumbPhoto}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : thumbEmoji ? (
          <span>{thumbEmoji}</span>
        ) : (
          <span>{style.icon}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
          <span style={{ color: style.accent }}>
            {style.icon} {style.label}
          </span>
          <span>·</span>
          <time dateTime={event.date}>{formatDate(event.date)}</time>
        </div>
        <div className="mt-1 font-display text-[15px] font-extrabold leading-snug text-[var(--ink)] group-hover:text-[var(--tj-red)]">
          {event.summary}
        </div>
        {event.reason && (
          <div className="mt-1 text-[12px] font-semibold leading-snug text-[var(--ink-soft)]">
            {event.reason}
          </div>
        )}
      </div>
    </article>
  );

  return (
    <li>{href ? <Link href={href} className="block">{inner}</Link> : inner}</li>
  );
}

/** Format an ISO date as "May 1, 2026" — friendlier than 2026-05-01. */
function formatDate(iso: string): string {
  // Manual format avoids locale drift between server build and client render.
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const [, y, mm, dd] = m;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[parseInt(mm, 10) - 1] ?? mm;
  return `${monthName} ${parseInt(dd, 10)}, ${y}`;
}
