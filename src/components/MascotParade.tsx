'use client';

/**
 * MascotParade
 *
 * A full-screen "carnival" animation that celebrates how many Trader Joe's
 * stores have been mapped so far. McQuackers of Oakland (store #203) is the
 * inspiration for this whole project, so he gets the hero spot: he leads the
 * parade in, he takes the final bow, and the dedication at the end points
 * back to him.
 *
 * Beats:
 *   1. McQuackers waddles in from the left, quacks a welcome
 *   2. A parade of mascot emojis marches in across the bottom
 *   3. A big percentage counter races from 0 to X% while a horizontal
 *      pixel-bar fills left-to-right
 *   4. Confetti + star burst at the finale
 *   5. Final reveal card with McQuackers taking a bow + CTA
 *
 * Plays fully automatically once the modal opens. User can close any time
 * with the × button or the Esc key, or replay the whole thing.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import type { Mascot } from '@/lib/types';

interface MascotParadeProps {
  open: boolean;
  onClose: () => void;
  mascots: Mascot[];
  totalStores: number;
}

/** The 5 beats of the parade, tied to runKey so we can restart cleanly. */
type Phase = 'enter' | 'parade' | 'counter' | 'burst' | 'reveal';

export default function MascotParade({
  open,
  onClose,
  mascots,
  totalStores,
}: MascotParadeProps) {
  const [runKey, setRunKey] = useState(0); // bump to replay
  const [phase, setPhase] = useState<Phase>('enter');

  // Core stats -------------------------------------------------------------
  const mappedStoreNumbers = useMemo(
    () => new Set(mascots.map((m) => m.store_number).filter(Boolean) as string[]),
    [mascots],
  );
  const mappedCount = mappedStoreNumbers.size;
  const unmappedCount = Math.max(0, totalStores - mappedCount);
  const percent = totalStores > 0 ? (mappedCount / totalStores) * 100 : 0;
  const percentRounded = Math.round(percent * 10) / 10; // 1 decimal place

  // Find McQuackers — he's always the founding mascot (id=1 at Lakeshore).
  const mcquackers =
    mascots.find((m) => m.name === 'McQuackers') ??
    mascots.find((m) => m.id === 1) ??
    null;

  // Build the parade lineup: ~24 mascots, photo-havers preferred, diverse
  // animals, McQuackers excluded (he gets the solo hero spot).
  const paradeLineup = useMemo(() => {
    const seen = new Set<string>();
    const picks: Mascot[] = [];
    // First pass: mascots with photos, one per animal type for variety
    for (const m of mascots) {
      if (!m.has_photo) continue;
      if (m.name === 'McQuackers') continue;
      const key = (m.animal || '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      picks.push(m);
      if (picks.length >= 18) break;
    }
    // Second pass: fill out to 24 with anyone we haven't picked yet
    for (const m of mascots) {
      if (picks.length >= 24) break;
      if (m.name === 'McQuackers') continue;
      if (picks.includes(m)) continue;
      picks.push(m);
    }
    return picks;
  }, [mascots]);

  // Phase timing (auto-advance). All in ms, tied to runKey so replay resets.
  useEffect(() => {
    if (!open) return;
    setPhase('enter');
    const t1 = setTimeout(() => setPhase('parade'), 2200);
    const t2 = setTimeout(() => setPhase('counter'), 4800);
    const t3 = setTimeout(() => setPhase('burst'), 9800);
    const t4 = setTimeout(() => setPhase('reveal'), 11200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [open, runKey]);

  // Escape key closes the whole thing
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function replay() {
    setRunKey((k) => k + 1);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="parade-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[3000] overflow-hidden bg-[var(--cream)]"
          role="dialog"
          aria-label="Mascot Parade: how many stores have we mapped"
        >
          {/* Pennant banner across the top — that carnival/fairgrounds feel */}
          <PennantBanner />

          {/* Close button — always available */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-5 top-5 z-[3200] flex h-11 w-11 items-center justify-center rounded-full bg-[var(--tj-red)] text-xl font-extrabold text-[var(--cream)] shadow-[0_3px_0_var(--tj-red-dark)] transition hover:-translate-y-px hover:shadow-[0_5px_0_var(--tj-red-dark)]"
          >
            ×
          </button>

          {/* The parade stage is re-rendered on each replay via the key */}
          <div key={runKey} className="relative h-full w-full">
            {/* BEAT 1: McQuackers enters */}
            <AnimatePresence>
              {phase === 'enter' && (
                <McQuackersEntry mcquackers={mcquackers} />
              )}
            </AnimatePresence>

            {/* BEAT 2: parade of mascots marches in */}
            <AnimatePresence>
              {(phase === 'parade' || phase === 'counter') && (
                <ParadeLine lineup={paradeLineup} />
              )}
            </AnimatePresence>

            {/* BEAT 3: bar chart + percentage counter race */}
            <AnimatePresence>
              {phase === 'counter' && (
                <PercentageRace
                  targetPercent={percentRounded}
                  mappedCount={mappedCount}
                  totalStores={totalStores}
                />
              )}
            </AnimatePresence>

            {/* BEAT 4: burst of confetti + stars */}
            <AnimatePresence>
              {phase === 'burst' && <Fireworks />}
            </AnimatePresence>

            {/* BEAT 5: final reveal + CTA */}
            <AnimatePresence>
              {phase === 'reveal' && (
                <FinalReveal
                  percent={percentRounded}
                  mappedCount={mappedCount}
                  unmappedCount={unmappedCount}
                  totalStores={totalStores}
                  mcquackers={mcquackers}
                  onReplay={replay}
                  onClose={onClose}
                />
              )}
            </AnimatePresence>

            {/* Subtle always-on ambient confetti drift in the background */}
            <AmbientConfetti />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------------- */
/* BEAT 1 — McQuackers Entry                                                 */
/* ------------------------------------------------------------------------- */

function McQuackersEntry({ mcquackers }: { mcquackers: Mascot | null }) {
  return (
    <motion.div
      key="enter"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 flex flex-col items-center justify-center px-6"
    >
      <div className="text-center">
        <motion.div
          initial={{ x: -600, rotate: -10 }}
          animate={{
            x: [-600, 0, 0, 0],
            rotate: [-10, 0, 5, -5, 0],
          }}
          transition={{
            duration: 1.8,
            times: [0, 0.5, 0.7, 0.85, 1],
            ease: ['easeOut', 'easeInOut', 'easeInOut', 'easeInOut'],
          }}
          className="inline-block text-[220px] leading-none drop-shadow-[0_8px_0_var(--tj-red-dark)] max-sm:text-[150px]"
        >
          🦆
        </motion.div>

        {/* Speech bubble */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.9, type: 'spring', stiffness: 220, damping: 14 }}
          className="relative mx-auto mt-6 inline-block max-w-md rounded-[24px] bg-[var(--tj-red)] px-7 py-4 font-display text-2xl font-extrabold leading-tight text-[var(--cream)] shadow-[0_4px_0_var(--tj-red-dark)] max-sm:text-lg"
        >
          Quack! Welcome to the Mascot Parade!
          {/* Bubble tail */}
          <div className="absolute -top-3 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[14px] border-b-[14px] border-x-transparent border-b-[var(--tj-red)]" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.4 }}
          className="mt-5 text-[15px] font-bold uppercase tracking-[0.2em] text-[var(--ink-soft)]"
        >
          Starring McQuackers of Oakland — the duck who started it all
        </motion.p>

        {mcquackers?.store_number && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.65, duration: 0.3 }}
            className="mt-1.5 text-xs font-bold text-[var(--tj-red)]"
          >
            Trader Joe&apos;s Store #{mcquackers.store_number}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------------- */
/* BEAT 2 — Parade line                                                      */
/* ------------------------------------------------------------------------- */

function ParadeLine({ lineup }: { lineup: Mascot[] }) {
  // The mascots march in from the right, one at a time, then hold their
  // line across the bottom half of the screen.
  return (
    <motion.div
      key="parade"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0.4 }}
      transition={{ duration: 0.3 }}
      className="pointer-events-none absolute inset-x-0 bottom-0 top-[55%] overflow-hidden"
    >
      <div className="relative h-full w-full">
        {lineup.map((m, i) => (
          <ParadeMascot key={m.id} mascot={m} index={i} total={lineup.length} />
        ))}
      </div>
    </motion.div>
  );
}

function ParadeMascot({
  mascot,
  index,
  total,
}: {
  mascot: Mascot;
  index: number;
  total: number;
}) {
  // Each mascot gets its own physics flavor, keyed to animal type, so the
  // parade doesn't feel like 24 copies of the same bounce.
  const animal = (mascot.animal || '').toLowerCase();
  const physics = getPhysics(animal);

  // Spread them across the bottom 40% of the screen. Using percentages so it
  // scales on narrow viewports.
  const xPercent = (index / Math.max(1, total - 1)) * 90 + 5; // 5% .. 95%
  const delay = index * 0.12; // staggered march

  return (
    <motion.div
      initial={{ x: '120vw', y: 0, rotate: 0, opacity: 0 }}
      animate={{
        x: `calc(${xPercent}vw - 30px)`,
        y: physics.bounce,
        rotate: physics.sway,
        opacity: 1,
      }}
      transition={{
        x: { delay, duration: 1.1, ease: 'easeOut' },
        opacity: { delay, duration: 0.2 },
        y: {
          delay: delay + 1.1,
          duration: physics.period,
          repeat: Infinity,
          ease: 'easeInOut',
        },
        rotate: {
          delay: delay + 1.1,
          duration: physics.period,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }}
      className="absolute bottom-10 flex flex-col items-center"
      style={{ left: 0 }}
    >
      <div className="text-[56px] leading-none drop-shadow-[0_3px_0_rgba(58,46,31,0.15)] max-sm:text-[38px]">
        {mascot.emoji}
      </div>
      {/* Name-tag banner */}
      <div className="mt-1 max-w-[120px] truncate rounded-md bg-[var(--tj-red)] px-2 py-0.5 text-center text-[10px] font-extrabold uppercase tracking-wider text-[var(--cream)] shadow-[0_2px_0_var(--tj-red-dark)] max-sm:max-w-[80px] max-sm:text-[8px]">
        {mascot.name || mascot.animal || 'Friend'}
      </div>
    </motion.div>
  );
}

/** Per-animal movement flavor so each mascot feels alive. */
function getPhysics(animal: string): {
  bounce: number[];
  sway: number[];
  period: number;
} {
  if (/duck|bird|goose|owl|parrot|flamingo|penguin|chicken|peacock|swan/.test(animal)) {
    return { bounce: [0, -12, 0], sway: [-4, 4, -4], period: 1.4 };
  }
  if (/fox|dog|wolf|coyote|cat|tiger|lion|bear|raccoon|fox/.test(animal)) {
    return { bounce: [0, -8, 0, -4, 0], sway: [-2, 2, -2], period: 1.1 };
  }
  if (/octopus|squid|jellyfish|crab|lobster|shark|fish|whale|dolphin/.test(animal)) {
    return { bounce: [0, -4, 0, 4, 0], sway: [-8, 8, -8], period: 1.6 };
  }
  if (/frog|toad|kangaroo|rabbit|bunny|grasshopper/.test(animal)) {
    return { bounce: [0, -22, 0], sway: [0, 0, 0], period: 0.9 };
  }
  // Default: friendly amble
  return { bounce: [0, -6, 0], sway: [-3, 3, -3], period: 1.3 };
}

/* ------------------------------------------------------------------------- */
/* BEAT 3 — Percentage race + bar chart                                      */
/* ------------------------------------------------------------------------- */

function PercentageRace({
  targetPercent,
  mappedCount,
  totalStores,
}: {
  targetPercent: number;
  mappedCount: number;
  totalStores: number;
}) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(mv, targetPercent, {
      duration: 3.8,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [mv, targetPercent]);

  const width = Math.max(2, display); // never fully empty

  // Milestone pop-in markers at 10/25/50/75/100
  const milestones = [10, 25, 50, 75, 100];

  return (
    <motion.div
      key="counter"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="absolute inset-x-0 top-12 flex flex-col items-center px-6 max-sm:top-6"
    >
      <div className="text-[15px] font-bold uppercase tracking-[0.2em] text-[var(--ink-soft)]">
        The Mascot Parade builds…
      </div>
      <motion.div
        initial={{ scale: 0.7 }}
        animate={{ scale: [0.7, 1.05, 1] }}
        transition={{ duration: 0.5 }}
        className="mt-2 font-display text-[120px] font-black leading-none text-[var(--tj-red)] drop-shadow-[0_4px_0_var(--tj-red-dark)] max-sm:text-[72px]"
      >
        {display.toFixed(1)}%
      </motion.div>
      <div className="mt-1 text-[15px] font-bold text-[var(--ink-soft)]">
        <span className="font-extrabold text-[var(--ink)]">
          {Math.round((display / 100) * totalStores).toLocaleString()}
        </span>{' '}
        of {totalStores.toLocaleString()} stores mapped
      </div>

      {/* The pixel-bar building left to right */}
      <div className="relative mt-7 h-[46px] w-full max-w-3xl overflow-hidden rounded-full bg-[var(--cream-dark)] shadow-[inset_0_3px_0_rgba(58,46,31,0.12)]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[var(--tj-red-dark)] via-[var(--tj-red)] to-[#ff8a5b]"
          style={{ width: `${width}%` }}
          transition={{ type: 'tween' }}
        />
        {milestones.map((pct) => (
          <MilestoneStar key={pct} percent={pct} reached={display >= pct} />
        ))}
      </div>

      <div className="mt-3 font-display text-sm font-extrabold uppercase tracking-[0.15em] text-[var(--ink-soft)]">
        {mappedCount.toLocaleString()} mapped · {(totalStores - mappedCount).toLocaleString()} still
        need you
      </div>
    </motion.div>
  );
}

function MilestoneStar({ percent, reached }: { percent: number; reached: boolean }) {
  return (
    <motion.div
      className="absolute top-1/2 -translate-y-1/2 text-xl"
      style={{ left: `calc(${percent}% - 10px)` }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: reached ? [0, 1.6, 1] : 0,
        opacity: reached ? 1 : 0,
      }}
      transition={{ duration: 0.4 }}
    >
      ⭐
    </motion.div>
  );
}

/* ------------------------------------------------------------------------- */
/* BEAT 4 — Fireworks burst                                                  */
/* ------------------------------------------------------------------------- */

function Fireworks() {
  // 50 confetti pieces + 8 starburst rays
  const pieces = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({ id: i, ...randomConfettiPiece() })),
    [],
  );
  const rays = useMemo(() => Array.from({ length: 8 }, (_, i) => i), []);

  return (
    <motion.div
      key="burst"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-none absolute inset-0"
    >
      {/* Central starburst rays from center */}
      {rays.map((r) => (
        <motion.div
          key={r}
          className="absolute left-1/2 top-1/2 h-[6px] w-[40vw] origin-left bg-gradient-to-r from-[var(--tj-red)] via-[#ffb347] to-transparent"
          style={{ rotate: `${(360 / rays.length) * r}deg` }}
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: [0, 1.2, 1], opacity: [1, 1, 0] }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      ))}
      {/* Confetti pieces launching from center */}
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          className="absolute left-1/2 top-1/2 h-3 w-3 rounded-sm"
          style={{ backgroundColor: p.color }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{
            x: p.dx,
            y: p.dy,
            rotate: p.rot,
            opacity: [1, 1, 0],
          }}
          transition={{ duration: p.duration, ease: 'easeOut' }}
        />
      ))}
      {/* A big gold star at dead center */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[140px]"
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: [0, 1.4, 1], rotate: [0, 15, 0] }}
        transition={{ duration: 0.9 }}
      >
        🌟
      </motion.div>
    </motion.div>
  );
}

function randomConfettiPiece() {
  const colors = ['#B22222', '#FFCC4D', '#FFB347', '#FDF6EC', '#FFD700', '#E8623D', '#C94F38'];
  const angle = Math.random() * Math.PI * 2;
  const dist = 250 + Math.random() * 500;
  return {
    color: colors[Math.floor(Math.random() * colors.length)],
    dx: Math.cos(angle) * dist,
    dy: Math.sin(angle) * dist + 200, // gravity pull
    rot: Math.random() * 720 - 360,
    duration: 1.4 + Math.random() * 0.8,
  };
}

/* ------------------------------------------------------------------------- */
/* BEAT 5 — Final reveal                                                     */
/* ------------------------------------------------------------------------- */

function FinalReveal({
  percent,
  mappedCount,
  unmappedCount,
  totalStores,
  mcquackers,
  onReplay,
  onClose,
}: {
  percent: number;
  mappedCount: number;
  unmappedCount: number;
  totalStores: number;
  mcquackers: Mascot | null;
  onReplay: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      key="reveal"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
      className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
    >
      <div className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--ink-soft)]">
        The current count
      </div>

      <motion.div
        initial={{ scale: 0.6, rotate: -4 }}
        animate={{ scale: [0.6, 1.15, 1], rotate: [-4, 2, 0] }}
        transition={{ duration: 0.7, ease: 'backOut' }}
        className="mt-2 font-display text-[160px] font-black leading-none text-[var(--tj-red)] drop-shadow-[0_6px_0_var(--tj-red-dark)] max-sm:text-[90px]"
      >
        {percent.toFixed(1)}%
      </motion.div>

      <div className="mt-3 max-w-lg font-display text-2xl font-extrabold text-[var(--ink)] max-sm:text-lg">
        of Trader Joe&apos;s mapped
      </div>

      <div className="mt-6 flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-2.5 text-sm font-bold max-sm:flex-col max-sm:gap-1.5">
          <span className="rounded-full bg-[var(--tj-red)] px-3.5 py-1.5 text-[var(--cream)] shadow-[0_2px_0_var(--tj-red-dark)]">
            {mappedCount.toLocaleString()} mascots found
          </span>
          <span className="rounded-full bg-[var(--cream-dark)] px-3.5 py-1.5 text-[var(--ink)]">
            {unmappedCount.toLocaleString()} stores still need your help
          </span>
          <span className="rounded-full bg-[var(--ink)] px-3.5 py-1.5 text-[var(--cream)]">
            {totalStores.toLocaleString()} total stores
          </span>
        </div>

        {/* McQuackers takes a bow */}
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[var(--cream-dark)] px-5 py-3 font-display text-base font-extrabold text-[var(--ink)] shadow-[0_2px_0_rgba(58,46,31,0.12)]">
          <motion.span
            initial={{ rotate: 0 }}
            animate={{ rotate: [0, -25, 10, -20, 0, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 0.6 }}
            className="text-4xl"
          >
            🦆
          </motion.span>
          <span className="text-left">
            It all started with <span className="text-[var(--tj-red)]">McQuackers</span> in
            Oakland
            {mcquackers?.store_number && (
              <span className="ml-1.5 align-middle text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
                · Store #{mcquackers.store_number}
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3 max-sm:flex-col">
        <button
          onClick={onClose}
          className="rounded-full bg-[var(--tj-red)] px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--cream)] shadow-[0_3px_0_var(--tj-red-dark)] transition hover:-translate-y-px hover:shadow-[0_5px_0_var(--tj-red-dark)]"
        >
          Help find more →
        </button>
        <button
          onClick={onReplay}
          className="rounded-full border-2 border-[var(--tj-red)] bg-[var(--cream)] px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-[var(--tj-red)] transition hover:bg-[var(--cream-dark)]"
        >
          ▶ Replay
        </button>
        <button
          onClick={onClose}
          className="rounded-full px-4 py-3 text-sm font-bold uppercase tracking-wider text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
        >
          Close
        </button>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------------- */
/* Decor: pennant banner + ambient confetti                                  */
/* ------------------------------------------------------------------------- */

function PennantBanner() {
  const flags = useMemo(() => {
    const colors = ['#B22222', '#FFCC4D', '#C94F38', '#FFB347', '#E8623D'];
    return Array.from({ length: 30 }, (_, i) => colors[i % colors.length]);
  }, []);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[3100]">
      <div className="flex items-start justify-between px-0">
        {flags.map((c, i) => (
          <motion.div
            key={i}
            className="h-6 flex-1 origin-top"
            style={{
              backgroundColor: c,
              clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
            }}
            animate={{ rotate: [0, 2, -2, 0] }}
            transition={{
              duration: 2 + (i % 3) * 0.3,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.03,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function AmbientConfetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 25 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 6,
        duration: 6 + Math.random() * 4,
        color: ['#FFCC4D', '#FFB347', '#B22222', '#FDF6EC'][i % 4],
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          className="absolute h-2.5 w-2.5 rounded-[2px]"
          style={{ left: `${p.left}%`, top: -20, backgroundColor: p.color }}
          animate={{
            y: ['0vh', '110vh'],
            rotate: [0, 360],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}
