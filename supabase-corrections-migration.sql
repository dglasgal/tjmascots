-- ==================================================================
-- TJ Mascots — corrections table
-- Paste this whole file into the Supabase dashboard SQL editor and run.
-- Safe to re-run.
-- ==================================================================

CREATE TABLE IF NOT EXISTS public.corrections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mascot_id       BIGINT NOT NULL,       -- no FK on purpose: keep reports even if a mascot is removed
  mascot_name     TEXT,                  -- denormalized for easy scanning in the dashboard
  store           TEXT,                  -- denormalized
  issues          TEXT[] NOT NULL DEFAULT '{}',  -- e.g. ['name','photo']
  details         TEXT,                  -- free-form correction text
  reporter_email  TEXT,                  -- optional, provided by reporter
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'resolved', 'dismissed')),
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS corrections_status_idx
  ON public.corrections (status, created_at DESC);

-- Row Level Security: anyone (anon) can INSERT a correction, nobody can read
-- with the anon key. David reads via the dashboard (service_role).
ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can report corrections" ON public.corrections;
CREATE POLICY "anyone can report corrections"
  ON public.corrections FOR INSERT
  WITH CHECK (TRUE);
-- No SELECT policy → anon key can't read the queue. Good.
