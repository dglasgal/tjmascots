import type { Metadata } from 'next';
import Link from 'next/link';
import mascotsRaw from '@/data/mascots.json';
import { emojiForAnimal } from '@/lib/emoji';
import { slugForAnimal } from '@/lib/slug';
import { SITE_URL } from '@/lib/site-url';
import MallardHead from '@/components/MallardHead';
import Breadcrumbs from '@/components/Breadcrumbs';

export const dynamic = 'force-static';

interface RawMascot {
  id: number;
  animal: string;
  retired?: boolean;
}

const allMascots = (mascotsRaw as { mascots: RawMascot[] }).mascots;
const activeMascots = allMascots.filter((m) => !m.retired);

interface AnimalEntry {
  animal: string;
  count: number;
  emoji: string;
  slug: string;
}

/** Sorted list of every animal with at least one active mascot.
 *  Every animal links to its own /animal/{slug} page, including
 *  singletons. */
function allAnimals(): AnimalEntry[] {
  const counts = new Map<string, number>();
  for (const m of activeMascots) {
    const a = (m.animal || '').trim();
    if (!a) continue;
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([animal, count]) => ({
      animal,
      count,
      emoji: emojiForAnimal(animal),
      slug: slugForAnimal(animal),
    }))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return a.animal.localeCompare(b.animal);
    });
}

export const metadata: Metadata = {
  title: "Browse Trader Joe's mascots by animal — TJ Mascots",
  description:
    "Browse every type of animal Trader Joe's stores have chosen as a mascot — monkeys, octopuses, parrots, bears, sharks, turtles, and over a hundred more. Pick your favorite to see where each one lives.",
  alternates: { canonical: `${SITE_URL}/animal` },
  openGraph: {
    type: 'website',
    title: "Browse TJ Mascots by animal",
    description: "Every animal type used as a Trader Joe's store mascot.",
    url: `${SITE_URL}/animal`,
    siteName: 'TJ Mascots',
  },
};

export default function AnimalIndexPage() {
  const animals = allAnimals();

  return (
    <div className="flex h-full flex-col">
      <header className="relative z-[1000] flex items-center justify-between gap-3 bg-[var(--tj-red)] px-6 py-3 text-[var(--cream)] shadow-card max-sm:gap-2 max-sm:px-3">
        <div className="flex flex-shrink-0 items-center gap-3.5 max-sm:gap-2">
          <Link
            href="/"
            aria-label="Back to the map"
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
          className="flex-shrink-0 rounded-full bg-[var(--cream)] px-[18px] py-2.5 text-sm font-extrabold text-[var(--tj-red)] shadow-[0_2px_0_var(--tj-red-dark)] transition hover:-translate-y-px hover:shadow-[0_4px_0_var(--tj-red-dark)] max-sm:px-3 max-sm:text-xs"
        >
          <span className="max-sm:hidden">🗺️ Open the map →</span>
          <span className="hidden max-sm:inline">🗺️ Map →</span>
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
        <div className="mx-auto max-w-5xl px-6 py-12 max-sm:px-4 sm:py-16">
          <Breadcrumbs
            className="mb-6"
            items={[
              { label: 'Map', href: '/' },
              { label: 'Browse by animal' },
            ]}
          />

          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.4em] text-[var(--accent)]">
              Browse by
            </p>
            <h2 className="font-display text-5xl font-black leading-[0.92] tracking-tight text-[var(--tj-red)] sm:text-7xl">
              ANIMAL
            </h2>
            <div className="mx-auto mt-4 h-1.5 w-24 rounded-full bg-[var(--accent)]" />
            <p className="mx-auto mt-5 max-w-xl text-base font-semibold text-[var(--ink-soft)]">
              <strong className="text-[var(--ink)]">{animals.length}</strong> different
              kinds of animals (and a few non-animals) have served as Trader Joe&apos;s mascots.
              Click any to see every store that has one.
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {animals.map((a) => {
              const inner = (
                <>
                  <span className="text-3xl">{a.emoji}</span>
                  <div className="min-w-0">
                    <div className="truncate font-display text-base font-extrabold text-[var(--ink)] group-hover:text-[var(--tj-red)]">
                      {a.animal}
                    </div>
                    <div className="text-[11px] font-bold text-[var(--ink-soft)]">
                      {a.count} {a.count === 1 ? 'mascot' : 'mascots'}
                    </div>
                  </div>
                </>
              );
              return (
                <li key={a.animal}>
                  <Link
                    href={`/animal/${a.slug}`}
                    className="group flex h-full items-center gap-3 rounded-2xl bg-[var(--cream-dark)] p-3 transition hover:-translate-y-px hover:bg-[var(--cream)] hover:shadow-card"
                  >
                    {inner}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="rounded-full bg-[var(--tj-red)] px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--cream)] shadow-[0_2px_0_var(--tj-red-dark)] transition hover:-translate-y-px"
            >
              🗺️ Open the map →
            </Link>
            <Link
              href="/recent"
              className="rounded-full border-2 border-[var(--tj-red)] bg-[var(--cream)] px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--tj-red)] transition hover:-translate-y-px"
            >
              ✨ Recently spotted
            </Link>
          </div>

          <footer className="mt-16 border-t border-[var(--cream-dark)] pt-6 text-center text-xs font-semibold text-[var(--ink-soft)]">
            A fan project. Unaffiliated with Trader Joe&apos;s Company.
          </footer>
        </div>
      </main>
    </div>
  );
}
