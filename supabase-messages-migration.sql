-- =============================================================
-- TJ Mascots — `messages` table for the privacy-page contact form
-- =============================================================
-- Public visitors can INSERT a row (their message + optional
-- reply-to email). The admin reads / triages them through the
-- /admin-7c4t-mc9q-3p dashboard.
--
-- Mirrors the same RLS / GRANT pattern used by `submissions` and
-- `corrections`: write-only for the anon role, full access through
-- the service_role key the admin pastes into localStorage.
--
-- Run this once in Supabase SQL Editor (Project Settings → SQL
-- Editor → New query → paste → Run).
-- =============================================================

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  -- The body of the contact message. Required.
  message text not null,
  -- Optional reply-to email. Format-validated client-side; admin
  -- still sanity-checks before responding.
  reply_to text,
  -- Triage state.
  status text not null default 'pending'
    check (status in ('pending', 'resolved', 'dismissed')),
  admin_notes text,
  reviewed_at timestamptz,
  -- When did the message land?
  created_at timestamptz not null default now()
);

-- RLS policy: anon can INSERT, service_role bypasses RLS for reads.
-- Mirrors the working pattern from corrections — explicit GRANT plus
-- an explicit policy targeting anon/authenticated roles is what
-- actually let inserts go through (Postgres' default `public` role
-- did not, see project memory).
alter table public.messages enable row level security;

drop policy if exists "anyone can insert messages" on public.messages;
create policy "anyone can insert messages"
  on public.messages
  for insert
  to anon, authenticated
  with check (true);

grant insert on public.messages to anon, authenticated;

-- Tell PostgREST to reload its schema cache so the new table is
-- exposed via the REST API immediately.
notify pgrst, 'reload schema';
