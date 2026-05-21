/**
 * Leaderboard read/write for "McQuackers' Mascot Catch".
 *
 * Talks to the `catch_scores` Supabase table. RLS allows anonymous SELECT and
 * INSERT, with CHECK constraints enforcing plausible bounds.
 * Schema: see site/supabase-catch-scores-migration.sql
 *
 * Scoring model:
 *   • Per-level score = sum of caught mascots' points
 *   • Per-row leaderboard: one row per (initials, level) play
 *   • "Overall" leaderboard derives from best-per-level for each initials
 *     (we let the UI compute that — no separate table)
 */

import { getSupabase, SUPABASE_CONFIGURED } from './supabase';
import {
  SCORE_BOUNDS,
  ALL_LEVEL_SLUGS,
  type LevelConfig,
} from './catch-config';

export type CatchScoreRow = {
  id: string;
  initials: string;
  level_slug: string;
  store_number: string;
  score: number;
  mascots_caught: Record<string, number>;
  created_at: string;
};

export type CatchScoreSubmission = {
  initials: string;
  levelSlug: string;
  storeNumber: string;
  score: number;
  /** Map of mascot slug → number of times caught this play. */
  mascotsCaught: Record<string, number>;
};

export function validateSubmission(s: CatchScoreSubmission): string | null {
  if (!/^[A-Z]{3}$/.test(s.initials)) return 'Initials must be 3 letters (A–Z).';
  if (!ALL_LEVEL_SLUGS.includes(s.levelSlug)) return 'Unknown level.';
  if (s.score < SCORE_BOUNDS.minScore || s.score > SCORE_BOUNDS.maxScore) {
    return 'Score out of plausible range.';
  }
  const totalCaught = Object.values(s.mascotsCaught).reduce((a, b) => a + b, 0);
  if (totalCaught < SCORE_BOUNDS.minMascotsForLeaderboard) {
    return 'You need to catch at least one mascot to submit.';
  }
  return null;
}

/** Light client-side spam guard. */
const SUBMIT_THROTTLE_KEY = 'catch.lastSubmitMs';
const SUBMIT_THROTTLE_MS = 60_000;

export function isThrottled(): boolean {
  if (typeof window === 'undefined') return false;
  const last = Number(window.localStorage.getItem(SUBMIT_THROTTLE_KEY) || 0);
  return Date.now() - last < SUBMIT_THROTTLE_MS;
}

function markSubmitted() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SUBMIT_THROTTLE_KEY, String(Date.now()));
}

export async function submitScore(s: CatchScoreSubmission): Promise<
  | { ok: true; row: CatchScoreRow }
  | { ok: false; error: string }
> {
  const err = validateSubmission(s);
  if (err) return { ok: false, error: err };
  if (isThrottled()) {
    return { ok: false, error: 'You just submitted — wait a minute and try again.' };
  }
  if (!SUPABASE_CONFIGURED) {
    return { ok: false, error: 'Leaderboard offline (Supabase not configured).' };
  }
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Leaderboard offline.' };

  const { data, error } = await sb
    .from('catch_scores')
    .insert({
      initials: s.initials.toUpperCase(),
      level_slug: s.levelSlug,
      store_number: s.storeNumber,
      score: s.score,
      mascots_caught: s.mascotsCaught,
    })
    .select('*')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message || 'Submission failed.' };
  }
  markSubmitted();
  return { ok: true, row: data as CatchScoreRow };
}

/** Fetch the top N scores for a specific level. */
export async function fetchLevelTop(
  levelSlug: string,
  limit = 25,
): Promise<CatchScoreRow[]> {
  if (!SUPABASE_CONFIGURED) return [];
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('catch_scores')
    .select('*')
    .eq('level_slug', levelSlug)
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data as CatchScoreRow[];
}

/**
 * Compute the overall leaderboard client-side: for each player (initials),
 * take their best score on each level and sum. Only players who've played
 * all 3 levels appear.
 *
 * We pull a generous slice (top 200 per level), aggregate locally. For an
 * easter-egg game this is fine; if it ever grows past ~10k rows we can
 * swap to a Postgres RPC.
 */
export async function fetchOverallTop(limit = 25): Promise<
  Array<{
    initials: string;
    total: number;
    perLevel: Record<string, number>;
  }>
> {
  if (!SUPABASE_CONFIGURED) return [];
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('catch_scores')
    .select('initials, level_slug, score')
    .order('score', { ascending: false })
    .limit(200 * ALL_LEVEL_SLUGS.length);
  if (error || !data) return [];

  // Aggregate: best score per (initials, level)
  const best = new Map<string, Map<string, number>>();
  for (const row of data as Array<{ initials: string; level_slug: string; score: number }>) {
    const initialsBest = best.get(row.initials) ?? new Map<string, number>();
    const prev = initialsBest.get(row.level_slug) ?? 0;
    if (row.score > prev) initialsBest.set(row.level_slug, row.score);
    best.set(row.initials, initialsBest);
  }

  const results: Array<{ initials: string; total: number; perLevel: Record<string, number> }> = [];
  for (const [initials, perLevelMap] of best.entries()) {
    // Only count players who've played ALL levels
    if (perLevelMap.size < ALL_LEVEL_SLUGS.length) continue;
    let total = 0;
    const perLevel: Record<string, number> = {};
    for (const slug of ALL_LEVEL_SLUGS) {
      const s = perLevelMap.get(slug) ?? 0;
      perLevel[slug] = s;
      total += s;
    }
    results.push({ initials, total, perLevel });
  }
  results.sort((a, b) => b.total - a.total);
  return results.slice(0, limit);
}

/** Rank a candidate score on a specific level (1-indexed, or null on failure). */
export async function rankForLevelScore(
  levelSlug: string,
  score: number,
): Promise<number | null> {
  if (!SUPABASE_CONFIGURED) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const { count, error } = await sb
    .from('catch_scores')
    .select('*', { count: 'exact', head: true })
    .eq('level_slug', levelSlug)
    .gt('score', score);
  if (error || count == null) return null;
  return count + 1;
}
