import Link from 'next/link';
import mascotsRaw from '@/data/mascots.json';
import MallardHead from '@/components/MallardHead';
import { SITE_URL } from '@/lib/site-url';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Open data — TJ Mascots',
  description:
    "The full TJ Mascots dataset is free for anyone to download — JSON or CSV, every active mascot with store number, address, coordinates, and photo links. No API keys, no signup.",
  alternates: { canonical: `${SITE_URL}/data` },
};

const totalMascots = (mascotsRaw as { mascots: { retired?: boolean }[] }).mascots.filter(
  (m) => !m.retired,
).length;

export default function DataPage() {
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
        <div className="mx-auto max-w-3xl px-6 py-12 max-sm:px-4 sm:py-16">
          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.4em] text-[var(--accent)]">
              Use the data, share the data
            </p>
            <h2 className="font-display text-5xl font-black leading-none tracking-tight text-[var(--tj-red)] sm:text-6xl">
              OPEN DATA
            </h2>
            <div className="mx-auto mt-4 h-1.5 w-24 rounded-full bg-[var(--accent)]" />
            <p className="mt-5 text-base font-semibold text-[var(--ink-soft)]">
              The full TJ Mascots dataset — every mascot, every store, every photo —
              is free for anyone to download. No API keys, no sign-up.
            </p>
          </div>

          {/* Big download buttons */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <a
              href="/data/mascots.json"
              download
              className="group flex items-center gap-4 rounded-2xl bg-[var(--cream-dark)] p-5 transition hover:-translate-y-px hover:bg-[var(--cream)] hover:shadow-card"
            >
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--tj-red)] text-xl font-extrabold text-[var(--cream)]">
                JSON
              </div>
              <div className="min-w-0">
                <div className="font-display text-lg font-extrabold text-[var(--ink)] group-hover:text-[var(--tj-red)]">
                  Download JSON
                </div>
                <div className="text-xs font-bold text-[var(--ink-soft)]">
                  {totalMascots} mascots · structured · pretty-printed
                </div>
              </div>
            </a>
            <a
              href="/data/mascots.csv"
              download
              className="group flex items-center gap-4 rounded-2xl bg-[var(--cream-dark)] p-5 transition hover:-translate-y-px hover:bg-[var(--cream)] hover:shadow-card"
            >
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-xl font-extrabold text-[var(--ink)]">
                CSV
              </div>
              <div className="min-w-0">
                <div className="font-display text-lg font-extrabold text-[var(--ink)] group-hover:text-[var(--tj-red)]">
                  Download CSV
                </div>
                <div className="text-xs font-bold text-[var(--ink-soft)]">
                  {totalMascots} rows · opens in Excel / Numbers / Google Sheets
                </div>
              </div>
            </a>
          </div>

          {/* Sections */}
          <div className="mt-12 space-y-7 text-[16px] leading-relaxed text-[var(--ink)]">
            <Section heading="What's in it">
              <p>
                Every active mascot in the catalog, joined with the store data so
                you don&apos;t have to look anything up separately. Each row has:
              </p>
              <ul className="ml-5 mt-2 list-disc space-y-1">
                <li><code>id</code>, <code>name</code>, <code>animal</code></li>
                <li><code>store_number</code> · the official Trader Joe&apos;s store number</li>
                <li><code>city</code>, <code>state</code>, <code>zip</code>, <code>street</code></li>
                <li><code>lat</code>, <code>lng</code> · precise store coordinates</li>
                <li><code>has_photo</code>, <code>photo_url</code> · relative path on this site</li>
                <li><code>submitted_by</code> · contributor credit (when given)</li>
                <li><code>created_at</code> · when the mascot was added to the catalog</li>
                <li><code>notes</code>, <code>source_url</code></li>
              </ul>
              <p className="mt-3">
                Retired mascots are excluded from the export. The file is regenerated
                every time the site rebuilds, so it&apos;s always current.
              </p>
            </Section>

            <Section heading="License">
              <p>
                Free for personal, academic, and journalistic use. If you publish
                derivative work (a chart, a map, a story, an analysis), please
                attribute &ldquo;TJ Mascots fan project (tjmascots.com).&rdquo;
              </p>
              <p className="mt-2">
                Photos belong to the people who took them. Don&apos;t republish photos
                without contacting us first — many were submitted with credit
                conditions, and we&apos;re happy to forward requests.
              </p>
            </Section>

            <Section heading="Got something cool to share?">
              <p>
                If you build something with this dataset — a chart, a
                Reddit post, a tweet thread, a research note — we&apos;d love
                to hear about it. Reach out via the contact form on the{' '}
                <Link href="/privacy" className="font-bold text-[var(--tj-red)] underline">
                  privacy page
                </Link>
                .
              </p>
            </Section>

            <Section heading="No API, by design">
              <p>
                This is a static dataset, not a live API. If you need fresher
                data, just re-download — files are regenerated on every site
                build (typically multiple times a day). No rate limits, no keys.
              </p>
            </Section>
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full bg-[var(--tj-red)] px-5 py-3 text-sm font-extrabold text-[var(--cream)] shadow-[0_2px_0_var(--tj-red-dark)] transition hover:-translate-y-px"
            >
              Open the map →
            </Link>
            <Link
              href="/recent"
              className="rounded-full border-2 border-[var(--tj-red)] bg-[var(--cream)] px-5 py-3 text-sm font-extrabold text-[var(--tj-red)] transition hover:-translate-y-px"
            >
              Recently spotted
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

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-display text-lg font-extrabold uppercase tracking-[0.1em] text-[var(--tj-red)]">
        {heading}
      </h3>
      <div className="text-[var(--ink)]">{children}</div>
    </section>
  );
}
