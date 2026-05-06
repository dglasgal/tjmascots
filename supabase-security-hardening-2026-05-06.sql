-- ===================================================================
-- TJ Mascots — security hardening pass (applied 2026-05-06)
-- ===================================================================
-- This file is a self-contained, idempotent record of the security
-- migration applied on 2026-05-06 in response to a Supabase advisor
-- email flagging that public.submissions and public.corrections had
-- RLS policies but RLS itself was not enabled — meaning the policies
-- were silently NOT being enforced and anyone with the public anon
-- key could read or modify those tables.
--
-- After running everything below the Supabase security advisor
-- reports zero findings.
--
-- The same changes are also baked into the regular per-table migration
-- files (supabase-migration.sql, supabase-corrections-migration.sql,
-- supabase-messages-migration.sql, supabase-email-alerts.sql,
-- supabase-submitter-emails.sql) — so a fresh-from-scratch install
-- gets the same hardened state automatically. This file exists as a
-- one-shot replay for the live database when needed.
--
-- Safe to re-run.
-- ===================================================================

-- ---- 1. Enable RLS on submissions and corrections -----------------
-- This was the actual breach: policies existed but RLS was off, so the
-- policies were ignored and the tables were wide open.
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;

-- ---- 2. Tighten the three "anyone can insert" RLS policies --------
-- Each is INSERT-only. Generous size caps prevent abuse, and forcing
-- status='pending' blocks anon from sneaking in pre-approved rows.

-- a) submissions
DROP POLICY IF EXISTS "anyone can submit" ON public.submissions;
CREATE POLICY "anyone can submit"
  ON public.submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(coalesce(store, ''))         BETWEEN 1 AND 500
    AND length(coalesce(animal, ''))    BETWEEN 1 AND 200
    AND length(coalesce(name, ''))             <= 200
    AND length(coalesce(email, ''))            <= 320      -- RFC 5321 max
    AND length(coalesce(notes, ''))            <= 10000
    AND length(coalesce(photo_path, ''))       <= 500
    AND length(coalesce(store_number, ''))     <= 20
    AND (status IS NULL OR status = 'pending')
  );

-- b) corrections
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

-- c) messages
DROP POLICY IF EXISTS "anyone can insert messages" ON public.messages;
CREATE POLICY "anyone can insert messages"
  ON public.messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(coalesce(message, ''))   BETWEEN 1 AND 10000
    AND length(coalesce(reply_to, '')) <= 320
    AND (status IS NULL OR status = 'pending')
  );

-- ---- 3. Lock down the SECURITY DEFINER trigger functions ---------
-- They're wired to triggers, which run as the table owner regardless of
-- EXECUTE permission. But the default 'execute by anyone' grant exposes
-- them via /rest/v1/rpc/, letting anyone with the anon key fire spam.
REVOKE EXECUTE ON FUNCTION public.notify_admin_on_new_row() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_submitter()       FROM anon, authenticated, PUBLIC;

-- ---- 4. Pin search_path on touch_updated_at ----------------------
-- Empty search_path forces all references in the body to be fully
-- qualified, blocking schema-shadowing hijacks on a SECURITY-anything
-- function. The body only uses NEW and now() so this is harmless.
ALTER FUNCTION public.touch_updated_at() SET search_path = '';

-- ---- 5. Drop the broad listing policy on the photos bucket -------
-- The mascot-photos bucket is marked public, so direct-URL access to
-- files works without any storage.objects policy. The dropped policy
-- only enabled enumeration of every key in the bucket via the storage
-- list API — not something we need.
DROP POLICY IF EXISTS "mascot photos are public" ON storage.objects;
