import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import mascotsRaw from '@/data/mascots.json';
import storesData from '@/data/tj-stores.json';
import { emojiForAnimal } from '@/lib/emoji';
import { photoUrl } from '@/lib/data';
import { slugForAnimal, slugForMascot } from '@/lib/slug';
import { stateName } from '@/lib/state';
import { SITE_URL } from '@/lib/site-url';
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
  submitted_by?: string | null;
}

const stores = storesData as Store[];
const storesByNum = new Map(stores.map((s) => [s.store_number, s]));
const allMascots = (mascotsRaw as { mascots: RawMascot[] }).mascots;
const activeMascots = allMascots.filter((m) => !m.retired);

/**
 * Per-animal browse pages — one per unique animal type, including
 * singletons. Captures queries like "trader joe's monkey mascot",
 * "all the trader joe's bears", and direct lookups like
 * "trader joe's capybara mascot" even when there's just one.
 */
function animalCounts(): Map<string, RawMascot[]> {
  const m = new Map<string, RawMascot[]>();
  for (const x of activeMascots) {
    const a = (x.animal || '').trim();
    if (!a) continue;
    if (!m.has(a)) m.set(a, []);
    m.get(a)!.push(x);
  }
  return m;
}

function eligibleAnimals(): { animal: string; mascots: RawMascot[] }[] {
  return [...animalCounts().entries()]
    .map(([animal, mascots]) => ({ animal, mascots }));
}

export function generateStaticParams(): { slug: string }[] {
  return eligibleAnimals().map(({ animal }) => ({ slug: slugForAnimal(animal) }));
}

function findAnimalBySlug(slug: string): { animal: string; mascots: RawMascot[] } | null {
  return eligibleAnimals().find((e) => slugForAnimal(e.animal) === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = findAnimalBySlug(slug);
  if (!found) return { title: 'Animal not found — TJ Mascots' };
  const { animal, mascots } = found;
  const lower = animal.toLowerCase();
  const title = `Every Trader Joe's ${animal} mascot — ${mascots.length} found — TJ Mascots`;
  const description = `Browse all ${mascots.length} Trader Joe's stores with a ${lower} as their mascot — names, locations, and photos. Part of the TJ Mascots fan map.`;
  const url = `${SITE_URL}/animal/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, title, description, siteName: 'TJ Mascots' },
    twitter: { card: 'summary', title, description },
  };
}

export default async function AnimalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const found = findAnimalBySlug(slug);
  if (!found) notFound();
  const { animal, mascots } = found;
  const emoji = emojiForAnimal(animal);

  // Group by state for a cleaner listing
  const byState = new Map<string, RawMascot[]>();
  for (const m of mascots) {
    const s = m.state || '??';
    if (!byState.has(s)) byState.set(s, []);
    byState.get(s)!.push(m);
  }
  const states = [...byState.entries()].sort((a, b) =>
    (stateName(a[0]) || a[0]).localeCompare(stateName(b[0]) || b[0]),
  );

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
              { label: 'Browse by animal', href: '/animal' },
              { label: animal },
            ]}
          />

          <div className="mb-10 text-center">
            <div className="text-7xl">{emoji}</div>
            <p className="mt-3 text-xs font-extrabold uppercase tracking-[0.4em] text-[var(--accent)]">
              Every Trader Joe&apos;s
            </p>
            <h2 className="mt-1 font-display text-5xl font-black leading-[0.92] tracking-tight text-[var(--tj-red)] sm:text-7xl">
              {animal}
            </h2>
            <div className="mx-auto mt-4 h-1.5 w-24 rounded-full bg-[var(--accent)]" />
            <p className="mx-auto mt-5 max-w-xl text-base font-semibold text-[var(--ink-soft)]">
              <strong className="text-[var(--ink)]">{mascots.length}</strong>{' '}
              Trader Joe&apos;s {mascots.length === 1 ? 'store has a' : 'stores have a'}{' '}
              {animal.toLowerCase()} as {mascots.length === 1 ? 'its' : 'their'} mascot — across{' '}
              <strong className="text-[var(--ink)]">{states.length}</strong>{' '}
              {states.length === 1 ? 'state' : 'states'}.
            </p>
          </div>

          <div className="space-y-8">
            {states.map(([code, ms]) => (
              <section key={code}>
                <h3 className="mb-3 font-display text-2xl font-extrabold text-[var(--ink)]">
                  {stateName(code) || code}
                </h3>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {ms.map((m) => {
                    const photo = m.has_photo && m.photo ? photoUrl(m.photo) : null;
                    const store = m.store_number ? storesByNum.get(m.store_number) : null;
                    const cityHood = store
                      ? `${formatStoreLocation({ city: store.city, neighborhood: store.neighborhood })}, ${store.state}`
                      : `${m.store}${m.state ? `, ${m.state}` : ''}`;
                    return (
                      <li key={m.id}>
                        <Link
                          href={`/mascot/${slugForMascot(m)}`}
                          className="group flex h-full items-center gap-3 rounded-2xl bg-[var(--cream-dark)] p-3 transition hover:-translate-y-px hover:bg-[var(--cream)] hover:shadow-card"
                        >
                          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--cream)] text-3xl">
                            {photo ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={photo}
                                alt={`${m.name || 'Unnamed'} the ${m.animal} at Trader Joe's ${cityHood}`}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src="/images/missing-mascot.jpg"
                                alt={`Photo of ${m.animal} at Trader Joe's ${cityHood} not yet found`}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-display text-base font-extrabold text-[var(--tj-red)] group-hover:underline">
                              {m.name || `Unnamed ${m.animal}`}
                            </div>
                            <div className="truncate text-[12px] font-bold text-[var(--ink-soft)]">
                              {cityHood}
                            </div>
                            {m.store_number && (
                              <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                                #{m.store_number}
                              </div>
                            )}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

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
