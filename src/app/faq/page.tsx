import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/site-url';
import MallardHead from '@/components/MallardHead';
import Breadcrumbs from '@/components/Breadcrumbs';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: "FAQ — TJ Mascots, the unofficial Trader Joe's mascot map",
  description:
    "Frequently asked questions about Trader Joe's hidden store mascots — what they are, how to spot them, who runs this fan map, and how you can submit a photo.",
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title: 'TJ Mascots FAQ',
    description: "Everything you ever wanted to know about Trader Joe's store mascots.",
    url: `${SITE_URL}/faq`,
    type: 'website',
    siteName: 'TJ Mascots',
  },
};

/**
 * Q&A list — keep both the visual rendering and the FAQPage JSON-LD
 * driven from this single source of truth so they stay in sync.
 * Google may render these as rich snippets in search results.
 */
const FAQS: { q: string; a: string }[] = [
  {
    q: "What is a Trader Joe's mascot?",
    a: "Most Trader Joe's stores hide a small stuffed-animal mascot somewhere on the sales floor — usually picked by the crew to fit their store's neighborhood, named, and given a Hawaiian shirt or a regional accent. Spotting them has become a low-key sport for shoppers. TJ Mascots is the unofficial fan map of every one we've found.",
  },
  {
    q: "Who runs TJ Mascots?",
    a: "It's a two-person fan project, run independently by a pair of Trader Joe's shoppers who got tired of trying to remember which store had which animal. There's no commercial relationship with Trader Joe's Company.",
  },
  {
    q: "Is this affiliated with Trader Joe's?",
    a: "No. TJ Mascots is a fan project, not affiliated with or endorsed by Trader Joe's Company in any way. \"Trader Joe's\" is a registered trademark of Trader Joe's Company.",
  },
  {
    q: "How can I submit a mascot photo?",
    a: "Click the + Submit button in the header, pick the store from the dropdown, attach a photo of the mascot (the actual stuffed animal, not store signage), and add the mascot's name if you know it. Your submission goes into a private review queue and lands on the map within a day. Add your email if you want to be credited in the Hall of Fame.",
  },
  {
    q: "What if the mascot at my store has changed?",
    a: "Use the \"Report incorrect info\" link on any mascot card. We'll mark the old one as retired and add the new one — older mascots stay listed under \"Previous mascots\" so the store's history is preserved.",
  },
  {
    q: "How accurate is the data?",
    a: "Each mascot is geocoded to its exact Trader Joe's store address, pulled from the official TJ store list. Every photo we publish was either submitted by a shopper who took it themselves or sourced from a public post (Reddit, Instagram) where the photographer is credited. If you spot a mistake, the report button on each card opens a private review queue.",
  },
  {
    q: "Can I use the data?",
    a: 'Yes — there\'s a free open data export at /data with every active mascot in JSON and CSV. Use it for personal projects, journalism, academic research, or curious mapping experiments. Photos belong to their photographers; please contact us before republishing those.',
  },
  {
    q: "Why don't all stores have a mascot photo?",
    a: "Some stores don't have a mascot at all — the practice varies by store and by era. Others have mascots but no shopper has photographed them yet. Help us fill in the map: next time you're in a TJ that's missing one, look behind the bananas, snap a pic, and submit it.",
  },
  {
    q: "Why does every Trader Joe's have a different mascot?",
    a: "Each Trader Joe's has a different mascot meant to represent the store and its community. Crews pick them to fit something local — a sea turtle for a coastal store, a longhorn for a Texas one, a beagle for a dog-loving neighborhood. Naming, dressing (Hawaiian shirts are big), and hiding the mascot is a tradition each store makes its own.",
  },
  {
    q: "How do I find the mascot in my local store?",
    a: "Each mascot hides around the store, often in a different place every day. It's not only a fun hide-and-seek game to play — kids (and, honestly, plenty of adults) may get a little treat if they let a Trader Joe's crew member know where they spotted the store mascot that day. Most mascots are tucked above eye level — on top of refrigerator cases, in the windows, or peeking out from a shelf — and crew members are friendly about pointing them out if you ask.",
  },
];

export default function FaqPage() {
  // FAQPage JSON-LD — driven from the same FAQS array as the visible
  // accordion below so the two stay in sync.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
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
            <h1 className="font-display text-2xl font-black leading-none tracking-tight">
              TJ Mascots
            </h1>
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
        <div className="mx-auto max-w-3xl px-6 py-12 max-sm:px-4 sm:py-16">
          <Breadcrumbs
            className="mb-6"
            items={[
              { label: 'Map', href: '/' },
              { label: 'FAQ' },
            ]}
          />

          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.4em] text-[var(--accent)]">
              Frequently asked
            </p>
            <h2 className="font-display text-5xl font-black leading-[0.92] tracking-tight text-[var(--tj-red)] sm:text-6xl">
              FAQ
            </h2>
            <div className="mx-auto mt-4 h-1.5 w-20 rounded-full bg-[var(--accent)]" />
          </div>

          <ul className="space-y-3">
            {FAQS.map((f) => (
              <li
                key={f.q}
                className="group rounded-2xl bg-[var(--cream-dark)] open:bg-[var(--cream)] open:shadow-card"
              >
                <details className="group rounded-2xl px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer items-start justify-between gap-3 font-display text-lg font-extrabold text-[var(--ink)] hover:text-[var(--tj-red)]">
                    <span>{f.q}</span>
                    <span className="flex-shrink-0 text-[var(--ink-soft)] transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink)]">
                    {f.a}
                  </p>
                </details>
              </li>
            ))}
          </ul>

          <div className="mt-12 rounded-3xl bg-[var(--cream-dark)] px-6 py-8 text-center">
            <h3 className="font-display text-2xl font-extrabold text-[var(--tj-red)]">
              Still have a question?
            </h3>
            <p className="mx-auto mt-2 max-w-md text-base font-semibold text-[var(--ink-soft)]">
              Drop us a note via the contact form on the privacy page — we
              read every message.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/privacy"
                className="rounded-full bg-[var(--tj-red)] px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--cream)] shadow-[0_2px_0_var(--tj-red-dark)] transition hover:-translate-y-px"
              >
                Contact form
              </Link>
              <Link
                href="/"
                className="rounded-full border-2 border-[var(--tj-red)] bg-[var(--cream)] px-5 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--tj-red)] transition hover:-translate-y-px"
              >
                🗺️ Open the map
              </Link>
            </div>
          </div>

          <footer className="mt-16 border-t border-[var(--cream-dark)] pt-6 text-center text-xs font-semibold text-[var(--ink-soft)]">
            A fan project. Unaffiliated with Trader Joe&apos;s Company.
          </footer>
        </div>
      </main>

      {/* FAQPage JSON-LD for Google rich results */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
