import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import mascotsRaw from '@/data/mascots.json';
import storesData from '@/data/tj-stores.json';
import { emojiForAnimal } from '@/lib/emoji';
import { photoUrl } from '@/lib/data';
import { slugForMascot } from '@/lib/slug';
import { stateName, stateSlug } from '@/lib/state';
import { SITE_URL } from '@/lib/site-url';
import { formatStreetAddress } from '@/lib/store-label';
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
}

const stores = storesData as Store[];
const allMascots = (mascotsRaw as { mascots: RawMascot[] }).mascots;
const activeMascots = allMascots.filter((m) => !m.retired);

/**
 * Per-city pages for cities with 2+ TJ stores. Single-store cities
 * already show clearly on the state page; per-city pages are only a
 * win when there's something to disambiguate (Atlanta — Buckhead vs
 * Atlanta — Midtown).
 *
 * Slug shape: `{city-slug}-{state-slug}` (e.g., long-beach-ca,
 * brooklyn-ny). The state suffix prevents collisions across states.
 */
function citySlug(city: string, state: string): string {
  return (
    city
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') +
    '-' +
    state.toLowerCase()
  );
}

interface CityKey {
  city: string;
  state: string;
}

/** Cities with 2+ TJ stores (the only ones we generate pages for). */
function multiStoreCities(): CityKey[] {
  const counts = new Map<string, { count: number; entry: CityKey }>();
  for (const s of stores) {
    const key = `${s.city}|${s.state}`;
    const cur = counts.get(key);
    if (cur) cur.count++;
    else counts.set(key, { count: 1, entry: { city: s.city, state: s.state } });
  }
  return [...counts.values()].filter((v) => v.count >= 2).map((v) => v.entry);
}

export function generateStaticParams(): { slug: string }[] {
  return multiStoreCities().map((c) => ({ slug: citySlug(c.city, c.state) }));
}

function findCityBySlug(slug: string): CityKey | null {
  return multiStoreCities().find((c) => citySlug(c.city, c.state) === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const city = findCityBySlug(slug);
  if (!city) return { title: 'City not found — TJ Mascots' };
  const cityStores = stores.filter((s) => s.city === city.city && s.state === city.state);
  const cityMascots = activeMascots.filter(
    (m) => m.store_number && cityStores.some((s) => s.store_number === m.store_number),
  );
  const stateLabel = stateName(city.state) || city.state;
  const title = `Trader Joe's mascots in ${city.city}, ${stateLabel} — TJ Mascots`;
  const description = `${cityMascots.length} of ${cityStores.length} Trader Joe's stores in ${city.city}, ${stateLabel} have a known mascot. Browse every TJ mascot in ${city.city} on the TJ Mascots fan map.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/city/${slug}` },
    openGraph: {
      type: 'website',
      url: `${SITE_URL}/city/${slug}`,
      title,
      description,
      siteName: 'TJ Mascots',
    },
    twitter: { card: 'summary', title, description },
  };
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const city = findCityBySlug(slug);
  if (!city) notFound();

  const cityStores = stores
    .filter((s) => s.city === city.city && s.state === city.state)
    .sort((a, b) => (a.neighborhood || '').localeCompare(b.neighborhood || ''));
  const stateLabel = stateName(city.state) || city.state;

  // Pair each store with its mascot (if any)
  const pairs = cityStores.map((s) => ({
    store: s,
    mascot: activeMascots.find((m) => m.store_number === s.store_number) || null,
  }));
  const mappedCount = pairs.filter((p) => p.mascot && p.mascot.has_photo).length;

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
      </div>

      <main className="flex-1 overflow-y-auto bg-[var(--cream)]">
        <div className="mx-auto max-w-5xl px-6 py-12 max-sm:px-4 sm:py-16">
          <Breadcrumbs
            className="mb-6"
            items={[
              { label: 'Map', href: '/' },
              { label: stateLabel, href: `/state/${stateSlug(city.state)}` },
              { label: city.city },
            ]}
          />

          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.4em] text-[var(--accent)]">
              Trader Joe&apos;s mascots in
            </p>
            <h2 className="font-display text-5xl font-black leading-[0.92] tracking-tight text-[var(--tj-red)] sm:text-7xl">
              {city.city}
            </h2>
            <div className="mx-auto mt-4 h-1.5 w-24 rounded-full bg-[var(--accent)]" />
            <p className="mx-auto mt-5 max-w-xl text-base font-semibold text-[var(--ink-soft)]">
              <strong className="text-[var(--ink)]">{cityStores.length}</strong> Trader
              Joe&apos;s {cityStores.length === 1 ? 'store' : 'stores'} in {city.city},{' '}
              {stateLabel}.{' '}
              <strong className="text-[var(--tj-red)]">{mappedCount}</strong>{' '}
              {mappedCount === 1 ? 'has a known mascot photo' : 'have known mascot photos'}.
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {pairs.map(({ store, mascot }) => {
              const photo = mascot?.has_photo && mascot.photo ? photoUrl(mascot.photo) : null;
              const target = mascot
                ? `/mascot/${slugForMascot(mascot)}`
                : `/?store=${store.store_number}`;
              return (
                <li key={store.store_number}>
                  <Link
                    href={target}
                    className="group flex items-stretch gap-4 rounded-2xl bg-[var(--cream-dark)] p-4 transition hover:-translate-y-px hover:bg-[var(--cream)] hover:shadow-card"
                  >
                    <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--cream)] text-4xl">
                      {photo ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={photo}
                          alt={`${mascot?.name || mascot?.animal} at Trader Joe's ${city.city} — ${store.neighborhood || ''}`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src="/images/missing-mascot.jpg"
                          alt={
                            mascot
                              ? `Photo of ${mascot.animal} at Trader Joe's ${city.city} not yet found`
                              : `Mascot for Trader Joe's ${city.city} ${store.neighborhood || ''} not yet known`
                          }
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
                        {store.neighborhood || 'TJ Store'}
                      </div>
                      <div className="font-display text-xl font-extrabold leading-tight text-[var(--tj-red)] group-hover:underline">
                        {mascot?.name ||
                          (mascot ? `Unnamed ${mascot.animal}` : 'Mascot unknown')}
                      </div>
                      {mascot && (
                        <div className="text-[12px] font-bold text-[var(--ink-soft)]">
                          {mascot.animal}
                        </div>
                      )}
                      <div className="mt-1.5 text-[11px] text-[var(--ink-soft)]">
                        {formatStreetAddress({
                          street: store.street,
                          city: store.city,
                          state: store.state,
                          zip: store.zip,
                        })}
                      </div>
                      <div className="mt-1.5 flex">
                        <span className="rounded-full bg-[var(--tj-red)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--cream)]">
                          Store #{store.store_number}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/state/${stateSlug(city.state)}`}
              className="rounded-full border-2 border-[var(--tj-red)] bg-[var(--cream)] px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--tj-red)] transition hover:-translate-y-px"
            >
              All {stateLabel} mascots
            </Link>
            <Link
              href="/"
              className="rounded-full bg-[var(--tj-red)] px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--cream)] shadow-[0_2px_0_var(--tj-red-dark)] transition hover:-translate-y-px"
            >
              🗺️ Open the map →
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
