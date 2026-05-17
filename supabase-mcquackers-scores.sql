-- ============================================================================
-- mcquackers_scores
--
-- Leaderboard for "McQuackers' Quest" — the hidden-object easter-egg game
-- discoverable via the "Terms and Conditions" footer link on tjmascots.com.
--
-- Schema goals:
--   • Anonymous insert + select (RLS on, anon role permitted).
--   • CHECK constraints reject implausible scores at the DB level so a
--     determined cheater can't put "999,999,999" on the board with a tampered
--     client. (We accept that they could still submit a *believable* fake.)
--   • Composite index supports the leaderboard sort: score DESC, time ASC.
--
-- See site/src/lib/quack-config.ts SCORE_BOUNDS and
-- site/src/lib/quack-leaderboard.ts for the client-side mirror of these
-- checks. If you tighten these constraints later, update both files.
--
-- Apply via the Supabase SQL editor on the existing TJ Mascots project.
-- ============================================================================

create table if not exists public.mcquackers_scores (
  id              uuid primary key default gen_random_uuid(),
  initials        text not null,
  total_score     int  not null,
  total_time_seconds int not null,
  hints_used      int  not null default 0,
  created_at      timestamptz not null default now(),

  -- 3-letter uppercase initials, A–Z only.
  constraint initials_format
    check (initials ~ '^[A-Z]{3}$'),

  -- A 5-level run has a per-level floor of 100, so min total is 500.
  -- Theoretical max (instant find, no hints) is 10,000. We allow a small
  -- buffer for rounding edge cases.
  constraint score_in_range
    check (total_score between 500 and 10000),

  -- 10s minimum — skilled players who know the positions can speedrun
  -- the 5 levels in ~15s, so we allow times this low. Cap at 1 hour
  -- to filter junk submissions. Migration `relax_mcquackers_time_minimum`
  -- moved this from 30 → 10 on 2026-05-12 after a legitimate 0:16 run.
  constraint time_in_range
    check (total_time_seconds between 10 and 3600),

  -- 5 levels × 5 max hints per level = 25 ceiling.
  constraint hints_in_range
    check (hints_used between 0 and 25)
);

-- Leaderboard sort index: highest score first, then fastest time as tiebreaker.
create index if not exists idx_mcquackers_scores_top
  on public.mcquackers_scores (total_score desc, total_time_seconds asc);

alter table public.mcquackers_scores enable row level security;

-- Anyone can read the leaderboard.
drop policy if exists "anon read scores" on public.mcquackers_scores;
create policy "anon read scores"
  on public.mcquackers_scores
  for select
  to anon, authenticated
  using (true);

-- Anyone can submit, but the CHECK constraints above gate impossible values.
drop policy if exists "anon insert scores" on public.mcquackers_scores;
create policy "anon insert scores"
  on public.mcquackers_scores
  for insert
  to anon, authenticated
  with check (true);

-- (No UPDATE or DELETE policies — submissions are immutable.)

comment on table public.mcquackers_scores is
  'Leaderboard for the McQuackers easter-egg hidden-object game. Anonymous insert with DB-level CHECK constraints for plausibility. See site/src/lib/quack-* for the client.';
