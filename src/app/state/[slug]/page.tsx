/**
 * Per-state SEO landing page.
 *
 * One static page is generated at build time for every state that has at
 * least one active mascot. Lists every mascot in that state grouped by
 * city, with a "X of Y stores mapped" stat line. Designed primarily for
 * search-engine discovery — someone Googling "trader joe's mascots
 * california" lands here and finds every mascot at once.
 *
 * Static-export-compatible: generateStaticParams enumerates the states,
 * dynamicParams=false 404s anything else.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import mascotsRaw from '@/data/mascots.json';
import storesData from '@/data/tj-stores.json';
import type { Store } from '@/lib/types';
import { slugForCity, slugForMascot } from '@/lib/slug';
import { stateName, stateSlug, stateCodeFromSlug, statesWithMascots } from '@/lib/state';
import { emojiForAnimal } from '@/lib/emoji';
import { photoUrl } from '@/lib/data';
import { SITE_URL } from '@/lib/site-url';
import MallardHead from '@/components/MallardHead';
import Breadcrumbs from '@/components/Breadcrumbs';

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
  source_url: string;
}

const stores = storesData as Store[];
const allMascots = (mascotsRaw as { mascots: RawMascot[] }).mascots;
const activeMascots = allMascots.filter((m) => !m.retired);

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return statesWithMascots(activeMascots).map((code) => ({ slug: stateSlug(code) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const code = stateCodeFromSlug(slug);
  if (!code) return { title: 'State not found — TJ Mascots' };

  const name = stateName(code);
  const stateMascots = activeMascots.filter((m) => m.state === code);
  const totalStores = stores.filter((s) => s.state === code).length;
  const url = `${SITE_URL}/state/${slug}`;

  const title = `Trader Joe's mascots in ${name} — ${stateMascots.length} mapped`;
  const description = `Every known Trader Joe's mascot in ${name}. ${stateMascots.length} of ${totalStores} stores have a known mascot — see who lives where, who's been spotted, and where to look next.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      siteName: 'TJ Mascots',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function StatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const code = stateCodeFromSlug(slug);
  if (!code) notFound();

  const name = stateName(code);
  const stateMascots = activeMascots
    .filter((m) => m.state === code)
    .sort((a, b) => (a.store || '').localeCompare(b.store || ''));
  const totalStores = stores.filter((s) => s.state === code).length;
  const percent = totalStores > 0 ? Math.round((stateMascots.length / totalStores) * 100) : 0;

  // Group mascots by city for the listing
  const byCity: Map<string, RawMascot[]> = new Map();
  for (const m of stateMascots) {
    const store = m.store_number ? stores.find((s) => s.store_number === m.store_number) : null;
    const city = store?.city || (m.store || '').replace(/\s*\([^)]*\)/g, '').trim() || 'Other';
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city)!.push(m);
  }
  const cities = [...byCity.entries()].sort((a, b) => a[0].localeCompare(b[0]));

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
      </div>

      <main className="flex-1 overflow-y-auto bg-[var(--cream)]">
        <div className="mx-auto max-w-5xl px-6 py-12 max-sm:px-4 sm:py-16">
          <Breadcrumbs
            className="mb-6"
            items={[
              { label: 'Map', href: '/' },
              { label: name },
            ]}
          />
          {/* Hero */}
          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.4em] text-[var(--accent)]">
              Mascots in
            </p>
            <h2 className="font-display text-5xl font-black leading-[0.92] tracking-tight text-[var(--tj-red)] sm:text-7xl">
              {name}
            </h2>
            <div className="mx-auto mt-4 h-1.5 w-24 rounded-full bg-[var(--accent)]" />
            <p className="mx-auto mt-5 max-w-xl text-base font-semibold text-[var(--ink-soft)]">
              <strong className="text-[var(--ink)]">{stateMascots.length}</strong> of{' '}
              <strong className="text-[var(--ink)]">{totalStores}</strong> Trader Joe&apos;s stores in {name} have a known mascot —{' '}
              <strong className="text-[var(--tj-red)]">{percent}%</strong> mapped.
            </p>
          </div>

          {/* Mascots by city */}
          <div className="space-y-8">
            {cities.map(([city, ms]) => {
              const cityHasMultipleStores =
                stores.filter((s) => s.state === code && s.city === city).length >= 2;
              const cityPagePath = cityHasMultipleStores
                ? `/city/${slugForCity(city, code)}`
                : null;
              return (
              <section key={city}>
                <div className="mb-3 flex items-baseline justify-between">
                  {cityPagePath ? (
                    <Link
                      href={cityPagePath}
                      className="font-display text-2xl font-extrabold text-[var(--ink)] hover:text-[var(--tj-red)] hover:underline"
                    >
                      {city} →
                    </Link>
                  ) : (
                    <h3 className="font-display text-2xl font-extrabold text-[var(--ink)]">{city}</h3>
                  )}
                  <span className="text-xs font-bold text-[var(--ink-soft)]">
                    {ms.length} {ms.length === 1 ? 'mascot' : 'mascots'}
                  </span>
                </div>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {ms.map((m) => {
                    const photo = m.has_photo && m.photo ? photoUrl(m.photo) : null;
                    return (
                      <li key={m.id}>
                        <Link
                          href={`/mascot/${slugForMascot(m)}`}
                          className="group block overflow-hidden rounded-2xl bg-[var(--cream-dark)] transition hover:-translate-y-px hover:shadow-card"
                        >
                          <div className="relative aspect-[4/3] w-full bg-[var(--cream)]">
                            {photo ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={photo}
                                alt={`${m.name || 'Unnamed'} the ${m.animal} at Trader Joe's ${city}`}
                                loading="lazy"
                                className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                              />
                            ) : (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src="/images/missing-mascot.jpg"
                                alt={`Photo of ${m.animal} at Trader Joe's ${city} not yet found`}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            )}
                          </div>
                          <div className="p-3">
                            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
                              {m.animal}
                            </div>
                            <div className="mt-0.5 truncate font-display text-base font-extrabold leading-tight text-[var(--tj-red)]">
                              {m.name || <span className="italic opacity-60">Unnamed</span>}
                            </div>
                            {(() => {
                              const sm = m.store_number ? stores.find((s) => s.store_number === m.store_number) : null;
                              const hood = sm?.neighborhood;
                              return (
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-[var(--ink-soft)]">
                                  {hood && <span>{hood}</span>}
                                  {m.store_number && (
                                    <span className="rounded-full bg-[var(--tj-red)] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[var(--cream)]">
                                      Store #{m.store_number}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
              );
            })}
          </div>

          {/* CTA */}
          <div className="mt-14 rounded-3xl bg-[var(--cream-dark)] px-6 py-10 text-center sm:px-10">
            <div className="text-5xl">🦆</div>
            <h3 className="mt-3 font-display text-3xl font-extrabold text-[var(--tj-red)]">
              Help fill in {name}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-base font-semibold text-[var(--ink-soft)]">
              {totalStores - stateMascots.length} {name} stores still need a mascot photo. Next time you&apos;re shopping,
              look up — and send us what you find.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/"
                className="rounded-full bg-[var(--tj-red)] px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--cream)] shadow-[0_3px_0_var(--tj-red-dark)] transition hover:-translate-y-px"
              >
                🗺️ Open the map
              </Link>
              <Link
                href="/recent"
                className="rounded-full border-2 border-[var(--tj-red)] bg-[var(--cream)] px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--tj-red)] transition hover:-translate-y-px"
              >
                ✨ Recently spotted
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
