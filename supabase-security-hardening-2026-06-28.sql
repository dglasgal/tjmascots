-- ============================================================================
-- TJ Mascots — security hardening pass, 2026-06-28
-- ============================================================================
-- Applied live to the Supabase project (xxdandghgljvjbirlhfz). This file is the
-- committed record; the CREATE OR REPLACE statements are idempotent.
--
-- WHY: a security review found two issues —
--   1. The email trigger functions built `body_html` by concatenating raw
--      user input (NEW.name / animal / store / notes / message / etc.) with no
--      HTML escaping. A malicious submission/correction/contact-message could
--      inject markup (tracking pixels, phishing links, spoofed buttons) into
--      the admin's inbox, and — via notify_submitter, which sends to a
--      visitor-controlled `to` address — turn mascots@tjmascots.com into an
--      HTML-email relay trading on the domain's sending reputation.
--   2. (handled separately) catch_scores INSERT RLS was WITH CHECK (true).
--
-- FIX: a small immutable _html_escape() helper, applied to every interpolated
-- user field in both notify_admin_on_new_row() and notify_submitter(). For the
-- contact message we escape FIRST, then convert real newlines to <br> so the
-- intended line breaks survive while user '<' becomes '&lt;'.
--
-- Header injection (CRLF into to/subject) was already prevented because the
-- payload is built with jsonb_build_object (JSON, not raw SMTP), and the
-- functions already REVOKE EXECUTE from anon/authenticated/public.
-- ============================================================================

-- 1. HTML escaper -----------------------------------------------------------
create or replace function public._html_escape(s text)
returns text
language sql
immutable
as $$
  select case when s is null then null else
    replace(
      replace(
        replace(
          replace(
            replace(s, '&', '&amp;'),
          '<', '&lt;'),
        '>', '&gt;'),
      '"', '&quot;'),
    '''', '&#39;')
  end;
$$;

-- 2. The two trigger functions were rebuilt to wrap every NEW.* user field in
--    public._html_escape(...). See the applied migrations
--    `add_html_escape_helper_and_secure_admin_email` and
--    `secure_submitter_email_html_escape` for the full bodies (they are the
--    same as supabase-email-alerts.sql / supabase-submitter-emails.sql but
--    with each user field escaped, and message newlines converted to <br>
--    AFTER escaping). The Resend API key and from-address
--    (mascots@tjmascots.com) are unchanged.
--
-- Verify after applying:
--   select public._html_escape('<img src=x onerror=alert(1)>');  -- => &lt;img src=x onerror=alert(1)&gt;
