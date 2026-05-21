-- ============================================================================
-- McQuackers' Mascot Catch — leaderboard table
--
-- Apply by pasting this whole file into the Supabase SQL Editor for project
-- xxdandghgljvjbirlhfz, then click Run. Idempotent — safe to re-run.
--
-- WHY THE EXPLICIT GRANTS:
--   We learned the hard way on `submissions` that just running CREATE POLICY
--   with implicit `roles {public}` does NOT actually grant anon INSERT. See
--   the "RLS gotcha" note in project_tjmascots.md. So here we do both:
--     1. Explicit GRANT to anon, authenticated
--     2. RLS policies with TO anon, authenticated
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.catch_scores (
  id              BIGSERIAL PRIMARY KEY,
  initials        TEXT NOT NULL CHECK (initials ~ '^[A-Z]{3}$'),
  level_slug      TEXT NOT NULL CHECK (level_slug IN ('pasadena', 'chicago', 'nyc-uws')),
  store_number    TEXT NOT NULL,
  score           INTEGER NOT NULL CHECK (score >= 0 AND score <= 6000),
  mascots_caught  JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for the two main query patterns:
--   • per-level top-N (ORDER BY score DESC within level)
--   • per-initials best-per-level (overall leaderboard aggregation)
CREATE INDEX IF NOT EXISTS catch_scores_level_score_idx
  ON public.catch_scores (level_slug, score DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS catch_scores_initials_idx
  ON public.catch_scores (initials);

-- ---- RLS + grants -----------------------------------------------------------

ALTER TABLE public.catch_scores ENABLE ROW LEVEL SECURITY;

-- Allow anonymous reads (leaderboard is public)
DROP POLICY IF EXISTS catch_scores_select_anon ON public.catch_scores;
CREATE POLICY catch_scores_select_anon ON public.catch_scores
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- Allow anonymous inserts (anyone can submit a score)
DROP POLICY IF EXISTS catch_scores_insert_anon ON public.catch_scores;
CREATE POLICY catch_scores_insert_anon ON public.catch_scores
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

-- Belt + suspenders: explicit grants (the RLS-gotcha workaround)
GRANT SELECT, INSERT ON public.catch_scores TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.catch_scores_id_seq TO anon, authenticated;

-- Tell PostgREST to reload its schema cache so the new table + columns are
-- queryable immediately, without needing to bounce the project.
NOTIFY pgrst, 'reload schema';

-- ---- Smoke test (run manually after applying) -------------------------------
-- INSERT INTO public.catch_scores (initials, level_slug, store_number, score, mascots_caught)
-- VALUES ('AAA', 'pasadena', '51', 1234, '{"cacahuete": 1, "rosie": 2, "meatball": 3}'::jsonb)
-- RETURNING *;
-- SELECT * FROM public.catch_scores ORDER BY created_at DESC LIMIT 5;
