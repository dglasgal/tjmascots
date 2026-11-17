import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { emojiForAnimal } from '@/lib/emoji';
import { photoUrl } from '@/lib/data';
import { slugForCity, slugForMascot } from '@/lib/slug';
import { stateName, stateSlug } from '@/lib/state';
import { SITE_URL } from '@/lib/site-url';
import { formatStreetAddress } from '@/lib/store-label';
import { safeJsonLd } from '@/lib/jsonld';
import {
  allStores,
  cityStoreCount,
  findStoreBySlug,
  mascotsAtStore,
  nearestMascotStores,
  slugForStore,
} from '@/lib/store-pages';
import type { Store } from '@/lib/types';
import MallardHead from '@/components/MallardHead';
import Breadcrumbs from '@/components/Breadcrumbs';

export const dynamic = 'force-static';
export const dynamicParams = false;

/**
 * One page per Trader Joe's store (added 2026-11-16 for SEO).
 * See src/lib/store-pages.ts for which ones go in the sitemap and how
 * canonical links work when a store already has a mascot.
 */
export function generateStaticParams(): { slug: string }[] {
  return allStores.map((s) => ({ slug: slugForStore(s) }));
}

function placeName(s: Store): string {
  return s.neighborhood ? `${s.city} — ${s.neighborhood}` : s.city;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const s = findStoreBySlug(slug);
  if (!s) return { title: 'Store not found — TJ Mascots' };
  const here = mascotsAtStore(s.store_number);
  const lead = here[0];
  const where = s.neighborhood ? `${s.city} (${s.neighborhood})` : s.city;
  const title = lead
    ? `Trader Joe's ${where}, ${s.state} mascot: ${lead.name || `the ${lead.animal}`} — TJ Mascots`
    : `Trader Joe's ${where}, ${s.state} mascot — TJ Mascots`;
  const near = nearestMascotStores(s, 1)[0];
  const description = lead
    ? `Meet ${lead.name || `the ${lead.animal}`}, the ${lead.animal} mascot at Trader Joe's #${s.store_number}, ${s.street}, ${s.city}, ${s.state}.`
    : s.opening_soon
      ? `Trader Joe's #${s.store_number} at ${s.street}, ${s.city}, ${s.state} is opening soon. Be the first to spot its store mascot and add it to the TJ Mascots fan map.`
      : `Who's the mascot at Trader Joe's #${s.store_number}, ${s.street}, ${s.city}, ${s.state}? Nobody has spotted it yet${
          near ? ` — the nearest known mascot is ${near.mascot.name || `a ${near.mascot.animal.toLowerCase()}`} in ${near.store.city}, ${Math.round(near.miles)} mi away` : ''
        }. Help find it.`;
  // Stores with a mascot point search engines at the mascot page.
  const canonical = lead
    ? `${SITE_URL}/mascot/${slugForMascot(lead)}`
    : `${SITE_URL}/store/${slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: `${SITE_URL}/store/${slug}`,
      title,
      description,
      siteName: 'TJ Mascots',
    },
    twitter: { card: 'summary', title, description },
  };
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const s = findStoreBySlug(slug);
  if (!s) notFound();

  const here = mascotsAtStore(s.store_number);
  const nearby = nearestMascotStores(s, 4);
  const stateLabel = stateName(s.state) || s.state;
  const hasCityPage = cityStoreCount(s) >= 2;
  const cityPath = hasCityPage ? `/city/${slugForCity(s.city, s.state)}` : null;
  const address = formatStreetAddress({ street: s.street, city: s.city, state: s.state, zip: s.zip });
  const mapLink = `/?store=${s.store_number}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'GroceryStore',
    name: `Trader Joe's ${placeName(s)}`,
    url: `${SITE_URL}/store/${slug}`,
    ...(s.url ? { sameAs: s.url } : {}),
    ...(s.phone ? { telephone: s.phone } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: s.street,
      addressLocality: s.city,
      addressRegion: s.state,
      postalCode: s.zip,
      addressCountry: 'US',
    },
    geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng },
  };

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
        <div className="mx-auto max-w-3xl px-6 py-12 max-sm:px-4 sm:py-16">
          <Breadcrumbs
            className="mb-6"
            items={[
              { label: 'Map', href: '/' },
              { label: stateLabel, href: `/state/${stateSlug(s.state)}` },
              ...(cityPath ? [{ label: s.city, href: cityPath }] : []),
              { label: `Store #${s.store_number}` },
            ]}
          />

          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.4em] text-[var(--accent)]">
              The mascot at Trader Joe&apos;s
            </p>
            <h2 className="font-display text-5xl font-black leading-[0.92] tracking-tight text-[var(--tj-red)] sm:text-6xl">
              {s.city}
            </h2>
            {s.neighborhood && (
              <p className="mt-2 font-display text-2xl font-extrabold text-[var(--ink)]">{s.neighborhood}</p>
            )}
            <div className="mx-auto mt-4 h-1.5 w-24 rounded-full bg-[var(--accent)]" />
            <p className="mt-5 text-base font-semibold text-[var(--ink-soft)]">{address}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-[var(--tj-red)] px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-[var(--cream)]">
                Store #{s.store_number}
              </span>
              {s.opening_soon && (
                <span className="rounded-full border-2 border-dashed border-[var(--tj-red)] px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider text-[var(--tj-red)]">
                  Opening soon
                </span>
              )}
              {s.phone && (
                <a
                  href={`tel:${s.phone}`}
                  className="rounded-full bg-[var(--cream-dark)] px-3 py-1 text-xs font-extrabold text-[var(--ink)] hover:text-[var(--tj-red)]"
                >
                  📞 {s.phone}
                </a>
              )}
            </div>
          </div>

          {here.length > 0 ? (
            <section className="mb-12">
              <h3 className="mb-4 text-center font-display text-2xl font-extrabold text-[var(--ink)]">
                {here.length === 1 ? 'Who lives here' : `${here.length} mascots live here`}
              </h3>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {here.map((m) => {
                  const photo = m.has_photo && m.photo ? photoUrl(m.photo) : '/images/missing-mascot.jpg';
                  return (
                    <li key={m.id}>
                      <Link
                        href={`/mascot/${slugForMascot(m)}`}
                        className="group flex items-center gap-4 rounded-2xl bg-[var(--cream-dark)] p-4 transition hover:-translate-y-px hover:shadow-card"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo || '/images/missing-mascot.jpg'}
                          alt={`${m.name || 'Unnamed'} the ${m.animal} at Trader Joe's ${s.city}`}
                          className="h-24 w-24 flex-shrink-0 rounded-xl object-cover"
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
                            {emojiForAnimal(m.animal)} {m.animal}
                          </div>
                          <div className="font-display text-2xl font-extrabold leading-tight text-[var(--tj-red)] group-hover:underline">
                            {m.name || `Unnamed ${m.animal}`}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <section className="mb-12 rounded-3xl bg-[var(--cream-dark)] px-6 py-10 text-center sm:px-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/missing-mascot.jpg"
                alt={`The mascot at Trader Joe's ${s.city} hasn't been spotted yet`}
                className="mx-auto h-32 w-32 rounded-2xl object-cover"
              />
              <h3 className="mt-5 font-display text-3xl font-extrabold text-[var(--tj-red)]">
                {s.opening_soon ? 'A brand-new store, a mascot to meet' : 'Nobody has spotted this mascot yet'}
              </h3>
              <p className="mx-auto mt-3 max-w-lg text-base font-semibold text-[var(--ink-soft)]">
                {s.opening_soon
                  ? `This Trader Joe's hasn't opened its doors yet. Once it does, a new crew mascot will move in — be the first to introduce them to the map.`
                  : `Most Trader Joe's stores have a resident animal who spends the day hiding somewhere on the sales floor. The ${s.city} crew knows exactly who lives here — next time you shop, look up, ask around, and tell us who you meet.`}
              </p>
              <Link
                href={mapLink}
                className="mt-6 inline-block rounded-full bg-[var(--tj-red)] px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--cream)] shadow-[0_3px_0_var(--tj-red-dark)] transition hover:-translate-y-px"
              >
                📸 Spotted it? Add it on the map
              </Link>
            </section>
          )}

          {nearby.length > 0 && (
            <section className="mb-12">
              <h3 className="mb-4 font-display text-2xl font-extrabold text-[var(--ink)]">
                Known mascots nearby
              </h3>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {nearby.map(({ store, mascot, miles }) => {
                  const photo = mascot.has_photo && mascot.photo ? photoUrl(mascot.photo) : '/images/missing-mascot.jpg';
                  return (
                    <li key={mascot.id}>
                      <Link
                        href={`/mascot/${slugForMascot(mascot)}`}
                        className="group flex items-center gap-3 rounded-2xl bg-[var(--cream-dark)] p-3 transition hover:-translate-y-px hover:shadow-card"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo || '/images/missing-mascot.jpg'}
                          alt={`${mascot.name || 'Unnamed'} the ${mascot.animal} at Trader Joe's ${store.city}`}
                          loading="lazy"
                          className="h-16 w-16 flex-shrink-0 rounded-xl object-cover"
                        />
                        <div className="min-w-0">
                          <div className="truncate font-display text-lg font-extrabold leading-tight text-[var(--tj-red)] group-hover:underline">
                            {mascot.name || `Unnamed ${mascot.animal}`}
                          </div>
                          <div className="text-[12px] font-bold text-[var(--ink-soft)]">
                            {emojiForAnimal(mascot.animal)} {mascot.animal} · {placeName(store)}, {store.state}
                          </div>
                          <div className="text-[11px] font-semibold text-[var(--ink-soft)]">
                            {miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi away
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            {cityPath && (
              <Link
                href={cityPath}
                className="rounded-full border-2 border-[var(--tj-red)] bg-[var(--cream)] px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--tj-red)] transition hover:-translate-y-px"
              >
                All {s.city} stores
              </Link>
            )}
            <Link
              href={`/state/${stateSlug(s.state)}`}
              className="rounded-full border-2 border-[var(--tj-red)] bg-[var(--cream)] px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--tj-red)] transition hover:-translate-y-px"
            >
              All {stateLabel} mascots
            </Link>
            <Link
              href={mapLink}
              className="rounded-full bg-[var(--tj-red)] px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--cream)] shadow-[0_2px_0_var(--tj-red-dark)] transition hover:-translate-y-px"
            >
              🗺️ See it on the map →
            </Link>
          </div>

          <footer className="mt-16 border-t border-[var(--cream-dark)] pt-6 text-center text-xs font-semibold text-[var(--ink-soft)]">
            A fan project. Unaffiliated with Trader Joe&apos;s Company.
          </footer>
        </div>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
    </div>
  );
}
