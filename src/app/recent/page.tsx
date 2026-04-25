import Link from 'next/link';
import mascotsRaw from '@/data/mascots.json';
import storesData from '@/data/tj-stores.json';
import { emojiForAnimal } from '@/lib/emoji';
import type { Store } from '@/lib/types';
import { photoUrl } from '@/lib/data';

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

const stores = storesData as Store[];
const storesByNum = new Map(stores.map((s) => [s.store_number, s]));

const allMascots = (mascotsRaw as { mascots: RawMascot[] }).mascots;
// Filter to active mascots only
const active = allMascots.filter((m) => !m.retired);

// "Recently spotted" — sort by created_at desc, then by id desc as tiebreaker
const recent = [...active].sort((a, b) => {
  const da = a.created_at || '';
  const db = b.created_at || '';
  if (da === db) return b.id - a.id;
  return db.localeCompare(da);
}).slice(0, 24);

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
            🛒
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
        trademark of Trader Joe&apos;s Company.
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
                  <li
                    key={c.name}
                    className="group relative flex items-center gap-3 rounded-2xl bg-[var(--cream-dark)] p-3.5 transition hover:-translate-y-px hover:shadow-card"
                  >
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[var(--cream)] text-2xl">
                      {medalForRank(i)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-base font-extrabold text-[var(--ink)]">
                        {c.name}
                      </div>
                      <div className="text-[12px] font-bold text-[var(--ink-soft)]">
                        {c.count} {c.count === 1 ? 'mascot' : 'mascots'} · most recent:{' '}
                        <span className="text-[var(--tj-red)]">
                          {c.latest.name || c.latest.animal}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-center text-[12px] font-semibold italic text-[var(--ink-soft)]">
                Want your name here? Submit a mascot photo (with your email for credit) and you&apos;re in.
              </p>
            </section>
          )}

          {/* Recently spotted grid */}
          <section>
            <div className="mb-5 flex items-baseline justify-between">
              <h3 className="font-display text-2xl font-extrabold text-[var(--ink)]">
                ✨ Latest additions
              </h3>
              <span className="text-sm font-bold text-[var(--ink-soft)]">
                showing the {recent.length} newest
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {recent.map((m) => (
                <RecentCard key={m.id} mascot={m} />
              ))}
            </div>
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

function RecentCard({ mascot }: { mascot: RawMascot }) {
  const photo = mascot.has_photo && mascot.photo ? photoUrl(mascot.photo) : null;
  const emoji = emojiForAnimal(mascot.animal);
  const store = mascot.store_number ? storesByNum.get(mascot.store_number) : null;
  return (
    <Link
      href={`/?mascot=${mascot.id}`}
      title={`See ${mascot.name || mascot.animal} on the map`}
      className="group block overflow-hidden rounded-2xl bg-[var(--cream-dark)] transition hover:-translate-y-1 hover:shadow-card"
    >
      <div className="relative aspect-[4/3] w-full bg-[var(--cream)]">
        {photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photo}
            alt={mascot.name || mascot.animal}
            className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--cream-dark)] to-[var(--accent)] text-[80px]">
            {emoji}
          </div>
        )}
        {mascot.submitted_by && (
          <div className="absolute right-2 top-2 rounded-full bg-[var(--ink)]/85 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--cream)]">
            📷 {mascot.submitted_by}
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center bg-[var(--tj-red)] py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[var(--cream)] opacity-0 transition-opacity group-hover:opacity-100">
          See on map →
        </div>
      </div>
      <div className="p-3.5">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
          {mascot.animal}
        </div>
        <div className="mt-0.5 truncate font-display text-lg font-extrabold leading-tight text-[var(--tj-red)]">
          {mascot.name || <span className="italic opacity-60">Unnamed</span>}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[12px] font-bold text-[var(--ink)]">
          <span className="truncate">
            {store ? `${store.city}, ${store.state}` : `${mascot.store}, ${mascot.state}`}
          </span>
          {mascot.store_number && (
            <span className="flex-shrink-0 rounded-full bg-[var(--tj-red)] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[var(--cream)]">
              #{mascot.store_number}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function medalForRank(rank: number): string {
  if (rank === 0) return '🥇';
  if (rank === 1) return '🥈';
  if (rank === 2) return '🥉';
  return '⭐';
}
