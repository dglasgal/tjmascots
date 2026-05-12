/**
 * Configuration for "McQuackers' Quest" — the hidden-object easter-egg game.
 *
 * Players guide McQuackers (the duck mascot of the Oakland Lakeshore TJ's)
 * through 5 themed Trader Joe's store layouts to find the hidden store mascot
 * for each. Discovered via the "Terms and Conditions" footer link.
 *
 * Difficulty escalates: bigger/brighter mascot first, tiny/blended last.
 *
 * MASCOT POSITIONS are stored as normalized (0–1) coordinates relative to the
 * background image's full extent. The hit-detection radius scales with the
 * mascot's `size` (also normalized to the long edge of the canvas).
 *
 * BACKGROUNDS live at /quack/bg-l*.jpg, MASCOT SPRITES at /quack/mascot-*.png.
 */

export type LevelConfig = {
  /** 1-indexed level number for display. */
  number: number;
  /** Store name as it appears on the in-game card. */
  storeLabel: string;
  /** State code for the card subtitle. */
  state: string;
  /** Mascot common name (e.g. "Steven Sparkles"). */
  mascotName: string;
  /** Animal kind (e.g. "Unicorn") shown on the between-level card. */
  animal: string;
  /** Background JPG public path. */
  backgroundSrc: string;
  /** Mascot sprite (transparent PNG) public path. */
  mascotSrc: string;
  /** Mascot's hidden center, normalized (0 = left/top, 1 = right/bottom). */
  position: { x: number; y: number };
  /**
   * Mascot rendered size as a fraction of the canvas's longer dimension.
   * Bigger = easier to spot.
   */
  size: number;
  /** Base points awarded for completing the level (before time/hint penalties). */
  basePoints: number;
  /**
   * Optional foreground prop overlaid ON TOP of the mascot so it looks
   * like the mascot is peeking out from behind a store display. The prop
   * is a transparent-background PNG painted in the same Fearless Flyer
   * style as everything else. Hit detection still uses the mascot's full
   * position/size so a player who clicks "where the mascot should be"
   * still wins.
   */
  prop?: {
    src: string;
    /** Center of the prop in normalized coords (0–1). */
    position: { x: number; y: number };
    /** Width as a fraction of canvas longer dim. Should be > mascot.size
     *  so it actually covers most of the mascot. */
    size: number;
  };
};

/**
 * The 5 levels in arcade order: easy → hard.
 * (See spec: real TJ stores from the mascot database; difficulty curve set
 * by combination of mascot size, color contrast vs scene, and clutter.)
 */
export const LEVELS: LevelConfig[] = [
  {
    number: 1,
    storeLabel: 'West Hollywood',
    state: 'CA',
    mascotName: 'Steven Sparkles',
    animal: 'Unicorn',
    backgroundSrc: '/quack/bg-l1-west-hollywood.jpg',
    mascotSrc: '/quack/mascot-steven-sparkles.png',
    // Standing on the left side of the aisle floor, peeking out from
    // behind a tall flower display.
    position: { x: 0.22, y: 0.66 },
    size: 0.14,
    basePoints: 1000,
    prop: {
      src: '/quack/prop-l1-flowers.png',
      position: { x: 0.22, y: 0.78 },
      size: 0.22,
    },
  },
  {
    number: 2,
    storeLabel: 'Lake Grove',
    state: 'NY',
    mascotName: 'Schmooli',
    animal: 'Shark',
    backgroundSrc: '/quack/bg-l2-lake-grove.jpg',
    mascotSrc: '/quack/mascot-schmooli.png',
    // Standing on the right side, behind a stack of fish crates.
    position: { x: 0.72, y: 0.62 },
    size: 0.12,
    basePoints: 1500,
    prop: {
      src: '/quack/prop-l2-fish-crates.png',
      position: { x: 0.72, y: 0.74 },
      size: 0.20,
    },
  },
  {
    number: 3,
    storeLabel: 'East Liberty (Pittsburgh)',
    state: 'PA',
    mascotName: 'Tuskanini',
    animal: 'Elephant',
    backgroundSrc: '/quack/bg-l3-pittsburgh.jpg',
    mascotSrc: '/quack/mascot-tuskanini.png',
    // Center-left, behind a pile of burlap peanut sacks.
    position: { x: 0.40, y: 0.58 },
    size: 0.13,
    basePoints: 2000,
    prop: {
      src: '/quack/prop-l3-peanut-sacks.png',
      position: { x: 0.40, y: 0.72 },
      size: 0.22,
    },
  },
  {
    number: 4,
    storeLabel: 'Silverdale',
    state: 'WA',
    mascotName: 'Confetti Yeti',
    animal: 'Yeti',
    backgroundSrc: '/quack/bg-l4-silverdale.jpg',
    mascotSrc: '/quack/mascot-confetti-yeti.png',
    // Right side, behind a tall winter-goods stack.
    position: { x: 0.78, y: 0.55 },
    size: 0.10,
    basePoints: 2500,
    prop: {
      src: '/quack/prop-l4-winter-stack.png',
      position: { x: 0.78, y: 0.68 },
      size: 0.18,
    },
  },
  {
    number: 5,
    storeLabel: 'Rochester',
    state: 'NY',
    mascotName: 'Susan Bee Anthony',
    animal: 'Bee',
    backgroundSrc: '/quack/bg-l5-rochester.jpg',
    mascotSrc: '/quack/mascot-susan-bee.png',
    // Tiny, low to the floor on the left, behind a honey jar display.
    position: { x: 0.18, y: 0.76 },
    size: 0.05,
    basePoints: 3000,
    prop: {
      src: '/quack/prop-l5-honey-flowers.png',
      position: { x: 0.20, y: 0.84 },
      size: 0.14,
    },
  },
];

/** McQuackers — the cursor companion who's with you on every level. */
export const HERO = {
  name: 'McQuackers',
  src: '/quack/mascot-mcquackers.png',
  /** Width as a fraction of the canvas's longer dimension. */
  size: 0.085,
  /** On mobile, the duck is drawn this many pixels ABOVE the touch point so
   *  the player's finger doesn't cover the target. Doesn't apply on desktop. */
  touchOffsetPx: 70,
};

// --------------------------------------------------------------------------
// Scoring rules — see spec:
//   • Base = level.basePoints
//   • −10 points per second elapsed on that level
//   • −200 points per hint used
//   • Score is floored at 100 (a player can never zero out a level)
//   • Total = sum across all 5 levels
// --------------------------------------------------------------------------

export const TIME_PENALTY_PER_SECOND = 10;
export const HINT_PENALTY = 200;
export const LEVEL_SCORE_FLOOR = 100;
/** Radius of the mascot hit zone, as a multiple of `size`. Generous to
 *  account for the rendered sprite being taller than its width
 *  (most are portrait orientation) and to make the peeking head/horn
 *  reachable. Lower = harder. */
export const HIT_TOLERANCE_MULTIPLIER = 1.5;
/** Seconds of searching before the Hint button appears. */
export const HINT_AVAILABLE_AFTER_SECONDS = 30;

export function scoreForLevel(
  level: LevelConfig,
  elapsedSeconds: number,
  hintsUsed: number,
): number {
  const raw =
    level.basePoints -
    Math.floor(elapsedSeconds) * TIME_PENALTY_PER_SECOND -
    hintsUsed * HINT_PENALTY;
  return Math.max(LEVEL_SCORE_FLOOR, raw);
}

/** Theoretical max score: hit every level instantly with 0 hints. */
export const MAX_POSSIBLE_SCORE = LEVELS.reduce((s, l) => s + l.basePoints, 0);

/** Plausibility bounds for leaderboard submissions — used by RLS check
 *  constraints in supabase-mcquackers-scores.sql. Mirror values here for
 *  client-side pre-flight validation. */
export const SCORE_BOUNDS = {
  minScore: LEVEL_SCORE_FLOOR * LEVELS.length, // 500
  maxScore: MAX_POSSIBLE_SCORE, // 10,000
  minTimeSeconds: 30, // no plausible 5-level run finishes faster than 30s
  maxTimeSeconds: 60 * 60, // sanity cap at 1 hour
  maxHints: LEVELS.length * 5, // 25 total hints possible
};
