import Link from 'next/link';
import { notFound } from 'next/navigation';
import mascotsRaw from '@/data/mascots.json';
import storesData from '@/data/tj-stores.json';
import { emojiForAnimal } from '@/lib/emoji';
import { photoUrl } from '@/lib/data';
import { slugForMascot, spotterSlugMap } from '@/lib/slug';
import { formatStoreLocation } from '@/lib/store-label';
import type { Store } from '@/lib/types';
import MallardHead from '@/components/MallardHead';
import Breadcrumbs from '@/components/Breadcrumbs';

export const dynamic = 'force-static';
export const dynamicParams = false;

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
const active = allMascots.filter((m) => !m.retired);

const slugMap = spotterSlugMap(active);
// Reverse: slug → spotter display name
const spotterByslug = new Map<string, string>();
slugMap.forEach((slug, name) => {
  spotterByslug.set(slug, name);
});

/** Build the static list of slugs for /spotter/{slug} pages. */
export function generateStaticParams(): { slug: string }[] {
  return Array.from(spotterByslug.keys()).map((slug) => ({ slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Per-page metadata so Google indexes spotter pages and link previews
 *  show the spotter's name + count in iMessage/Twitter/Slack. */
export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const name = spotterByslug.get(slug);
  if (!name) return { title: 'Spotter not found — TJ Mascots' };
  const count = mascotsForSpotter(name).length;
  return {
    title: `${name} — TJ Mascots Hall of Fame`,
    description: `${name} has spotted ${count} Trader Joe's mascot${count === 1 ? '' : 's'} for the TJ Mascots fan map.`,
  };
}

function mascotsForSpotter(name: string): RawMascot[] {
  return active
    .filter((m) => m.submitted_by === name)
    .sort((a, b) => {
      // Newest first by created_at, falling back to id
      const da = a.created_at || '';
      const db = b.created_at || '';
      if (da === db) return b.id - a.id;
      return db.localeCompare(da);
    });
}

export default async function SpotterPage({ params }: PageProps) {
  const { slug } = await params;
  const name = spotterByslug.get(slug);
  if (!name) notFound();
  const mascots = mascotsForSpotter(name);

  // Top 3 spotters by count → which medal does this spotter wear?
  const counts = new Map<string, number>();
  for (const m of active) {
    if (!m.submitted_by) continue;
    counts.set(m.submitted_by, (counts.get(m.submitted_by) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const rankIndex = ranked.findIndex(([n]) => n === name);
  const medal = medalForRank(rankIndex);

  // Span: which states are represented in this spotter's contributions
  const states = Array.from(new Set(mascots.map((m) => m.state).filter(Boolean)));

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
          href="/recent"
          className="flex-shrink-0 rounded-full bg-[var(--cream)] px-[18px] py-2.5 text-sm font-extrabold text-[var(--tj-red)] shadow-[0_2px_0_var(--tj-red-dark)] transition hover:-translate-y-px max-sm:px-3 max-sm:text-xs"
        >
          <span className="max-sm:hidden">← Hall of Fame</span>
          <span className="hidden max-sm:inline">← Back</span>
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
      </div>

      <main className="flex-1 overflow-y-auto bg-[var(--cream)]">
        <div className="mx-auto max-w-6xl px-6 py-12 max-sm:px-4 sm:py-16">
          <Breadcrumbs
            className="mb-6"
            items={[
              { label: 'Map', href: '/' },
              { label: 'Hall of Fame', href: '/recent' },
              { label: name },
            ]}
          />
          {/* Spotter card */}
          <div className="mb-10 rounded-3xl bg-[var(--cream-dark)] px-6 py-8 text-center sm:px-12 sm:py-10">
            <div className="text-6xl">{medal}</div>
            <p className="mt-3 text-xs font-extrabold uppercase tracking-[0.4em] text-[var(--accent)]">
              Trader Joe&apos;s mascot spotter
            </p>
            <h2 className="mt-2 font-display text-5xl font-black leading-tight tracking-tight text-[var(--tj-red)] sm:text-6xl">
              {name}
            </h2>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm font-bold text-[var(--ink)]">
              <span className="rounded-full bg-[var(--cream)] px-3 py-1.5">
                📷 {mascots.length} {mascots.length === 1 ? 'mascot' : 'mascots'} contributed
              </span>
              {states.length > 0 && (
                <span className="rounded-full bg-[var(--cream)] px-3 py-1.5">
                  🗺️ {states.length} {states.length === 1 ? 'state' : 'states'}
                </span>
              )}
              {rankIndex >= 0 && rankIndex < 10 && (
                <span className="rounded-full bg-[var(--tj-red)] px-3 py-1.5 text-[var(--cream)]">
                  Hall of Fame · #{rankIndex + 1}
                </span>
              )}
            </div>
          </div>

          {/* Mascots grid */}
          <section>
            <h3 className="mb-5 font-display text-2xl font-extrabold text-[var(--ink)]">
              {mascots.length === 1 ? 'Their spot:' : 'Their spots:'}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {mascots.map((m) => (
                <SpotterMascotCard key={m.id} mascot={m} />
              ))}
            </div>
          </section>

          {/* Footer CTA */}
          <div className="mt-16 rounded-3xl bg-[var(--cream-dark)] px-6 py-10 text-center sm:px-10">
            <div className="text-5xl">📍</div>
            <h3 className="mt-3 font-display text-3xl font-extrabold text-[var(--tj-red)]">
              Add yourself to the Hall of Fame
            </h3>
            <p className="mx-auto mt-2 max-w-md text-base font-semibold text-[var(--ink-soft)]">
              Submit a mascot photo (with your email for credit) and your name will land here next to {name}&apos;s.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/"
                className="rounded-full bg-[var(--tj-red)] px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--cream)] shadow-[0_3px_0_var(--tj-red-dark)] transition hover:-translate-y-px"
              >
                Open the map →
              </Link>
              <Link
                href="/recent"
                className="rounded-full border-2 border-[var(--tj-red)] bg-[var(--cream)] px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--tj-red)] transition hover:-translate-y-px"
              >
                Recently spotted
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

function SpotterMascotCard({ mascot }: { mascot: RawMascot }) {
  const photo = mascot.has_photo && mascot.photo ? photoUrl(mascot.photo) : null;
  const emoji = emojiForAnimal(mascot.animal);
  const store = mascot.store_number ? storesByNum.get(mascot.store_number) : null;
  return (
    <Link
      href={`/mascot/${slugForMascot(mascot)}`}
      title={`Read about ${mascot.name || mascot.animal}`}
      className="group block overflow-hidden rounded-2xl bg-[var(--cream-dark)] transition hover:-translate-y-1 hover:shadow-card"
    >
      <div className="relative aspect-[4/3] w-full bg-[var(--cream)]">
        {photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photo}
            alt={`${mascot.name || 'Unnamed'} the ${mascot.animal} at Trader Joe's ${mascot.store}`}
            loading="lazy"
            className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--cream-dark)] to-[var(--accent)] text-[80px]">
            {emoji}
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center bg-[var(--tj-red)] py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[var(--cream)] opacity-0 transition-opacity group-hover:opacity-100">
          Read more →
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
            {store ? formatStoreLocation(store) : mascot.store}
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
