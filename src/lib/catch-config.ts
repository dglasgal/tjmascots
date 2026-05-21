/**
 * Configuration for "McQuackers' Mascot Catch" — the duck-level whack-a-mole
 * easter egg game at /catch.
 *
 * Players control McQuackers (the duck mascot of the Oakland Lakeshore TJ's)
 * as he sweeps a butterfly net through one of three real Trader Joe's stores,
 * catching that store's home mascot and surrounding-area mascots in 30 seconds.
 *
 * Discovered by clicking the © symbol in the site footer five times.
 *
 * ART:
 *   • McQuackers sprites — /games/catch/mcquackers/{idle,swing,stunned,victory}.png
 *   • Mascot sprites     — /games/catch/mascots/{slug}.png
 *   • Obstacle sprites   — /games/catch/obstacles/{customer-legs,shopping-cart,crew-restocking}.png
 *   • Backgrounds        — /games/catch/backgrounds/{pasadena,chicago,nyc-uws}.png
 */

/**
 * A spawn-point where a mascot can appear in a given level's scene.
 *
 * Why per-level: each store background has different shelves, endcaps, and
 * floor zones. A "behind chip endcap" spot in Pasadena is mid-air in Chicago.
 * David hand-placed these by marking the actual background images so each
 * mascot looks like it's standing on a real surface (floor / display top /
 * peeking around a corner) instead of floating.
 *
 * `scale` accounts for perspective: a mascot at the back of the store should
 * render smaller than one in the foreground. The final render size is
 * `MASCOT_SIZE_FRAC * scale * canvas_height`. Scale 1.0 = foreground (full
 * size); 0.5 = mid-aisle; 0.2 = far back, near the back wall.
 */
export type HidingSpot = {
  /** Normalized x position (0..1) of the mascot's center. */
  x: number;
  /** Normalized y position (0..1) of the mascot's center. */
  y: number;
  /** Size multiplier — 1.0 = MASCOT_SIZE_FRAC (foreground), smaller = farther back. */
  scale: number;
};

export type MascotTarget = {
  /** URL-safe slug used for asset filename + leaderboard key. */
  slug: string;
  /** Display name shown on the targets panel + on the in-world nametag. */
  displayName: string;
  /** Animal kind for the targets panel subtitle. */
  animal: string;
  /** Sprite PNG path (transparent background after we composite white→transparent client-side). */
  spriteSrc: string;
  /** Points awarded per catch. Home mascot = highest. */
  points: number;
  /**
   * Spawn weight relative to other mascots in the same level. Higher = more
   * frequent. Home mascot is rare (low weight), common neighbors are high
   * weight. See SPAWN_INTERVAL_MS below for actual rate.
   */
  spawnWeight: number;
};

export type LevelConfig = {
  /** URL slug + leaderboard partition key. */
  slug: string;
  /** Store name as it appears on the pre-level "Today's Targets" card. */
  storeLabel: string;
  /** 2-letter state code for the card subtitle. */
  state: string;
  /** Real Trader Joe's store number (matches tj-stores.json). */
  storeNumber: string;
  /** Background PNG path. */
  backgroundSrc: string;
  /** Region label for the level-select screen. */
  region: 'West' | 'Midwest' | 'East';
  /** The 6 mascots — first is the home mascot (500 pts, rare). */
  mascots: MascotTarget[];
  /** Display tagline shown under the store name. */
  tagline: string;
  /**
   * Spawn-points specific to this level's scene. If omitted, spawn falls back
   * to the level-agnostic legacy HIDING_SPOTS in CatchGame.tsx (which puts
   * mascots in mid-air for any scene whose geometry doesn't match — Chicago
   * and NYC are still on that fallback until David marks their templates).
   */
  hidingSpots?: HidingSpot[];
};

// --------------------------------------------------------------------------
// Spawn + scoring rules
// --------------------------------------------------------------------------

/** Game length in seconds. */
export const LEVEL_DURATION_SECONDS = 30;
/** During the final N seconds, spawn rate doubles ("rush hour"). */
export const RUSH_HOUR_SECONDS = 5;
/** Max number of mascots simultaneously visible on screen. */
export const MAX_CONCURRENT_MASCOTS = 3;
/** Base ms between spawn attempts. (Halved during rush hour.) */
export const SPAWN_INTERVAL_MS = 1100;
/** A spawned mascot stays visible this long before scurrying back to hide. */
export const MASCOT_VISIBLE_MS_RANGE: [number, number] = [1500, 2500];

/** Net swing cooldown — prevents click-mashing. */
export const NET_COOLDOWN_MS = 350;
/** How long a single swing animation lasts. Catch window = full duration. */
export const NET_SWING_MS = 200;
/** Catch radius around the net's tip, as fraction of canvas long edge. */
export const NET_CATCH_RADIUS = 0.08;

/** Obstacle collision stun duration. No point penalty, just lost time. */
export const STUN_DURATION_MS = 500;
/** Probability per second that a new obstacle spawns. Lowered from 0.6 →
 *  0.22 after playtest feedback that there were too many carts and legs
 *  filling the screen. With max ~5 obstacles on screen at any time. */
export const OBSTACLE_SPAWN_PER_SECOND = 0.22;
/** Hard cap on concurrent on-screen obstacles. */
export const MAX_CONCURRENT_OBSTACLES = 4;

/** McQuackers sprite size as fraction of canvas height. */
export const HERO_SIZE_FRAC = 0.22;
/** Mascot sprite size as fraction of canvas height. */
export const MASCOT_SIZE_FRAC = 0.18;
/** Obstacle sprite size as fraction of canvas height. */
export const OBSTACLE_SIZE_FRAC = 0.28;

/**
 * McQuackers' eased follow speed. 1 = snap to cursor instantly,
 * smaller values = more waddle-momentum.
 */
export const HERO_FOLLOW_SPEED = 0.18;

// --------------------------------------------------------------------------
// The 3 levels (West → Midwest → East)
//   Picks: real-world busiest TJ's per region (with one swap from #703
//   Diversey → #691 Clybourn so the home mascot — Clyde the Lion — exists
//   in our DB).
// --------------------------------------------------------------------------

// NOTE: Chicago + NYC are temporarily commented out — David is focusing on
// getting Pasadena right first (placements + audio + obstacles). When ready,
// uncomment the two entries below to bring them back into level-select.
// Their data is still here intact; only the array membership is removed.
export const LEVELS: LevelConfig[] = [
  {
    slug: 'pasadena',
    storeLabel: 'Pasadena',
    state: 'CA',
    storeNumber: '51',
    region: 'West',
    tagline: 'The Original Trader Joe’s · est. 1967',
    backgroundSrc: '/games/catch/backgrounds/pasadena.png',
    // Spawn points hand-marked by David against the Pasadena background image
    // (see pasadena_marks_preview_v2.png in outputs). 21 spots covering the
    // floor (foreground, full-size), endcap perches (mid-scale), and tiny
    // deep-aisle hiding spots near the PASADENA sign / back wall.
    hidingSpots: [
      { x: 0.060, y: 0.089, scale: 0.35 }, // spot 1
      { x: 0.117, y: 0.252, scale: 0.50 }, // spot 2
      { x: 0.024, y: 0.734, scale: 1.00 }, // spot 3 — foreground floor, left edge
      { x: 0.230, y: 0.687, scale: 1.00 }, // spot 4 — foreground floor, left-center
      { x: 0.226, y: 0.223, scale: 0.50 }, // spot 5
      { x: 0.114, y: 0.104, scale: 0.25 }, // spot 6
      { x: 0.320, y: 0.326, scale: 0.45 }, // spot 7
      { x: 0.410, y: 0.400, scale: 0.20 }, // spot 8
      { x: 0.497, y: 0.412, scale: 0.20 }, // spot 9
      { x: 0.487, y: 0.534, scale: 0.20 }, // spot 10
      { x: 0.597, y: 0.412, scale: 0.20 }, // spot 11
      { x: 0.610, y: 0.580, scale: 0.20 }, // spot 12
      { x: 0.707, y: 0.307, scale: 0.20 }, // spot 13
      { x: 0.556, y: 0.268, scale: 0.20 }, // spot 14a — labeled 14 in template
      { x: 0.841, y: 0.252, scale: 0.20 }, // spot 14b — second mark also labeled 14
      { x: 0.867, y: 0.316, scale: 0.40 }, // spot 15
      { x: 0.651, y: 0.070, scale: 0.20 }, // spot 16
      { x: 0.422, y: 0.043, scale: 0.20 }, // spot 17
      { x: 0.833, y: 0.518, scale: 0.40 }, // spot 18
      { x: 0.789, y: 0.664, scale: 0.40 }, // spot 19
      { x: 0.878, y: 0.738, scale: 1.00 }, // spot 20 — foreground floor, right edge
      // Added 2026-05-20: more foreground-center coverage so the player
      // has plenty to catch in the easy zone right in front of them.
      { x: 0.420, y: 0.780, scale: 1.00 }, // spot 21 — front-left-of-center floor
      { x: 0.500, y: 0.860, scale: 1.00 }, // spot 22 — dead center, very foreground
      { x: 0.580, y: 0.780, scale: 1.00 }, // spot 23 — front-right-of-center floor
      // Added 2026-05-20 round 2: even more foreground density per David —
      // game has no obstacles now so the foreground was looking empty.
      { x: 0.130, y: 0.850, scale: 1.00 }, // spot 24 — in front of left endcap
      { x: 0.330, y: 0.810, scale: 1.00 }, // spot 25 — left-center foreground gap
      { x: 0.690, y: 0.810, scale: 1.00 }, // spot 26 — right-center foreground gap
      { x: 0.870, y: 0.870, scale: 1.00 }, // spot 27 — in front of right endcap
    ],
    mascots: [
      // Home — rare, big points
      {
        slug: 'cacahuete',
        displayName: 'Cacahuete',
        animal: 'Elephant',
        spriteSrc: '/games/catch/mascots/cacahuete.png',
        points: 500,
        spawnWeight: 1,
      },
      // Tier 2 — uncommon
      {
        slug: 'rosie',
        displayName: 'Rosie',
        animal: 'Monkey',
        spriteSrc: '/games/catch/mascots/rosie.png',
        points: 200,
        spawnWeight: 3,
      },
      {
        slug: 'freddie',
        displayName: 'Freddie',
        animal: 'Eagle',
        spriteSrc: '/games/catch/mascots/freddie.png',
        points: 200,
        spawnWeight: 3,
      },
      // Tier 3 — common
      {
        slug: 'meatball',
        displayName: 'Meatball',
        animal: 'Bear',
        spriteSrc: '/games/catch/mascots/meatball.png',
        points: 100,
        spawnWeight: 5,
      },
      {
        slug: 'chewy',
        displayName: 'Chewy',
        animal: 'Coyote',
        spriteSrc: '/games/catch/mascots/chewy.png',
        points: 100,
        spawnWeight: 5,
      },
      {
        slug: 'wesley',
        displayName: 'Wesley',
        animal: 'Tiger',
        spriteSrc: '/games/catch/mascots/wesley.png',
        points: 100,
        spawnWeight: 5,
      },
    ],
  },
  /* TEMPORARILY DISABLED — uncomment to bring Chicago + NYC back into level select.
  {
    slug: 'chicago',
    storeLabel: 'Chicago Clybourn',
    state: 'IL',
    storeNumber: '691',
    region: 'Midwest',
    tagline: 'Lincoln Park · One of the busiest in Chicago',
    backgroundSrc: '/games/catch/backgrounds/chicago.png',
    mascots: [
      {
        slug: 'clyde',
        displayName: 'Clyde',
        animal: 'Lion',
        spriteSrc: '/games/catch/mascots/clyde.png',
        points: 500,
        spawnWeight: 1,
      },
      {
        slug: 'pickles',
        displayName: 'Pickles',
        animal: 'Squirrel',
        spriteSrc: '/games/catch/mascots/pickles.png',
        points: 200,
        spawnWeight: 3,
      },
      {
        slug: 'ozzy',
        displayName: 'Ozzy',
        animal: 'Octopus',
        spriteSrc: '/games/catch/mascots/ozzy.png',
        points: 200,
        spawnWeight: 3,
      },
      {
        slug: 'sue',
        displayName: 'Sue',
        animal: 'T-Rex',
        spriteSrc: '/games/catch/mascots/sue.png',
        points: 100,
        spawnWeight: 5,
      },
      {
        slug: 'gorilla-joe',
        displayName: 'Gorilla Joe',
        animal: 'Gorilla',
        spriteSrc: '/games/catch/mascots/gorilla-joe.png',
        points: 100,
        spawnWeight: 5,
      },
      {
        slug: 'midnight',
        displayName: 'Midnight',
        animal: 'Cow',
        spriteSrc: '/games/catch/mascots/midnight.png',
        points: 100,
        spawnWeight: 5,
      },
    ],
  },
  {
    slug: 'nyc-uws',
    storeLabel: 'Upper West Side',
    state: 'NY',
    storeNumber: '542',
    region: 'East',
    tagline: '72nd & Broadway · The busiest TJ’s on Earth',
    backgroundSrc: '/games/catch/backgrounds/nyc-uws.png',
    mascots: [
      {
        slug: 'octavia',
        displayName: 'Octavia',
        animal: 'Octopus',
        spriteSrc: '/games/catch/mascots/octavia.png',
        points: 500,
        spawnWeight: 1,
      },
      {
        slug: 'bridget',
        displayName: 'Bridget',
        animal: 'Troll',
        spriteSrc: '/games/catch/mascots/bridget.png',
        points: 200,
        spawnWeight: 3,
      },
      {
        slug: 'tux',
        displayName: 'Tux',
        animal: 'Turtle',
        spriteSrc: '/games/catch/mascots/tux.png',
        points: 200,
        spawnWeight: 3,
      },
      {
        slug: 'marvin',
        displayName: 'Marvin',
        animal: 'Pigeon',
        spriteSrc: '/games/catch/mascots/marvin.png',
        points: 100,
        spawnWeight: 5,
      },
      {
        slug: 'beary-river',
        displayName: 'Beary & River',
        animal: 'Polar Bear + Raccoon',
        spriteSrc: '/games/catch/mascots/beary-river.png',
        points: 100,
        spawnWeight: 5,
      },
      {
        slug: 'caracara',
        displayName: 'CaraCara',
        animal: 'Capybara',
        spriteSrc: '/games/catch/mascots/caracara.png',
        points: 100,
        spawnWeight: 5,
      },
    ],
  },
  */
];

export const HERO = {
  name: 'McQuackers',
  spriteIdle: '/games/catch/mcquackers/idle.png',
  spriteSwing: '/games/catch/mcquackers/swing.png',
  spriteStunned: '/games/catch/mcquackers/stunned.png',
  spriteVictory: '/games/catch/mcquackers/victory.png',
};

export const OBSTACLES = {
  legs: '/games/catch/obstacles/customer-legs.png',
  cart: '/games/catch/obstacles/shopping-cart.png',
  crew: '/games/catch/obstacles/crew-restocking.png',
};

/**
 * Audio asset paths. SFX are synthesized procedurally — see catch-audio.ts —
 * so only the background music is a file. Drop the file at this path. If
 * the file is missing, the game still plays (just silently).
 */
export const CATCH_AUDIO = {
  music: '/games/catch/audio/bgmusic.mp3',
};

// --------------------------------------------------------------------------
// Score bounds for leaderboard validation (mirror in Supabase CHECK constraints)
// --------------------------------------------------------------------------

/** Max possible score per level — catch every mascot every spawn. Generous. */
function maxPossibleScoreForLevel(level: LevelConfig): number {
  // Worst-case theoretical: home mascot caught ~3 times + 5 of each common.
  // Real ceiling is ~3500-4000. We cap at 6000 to allow headroom for tuning
  // without rejecting legit speedruns.
  return 6000;
}

export const SCORE_BOUNDS = {
  minScore: 0,
  maxScore: 6000,
  /** Overall (sum-of-best across 3 levels) plausibility cap. */
  maxOverallScore: 18000,
  /** Minimum mascots that must be caught for a non-zero score. */
  minMascotsForLeaderboard: 1,
};

export function getLevelBySlug(slug: string): LevelConfig | undefined {
  return LEVELS.find((l) => l.slug === slug);
}

/** Find mascot config by (level slug, mascot slug). */
export function getMascotByKey(
  levelSlug: string,
  mascotSlug: string,
): MascotTarget | undefined {
  const level = getLevelBySlug(levelSlug);
  return level?.mascots.find((m) => m.slug === mascotSlug);
}

export const ALL_LEVEL_SLUGS = LEVELS.map((l) => l.slug);
