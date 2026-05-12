'use client';

/**
 * QuackGame — the McQuackers' Quest hidden-object easter-egg game.
 *
 * High-level flow:
 *   1. 'intro'          — title screen + Start button (skipped if mounted with
 *                         autoStart, e.g. from the /terms burst-through).
 *   2. 'playing'        — 5 levels in sequence. McQuackers follows the
 *                         cursor/finger. Player double-taps (mobile) or
 *                         clicks (desktop) on the hidden mascot to advance.
 *   3. 'level-complete' — quick card with time + points + preview of next.
 *   4. 'won'            — final score, initials entry, leaderboard slot,
 *                         brag-share URL.
 *
 * Pointer handling:
 *   - pointermove → update McQuackers position (mobile offsets him 70px above
 *     the finger so the touch doesn't cover what you're looking for).
 *   - pointerup on desktop → instant guess.
 *   - pointerup on touch  → first tap moves McQuackers; second within 350ms
 *     is a guess.
 *
 * Pause: any keystroke (desktop) or the pause button (mobile) freezes the
 * level timer. The total-time stat used for the leaderboard reflects only
 * active play time.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LEVELS,
  HERO,
  HIT_TOLERANCE_MULTIPLIER,
  scoreForLevel,
  type LevelConfig,
} from '@/lib/quack-config';
import {
  fetchTopScores,
  submitScore,
  type ScoreRow,
} from '@/lib/quack-leaderboard';
import { playSfx, preloadAllSfx, isMuted, setMuted } from '@/lib/quack-sfx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = 'intro' | 'playing' | 'level-complete' | 'won';

type LevelResult = {
  level: number;
  elapsedSeconds: number;
  hintsUsed: number;
  score: number;
};

export type QuackGameProps = {
  /** Skip the intro screen and jump straight to Level 1. Used when the player
   *  arrives via the burst-through on /terms. */
  autoStart?: boolean;
  /** Friend's total seconds from a brag-share URL (?t=247). Shows a
   *  "beat 4:07" banner on the intro screen. */
  challengeSeconds?: number | null;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QuackGame({ autoStart, challengeSeconds }: QuackGameProps) {
  // ---- Phase + level state ------------------------------------------------
  const [phase, setPhase] = useState<Phase>(autoStart ? 'playing' : 'intro');
  const [levelIndex, setLevelIndex] = useState(0);
  const [results, setResults] = useState<LevelResult[]>([]);

  // ---- Per-level state ----------------------------------------------------
  /** Elapsed seconds on the current level, advances while !paused. */
  const [elapsed, setElapsed] = useState(0);
  /** Hints used on the CURRENT level (resets each level). */
  const [hintsThisLevel, setHintsThisLevel] = useState(0);
  /** Hints used total — used for scoring + leaderboard submission. */
  const [hintsTotal, setHintsTotal] = useState(0);
  /** Brief glow over the right quadrant when a hint is active. */
  const [hintActive, setHintActive] = useState(false);
  /** Paused freezes the timer (and dims the scene). */
  const [paused, setPaused] = useState(false);
  /** Animated "wrong!" feedback near the most recent miss. */
  const [miss, setMiss] = useState<{ x: number; y: number; key: number } | null>(null);
  /** Tutorial overlay shows on Level 1 only and auto-fades. */
  const [showTutorial, setShowTutorial] = useState(false);
  /** Help/instructions overlay — opened from the HUD ❓ button. */
  const [showHelp, setShowHelp] = useState(false);

  // ---- DOM refs + pointer state ------------------------------------------
  /** The aspect-ratio container that holds the background + mascots. */
  const stageRef = useRef<HTMLDivElement | null>(null);
  /** McQuackers' rendered center, normalized to stage size. */
  const [duckPos, setDuckPos] = useState({ x: 0.5, y: 0.5 });
  /** Tracks recent pointerType for the tap/double-tap logic. */
  const lastTapAtRef = useRef(0);
  /** Has the player touched at all this level? (Drives the tutorial fade.) */
  const hasInteractedRef = useRef(false);

  const level: LevelConfig = LEVELS[levelIndex];

  // ---- Timer --------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'playing' || paused) return;
    const id = window.setInterval(() => setElapsed((e) => e + 0.1), 100);
    return () => window.clearInterval(id);
  }, [phase, paused]);

  // ---- Reset per-level state when level changes ---------------------------
  useEffect(() => {
    if (phase !== 'playing') return;
    setElapsed(0);
    setHintsThisLevel(0);
    setHintActive(false);
    setMiss(null);
    setPaused(false);
    if (levelIndex === 0) {
      setShowTutorial(true);
      const t = window.setTimeout(() => setShowTutorial(false), 6500);
      return () => window.clearTimeout(t);
    } else {
      setShowTutorial(false);
    }
  }, [levelIndex, phase]);

  // ---- Pause via Escape / Space (desktop) --------------------------------
  useEffect(() => {
    if (phase !== 'playing') return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === ' ' || e.code === 'Space') {
        setPaused((p) => !p);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  // ---- Pointer handling --------------------------------------------------
  /**
   * Convert a pointer event into normalized stage coordinates (0–1).
   * For touch input we offset McQuackers above the finger so the player
   * can see what's under him.
   */
  function pointerToStage(e: { clientX: number; clientY: number; pointerType?: string }) {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const rect = stage.getBoundingClientRect();
    let x = (e.clientX - rect.left) / rect.width;
    let y = (e.clientY - rect.top) / rect.height;
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      const offsetNormY = HERO.touchOffsetPx / rect.height;
      y -= offsetNormY;
    }
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    return { x, y };
  }

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (phase !== 'playing' || paused) return;
    hasInteractedRef.current = true;
    setDuckPos(pointerToStage(e));
  }, [phase, paused]);

  /**
   * Hit check: a guess wins if it lands close to the mascot center AND
   * is NOT inside the dense center of the foreground prop covering it.
   *
   * We use a generous radius around the mascot (since sprites are taller
   * than they are wide and our stage is 4:3, a rectangle bbox keyed off
   * `size` would miss the head). The prop subtract zone is tight (just
   * the dense middle of the display), so the visible peek-out edges of
   * the mascot still register.
   *
   * Note we don't aspect-correct x vs y deltas — that introduces a small
   * ellipse-ness to the hit zone, which is invisible at the radii we use.
   */
  function checkHit() {
    const dxM = duckPos.x - level.position.x;
    const dyM = duckPos.y - level.position.y;
    const distM = Math.hypot(dxM, dyM);
    // Generous mascot zone: 1.5x the sprite width. Catches the head/horn
    // peeking up above the prop.
    const mascotR = level.size * HIT_TOLERANCE_MULTIPLIER;
    if (distM > mascotR) return false;

    if (!level.prop) return true;

    // Tight prop "no-hit" zone — just the dense center of the display.
    const dxP = duckPos.x - level.prop.position.x;
    const dyP = duckPos.y - level.prop.position.y;
    const distP = Math.hypot(dxP, dyP);
    const propR = level.prop.size * 0.4;
    return distP >= propR;
  }

  function recordMiss() {
    setMiss({ x: duckPos.x, y: duckPos.y, key: Date.now() });
    window.setTimeout(() => setMiss((m) => (m?.key === Date.now() ? null : m)), 700);
  }

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (phase !== 'playing' || paused) return;
      // Move McQuackers to the release point too (matters most on touch
      // where pointermove fires only during drag, not on tap).
      setDuckPos(pointerToStage(e));

      const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
      if (!isTouch) {
        // Desktop: click = guess.
        evaluateGuess();
        return;
      }
      // Touch: detect double-tap.
      const now = Date.now();
      if (now - lastTapAtRef.current < 350) {
        lastTapAtRef.current = 0;
        evaluateGuess();
      } else {
        lastTapAtRef.current = now;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, paused, duckPos, levelIndex],
  );

  function evaluateGuess() {
    if (checkHit()) {
      playSfx('found-it', 0.7);
      completeLevel();
    } else {
      playSfx('wrong', 0.5);
      recordMiss();
    }
  }

  // ---- Level completion ---------------------------------------------------
  function completeLevel() {
    const elapsedSec = elapsed;
    const score = scoreForLevel(level, elapsedSec, hintsThisLevel);
    const newResult: LevelResult = {
      level: level.number,
      elapsedSeconds: elapsedSec,
      hintsUsed: hintsThisLevel,
      score,
    };
    setResults((r) => [...r, newResult]);
    setPhase('level-complete');
    // level-complete fanfare on the last level is replaced by the bigger
    // game-won celebration in the WonScreen mount effect.
    if (levelIndex < LEVELS.length - 1) {
      window.setTimeout(() => playSfx('level-complete', 0.65), 220);
    }
  }

  function nextLevel() {
    playSfx('ui-click', 0.4);
    if (levelIndex >= LEVELS.length - 1) {
      setPhase('won');
    } else {
      setLevelIndex((i) => i + 1);
      setPhase('playing');
    }
  }

  // Hint mechanic was retired — the HUD's old 🔍 button now shows the
  // help/instructions overlay instead. `hintsThisLevel` / `hintsTotal`
  // stay in state so the scoring formula's `hintsUsed` parameter is
  // satisfied (always 0 now), and so leaderboard submissions still
  // carry the field that the Supabase table expects.

  // ---- Computed totals for the win screen --------------------------------
  const totalScore = useMemo(
    () => results.reduce((s, r) => s + r.score, 0),
    [results],
  );
  const totalTimeSeconds = useMemo(
    () => Math.round(results.reduce((s, r) => s + r.elapsedSeconds, 0)),
    [results],
  );

  // ---- Render selection --------------------------------------------------
  if (phase === 'intro') {
    return (
      <IntroScreen
        onStart={() => {
          playSfx('game-start', 0.7);
          // First user gesture — preload the rest so they're instant later.
          preloadAllSfx();
          setLevelIndex(0);
          setResults([]);
          setHintsTotal(0);
          setPhase('playing');
        }}
        challengeSeconds={challengeSeconds ?? null}
      />
    );
  }

  if (phase === 'won') {
    return (
      <WonScreen
        results={results}
        totalScore={totalScore}
        totalTimeSeconds={totalTimeSeconds}
        hintsTotal={hintsTotal}
        onReplay={() => {
          setResults([]);
          setHintsTotal(0);
          setLevelIndex(0);
          setPhase('playing');
        }}
      />
    );
  }

  if (phase === 'level-complete') {
    const lastResult = results[results.length - 1];
    const upcoming = LEVELS[levelIndex + 1] ?? null;
    return (
      <LevelCompleteCard
        justFinished={level}
        result={lastResult}
        upcoming={upcoming}
        onContinue={nextLevel}
      />
    );
  }

  // phase === 'playing'
  return (
    <div className="flex h-full flex-col bg-[var(--ink)]">
      {/* Top HUD */}
      <Hud
        level={level}
        elapsed={elapsed}
        onShowHelp={() => setShowHelp(true)}
        onPause={() => setPaused((p) => !p)}
        paused={paused}
      />
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}

      {/* Stage */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2 py-2 sm:px-4 sm:py-4">
        <div
          ref={stageRef}
          className="relative w-full max-w-[1280px] select-none overflow-hidden rounded-2xl shadow-2xl"
          style={{
            aspectRatio: '4 / 3',
            backgroundImage: `url(${level.backgroundSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            cursor: 'none',
            touchAction: 'none',
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Hidden mascot — drawn first, then optionally covered by a
              foreground prop (see below) so the mascot looks like it's
              peeking out from behind a store display. Hit detection uses
              the mascot's full position/size, so players who guess where
              the "hidden" portion would be still win. */}
          <img
            src={level.mascotSrc}
            alt=""
            draggable={false}
            className="pointer-events-none absolute select-none"
            style={{
              left: `${level.position.x * 100}%`,
              top: `${level.position.y * 100}%`,
              width: `${level.size * 100}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 2,
            }}
          />

          {/* Foreground prop — covers most of the mascot. Painted in the
              same Fearless Flyer style so it visually belongs in the scene. */}
          {level.prop && (
            <img
              src={level.prop.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute select-none"
              style={{
                left: `${level.prop.position.x * 100}%`,
                top: `${level.prop.position.y * 100}%`,
                width: `${level.prop.size * 100}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 3,
                filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.2))',
              }}
            />
          )}

          {/* Hint glow — light up a quadrant containing the mascot.
              Drawn above the prop so it can highlight even the hidden bits. */}
          {hintActive && (
            <div
              className="pointer-events-none absolute animate-pulse rounded-3xl"
              style={{
                left: `${(level.position.x - 0.18) * 100}%`,
                top: `${(level.position.y - 0.18) * 100}%`,
                width: '36%',
                height: '36%',
                background:
                  'radial-gradient(circle, rgba(255,235,150,0.55) 0%, rgba(255,235,150,0) 70%)',
                zIndex: 4,
              }}
            />
          )}

          {/* Wrong-guess feedback */}
          {miss && (
            <div
              key={miss.key}
              className="pointer-events-none absolute"
              style={{
                left: `${miss.x * 100}%`,
                top: `${miss.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 5,
              }}
            >
              <div className="animate-ping h-12 w-12 rounded-full border-4 border-[var(--tj-red)]" />
            </div>
          )}

          {/* McQuackers — the cursor companion, always on top. */}
          <img
            src={HERO.src}
            alt="McQuackers"
            draggable={false}
            className="pointer-events-none absolute select-none transition-transform duration-100"
            style={{
              left: `${duckPos.x * 100}%`,
              top: `${duckPos.y * 100}%`,
              width: `${HERO.size * 100}%`,
              transform: 'translate(-50%, -50%)',
              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.35))',
              zIndex: 10,
            }}
          />

          {/* Pause overlay */}
          {paused && (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 text-center text-[var(--cream)]"
              onPointerUp={(e) => {
                e.stopPropagation();
                setPaused(false);
              }}
            >
              <div>
                <div className="font-display text-4xl font-black">Paused</div>
                <div className="mt-2 text-sm opacity-80">Tap or press Space to resume.</div>
              </div>
            </div>
          )}

          {/* Tutorial overlay (Level 1 only, first 6.5s) */}
          {showTutorial && !paused && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[var(--cream)] px-5 py-2.5 text-center text-sm font-bold text-[var(--ink)] shadow-xl">
              <span className="sm:hidden">Drag to look. Double-tap when you spot the mascot.</span>
              <span className="hidden sm:inline">Move your cursor to look. Click when you spot the hidden mascot.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

function Hud({
  level,
  elapsed,
  onShowHelp,
  onPause,
  paused,
}: {
  level: LevelConfig;
  elapsed: number;
  onShowHelp: () => void;
  onPause: () => void;
  paused: boolean;
}) {
  // Track mute as local state so the button shows the right icon. The
  // underlying source of truth is localStorage (see quack-sfx.ts).
  const [muted, setMutedState] = useState(() => isMuted());
  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) playSfx('ui-click', 0.5);
  }

  return (
    <div className="z-20 flex items-center justify-between gap-3 bg-[var(--tj-red)] px-4 py-2 text-[var(--cream)] shadow-lg sm:px-6 sm:py-3">
      <div className="flex items-center gap-3">
        <a
          href="/"
          onClick={() => playSfx('ui-click', 0.4)}
          className="rounded-full bg-[var(--cream)] px-3 py-1.5 text-xs font-extrabold text-[var(--tj-red)] hover:bg-white sm:text-sm"
          title="Exit to map"
        >
          ✕ Exit
        </a>
        {/* Mascot avatar — the player can see exactly who they're looking for. */}
        <img
          src={level.mascotSrc}
          alt={level.mascotName}
          className="h-10 w-10 rounded-full border-2 border-[var(--cream)] bg-[var(--cream)] object-contain shadow-md sm:h-12 sm:w-12"
        />
        <div className="leading-tight">
          <div className="font-display text-base font-black sm:text-lg">
            {level.mascotName}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-wide opacity-90 sm:text-xs">
            Lvl {level.number} · {level.storeLabel}, {level.state}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="rounded-full bg-[var(--cream)] px-3 py-1.5 font-mono text-xs font-extrabold text-[var(--ink)] tabular-nums sm:text-sm">
          {formatTime(elapsed)}
        </div>
        <button
          type="button"
          onClick={() => {
            playSfx('ui-click', 0.4);
            onShowHelp();
          }}
          className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-extrabold text-[var(--ink)] shadow sm:text-sm"
          title="How to play"
        >
          ❓ Help
        </button>
        <button
          type="button"
          onClick={toggleMute}
          className="rounded-full bg-[var(--cream)] px-3 py-1.5 text-xs font-extrabold text-[var(--tj-red)] shadow sm:text-sm"
          title={muted ? 'Sound off' : 'Sound on'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button
          type="button"
          onClick={() => {
            playSfx('ui-click', 0.4);
            onPause();
          }}
          className="rounded-full bg-[var(--cream)] px-3 py-1.5 text-xs font-extrabold text-[var(--tj-red)] shadow sm:text-sm"
          title="Pause (Space)"
        >
          {paused ? '▶' : '⏸'}
        </button>
      </div>
    </div>
  );
}

/** How-to-Play overlay opened from the HUD ❓ button. */
function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="max-w-md rounded-3xl border-4 border-[var(--tj-red)] bg-[var(--cream-dark)] px-6 py-7 text-[var(--ink)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-2xl font-black text-[var(--tj-red)]">How to play</h2>
        <ul className="mt-4 space-y-2.5 text-sm">
          <li className="flex gap-2"><span>👆</span><span>Move your cursor (or drag your finger on mobile) to move McQuackers around.</span></li>
          <li className="flex gap-2"><span>🎯</span><span>Click <strong>directly on the mascot</strong> when you spot it peeking out — not on the display in front. On mobile, <strong>double-tap</strong>.</span></li>
          <li className="flex gap-2"><span>⏱</span><span>Each level starts with a base score that ticks down by 10 points per second. Faster = more points.</span></li>
          <li className="flex gap-2"><span>🦆</span><span>Complete all 5 levels to earn a virtual tjmascots.com lollipop and a spot on the global leaderboard.</span></li>
        </ul>
        <button
          type="button"
          onClick={() => {
            playSfx('ui-click', 0.4);
            onClose();
          }}
          className="mt-6 w-full rounded-full bg-[var(--tj-red)] px-6 py-2.5 text-sm font-black uppercase tracking-wide text-[var(--cream)]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Intro
// ---------------------------------------------------------------------------

function IntroScreen({
  onStart,
  challengeSeconds,
}: {
  onStart: () => void;
  challengeSeconds: number | null;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[var(--cream)] px-6 py-12 text-center">
      <div className="mb-6 text-7xl">🦆</div>
      <h1 className="font-display text-4xl font-black tracking-tight text-[var(--tj-red)] sm:text-6xl">
        McQuackers&apos; Quest
      </h1>
      <p className="mx-auto mt-4 max-w-md text-base text-[var(--ink-soft)] sm:text-lg">
        Five real Trader Joe&apos;s stores. Five hidden store mascots. McQuackers
        needs your help finding them all.
      </p>

      {challengeSeconds != null && (
        <div className="mt-6 rounded-2xl border-2 border-[var(--tj-red)] bg-[var(--cream-dark)] px-5 py-3 text-sm font-bold text-[var(--ink)]">
          🏁 A friend finished in <span className="text-[var(--tj-red)]">{formatTime(challengeSeconds)}</span> — can you beat it?
        </div>
      )}

      <button
        type="button"
        onClick={onStart}
        className="mt-10 rounded-full bg-[var(--tj-red)] px-10 py-4 text-lg font-black uppercase tracking-wide text-[var(--cream)] shadow-[0_4px_0_var(--tj-red-dark)] transition hover:-translate-y-px hover:shadow-[0_6px_0_var(--tj-red-dark)] active:translate-y-0.5"
      >
        Start the quest
      </button>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs font-bold text-[var(--ink-soft)]">
        <a href="/how-to-play" className="underline underline-offset-2 hover:text-[var(--tj-red)]">
          How to play
        </a>
        <span>·</span>
        <a href="/quack/leaderboard" className="underline underline-offset-2 hover:text-[var(--tj-red)]">
          High scores
        </a>
        <span>·</span>
        <a href="/" className="underline underline-offset-2 hover:text-[var(--tj-red)]">
          Back to the map
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Between-level card
// ---------------------------------------------------------------------------

function LevelCompleteCard({
  justFinished,
  result,
  upcoming,
  onContinue,
}: {
  justFinished: LevelConfig;
  result: LevelResult;
  upcoming: LevelConfig | null;
  onContinue: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[var(--cream)] px-6 py-12 text-center">
      <div className="mb-2 text-5xl">🎉</div>
      <h2 className="font-display text-3xl font-black text-[var(--tj-red)] sm:text-4xl">
        Found {justFinished.mascotName}!
      </h2>
      <p className="mt-2 text-sm font-bold uppercase tracking-wide text-[var(--ink-soft)]">
        Level {justFinished.number} complete · {justFinished.storeLabel}, {justFinished.state}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[var(--ink)] sm:gap-8">
        <Stat label="Time" value={formatTime(result.elapsedSeconds)} />
        <Stat label="Hints" value={String(result.hintsUsed)} />
        <Stat label="Points" value={result.score.toLocaleString()} />
      </div>

      {upcoming ? (
        <div className="mt-8 max-w-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
            Up next
          </div>
          <div className="mt-1 font-display text-xl font-black text-[var(--ink)]">
            Level {upcoming.number} — {upcoming.storeLabel}, {upcoming.state}
          </div>
          <div className="mt-1 text-sm italic text-[var(--ink-soft)]">
            Find {upcoming.mascotName}, the {upcoming.animal.toLowerCase()}.
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onContinue}
        className="mt-8 rounded-full bg-[var(--tj-red)] px-8 py-3 text-base font-black uppercase tracking-wide text-[var(--cream)] shadow-[0_4px_0_var(--tj-red-dark)] hover:-translate-y-px hover:shadow-[0_6px_0_var(--tj-red-dark)]"
      >
        {upcoming ? 'Continue' : 'See your final score'}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-2xl font-black tabular-nums">{value}</div>
      <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--ink-soft)]">
        {label}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Final / win screen
// ---------------------------------------------------------------------------

function WonScreen({
  results,
  totalScore,
  totalTimeSeconds,
  hintsTotal,
  onReplay,
}: {
  results: LevelResult[];
  totalScore: number;
  totalTimeSeconds: number;
  hintsTotal: number;
  onReplay: () => void;
}) {
  const [initials, setInitials] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topScores, setTopScores] = useState<ScoreRow[] | null>(null);
  const [myRowId, setMyRowId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Big celebration sound when the player lands on this screen.
  useEffect(() => {
    playSfx('game-won', 0.7);
  }, []);

  useEffect(() => {
    fetchTopScores(20).then(setTopScores).catch(() => setTopScores([]));
  }, [submitted]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = initials.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    if (cleaned.length !== 3) {
      setError('Please enter 3 letters.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await submitScore({
      initials: cleaned,
      totalScore,
      totalTimeSeconds,
      hintsUsed: hintsTotal,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMyRowId(res.row.id);
    setSubmitted(true);
  }

  function copyBragLink() {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/quack?t=${totalTimeSeconds}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--cream)] px-4 py-8 sm:px-8 sm:py-12">
      <style jsx>{`
        @keyframes lollipop-in {
          0% { transform: scale(0) rotate(-30deg); opacity: 0; }
          70% { transform: scale(1.1) rotate(8deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes lollipop-bob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(4deg); }
        }
        .reward-stack { animation: lollipop-in 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both; }
        .reward-stack img { animation: lollipop-bob 2.4s ease-in-out 1.3s infinite; }
      `}</style>
      <div className="mx-auto w-full max-w-2xl text-center">
        <div className="mb-2 text-6xl">🏆</div>
        <h2 className="font-display text-3xl font-black text-[var(--tj-red)] sm:text-5xl">
          You found them all!
        </h2>
        <p className="mt-2 text-base text-[var(--ink-soft)]">
          McQuackers couldn&apos;t have done it without you.
        </p>

        {/* Virtual lollipop reward — the "treat at the end" McQuackers promised. */}
        <div className="reward-stack mt-6 flex flex-col items-center">
          <img
            src="/quack/lollipop.png"
            alt="A tjmascots.com lollipop"
            className="h-44 w-auto sm:h-56"
          />
          <div className="mt-3 text-xs font-bold uppercase tracking-widest text-[var(--ink-soft)]">
            Your reward
          </div>
          <div className="font-display text-lg font-black text-[var(--ink)]">
            A tjmascots.com lollipop 🍭
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 rounded-3xl bg-[var(--cream-dark)] px-6 py-5 shadow-inner">
          <Stat label="Final score" value={totalScore.toLocaleString()} />
          <Stat label="Total time" value={formatTime(totalTimeSeconds)} />
          <Stat label="Hints used" value={String(hintsTotal)} />
        </div>

        {/* Per-level breakdown */}
        <div className="mt-4 grid grid-cols-5 gap-1 text-[10px] sm:text-xs">
          {results.map((r) => (
            <div
              key={r.level}
              className="rounded-lg bg-[var(--cream-dark)] px-1 py-2 font-mono tabular-nums text-[var(--ink-soft)]"
            >
              <div className="font-extrabold text-[var(--ink)]">L{r.level}</div>
              <div>{formatTime(r.elapsedSeconds)}</div>
              <div>{r.score.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* Initials / submission */}
        {!submitted ? (
          <form onSubmit={handleSubmit} className="mt-8">
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--ink-soft)]">
              Enter your initials for the leaderboard
            </div>
            <div className="mt-2 flex items-center justify-center gap-3">
              <input
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                value={initials}
                onChange={(e) =>
                  setInitials(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))
                }
                maxLength={3}
                placeholder="MCQ"
                className="w-32 rounded-xl border-4 border-[var(--tj-red)] bg-[var(--cream)] px-3 py-2 text-center font-mono text-3xl font-black uppercase tracking-[0.4em] text-[var(--ink)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={submitting || initials.length !== 3}
                className="rounded-full bg-[var(--tj-red)] px-6 py-3 text-sm font-black uppercase tracking-wide text-[var(--cream)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
            {error && <div className="mt-2 text-sm font-bold text-[var(--tj-red)]">{error}</div>}
          </form>
        ) : (
          <div className="mt-8 space-y-3">
            <div className="text-sm font-bold text-[var(--ink-soft)]">You&apos;re on the board.</div>
            <button
              type="button"
              onClick={copyBragLink}
              className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-black uppercase tracking-wide text-[var(--ink)] shadow"
            >
              {copied ? '✓ Link copied!' : '🔗 Copy brag link'}
            </button>
            <div className="text-xs text-[var(--ink-soft)]">
              Send it to a friend — they&apos;ll have to beat your time.
            </div>
          </div>
        )}

        {/* Leaderboard */}
        {topScores && topScores.length > 0 && (
          <div className="mt-10 text-left">
            <h3 className="font-display text-xl font-black uppercase tracking-wide text-[var(--ink)]">
              Top scores
            </h3>
            <ol className="mt-3 space-y-1 font-mono text-sm">
              {topScores.map((row, i) => (
                <li
                  key={row.id}
                  className={`flex items-baseline gap-3 rounded-lg px-3 py-1.5 tabular-nums ${
                    row.id === myRowId ? 'bg-[var(--accent)] font-extrabold' : 'bg-[var(--cream-dark)]'
                  }`}
                >
                  <span className="w-6 text-right text-[var(--ink-soft)]">{i + 1}.</span>
                  <span className="font-extrabold tracking-[0.25em]">{row.initials}</span>
                  <span className="ml-auto">{row.total_score.toLocaleString()}</span>
                  <span className="text-[var(--ink-soft)]">{formatTime(row.total_time_seconds)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onReplay}
            className="rounded-full bg-[var(--tj-red)] px-6 py-2.5 text-sm font-black uppercase tracking-wide text-[var(--cream)]"
          >
            Play again
          </button>
          <a
            href="/"
            className="rounded-full bg-[var(--cream-dark)] px-6 py-2.5 text-sm font-black uppercase tracking-wide text-[var(--ink)]"
          >
            Back to the map
          </a>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
