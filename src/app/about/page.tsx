import Link from 'next/link';
import BrianIllustration from '@/components/BrianIllustration';

export const dynamic = 'force-static';

export const metadata = {
  title: 'About — TJ Mascots',
  description:
    "The story behind TJ Mascots: a boy named Brian, a menagerie of Trader Joe's store mascots, and an invitation to help keep track of them all.",
};

export default function AboutPage() {
  return (
    <div className="flex h-full flex-col">
      {/* Simple header — cart icon returns to the map */}
      <header className="relative z-[1000] flex items-center justify-between gap-5 bg-[var(--tj-red)] px-6 py-3 text-[var(--cream)] shadow-card">
        <div className="flex flex-shrink-0 items-center gap-3.5">
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
          href="/"
          className="rounded-full bg-[var(--cream)] px-[18px] py-2.5 text-sm font-extrabold text-[var(--tj-red)] shadow-[0_2px_0_var(--tj-red-dark)] transition hover:-translate-y-px hover:shadow-[0_4px_0_var(--tj-red-dark)]"
        >
          ← Back to the map
        </Link>
      </header>

      <div className="bg-[var(--cream-dark)] px-6 py-1.5 text-center text-[11px] font-bold text-[var(--ink-soft)]">
        Fan project. Not affiliated with Trader Joe&apos;s Company. &ldquo;Trader Joe&apos;s&rdquo; is a
        trademark of Trader Joe&apos;s Company.{' '}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-[var(--tj-red)]">
          Privacy
        </Link>
      </div>

      {/* Scrollable content area */}
      <main className="flex-1 overflow-y-auto bg-[var(--cream)]">
        <div className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
          {/* Big ABOUT display */}
          <div className="relative mb-12 text-center">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-6 -z-10 mx-auto h-20 max-w-[520px] rounded-full bg-[var(--cream-dark)] blur-2xl opacity-70"
            />
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.4em] text-[var(--accent)]">
              The story behind the map
            </p>
            <h2 className="font-display text-6xl font-black leading-none tracking-tight text-[var(--tj-red)] sm:text-7xl md:text-8xl">
              ABOUT
            </h2>
            <div className="mx-auto mt-4 h-1.5 w-24 rounded-full bg-[var(--accent)]" />
          </div>

          {/* Illustration + story side-by-side on larger screens */}
          <div className="grid gap-10 md:grid-cols-5">
            <div className="md:col-span-2">
              <BrianIllustration />
              <p className="mt-3 text-center text-xs font-semibold italic text-[var(--ink-soft)]">
                Brian, meeting McQuackers.
              </p>
            </div>

            <div className="md:col-span-3">
              <div className="space-y-5 text-lg leading-relaxed text-[var(--ink)]">
                <p className="text-2xl font-bold leading-snug text-[var(--ink)] sm:text-[1.65rem]">
                  This all started because of a boy named{' '}
                  <span className="text-[var(--tj-red)]">Brian</span>.
                </p>
                <p>
                  Brian loved the quiet wonder of walking into a Trader Joe&apos;s. Not just for the
                  snacks — for the <em>menagerie</em>. Every store, it turned out, had its own
                  secret resident: a duck perched above the registers, a little moose tucked
                  behind the flowers, a crab squinting out from the produce cooler. A whole diverse
                  cast of little animals with their own names, their own nametags, and their own
                  stores.
                </p>
                <p>
                  He wanted to share that wonder with everyone else. Because most people don&apos;t
                  even know each store has its own mascot — let alone that finding one is a game.
                  Spot the mascot, tell a checkout clerk, <strong>win a small prize</strong>. Turns
                  out the staff need the help: the mascots wander, and someone has to round them up
                  at the end of the day.
                </p>
                <p>
                  So here&apos;s the map. Every Trader Joe&apos;s in the U.S., every mascot we know
                  about, every photo someone has shared. If your store&apos;s pin is a dotted
                  outline, we don&apos;t have a photo yet. If it&apos;s a plain circle, we
                  don&apos;t even know the mascot.
                </p>
                <p>
                  <strong>Help us fill it in.</strong> Next time you&apos;re shopping, look up.
                  Look behind the bananas. Check above the wine. When you spot your store&apos;s
                  mascot, snap a photo, and submit it here with the store name and location.
                </p>
                <p className="text-xl font-bold text-[var(--tj-red)]">
                  Brian will thank you. 🦆
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="rounded-full bg-[var(--tj-red)] px-5 py-3 text-sm font-extrabold text-[var(--cream)] shadow-[0_2px_0_var(--tj-red-dark)] transition hover:-translate-y-px hover:shadow-[0_4px_0_var(--tj-red-dark)]"
                >
                  Open the map →
                </Link>
                <Link
                  href="/?submit=1"
                  className="rounded-full border-2 border-[var(--tj-red)] bg-[var(--cream)] px-5 py-3 text-sm font-extrabold text-[var(--tj-red)] transition hover:-translate-y-px"
                >
                  + Submit a mascot
                </Link>
              </div>
            </div>
          </div>

          <footer className="mt-20 border-t border-[var(--cream-dark)] pt-6 text-center text-xs font-semibold text-[var(--ink-soft)]">
            A fan project. Unaffiliated with Trader Joe&apos;s Company.
          </footer>
        </div>
      </main>
    </div>
  );
}
