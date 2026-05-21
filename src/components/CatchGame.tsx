'use client';

/**
 * CatchGame — McQuackers' Mascot Catch
 *
 * Duck-level whack-a-mole. McQuackers swings a butterfly net through a TJ's
 * aisle to catch the home mascot + 5 neighbors in 30 seconds.
 *
 * Hosted at /catch. Trigger: 5 clicks on the © symbol in SiteShell footer.
 *
 * UI flow:
 *   1. LEVEL_SELECT — pick one of 3 stores (W/MW/E) or play All Three
 *   2. PRE_LEVEL    — store name + "Today's Targets" panel + START button
 *   3. PLAYING      — canvas with 30s timer, controls, scoring
 *   4. END          — score breakdown, leaderboard entry, replay options
 *
 * All asset paths come from catch-config.ts. Leaderboard writes via
 * catch-leaderboard.ts (Supabase).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  LEVELS,
  HERO,
  OBSTACLES,
  CATCH_AUDIO,
  LEVEL_DURATION_SECONDS,
  RUSH_HOUR_SECONDS,
  MAX_CONCURRENT_MASCOTS,
  SPAWN_INTERVAL_MS,
  MASCOT_VISIBLE_MS_RANGE,
  NET_COOLDOWN_MS,
  NET_SWING_MS,
  NET_CATCH_RADIUS,
  STUN_DURATION_MS,
  OBSTACLE_SPAWN_PER_SECOND,
  MAX_CONCURRENT_OBSTACLES,
  HERO_SIZE_FRAC,
  MASCOT_SIZE_FRAC,
  OBSTACLE_SIZE_FRAC,
  HERO_FOLLOW_SPEED,
  type LevelConfig,
  type MascotTarget,
} from '@/lib/catch-config';
import {
  isMuted,
  setMuted,
  unlockAudio,
  startBackgroundMusic,
  stopBackgroundMusic,
  playCatch,
  playMiss,
  playHit,
  playSplashJingle,
} from '@/lib/catch-audio';
import {
  submitScore,
  fetchLevelTop,
  rankForLevelScore,
  type CatchScoreRow,
} from '@/lib/catch-leaderboard';

type Phase = 'level-select' | 'pre-level' | 'playing' | 'end';

/**
 * Mascots with walk-cycle frames available. Keyed by slug, value is the
 * ordered list of 4 frame URLs. When a mascot is spawned and a walk cycle
 * exists for it, the new walking behavior kicks in (cross-screen movement,
 * frame cycling, direction flipping). Mascots NOT in this map fall through
 * to the legacy hiding-spot / peek-and-bob behavior.
 *
 * Pilot — Cacahuete only. Other 17 added once David approves her in-game.
 */
const WALK_CYCLES: Record<string, string[]> = {
  // Walking pilot (Cacahuete) was rolled back — see project memory. Placement
  // is the new approach: surfaces per level, mascots stand on them. The
  // walking plumbing below stays in place but nothing's registered here, so
  // all mascots fall through to the legacy hiding-spot behavior.
};

/** ms between walk-cycle frame advances. */
const WALK_FRAME_MS = 150;
/** Walk speed range, normalized x per second. ~5.5–8.3s to cross the playfield. */
const WALK_SPEED_MIN = 0.12;
const WALK_SPEED_MAX = 0.18;
/** Lane y-coordinates for walking mascots (0..1, fraction of playfield height). */
const WALK_LANE_FLOOR = 0.86;
const WALK_LANE_DISPLAY = 0.55;
// Eaves lane reserved for birds (freddie, marvin) — added when birds get wired up.
// const WALK_LANE_EAVES = 0.28;

type SpawnedMascot = {
  id: number;
  mascot: MascotTarget;
  /** Normalized position 0–1 within the playfield. */
  x: number;
  y: number;
  /** Size multiplier — final render size is MASCOT_SIZE_FRAC * scale * H.
   *  Comes from the level's HidingSpot.scale (default 1.0 for legacy spots). */
  scale: number;
  /** ms when it spawned. */
  spawnedAt: number;
  /** How long it should stay visible (ms). Unused for walking mascots — they
   *  despawn by walking off the edge, not by timer. */
  ttl: number;
  /** True once caught — animates into tote, stops being interactive. */
  caught: boolean;
  /** Animation start ms for the catch-arc. */
  caughtAt?: number;
  /** Present only for mascots with a walk cycle. When set, the mascot walks
   *  across the playfield instead of peeking from a hiding spot. */
  walking?: {
    /** +1 = walking rightward, -1 = walking leftward (sprite gets flipped). */
    direction: 1 | -1;
    /** Speed in normalized x per second. */
    speed: number;
    /** Current frame index into WALK_CYCLES[slug] (0..3). */
    frameIndex: number;
    /** ms when frameIndex last advanced. */
    lastFrameAt: number;
  };
};

type Obstacle = {
  id: number;
  // Both 'cart' and 'legs' removed per David — only the kneeling crew
  // restocker remains. The kind field is kept (single-value union) in
  // case we add new obstacle types later without restructuring the type.
  kind: 'crew';
  /** Normalized x position (kept for parity with future obstacles). */
  x: number;
  /** Vertical lane (0 = top obstacle lane, 1 = bottom). */
  lane: number;
  /** Pixels/sec movement. Crew is stationary so this stays 0. */
  velocity: number;
  /** Crew is stationary. */
  stationary: boolean;
  /** ms when spawned. */
  spawnedAt: number;
};

/** Pre-defined hiding spots (normalized 0–1 within the playfield) where
 *  mascots can peek out from. Mix of low and high spots so the player has
 *  to scan everywhere. */
const HIDING_SPOTS: Array<{ x: number; y: number }> = [
  { x: 0.12, y: 0.55 }, // behind left endcap
  { x: 0.22, y: 0.72 }, // low left
  { x: 0.35, y: 0.48 }, // mid-shelf left
  { x: 0.48, y: 0.65 }, // center aisle
  { x: 0.62, y: 0.45 }, // mid-shelf right
  { x: 0.75, y: 0.70 }, // low right
  { x: 0.85, y: 0.55 }, // behind right endcap
  { x: 0.30, y: 0.38 }, // upper shelf left
  { x: 0.68, y: 0.38 }, // upper shelf right
];

let mascotIdSeq = 0;
let obstacleIdSeq = 0;

/**
 * Convert an Image to a same-size offscreen canvas. Used for backgrounds
 * that don't need any pixel processing — canvas is a tidier render target.
 */
function imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d');
  if (ctx) ctx.drawImage(img, 0, 0);
  return c;
}

/**
 * Chroma-key any near-white pixels to transparent. Used on character +
 * obstacle sprites that Higgsfield rendered against a plain white background.
 *
 * Threshold tuned for clean edges on cartoon sprites. Lowered from
 * HARD=740/SOFT=680 → HARD=710/SOFT=600 after the shopping cart kept showing
 * a soft white halo around its silver wire frame (the AA-edge pixels were
 * ~220 per channel, just under the old SOFT line).
 *   • Pixels above HARD → fully transparent
 *   • Pixels between SOFT and HARD → faded (smooths the edge)
 *   • Pixels below SOFT → fully opaque
 *
 * Also requires per-channel desaturation (all 3 channels within 22 of each
 * other) so we don't accidentally chroma-key bright reds, blues, etc.
 *
 * This is fast (one O(n) pass) so we run it at load time and never again.
 */
function chromaKeyWhite(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.drawImage(img, 0, 0);
  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, c.width, c.height);
  } catch {
    // Canvas tainted (CORS) — fall back to drawing without chroma-key.
    return c;
  }
  const px = data.data;
  // RGB sum thresholds (each channel 0-255, so sum 0-765)
  const HARD = 710; // ~237 avg per channel → kill it
  const SOFT = 600; // ~200 avg per channel → fade for soft edge
  const DESAT = 22; // max spread between channels — anything above is "colorful"
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const sum = r + g + b;
    if (sum < SOFT) continue; // dark or colorful — keep
    // Only kill near-grayscale brights (saturated colors near white still pass)
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    if (maxC - minC > DESAT) continue;
    if (sum >= HARD) {
      px[i + 3] = 0; // fully transparent
    } else {
      // fade alpha linearly across the soft window
      const t = (sum - SOFT) / (HARD - SOFT);
      px[i + 3] = Math.floor(px[i + 3] * (1 - t));
    }
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

export default function CatchGame({ initialLevel }: { initialLevel?: string } = {}) {
  // When only one level is configured (David's "focus on Pasadena" mode),
  // skip the level-select screen entirely — picking from a single option is
  // bad UX. Auto-select that one level and go straight to pre-level.
  const soloLevel = LEVELS.length === 1 ? LEVELS[0] : null;
  const [phase, setPhase] = useState<Phase>(
    initialLevel || soloLevel ? 'pre-level' : 'level-select',
  );
  const [selectedLevel, setSelectedLevel] = useState<LevelConfig | null>(
    initialLevel
      ? LEVELS.find((l) => l.slug === initialLevel) ?? null
      : soloLevel,
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playfieldRef = useRef<HTMLDivElement | null>(null);

  // Game state lives in refs so the rAF loop doesn't trigger React renders.
  const heroRef = useRef({ x: 0.5, y: 0.7, targetX: 0.5, targetY: 0.7 });
  const swingRef = useRef({ swinging: false, lastSwingAt: 0, stunnedUntil: 0 });
  const mascotsRef = useRef<SpawnedMascot[]>([]);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const lastSpawnAtRef = useRef(0);
  const lastObstacleSpawnAtRef = useRef(0);
  const gameStartAtRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  // React state — only updated occasionally for the HUD (score, time).
  const [hudScore, setHudScore] = useState(0);
  const [hudTimeLeft, setHudTimeLeft] = useState(LEVEL_DURATION_SECONDS);
  const [hudCaughtCounts, setHudCaughtCounts] = useState<Record<string, number>>({});

  // Live mirrors of score + caught counts, read by the canvas render loop.
  // The rAF loop is created once inside useEffect and its closure captures
  // a stale snapshot of React state — so writing the score to setHudScore
  // alone makes the tote/score panel appear frozen even though state
  // updates correctly. These refs are mutated synchronously in
  // tryCatchAtHeroPos and read by drawHUD so the on-canvas HUD stays live.
  const scoreRef = useRef(0);
  const caughtCountsRef = useRef<Record<string, number>>({});

  // End-screen state
  const [finalScore, setFinalScore] = useState(0);
  const [finalCaught, setFinalCaught] = useState<Record<string, number>>({});

  // Mute state. Initialized after mount to avoid SSR mismatch (localStorage
  // is browser-only).
  const [muted, setMutedState] = useState(false);
  useEffect(() => {
    setMutedState(isMuted());
  }, []);
  const toggleMute = useCallback(() => {
    setMutedState((prev) => {
      const next = !prev;
      setMuted(next);
      return next;
    });
    // Clicking the toggle is a valid user gesture — unlock here too so a
    // user who toggles before pressing START still gets audio.
    void unlockAudio();
  }, []);

  // Sprite cache — loaded once at mount, re-used across replays.
  // Stored as canvases (post-chroma-key processing) instead of raw images
  // so we can drawImage() them with transparent backgrounds.
  const spritesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  /** Walk-cycle cache. Keyed by mascot slug; value is the 4 frames in order.
   *  Populated at preload time from WALK_CYCLES. Separate from spritesRef so
   *  the renderer doesn't have to string-concat URLs in its hot loop. */
  const walkFramesRef = useRef<Map<string, HTMLCanvasElement[]>>(new Map());
  const [assetsReady, setAssetsReady] = useState(false);

  // ---- ASSET PRELOAD ------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      const allUrls = new Set<string>();
      allUrls.add(HERO.spriteIdle);
      allUrls.add(HERO.spriteSwing);
      allUrls.add(HERO.spriteStunned);
      allUrls.add(HERO.spriteVictory);
      // All obstacle sprites (cart, legs, crew) intentionally not
      // preloaded — all three obstacle types are currently disabled per
      // David. Constants kept in catch-config so re-enabling is just an
      // array-add here.
      for (const level of LEVELS) {
        allUrls.add(level.backgroundSrc);
        for (const m of level.mascots) allUrls.add(m.spriteSrc);
      }
      const loaders = Array.from(allUrls).map(
        (url) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            // Same-origin assets don't strictly need this, but it makes
            // getImageData() reliable even if a future asset gets served
            // through a CDN that requires explicit CORS opt-in.
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              // Background images don't get chroma-keyed — they're meant to
              // fill the canvas. Only character/obstacle sprites do.
              const isBackground = url.includes('/backgrounds/');
              const canvas = isBackground
                ? imageToCanvas(img)
                : chromaKeyWhite(img);
              spritesRef.current.set(url, canvas);
              resolve();
            };
            img.onerror = () => {
              // Don't block the game on a single missing asset.
              console.warn('[CatchGame] failed to load sprite:', url);
              resolve();
            };
            img.src = url;
          }),
      );

      // Walk-cycle frames — load each mascot's 4 frames in order and stash
      // them under the mascot's slug so the renderer can grab the right
      // frame by index without string concatenation.
      const walkLoaders = Object.entries(WALK_CYCLES).flatMap(([slug, urls]) => {
        // Pre-allocate so frames land in the right slot regardless of which
        // image resolves first.
        const frames: HTMLCanvasElement[] = new Array(urls.length);
        walkFramesRef.current.set(slug, frames);
        return urls.map(
          (url, i) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => {
                frames[i] = chromaKeyWhite(img);
                resolve();
              };
              img.onerror = () => {
                console.warn('[CatchGame] failed to load walk frame:', url);
                resolve();
              };
              img.src = url;
            }),
        );
      });

      await Promise.all([...loaders, ...walkLoaders]);
      if (!cancelled) setAssetsReady(true);
    }
    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- CONTROLS -----------------------------------------------------------

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const el = playfieldRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    heroRef.current.targetX = Math.max(0.05, Math.min(0.95, x));
    heroRef.current.targetY = Math.max(0.1, Math.min(0.9, y));
  }, []);

  const tryCatchAtHeroPos = useCallback((levelMascots: MascotTarget[]) => {
    const now = performance.now();
    if (swingRef.current.stunnedUntil > now) return;
    if (now - swingRef.current.lastSwingAt < NET_COOLDOWN_MS) return;
    swingRef.current.swinging = true;
    swingRef.current.lastSwingAt = now;
    window.setTimeout(() => {
      swingRef.current.swinging = false;
    }, NET_SWING_MS);
    const hx = heroRef.current.x;
    const hy = heroRef.current.y;
    // Net tip is offset up-and-right from McQuackers' body.
    const netX = hx;
    const netY = hy - 0.08;
    const r = NET_CATCH_RADIUS;
    let bestHitIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < mascotsRef.current.length; i++) {
      const m = mascotsRef.current[i];
      if (m.caught) continue;
      const dx = m.x - netX;
      const dy = m.y - netY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r && d < bestDist) {
        bestDist = d;
        bestHitIdx = i;
      }
    }
    if (bestHitIdx >= 0) {
      const caught = mascotsRef.current[bestHitIdx];
      caught.caught = true;
      caught.caughtAt = now;
      // Update refs first (the canvas render loop reads from these).
      scoreRef.current += caught.mascot.points;
      caughtCountsRef.current = {
        ...caughtCountsRef.current,
        [caught.mascot.slug]: (caughtCountsRef.current[caught.mascot.slug] || 0) + 1,
      };
      // Keep React state in sync so the end-screen snapshot is correct.
      setHudScore(scoreRef.current);
      setHudCaughtCounts({ ...caughtCountsRef.current });
      playCatch();
    } else {
      playMiss();
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (!selectedLevel) return;
      handlePointerMove(e);
      tryCatchAtHeroPos(selectedLevel.mascots);
    },
    [selectedLevel, handlePointerMove, tryCatchAtHeroPos],
  );

  // ---- GAME LOOP ----------------------------------------------------------

  const startGame = useCallback(() => {
    if (!selectedLevel) return;
    mascotsRef.current = [];
    obstaclesRef.current = [];
    heroRef.current = { x: 0.5, y: 0.7, targetX: 0.5, targetY: 0.7 };
    swingRef.current = { swinging: false, lastSwingAt: 0, stunnedUntil: 0 };
    lastSpawnAtRef.current = 0;
    lastObstacleSpawnAtRef.current = 0;
    scoreRef.current = 0;
    caughtCountsRef.current = {};
    setHudScore(0);
    setHudTimeLeft(LEVEL_DURATION_SECONDS);
    setHudCaughtCounts({});
    gameStartAtRef.current = performance.now();
    // Clicking START is a valid user gesture — unlock the AudioContext and
    // kick off the background music loop here. If the music file is missing
    // (we haven't dropped one in yet), playback fails silently.
    void unlockAudio();
    startBackgroundMusic(CATCH_AUDIO.music);
    setPhase('playing');
  }, [selectedLevel]);

  useEffect(() => {
    if (phase !== 'playing' || !selectedLevel) return;
    const canvas = canvasRef.current;
    const playfield = playfieldRef.current;
    if (!canvas || !playfield) return;

    // Wire up controls
    playfield.addEventListener('pointermove', handlePointerMove);
    playfield.addEventListener('pointerdown', handlePointerDown);

    // Resize canvas to playfield size (DPR-aware)
    function resizeCanvas() {
      if (!canvas || !playfield) return;
      const rect = playfield.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastFrameAt = performance.now();

    function loop(now: number) {
      if (!canvas || !ctx || !selectedLevel) return;
      const dt = Math.min(50, now - lastFrameAt); // cap dt to handle tab-switch
      lastFrameAt = now;

      // Time
      const elapsedSec = (now - gameStartAtRef.current) / 1000;
      const timeLeft = Math.max(0, LEVEL_DURATION_SECONDS - elapsedSec);
      if (Math.abs(timeLeft - hudTimeLeft) > 0.2) setHudTimeLeft(timeLeft);

      const rushHour = timeLeft <= RUSH_HOUR_SECONDS && timeLeft > 0;
      const spawnInterval = rushHour ? SPAWN_INTERVAL_MS / 2 : SPAWN_INTERVAL_MS;

      // End condition
      if (timeLeft <= 0) {
        endGame();
        return;
      }

      // Hero smooth-follow
      heroRef.current.x += (heroRef.current.targetX - heroRef.current.x) * HERO_FOLLOW_SPEED;
      heroRef.current.y += (heroRef.current.targetY - heroRef.current.y) * HERO_FOLLOW_SPEED;

      // Mascot spawning
      if (
        now - lastSpawnAtRef.current >= spawnInterval &&
        mascotsRef.current.filter((m) => !m.caught).length < MAX_CONCURRENT_MASCOTS
      ) {
        spawnMascot(selectedLevel);
        lastSpawnAtRef.current = now;
      }

      // Walking mascots: advance x, cycle frameIndex. Caught mascots freeze
      // in place so the catch-arc starts from where the player netted them.
      for (const m of mascotsRef.current) {
        if (m.caught || !m.walking) continue;
        m.x += (m.walking.speed * m.walking.direction * dt) / 1000;
        if (now - m.walking.lastFrameAt >= WALK_FRAME_MS) {
          m.walking.frameIndex = (m.walking.frameIndex + 1) % 4;
          m.walking.lastFrameAt = now;
        }
      }

      // Mascot lifecycle:
      //   • caught   → linger 600ms for the catch-arc, then gone
      //   • walking  → gone when they walk past the opposite edge
      //   • legacy   → gone when TTL expires
      mascotsRef.current = mascotsRef.current.filter((m) => {
        if (m.caught) {
          return now - (m.caughtAt ?? now) < 600;
        }
        if (m.walking) {
          return m.x > -0.15 && m.x < 1.15;
        }
        return now - m.spawnedAt < m.ttl;
      });

      // Obstacles temporarily disabled — David removed crew (the last
      // remaining type), so the spawn check is short-circuited. The
      // Obstacle plumbing below (movement, collision, render, playHit) is
      // left intact so re-enabling is just deleting these two lines.
      // const obstacleProb = (OBSTACLE_SPAWN_PER_SECOND * dt) / 1000;
      // if (Math.random() < obstacleProb) spawnObstacle();

      // Obstacles movement + cleanup
      const playfieldWidth = canvas.clientWidth;
      for (const ob of obstaclesRef.current) {
        if (!ob.stationary) {
          ob.x += (ob.velocity * dt) / 1000 / playfieldWidth;
        }
      }
      obstaclesRef.current = obstaclesRef.current.filter((ob) => {
        if (ob.stationary) {
          // Stationary obstacles (crew) live for 3 seconds
          return now - ob.spawnedAt < 3000;
        }
        return ob.x > -0.3 && ob.x < 1.3;
      });

      // Obstacle collisions → stun (+ bonk sound on the leading edge of
      // each new stun, not every frame while still inside the radius).
      const hx = heroRef.current.x;
      const hy = heroRef.current.y;
      for (const ob of obstaclesRef.current) {
        const oy = ob.lane === 0 ? 0.45 : 0.86;
        const dx = ob.x - hx;
        const dy = oy - hy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.1 && swingRef.current.stunnedUntil <= now) {
          swingRef.current.stunnedUntil = now + STUN_DURATION_MS;
          playHit();
        }
      }

      // RENDER
      render(ctx, canvas, selectedLevel, now);

      rafIdRef.current = requestAnimationFrame(loop);
    }

    function spawnMascot(level: LevelConfig) {
      // Weighted random pick
      const totalWeight = level.mascots.reduce((s, m) => s + m.spawnWeight, 0);
      let roll = Math.random() * totalWeight;
      let pick = level.mascots[0];
      for (const m of level.mascots) {
        roll -= m.spawnWeight;
        if (roll <= 0) {
          pick = m;
          break;
        }
      }
      const now = performance.now();
      const walkFrames = walkFramesRef.current.get(pick.slug);

      // -- WALKING BEHAVIOR -------------------------------------------------
      // If this mascot has walk-cycle frames loaded, spawn them at an edge
      // of the playfield and let them stroll across one of the lanes. They
      // despawn when they walk off the opposite edge (no TTL).
      if (walkFrames && walkFrames.length === WALK_CYCLES[pick.slug].length) {
        const fromLeft = Math.random() < 0.5;
        const direction: 1 | -1 = fromLeft ? 1 : -1;
        // Ground mascots use floor or display lane. Birds (when added) will
        // use the eaves lane instead — gate on mascot kind in a later pass.
        const lane = Math.random() < 0.5 ? WALK_LANE_FLOOR : WALK_LANE_DISPLAY;
        const speed =
          WALK_SPEED_MIN + Math.random() * (WALK_SPEED_MAX - WALK_SPEED_MIN);
        mascotsRef.current.push({
          id: ++mascotIdSeq,
          mascot: pick,
          x: fromLeft ? -0.1 : 1.1,
          y: lane,
          scale: 1,
          spawnedAt: now,
          ttl: Infinity, // unused for walking mascots
          caught: false,
          walking: {
            direction,
            speed,
            frameIndex: 0,
            lastFrameAt: now,
          },
        });
        return;
      }

      // -- HIDING-SPOT BEHAVIOR ---------------------------------------------
      // Prefer the level's hand-marked spots (David's per-scene placements,
      // which include perspective-correct scale). Fall through to legacy
      // level-agnostic HIDING_SPOTS for any level that hasn't been mapped
      // yet — those spawns will look floaty until the level gets its own
      // hidingSpots array, but at least the game still plays.
      const spotPool: Array<{ x: number; y: number; scale: number }> =
        level.hidingSpots && level.hidingSpots.length > 0
          ? level.hidingSpots
          : HIDING_SPOTS.map((s) => ({ ...s, scale: 1 }));
      const occupied = new Set(
        mascotsRef.current
          .filter((m) => !m.caught)
          .map((m) => `${m.x.toFixed(3)},${m.y.toFixed(3)}`),
      );
      const candidates = spotPool.filter(
        (s) => !occupied.has(`${s.x.toFixed(3)},${s.y.toFixed(3)}`),
      );
      const pool = candidates.length > 0 ? candidates : spotPool;
      const spot = pool[Math.floor(Math.random() * pool.length)];
      const [tmin, tmax] = MASCOT_VISIBLE_MS_RANGE;
      mascotsRef.current.push({
        id: ++mascotIdSeq,
        mascot: pick,
        x: spot.x,
        y: spot.y,
        scale: spot.scale,
        spawnedAt: now,
        ttl: tmin + Math.random() * (tmax - tmin),
        caught: false,
      });
    }

    function spawnObstacle() {
      // Hard cap so the screen never gets cluttered.
      if (obstaclesRef.current.length >= MAX_CONCURRENT_OBSTACLES) return;
      // Only kneeling crew. Spawned at a random x on either shelf lane,
      // stationary, lives ~3s before despawning (handled in the lifecycle
      // filter above).
      const lane = Math.random() < 0.5 ? 0 : 1;
      const x = 0.1 + Math.random() * 0.8;
      obstaclesRef.current.push({
        id: ++obstacleIdSeq,
        kind: 'crew',
        x,
        lane,
        velocity: 0,
        stationary: true,
        spawnedAt: performance.now(),
      });
    }

    rafIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      playfield.removeEventListener('pointermove', handlePointerMove);
      playfield.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', resizeCanvas);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selectedLevel, handlePointerMove, handlePointerDown]);

  // ---- RENDER -------------------------------------------------------------

  function render(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    level: LevelConfig,
    now: number,
  ) {
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);

    // Background
    const bg = spritesRef.current.get(level.backgroundSrc);
    if (bg) {
      // cover-fit
      const bgRatio = bg.width / bg.height;
      const cvRatio = W / H;
      let dw = W;
      let dh = H;
      let dx = 0;
      let dy = 0;
      if (bgRatio > cvRatio) {
        dh = H;
        dw = H * bgRatio;
        dx = (W - dw) / 2;
      } else {
        dw = W;
        dh = W / bgRatio;
        dy = (H - dh) / 2;
      }
      ctx.drawImage(bg, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = '#3a2618';
      ctx.fillRect(0, 0, W, H);
    }

    // Sort drawables by y for fake depth
    type Drawable = { y: number; draw: () => void };
    const drawables: Drawable[] = [];

    // Obstacles
    for (const ob of obstaclesRef.current) {
      const oy = ob.lane === 0 ? 0.45 : 0.86;
      drawables.push({
        y: oy,
        draw: () => {
          const sprite = spritesRef.current.get(OBSTACLES.crew);
          if (!sprite) return;
          const size = H * OBSTACLE_SIZE_FRAC;
          const aspect = sprite.width / sprite.height;
          const w = size * aspect;
          ctx.drawImage(sprite, ob.x * W - w / 2, oy * H - size / 2, w, size);
        },
      });
    }

    // Mascots (peeking + walking + catch-arc)
    for (const m of mascotsRef.current) {
      drawables.push({
        y: m.y,
        draw: () => {
          // Walking mascots pull from the per-slug frame array; legacy
          // peeking mascots use the original single sprite.
          let sprite: HTMLCanvasElement | undefined;
          if (m.walking) {
            const frames = walkFramesRef.current.get(m.mascot.slug);
            sprite = frames?.[m.walking.frameIndex] ?? frames?.[0];
          } else {
            sprite = spritesRef.current.get(m.mascot.spriteSrc);
          }
          if (!sprite) return;
          // Per-spot scale lets back-of-store mascots render small for
          // perspective. Foreground mascots stay at full MASCOT_SIZE_FRAC.
          const size = H * MASCOT_SIZE_FRAC * m.scale;
          const aspect = sprite.width / sprite.height;
          const w = size * aspect;
          let x = m.x * W - w / 2;
          let y = m.y * H - size / 2;
          let scale = 1;
          if (m.caught && m.caughtAt) {
            // Arc into tote bag at top-right corner
            const t = Math.min(1, (now - m.caughtAt) / 600);
            const targetX = W - 90;
            const targetY = 60;
            const ease = 1 - Math.pow(1 - t, 2);
            x = (m.x * W - w / 2) + (targetX - (m.x * W)) * ease;
            y = (m.y * H - size / 2) + (targetY - (m.y * H)) * ease - Math.sin(t * Math.PI) * 80;
            scale = 1 - t * 0.6;
            ctx.globalAlpha = 1 - t * 0.3;
          } else {
            // Peek/walking bob — small vertical sine as a stride/breath
            const age = now - m.spawnedAt;
            const bob = Math.sin(age / 200) * 4;
            y += bob;
            // Fade-in for first 200ms (softens edge-of-screen pop-in too)
            const fade = Math.min(1, age / 200);
            ctx.globalAlpha = fade;
          }
          // Flip horizontally if walking leftward. Source art faces right.
          const flipX = m.walking && m.walking.direction === -1 && !m.caught;
          if (scale !== 1 || flipX) {
            ctx.save();
            ctx.translate(x + w / 2, y + size / 2);
            if (flipX) ctx.scale(-1, 1);
            if (scale !== 1) ctx.scale(scale, scale);
            ctx.drawImage(sprite, -w / 2, -size / 2, w, size);
            ctx.restore();
          } else {
            ctx.drawImage(sprite, x, y, w, size);
          }
          ctx.globalAlpha = 1;
        },
      });
    }

    // Hero (McQuackers)
    const stunned = swingRef.current.stunnedUntil > now;
    const swinging = swingRef.current.swinging;
    drawables.push({
      y: heroRef.current.y + 0.001, // draw just under tied-y mascots
      draw: () => {
        const heroSprite = stunned
          ? spritesRef.current.get(HERO.spriteStunned)
          : swinging
            ? spritesRef.current.get(HERO.spriteSwing)
            : spritesRef.current.get(HERO.spriteIdle);
        if (!heroSprite) return;
        const size = H * HERO_SIZE_FRAC;
        const aspect = heroSprite.width / heroSprite.height;
        const w = size * aspect;
        const x = heroRef.current.x * W - w / 2;
        const y = heroRef.current.y * H - size / 2;
        ctx.drawImage(heroSprite, x, y, w, size);
      },
    });

    // Sort by y (back-to-front) and draw
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // HUD overlays (tote bag in corner, score, timer ring)
    drawHUD(ctx, W, H, now);
  }

  function drawHUD(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    now: number,
  ) {
    // Tote bag icon in top-right corner. Read from the live ref (not React
    // state) so the count updates each frame — see scoreRef comment above.
    const totalCaught = Object.values(caughtCountsRef.current).reduce(
      (a, b) => a + b,
      0,
    );
    ctx.save();
    ctx.fillStyle = 'rgba(20, 12, 6, 0.65)';
    ctx.beginPath();
    ctx.roundRect(W - 130, 18, 110, 56, 14);
    ctx.fill();
    ctx.fillStyle = '#fdf6ec';
    ctx.font = '700 13px ui-sans-serif, system-ui';
    ctx.fillText('🛍 TOTE', W - 116, 38);
    ctx.font = '900 24px ui-sans-serif, system-ui';
    ctx.fillText(`${totalCaught}`, W - 116, 64);
    ctx.restore();

    // Score panel top-left
    ctx.save();
    ctx.fillStyle = 'rgba(20, 12, 6, 0.65)';
    ctx.beginPath();
    ctx.roundRect(18, 18, 140, 56, 14);
    ctx.fill();
    ctx.fillStyle = '#fdf6ec';
    ctx.font = '700 13px ui-sans-serif, system-ui';
    ctx.fillText('SCORE', 32, 38);
    ctx.font = '900 24px ui-sans-serif, system-ui';
    ctx.fillText(`${scoreRef.current}`, 32, 64);
    ctx.restore();

    // Timer ring center-top
    const cx = W / 2;
    const cy = 50;
    const r = 30;
    const t = Math.max(0, Math.min(1, hudTimeLeft / LEVEL_DURATION_SECONDS));
    const rush = hudTimeLeft <= RUSH_HOUR_SECONDS;
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = rush ? '#ff4d4d' : '#fdf6ec';
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
    ctx.stroke();
    if (rush) {
      // Pulse during rush hour
      const pulse = 1 + Math.sin(now / 100) * 0.05;
      ctx.scale(pulse, pulse);
    }
    ctx.fillStyle = rush ? '#ff4d4d' : '#fdf6ec';
    ctx.font = '900 20px ui-sans-serif, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(hudTimeLeft)}`, cx, cy + 7);
    ctx.restore();
  }

  // ---- END GAME -----------------------------------------------------------

  function endGame() {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    stopBackgroundMusic();
    // Snapshot from the refs — they're the authoritative source of truth.
    setFinalScore(scoreRef.current);
    setFinalCaught({ ...caughtCountsRef.current });
    setPhase('end');
  }

  function backToLevelSelect() {
    setSelectedLevel(null);
    setPhase('level-select');
  }

  // ---- RENDER PHASES ------------------------------------------------------

  if (!assetsReady) {
    return <LoadingScreen />;
  }

  if (phase === 'level-select') {
    return (
      <LevelSelect
        onPick={(l) => {
          setSelectedLevel(l);
          setPhase('pre-level');
        }}
      />
    );
  }

  if (phase === 'pre-level' && selectedLevel) {
    return (
      <PreLevelScreen
        level={selectedLevel}
        onStart={startGame}
        onBack={backToLevelSelect}
      />
    );
  }

  if (phase === 'playing' && selectedLevel) {
    return (
      <div className="catch-shell">
        <style jsx>{shellStyles}</style>
        <div ref={playfieldRef} className="catch-playfield" data-level={selectedLevel.slug}>
          <canvas ref={canvasRef} className="catch-canvas" />
          <button
            type="button"
            className="catch-mute"
            onClick={(e) => {
              // Don't let the click also count as a net-swing on the canvas.
              e.stopPropagation();
              toggleMute();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            title={muted ? 'Unmute sound' : 'Mute sound'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'end' && selectedLevel) {
    return (
      <EndScreen
        level={selectedLevel}
        score={finalScore}
        caught={finalCaught}
        onReplay={startGame}
        onBackToLevels={backToLevelSelect}
      />
    );
  }

  return null;
}

// =============================================================================
// SUB-SCREENS
// =============================================================================

function LoadingScreen() {
  return (
    <div className="catch-loading">
      <style jsx>{`
        .catch-loading {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: var(--cream);
          color: var(--ink);
          font-family: 'Fraunces', serif;
          font-weight: 900;
          font-size: 22px;
          gap: 14px;
        }
        .spinner {
          width: 48px;
          height: 48px;
          border: 5px solid var(--cream-dark);
          border-top-color: var(--tj-red);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div className="spinner" />
      <div>Loading McQuackers&apos; tote bag…</div>
    </div>
  );
}

function LevelSelect({ onPick }: { onPick: (level: LevelConfig) => void }) {
  return (
    <div className="catch-level-select">
      <style jsx>{levelSelectStyles}</style>
      <div className="catch-ls-inner">
        <h1 className="catch-ls-title">McQuackers&apos; Mascot Catch</h1>
        <p className="catch-ls-sub">Pick a store. Catch every mascot in 30 seconds.</p>
        <div className="catch-ls-grid">
          {LEVELS.map((level) => (
            <button
              key={level.slug}
              className="catch-ls-card"
              onClick={() => onPick(level)}
            >
              <div className="catch-ls-bg" style={{ backgroundImage: `url(${level.backgroundSrc})` }} />
              <div className="catch-ls-meta">
                <div className="catch-ls-region">{level.region}</div>
                <div className="catch-ls-store">{level.storeLabel}</div>
                <div className="catch-ls-tagline">{level.tagline}</div>
                <div className="catch-ls-cta">PLAY →</div>
              </div>
            </button>
          ))}
        </div>
        <Link href="/" className="catch-ls-back">← Back to the map</Link>
      </div>
    </div>
  );
}

function PreLevelScreen({
  level,
  onStart,
  onBack,
}: {
  level: LevelConfig;
  onStart: () => void;
  onBack: () => void;
}) {
  // Sort targets: home first, then by points desc
  const sorted = useMemo(() => {
    return [...level.mascots].sort((a, b) => b.points - a.points);
  }, [level]);
  // Only show the "back" link when there's more than one level — otherwise
  // it's a dead-end loop back to a 1-card menu.
  const showBack = LEVELS.length > 1;

  // Splash-arrival jingle. unlockAudio handles the case where the user
  // hasn't gestured yet (silent fail, no crash). When the splash mounts
  // they've just clicked through from the COMPLAINT DENIED stamp, so the
  // gesture is satisfied and the jingle plays.
  useEffect(() => {
    void unlockAudio();
    playSplashJingle();
  }, []);

  return (
    <div className="catch-pre">
      <style jsx>{preLevelStyles}</style>
      <div
        className="catch-pre-bg"
        style={{ backgroundImage: `url(${level.backgroundSrc})` }}
      />
      <div className="catch-pre-card">
        <div className="catch-pre-eyebrow">Field Assignment · {level.storeLabel}</div>
        <h2 className="catch-pre-headline">Round up the loose mascots!</h2>
        <p className="catch-pre-intro">
          Six of TJ&apos;s beloved mascots have wandered into the aisles.
          McQuackers can&apos;t process your complaint until they&apos;re
          back behind the counter. <strong>You&apos;re up.</strong>
        </p>

        <div className="catch-pre-section-label">How to play</div>
        <ol className="catch-pre-how">
          <li>
            <span className="catch-pre-how-num">1</span>
            Move with your cursor or finger — McQuackers follows.
          </li>
          <li>
            <span className="catch-pre-how-num">2</span>
            Click or tap to swing your butterfly net.
          </li>
          <li>
            <span className="catch-pre-how-num">3</span>
            Bag mascots in your canvas tote. Dodge crew restocking shelves.
          </li>
        </ol>

        <div className="catch-pre-section-label">Bag &apos;em — point values</div>
        <div className="catch-pre-targets">
          {sorted.map((m, i) => (
            <div
              key={m.slug}
              className={`catch-pre-target ${i === 0 ? 'is-home' : ''}`}
            >
              <img src={m.spriteSrc} alt={m.displayName} />
              <div className="catch-pre-target-info">
                <div className="catch-pre-target-name">
                  {m.displayName}{' '}
                  {i === 0 && (
                    <span className="catch-pre-home-pill">HOME · RARE</span>
                  )}
                </div>
                <div className="catch-pre-target-animal">{m.animal}</div>
              </div>
              <div className="catch-pre-target-points">+{m.points}</div>
            </div>
          ))}
        </div>

        <div className="catch-pre-timer-line">
          You&apos;ve got <strong>30 seconds</strong> on the clock.
        </div>

        <div className="catch-pre-buttons">
          {showBack && (
            <button className="catch-pre-back" onClick={onBack}>
              ← Levels
            </button>
          )}
          <button className="catch-pre-start" onClick={onStart}>
            GO!
          </button>
        </div>
      </div>
    </div>
  );
}

function EndScreen({
  level,
  score,
  caught,
  onReplay,
  onBackToLevels,
}: {
  level: LevelConfig;
  score: number;
  caught: Record<string, number>;
  onReplay: () => void;
  onBackToLevels: () => void;
}) {
  const totalCaught = Object.values(caught).reduce((a, b) => a + b, 0);
  const [initials, setInitials] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [topScores, setTopScores] = useState<CatchScoreRow[]>([]);
  const [didFetchRank, setDidFetchRank] = useState(false);

  // Fetch what rank this score would have, and the current top 10
  useEffect(() => {
    let cancelled = false;
    if (didFetchRank) return;
    setDidFetchRank(true);
    Promise.all([
      rankForLevelScore(level.slug, score),
      fetchLevelTop(level.slug, 10),
    ]).then(([r, top]) => {
      if (cancelled) return;
      setRank(r);
      setTopScores(top);
    });
    return () => {
      cancelled = true;
    };
  }, [level.slug, score, didFetchRank]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = initials.toUpperCase().trim();
    if (!/^[A-Z]{3}$/.test(cleaned)) {
      setSubmitError('Initials must be exactly 3 letters (A–Z).');
      return;
    }
    setSubmitState('submitting');
    setSubmitError(null);
    const result = await submitScore({
      initials: cleaned,
      levelSlug: level.slug,
      storeNumber: level.storeNumber,
      score,
      mascotsCaught: caught,
    });
    if (result.ok) {
      setSubmitState('submitted');
      // Refresh leaderboard
      const top = await fetchLevelTop(level.slug, 10);
      setTopScores(top);
    } else {
      setSubmitState('error');
      setSubmitError(result.error);
    }
  }

  return (
    <div className="catch-end">
      <style jsx>{endStyles}</style>
      <div className="catch-end-bg" style={{ backgroundImage: `url(${level.backgroundSrc})` }} />
      <div className="catch-end-card">
        <div className="catch-end-region">{level.storeLabel} · {level.region}</div>
        <h2 className="catch-end-headline">
          {totalCaught === 0 ? 'No mascots caught :(' : 'Time!'}
        </h2>
        <div className="catch-end-score">{score}</div>
        <div className="catch-end-sub">
          {totalCaught} mascot{totalCaught === 1 ? '' : 's'} in the tote
          {rank != null && totalCaught > 0 && (
            <> · Would rank <strong>#{rank}</strong> all-time</>
          )}
        </div>

        <div className="catch-end-caught-grid">
          {level.mascots.map((m) => {
            const count = caught[m.slug] || 0;
            return (
              <div key={m.slug} className={`catch-end-caught ${count > 0 ? 'has' : 'none'}`}>
                <img src={m.spriteSrc} alt={m.displayName} />
                <div className="catch-end-caught-info">
                  <div className="catch-end-caught-name">{m.displayName}</div>
                  <div className="catch-end-caught-count">
                    {count > 0 ? `×${count} · +${count * m.points}` : '—'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {totalCaught > 0 && submitState !== 'submitted' && (
          <form onSubmit={handleSubmit} className="catch-end-submit">
            <label>
              Initials
              <input
                type="text"
                maxLength={3}
                value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                placeholder="AAA"
                disabled={submitState === 'submitting'}
              />
            </label>
            <button type="submit" disabled={submitState === 'submitting' || initials.length !== 3}>
              {submitState === 'submitting' ? 'Submitting…' : 'Add to leaderboard'}
            </button>
            {submitError && <div className="catch-end-error">{submitError}</div>}
          </form>
        )}
        {submitState === 'submitted' && (
          <div className="catch-end-submitted">✓ Score submitted!</div>
        )}

        {topScores.length > 0 && (
          <div className="catch-end-leaderboard">
            <div className="catch-end-lb-title">Top 10 — {level.storeLabel}</div>
            <ol className="catch-end-lb-list">
              {topScores.map((r, i) => (
                <li key={r.id}>
                  <span className="catch-end-lb-rank">#{i + 1}</span>
                  <span className="catch-end-lb-initials">{r.initials}</span>
                  <span className="catch-end-lb-score">{r.score}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="catch-end-buttons">
          <button className="catch-end-replay" onClick={onReplay}>Play again</button>
          <button className="catch-end-back" onClick={onBackToLevels}>Other stores</button>
          <a href="/complaints" className="catch-end-complaints">📋 File a complaint</a>
          <a href="/" className="catch-end-home">Back to map</a>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// STYLES (kept inline via styled-jsx so the easter egg is fully self-contained)
// =============================================================================

const shellStyles = `
  .catch-shell {
    position: absolute;
    inset: 0;
    background: #0f0a06;
    overflow: hidden;
  }
  .catch-playfield {
    position: absolute;
    inset: 0;
    cursor: crosshair;
    touch-action: none;
    user-select: none;
  }
  .catch-canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  .catch-mute {
    position: absolute;
    bottom: 16px;
    right: 16px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2px solid rgba(253, 246, 236, 0.7);
    background: rgba(20, 12, 6, 0.72);
    color: var(--cream);
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    z-index: 5;
    transition: transform 0.1s;
  }
  .catch-mute:hover {
    transform: scale(1.08);
  }
  .catch-mute:active {
    transform: scale(0.95);
  }
`;

const levelSelectStyles = `
  .catch-level-select {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, #1a1108 0%, #2a1a0a 100%);
    color: var(--cream);
    overflow-y: auto;
    padding: 32px 16px 60px;
  }
  .catch-ls-inner {
    max-width: 1100px;
    margin: 0 auto;
  }
  .catch-ls-title {
    font-family: 'Fraunces', serif;
    font-weight: 900;
    font-size: clamp(28px, 5vw, 48px);
    text-align: center;
    margin-bottom: 8px;
    text-shadow: 0 2px 0 #000;
  }
  .catch-ls-sub {
    text-align: center;
    color: rgba(253,246,236,0.75);
    font-weight: 600;
    margin-bottom: 28px;
    font-size: clamp(14px, 2vw, 17px);
  }
  .catch-ls-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 18px;
  }
  .catch-ls-card {
    position: relative;
    border: 4px solid var(--tj-red);
    border-radius: 22px;
    overflow: hidden;
    cursor: pointer;
    background: #000;
    aspect-ratio: 16/12;
    transition: transform 0.2s, box-shadow 0.2s;
    text-align: left;
    padding: 0;
    color: inherit;
    font-family: inherit;
  }
  .catch-ls-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 18px 36px rgba(0,0,0,0.5);
  }
  .catch-ls-bg {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    filter: brightness(0.75) saturate(1.1);
  }
  .catch-ls-meta {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 18px;
    background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 60%, transparent 100%);
  }
  .catch-ls-region {
    font-size: 11px;
    letter-spacing: 0.12em;
    font-weight: 800;
    color: var(--tj-red);
    text-transform: uppercase;
  }
  .catch-ls-store {
    font-family: 'Fraunces', serif;
    font-weight: 900;
    font-size: 26px;
    margin: 2px 0 4px;
  }
  .catch-ls-tagline {
    font-size: 13px;
    opacity: 0.85;
    margin-bottom: 10px;
  }
  .catch-ls-cta {
    font-weight: 900;
    color: var(--cream);
    background: var(--tj-red);
    padding: 8px 14px;
    border-radius: 999px;
    align-self: flex-start;
    font-size: 14px;
    letter-spacing: 0.05em;
  }
  .catch-ls-back {
    display: inline-block;
    margin-top: 28px;
    color: rgba(253,246,236,0.7);
    text-decoration: underline;
    text-underline-offset: 4px;
  }
`;

const preLevelStyles = `
  .catch-pre {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    overflow-y: auto;
  }
  .catch-pre-bg {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    filter: brightness(0.35) blur(4px);
    z-index: 0;
  }
  .catch-pre-card {
    position: relative;
    z-index: 1;
    background: var(--cream);
    border: 4px solid var(--tj-red);
    border-radius: 24px;
    padding: 28px;
    max-width: 520px;
    width: 100%;
    box-shadow: 0 24px 60px rgba(0,0,0,0.5);
    color: var(--ink);
    max-height: calc(100vh - 40px);
    overflow-y: auto;
  }
  .catch-pre-eyebrow {
    font-size: 11px;
    letter-spacing: 0.14em;
    font-weight: 800;
    color: var(--tj-red);
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .catch-pre-headline {
    font-family: 'Fraunces', serif;
    font-weight: 900;
    font-size: 34px;
    line-height: 1.05;
    margin: 0 0 10px;
  }
  .catch-pre-intro {
    font-size: 15px;
    color: var(--ink);
    line-height: 1.5;
    margin-bottom: 18px;
  }
  .catch-pre-intro strong {
    color: var(--tj-red);
  }
  .catch-pre-section-label {
    font-size: 11px;
    letter-spacing: 0.12em;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--ink-soft);
    margin-bottom: 8px;
    margin-top: 8px;
  }
  .catch-pre-how {
    list-style: none;
    padding: 0;
    margin: 0 0 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .catch-pre-how li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 14px;
    color: var(--ink);
    line-height: 1.4;
  }
  .catch-pre-how-num {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--tj-red);
    color: var(--cream);
    font-weight: 900;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
  .catch-pre-timer-line {
    font-size: 15px;
    color: var(--ink);
    text-align: center;
    margin: 6px 0 14px;
  }
  .catch-pre-timer-line strong {
    font-family: 'Fraunces', serif;
    font-weight: 900;
    font-size: 18px;
    color: var(--tj-red);
  }
  .catch-pre-targets {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 14px;
  }
  .catch-pre-target {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    border-radius: 12px;
    background: var(--cream-dark);
  }
  .catch-pre-target.is-home {
    background: linear-gradient(90deg, rgba(229,57,53,0.15), var(--cream-dark));
    border: 2px solid var(--tj-red);
  }
  .catch-pre-target img {
    width: 54px;
    height: 54px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .catch-pre-target-info {
    flex: 1;
    min-width: 0;
  }
  .catch-pre-target-name {
    font-weight: 800;
    font-size: 15px;
  }
  .catch-pre-home-pill {
    background: var(--tj-red);
    color: var(--cream);
    font-size: 9px;
    padding: 2px 6px;
    border-radius: 999px;
    margin-left: 6px;
    letter-spacing: 0.05em;
    vertical-align: middle;
  }
  .catch-pre-target-animal {
    font-size: 12px;
    color: var(--ink-soft);
  }
  .catch-pre-target-points {
    font-weight: 900;
    color: var(--tj-red);
    font-size: 18px;
  }
  .catch-pre-rules {
    font-size: 12px;
    color: var(--ink-soft);
    text-align: center;
    margin-bottom: 18px;
    line-height: 1.5;
  }
  .catch-pre-buttons {
    display: flex;
    gap: 10px;
  }
  .catch-pre-back, .catch-pre-start {
    flex: 1;
    border-radius: 14px;
    padding: 14px;
    font-weight: 900;
    font-size: 16px;
    border: 0;
    cursor: pointer;
  }
  .catch-pre-back {
    background: var(--cream-dark);
    color: var(--ink-soft);
    flex: 0 0 auto;
    padding: 14px 18px;
  }
  .catch-pre-start {
    background: var(--tj-red);
    color: var(--cream);
    box-shadow: 0 4px 0 var(--tj-red-dark);
    font-size: 22px;
    letter-spacing: 0.08em;
    padding: 16px;
    transition: transform 0.08s, box-shadow 0.08s;
  }
  .catch-pre-start:hover {
    transform: translateY(-1px);
    box-shadow: 0 5px 0 var(--tj-red-dark);
  }
  .catch-pre-start:active {
    transform: translateY(2px);
    box-shadow: 0 1px 0 var(--tj-red-dark);
  }
`;

const endStyles = `
  .catch-end {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    overflow-y: auto;
  }
  .catch-end-bg {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    filter: brightness(0.3) blur(6px);
    z-index: 0;
  }
  .catch-end-card {
    position: relative;
    z-index: 1;
    background: var(--cream);
    border: 4px solid var(--tj-red);
    border-radius: 24px;
    padding: 28px;
    max-width: 560px;
    width: 100%;
    box-shadow: 0 24px 60px rgba(0,0,0,0.5);
    color: var(--ink);
    max-height: calc(100vh - 40px);
    overflow-y: auto;
    text-align: center;
  }
  .catch-end-region {
    font-size: 11px;
    letter-spacing: 0.12em;
    font-weight: 800;
    color: var(--tj-red);
    text-transform: uppercase;
  }
  .catch-end-headline {
    font-family: 'Fraunces', serif;
    font-weight: 900;
    font-size: 32px;
    margin: 6px 0 4px;
  }
  .catch-end-score {
    font-family: 'Fraunces', serif;
    font-weight: 900;
    font-size: 72px;
    color: var(--tj-red);
    line-height: 1;
    margin: 6px 0;
  }
  .catch-end-sub {
    font-size: 14px;
    color: var(--ink-soft);
    margin-bottom: 18px;
  }
  .catch-end-caught-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
    margin-bottom: 18px;
  }
  .catch-end-caught {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 10px;
    background: var(--cream-dark);
    text-align: left;
  }
  .catch-end-caught.none {
    opacity: 0.45;
  }
  .catch-end-caught img {
    width: 36px;
    height: 36px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .catch-end-caught-info {
    flex: 1;
    min-width: 0;
  }
  .catch-end-caught-name {
    font-weight: 800;
    font-size: 12px;
    line-height: 1.2;
  }
  .catch-end-caught-count {
    font-size: 11px;
    color: var(--ink-soft);
  }
  .catch-end-submit {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    margin-bottom: 14px;
    justify-content: center;
  }
  .catch-end-submit label {
    display: flex;
    flex-direction: column;
    text-align: left;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-soft);
  }
  .catch-end-submit input {
    margin-top: 4px;
    padding: 10px 12px;
    font-size: 18px;
    font-weight: 900;
    border: 2px solid var(--tj-red);
    border-radius: 10px;
    width: 96px;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    text-align: center;
    background: var(--cream);
    color: var(--ink);
  }
  .catch-end-submit button {
    background: var(--tj-red);
    color: var(--cream);
    border: 0;
    border-radius: 10px;
    padding: 12px 16px;
    font-weight: 900;
    cursor: pointer;
  }
  .catch-end-submit button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .catch-end-error {
    color: var(--tj-red);
    font-size: 12px;
    margin-top: 6px;
    flex-basis: 100%;
  }
  .catch-end-submitted {
    color: #008c50;
    font-weight: 800;
    margin-bottom: 14px;
  }
  .catch-end-leaderboard {
    margin: 0 0 18px;
    padding: 12px;
    background: var(--cream-dark);
    border-radius: 14px;
    text-align: left;
  }
  .catch-end-lb-title {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-soft);
    margin-bottom: 6px;
    text-align: center;
  }
  .catch-end-lb-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .catch-end-lb-list li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 8px;
    font-size: 14px;
    border-bottom: 1px solid rgba(0,0,0,0.05);
  }
  .catch-end-lb-list li:last-child { border-bottom: 0; }
  .catch-end-lb-rank {
    font-weight: 800;
    color: var(--tj-red);
    min-width: 28px;
  }
  .catch-end-lb-initials {
    font-weight: 800;
    flex: 1;
    letter-spacing: 0.08em;
  }
  .catch-end-lb-score {
    font-weight: 900;
  }
  .catch-end-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .catch-end-replay, .catch-end-back, .catch-end-complaints, .catch-end-home {
    flex: 1;
    min-width: 130px;
    text-align: center;
    border-radius: 12px;
    padding: 12px;
    font-weight: 800;
    text-decoration: none;
    font-size: 14px;
    border: 0;
    cursor: pointer;
  }
  .catch-end-replay {
    background: var(--tj-red);
    color: var(--cream);
  }
  .catch-end-back {
    background: var(--cream-dark);
    color: var(--ink);
  }
  .catch-end-complaints {
    background: var(--cream-dark);
    color: var(--ink);
    line-height: 1.4;
  }
  .catch-end-home {
    background: var(--cream-dark);
    color: var(--ink);
    line-height: 1.4;
  }
`;
