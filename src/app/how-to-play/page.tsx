import Link from 'next/link';
import MallardHead from '@/components/MallardHead';
import { SITE_URL } from '@/lib/site-url';

export const dynamic = 'force-static';

export const metadata = {
  title: "How to play — McQuackers' Quest",
  description:
    "How to play the McQuackers' Quest hidden-object game on TJ Mascots — controls, scoring, hints, leaderboard.",
  alternates: { canonical: `${SITE_URL}/how-to-play` },
};

export default function HowToPlayPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="relative z-[1000] flex items-center justify-between gap-3 bg-[var(--tj-red)] px-6 py-3 text-[var(--cream)] shadow-card max-sm:gap-2 max-sm:px-3">
        <div className="flex flex-shrink-0 items-center gap-3.5 max-sm:gap-2">
          <Link
            href="/"
            aria-label="Back to the map"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--cream)] text-2xl shadow-[inset_0_0_0_3px_var(--tj-red-dark)]"
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
          href="/quack"
          className="flex-shrink-0 rounded-full bg-[var(--cream)] px-[18px] py-2.5 text-sm font-extrabold text-[var(--tj-red)] shadow-[0_2px_0_var(--tj-red-dark)] max-sm:px-3 max-sm:text-xs"
        >
          <span className="max-sm:hidden">🦆 Play now</span>
          <span className="hidden max-sm:inline">🦆 Play</span>
        </Link>
      </header>

      <main className="flex-1 overflow-y-auto bg-[var(--cream)]">
        <article className="mx-auto max-w-2xl px-6 py-12 text-[var(--ink)] max-sm:px-4 sm:py-16">
          <header className="mb-10 text-center">
            <div className="text-5xl">🦆</div>
            <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-[var(--tj-red)] sm:text-5xl">
              How to play McQuackers&apos; Quest
            </h1>
            <p className="mt-2 text-sm font-semibold text-[var(--ink-soft)]">
              Five real Trader Joe&apos;s stores. Five hidden store mascots. Find them all.
            </p>
          </header>

          <Section title="The basics">
            McQuackers — the duck mascot from the Oakland Lakeshore Trader Joe&apos;s — follows your
            cursor (or finger) through five real TJ stores. In each store, a different real
            store mascot is hidden somewhere on the shelves. Your job: spot it and tell McQuackers
            where it is.
          </Section>

          <Section title="On a computer">
            <ul className="list-disc space-y-1 pl-6">
              <li>Move your mouse to move McQuackers around the scene.</li>
              <li>Click anywhere to make a guess. If you&apos;re close to the hidden mascot, you win the level.</li>
              <li>Press <kbd className="rounded bg-[var(--cream-dark)] px-1.5 py-0.5 font-mono text-xs">Space</kbd> or <kbd className="rounded bg-[var(--cream-dark)] px-1.5 py-0.5 font-mono text-xs">Esc</kbd> to pause the timer.</li>
            </ul>
          </Section>

          <Section title="On a phone or tablet">
            <ul className="list-disc space-y-1 pl-6">
              <li>Drag your finger to move McQuackers (he&apos;s drawn just above your fingertip so you can see what&apos;s underneath).</li>
              <li>Tap once to hop McQuackers to a new spot.</li>
              <li><strong>Double-tap</strong> when you spot the mascot to make a guess.</li>
              <li>Use the pause button in the corner if you need a break.</li>
            </ul>
          </Section>

          <Section title="Hints">
            Stuck for 30 seconds? A <strong>🔍 Hint</strong> button appears.
            Tapping it briefly lights up the part of the screen where the mascot is hiding.
            Each hint costs you <strong>200 points</strong> from your level score, so use them sparingly.
          </Section>

          <Section title="Scoring">
            <p>Each level starts with a base value and ticks down over time:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Level 1 starts at <strong>1,000 points</strong>.</li>
              <li>Level 5 starts at <strong>3,000 points</strong>.</li>
              <li>You lose <strong>10 points per second</strong> while searching.</li>
              <li>Each hint costs <strong>200 points</strong>.</li>
              <li>You can never drop below 100 points per level — no zeros.</li>
            </ul>
            <p className="mt-3">
              Your final score is the sum of all five levels. A perfect speed run (no hints,
              very fast on every level) tops out at around 9,500 points.
            </p>
          </Section>

          <Section title="Leaderboard">
            After finishing all five levels, enter <strong>3 letters</strong> (your initials) to
            submit your score to the global leaderboard. You&apos;ll see how you rank against
            other players worldwide. The board sorts by score first, then time as a tiebreaker.
          </Section>

          <Section title="Brag-share links">
            After submitting, you can copy a <strong>brag link</strong> like
            <span className="mx-1 rounded bg-[var(--cream-dark)] px-1.5 py-0.5 font-mono text-sm">tjmascots.com/quack?t=247</span>
            and send it to a friend. They&apos;ll see your time and a &ldquo;can you beat it?&rdquo;
            challenge before they play.
          </Section>

          <div className="mt-12 text-center">
            <Link
              href="/quack"
              className="inline-block rounded-full bg-[var(--tj-red)] px-10 py-4 text-base font-black uppercase tracking-wide text-[var(--cream)] shadow-[0_4px_0_var(--tj-red-dark)] hover:-translate-y-px hover:shadow-[0_6px_0_var(--tj-red-dark)]"
            >
              🦆 Start the quest
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-2xl font-black text-[var(--ink)]">{title}</h2>
      <div className="mt-2 leading-relaxed text-[var(--ink)]">{children}</div>
    </section>
  );
}
