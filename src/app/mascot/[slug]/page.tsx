/**
 * Per-mascot SEO page.
 *
 * One static page is generated at build time for every mascot, at
 * /mascot/{slug}. Each page has its own <title>, <meta description>,
 * Open Graph tags (so iMessage / Twitter / Slack previews look great),
 * Twitter card tags, and JSON-LD structured data.
 *
 * The interactive map lives at /. This page is a static marketing /
 * SEO surface — it lets Google index every mascot, and gives shoppers
 * a clean shareable URL for "this is the mascot at my TJ's."
 *
 * Compatible with `output: 'export'` because:
 *   - generateStaticParams enumerates every mascot id at build time
 *   - dynamicParams = false → unknown slugs return 404 instead of trying
 *     to render at runtime
 *   - All data comes from the local JSON files (no Supabase fetch
 *     needed at build time)
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import mascotsRaw from '@/data/mascots.json';
import storesData from '@/data/tj-stores.json';
import type { Store } from '@/lib/types';
import { slugForMascot } from '@/lib/slug';
import { emojiForAnimal } from '@/lib/emoji';
import { photoUrl } from '@/lib/data';
import { SITE_URL } from '@/lib/site-url';

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
  created_at?: string;
  submitted_by?: string | null;
}

const stores = storesData as Store[];
const storesByNum = new Map(stores.map((s) => [s.store_number, s]));
const allMascots = (mascotsRaw as { mascots: RawMascot[] }).mascots;
// Active mascots only — retired entries shouldn't get their own SEO page.
const activeMascots = allMascots.filter((m) => !m.retired);

// Static export prerequisites
export const dynamic = 'force-static';
export const dynamicParams = false;

/** Enumerate every mascot to pre-render at build time. */
export function generateStaticParams() {
  return activeMascots.map((m) => ({ slug: slugForMascot(m) }));
}

/** Pull the mascot for a given slug (used by both metadata + page). */
function findMascotBySlug(slug: string): RawMascot | null {
  return activeMascots.find((m) => slugForMascot(m) === slug) ?? null;
}

/** Produce per-page <title>, description, Open Graph tags for sharing. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const m = findMascotBySlug(slug);
  if (!m) return { title: 'Mascot not found — TJ Mascots' };

  const store = m.store_number ? storesByNum.get(m.store_number) : null;
  const storeLabel = store ? `${store.city}, ${store.state}` : `${m.store}, ${m.state}`;
  const storeNum = m.store_number ? ` (Store #${m.store_number})` : '';
  const displayName = m.name || `Unnamed ${m.animal}`;

  const title = `${displayName} the ${m.animal} — Trader Joe's ${storeLabel}${storeNum}`;
  const description = m.notes
    ? truncate(m.notes, 200)
    : `${displayName} the ${m.animal}, the resident mascot at the Trader Joe's in ${storeLabel}. Discover every TJ's mascot at TJ Mascots.`;

  const url = `${SITE_URL}/mascot/${slug}`;
  const ogImage = m.has_photo && m.photo ? `${SITE_URL}${photoUrl(m.photo)}` : undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      siteName: 'TJ Mascots',
      images: ogImage ? [{ url: ogImage, alt: `${displayName} the ${m.animal}` }] : undefined,
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function MascotPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const m = findMascotBySlug(slug);
  if (!m) notFound();

  const store = m.store_number ? storesByNum.get(m.store_number) : null;
  const photoSrc = m.has_photo && m.photo ? photoUrl(m.photo) : null;
  const emoji = emojiForAnimal(m.animal);
  const displayName = m.name || `Unnamed ${m.animal}`;
  const storeLabel = store ? `${store.city}, ${store.state}` : `${m.store}, ${m.state}`;

  // JSON-LD structured data — helps Google understand the page is about
  // a specific physical place (the store) and the mascot living there.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: `Trader Joe's ${storeLabel}${m.store_number ? ` #${m.store_number}` : ''}`,
    description: `Home of ${displayName} the ${m.animal}. ${m.notes || ''}`.trim(),
    ...(store && {
      address: {
        '@type': 'PostalAddress',
        streetAddress: store.street,
        addressLocality: store.city,
        addressRegion: store.state,
        postalCode: store.zip,
        addressCountry: 'US',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: store.lat,
        longitude: store.lng,
      },
    }),
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header — matches /about and /privacy patterns */}
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
            <h1 className="font-display text-2xl font-black leading-none tracking-tight">
              TJ Mascots
            </h1>
            <p className="mt-0.5 text-xs font-semibold opacity-80 max-[700px]:hidden">
              an unofficial map of every Trader Joe&apos;s store mascot
            </p>
          </Link>
        </div>
        <Link
          href={`/?mascot=${m.id}`}
          aria-label="See on the map"
          className="flex-shrink-0 rounded-full bg-[var(--cream)] px-[18px] py-2.5 text-sm font-extrabold text-[var(--tj-red)] shadow-[0_2px_0_var(--tj-red-dark)] transition hover:-translate-y-px hover:shadow-[0_4px_0_var(--tj-red-dark)] max-sm:px-3 max-sm:text-xs"
        >
          <span className="max-sm:hidden">🗺️ See on the map →</span>
          <span className="hidden max-sm:inline">🗺️ Map →</span>
        </Link>
      </header>

      <div className="bg-[var(--cream-dark)] px-6 py-1.5 text-center text-[11px] font-bold text-[var(--ink-soft)]">
        Fan project. Not affiliated with Trader Joe&apos;s Company. &ldquo;Trader Joe&apos;s&rdquo; is a
        trademark of Trader Joe&apos;s Company.{' '}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-[var(--tj-red)]">
          Privacy
        </Link>
      </div>

      <main className="flex-1 overflow-y-auto bg-[var(--cream)]">
        <div className="mx-auto max-w-3xl px-6 py-10 max-sm:px-4 sm:py-12">
          {/* Animal type label */}
          <div className="text-center text-xs font-extrabold uppercase tracking-[0.3em] text-[var(--accent)]">
            {m.animal}
          </div>

          {/* Mascot name */}
          <h2 className="mt-2 text-center font-display text-5xl font-black leading-none tracking-tight text-[var(--tj-red)] sm:text-6xl">
            {displayName}
          </h2>
          <div className="mx-auto mt-3 h-1.5 w-20 rounded-full bg-[var(--accent)]" />

          {/* Photo */}
          <div className="mt-8">
            {photoSrc ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={photoSrc}
                alt={`${displayName} the ${m.animal}, photographed at the Trader Joe's in ${storeLabel}`}
                className="mx-auto max-h-[480px] w-auto rounded-3xl shadow-card"
              />
            ) : (
              <div className="mx-auto flex aspect-square max-w-[360px] items-center justify-center rounded-3xl bg-gradient-to-br from-[var(--cream-dark)] to-[var(--accent)] text-[180px]">
                {emoji}
              </div>
            )}
            {m.submitted_by && (
              <p className="mt-3 text-center text-xs font-semibold italic text-[var(--ink-soft)]">
                📷 Photo by {m.submitted_by}
              </p>
            )}
          </div>

          {/* Store */}
          <div className="mt-8 text-center">
            <div className="font-display text-2xl font-extrabold text-[var(--ink)]">
              Trader Joe&apos;s {storeLabel}
              {m.store_number && (
                <span className="ml-2 inline-block rounded-full bg-[var(--tj-red)] px-2.5 py-1 align-middle text-xs font-extrabold uppercase tracking-wider text-[var(--cream)]">
                  Store #{m.store_number}
                </span>
              )}
            </div>
            {store && (
              <div className="mt-1 text-sm font-semibold text-[var(--ink-soft)]">
                {store.street} · {store.zip}
              </div>
            )}
          </div>

          {/* Notes */}
          {m.notes && (
            <div className="mt-8 rounded-3xl bg-[var(--cream-dark)] px-6 py-6 text-center text-[17px] leading-relaxed text-[var(--ink)] sm:px-10">
              {m.notes}
            </div>
          )}

          {/* Source */}
          {m.source_url && (
            <div className="mt-6 text-center text-xs font-semibold text-[var(--ink-soft)]">
              Source:{' '}
              {m.source_url.startsWith('http') ? (
                <a
                  href={m.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-[var(--tj-red)] underline-offset-2 hover:underline"
                >
                  {sourceLabel(m.source_url)}
                </a>
              ) : (
                <span>{m.source_url}</span>
              )}
            </div>
          )}

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/?mascot=${m.id}`}
              className="rounded-full bg-[var(--tj-red)] px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--cream)] shadow-[0_3px_0_var(--tj-red-dark)] transition hover:-translate-y-px"
            >
              🗺️ See {displayName} on the map →
            </Link>
            <Link
              href="/recent"
              className="rounded-full border-2 border-[var(--tj-red)] bg-[var(--cream)] px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--tj-red)] transition hover:-translate-y-px"
            >
              ✨ Recently spotted
            </Link>
          </div>

          <footer className="mt-16 border-t border-[var(--cream-dark)] pt-6 text-center text-xs font-semibold text-[var(--ink-soft)]">
            A fan project. Unaffiliated with Trader Joe&apos;s Company.
          </footer>
        </div>
      </main>

      {/* JSON-LD structured data for Google rich results */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}

/* ----------------------- helpers ----------------------- */

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

function sourceLabel(url: string): string {
  if (url.includes('reddit.com')) return 'Reddit thread';
  if (url.startsWith('User-submitted')) return url;
  if (url.includes('theaggie.org')) return 'The Aggie (Davis student paper)';
  if (url.includes('tastingtable')) return 'Tasting Table';
  if (url.includes('chowhound')) return 'Chowhound';
  if (url.includes('instagram')) return 'Instagram';
  if (url.includes('carlos.plus')) return 'Carlos Gomez archive';
  return 'source';
}
