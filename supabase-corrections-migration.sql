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
  reviewed_at     TIMESTAMPTZ,
  -- Reporter's suggestion of which store the mascot actually belongs at
  -- (when the original record had the wrong store_number). Optional.
  corrected_store_number TEXT
);

-- Make this idempotent for existing databases that pre-date the
-- corrected_store_number column.
ALTER TABLE public.corrections
  ADD COLUMN IF NOT EXISTS corrected_store_number TEXT;

CREATE INDEX IF NOT EXISTS corrections_status_idx
  ON public.corrections (status, created_at DESC);

-- Row Level Security: anyone (anon) can INSERT a correction, nobody can read
-- with the anon key. David reads via the dashboard (service_role).
ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;

-- WITH CHECK is intentionally tight. Generous size caps prevent abuse and
-- forcing status='pending' blocks anon from sneaking in pre-resolved rows.
-- Without the caps the Supabase advisor flags this as 'always-true RLS'.
DROP POLICY IF EXISTS "anyone can report corrections" ON public.corrections;
CREATE POLICY "anyone can report corrections"
  ON public.corrections FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    mascot_id IS NOT NULL AND mascot_id > 0
    AND length(coalesce(mascot_name, ''))            <= 500
    AND length(coalesce(store, ''))                  <= 500
    AND length(coalesce(details, ''))                <= 10000
    AND length(coalesce(reporter_email, ''))         <= 320
    AND length(coalesce(corrected_store_number, '')) <= 20
    AND (status IS NULL OR status = 'pending')
    AND coalesce(array_length(issues, 1), 0) <= 20
  );
-- No SELECT policy → anon key can't read the queue. Good.
