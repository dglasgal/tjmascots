/**
 * Leaderboard read/write for "McQuackers' Quest".
 *
 * Talks to the `mcquackers_scores` Supabase table. RLS allows anonymous
 * SELECT and INSERT, with CHECK constraints enforcing plausible score bounds.
 * See `supabase-mcquackers-scores.sql` for the schema.
 *
 * For a fan-site easter-egg game, we accept that a determined cheater could
 * forge a request. The CHECK constraints reject impossible scores; that's
 * the bar we're aiming for.
 */

import { getSupabase, SUPABASE_CONFIGURED } from './supabase';
import { SCORE_BOUNDS } from './quack-config';

export type ScoreRow = {
  id: string;
  initials: string;
  total_score: number;
  total_time_seconds: number;
  hints_used: number;
  created_at: string;
};

export type ScoreSubmission = {
  initials: string;
  totalScore: number;
  totalTimeSeconds: number;
  hintsUsed: number;
};

/** Client-side validation matching the SQL CHECK constraints. */
export function validateSubmission(s: ScoreSubmission): string | null {
  if (!/^[A-Z]{3}$/.test(s.initials)) return 'Initials must be 3 letters (A–Z).';
  if (s.totalScore < SCORE_BOUNDS.minScore || s.totalScore > SCORE_BOUNDS.maxScore) {
    return 'Score out of plausible range.';
  }
  if (
    s.totalTimeSeconds < SCORE_BOUNDS.minTimeSeconds ||
    s.totalTimeSeconds > SCORE_BOUNDS.maxTimeSeconds
  ) {
    return 'Time out of plausible range.';
  }
  if (s.hintsUsed < 0 || s.hintsUsed > SCORE_BOUNDS.maxHints) {
    return 'Hints used out of range.';
  }
  return null;
}

/** Light client-side spam guard — one submission per minute per browser. */
const SUBMIT_THROTTLE_KEY = 'mcq.lastSubmitMs';
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

export async function submitScore(s: ScoreSubmission): Promise<
  | { ok: true; row: ScoreRow }
  | { ok: false; error: string }
> {
  const err = validateSubmission(s);
  if (err) return { ok: false, error: err };
  if (isThrottled()) {
    return { ok: false, error: "You just submitted — wait a minute and try again." };
  }
  if (!SUPABASE_CONFIGURED) {
    return { ok: false, error: 'Leaderboard offline (Supabase not configured).' };
  }
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Leaderboard offline.' };

  const { data, error } = await sb
    .from('mcquackers_scores')
    .insert({
      initials: s.initials.toUpperCase(),
      total_score: s.totalScore,
      total_time_seconds: s.totalTimeSeconds,
      hints_used: s.hintsUsed,
    })
    .select('*')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message || 'Submission failed.' };
  }
  markSubmitted();
  return { ok: true, row: data as ScoreRow };
}

/** Fetch the top N scores, ordered by score desc then time asc. */
export async function fetchTopScores(limit = 50): Promise<ScoreRow[]> {
  if (!SUPABASE_CONFIGURED) return [];
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('mcquackers_scores')
    .select('*')
    .order('total_score', { ascending: false })
    .order('total_time_seconds', { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data as ScoreRow[];
}

/** Compute where a candidate score WOULD rank, without submitting it.
 *  Returns 1-indexed rank (or null on failure). */
export async function rankForScore(
  score: number,
  timeSeconds: number,
): Promise<number | null> {
  if (!SUPABASE_CONFIGURED) return null;
  const sb = getSupabase();
  if (!sb) return null;
  // Count rows that beat this candidate (higher score, OR same score and faster).
  const { count, error } = await sb
    .from('mcquackers_scores')
    .select('*', { count: 'exact', head: true })
    .or(
      `total_score.gt.${score},and(total_score.eq.${score},total_time_seconds.lt.${timeSeconds})`,
    );
  if (error || count == null) return null;
  return count + 1;
}
