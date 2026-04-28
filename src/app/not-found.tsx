import Link from 'next/link';
import MallardHead from '@/components/MallardHead';

export const metadata = {
  title: "Page not found — TJ Mascots",
  description:
    "We can't find that page, but McQuackers can probably help. Head back to the map or check out the recent additions.",
  robots: { index: false, follow: false },
};

/**
 * Friendly 404 — large McQuackers photo + a few well-marked exits
 * back into the site. Reduces bounce rate when Google indexes a
 * stale URL or someone mistypes a slug.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
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

      <main className="flex flex-1 flex-col items-center justify-center bg-[var(--cream)] px-6 py-16 text-center max-sm:px-4">
        <div className="mx-auto max-w-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mcq-404.png"
            alt="McQuackers the Mallard, the Trader Joe's mascot at Lakeshore Oakland #203, looking concerned about a missing page"
            width={520}
            height={520}
            className="mx-auto h-auto w-full max-w-[420px] rounded-3xl shadow-card"
          />
          <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.4em] text-[var(--accent)]">
            404 · Page not found
          </p>
          <h2 className="mt-3 font-display text-5xl font-black leading-[0.92] tracking-tight text-[var(--tj-red)] sm:text-6xl">
            McQuackers can&apos;t find that page.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-base font-semibold text-[var(--ink-soft)]">
            The link you followed might be old, the mascot might have
            been renamed, or there might be a typo in the URL. Either
            way — McQuackers suggests we head back to the map.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="rounded-full bg-[var(--tj-red)] px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--cream)] shadow-[0_3px_0_var(--tj-red-dark)] transition hover:-translate-y-px"
            >
              🗺️ Back to the map
            </Link>
            <Link
              href="/recent"
              className="rounded-full border-2 border-[var(--tj-red)] bg-[var(--cream)] px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--tj-red)] transition hover:-translate-y-px"
            >
              ✨ Recently spotted
            </Link>
            <Link
              href="/faq"
              className="rounded-full border-2 border-[var(--tj-red)] bg-[var(--cream)] px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--tj-red)] transition hover:-translate-y-px"
            >
              FAQ
            </Link>
          </div>

          <p className="mt-12 text-[12px] font-semibold italic text-[var(--ink-soft)]">
            McQuackers lives at Trader Joe&apos;s Lakeshore Oakland
            (#203). If you&apos;re ever in town, the produce aisle
            knows.
          </p>
        </div>
      </main>

      <div className="bg-[var(--cream-dark)] px-6 py-2 text-center text-[11px] font-bold text-[var(--ink-soft)]">
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
    </div>
  );
}
