-- ===================================================================
-- TJ Mascots — submitter-side thank-you emails
-- ===================================================================
-- Two warm emails sent to the SUBMITTER (not the admin) when they
-- include their email on a submission:
--
--   1. Acknowledgment — fires the moment they submit:
--        "Thanks! We've got your TJ Mascot submission..."
--   2. Approval celebration — fires when David clicks Approve:
--        "🌟 [Mascot Name] is now on the map!"
--
-- The trigger function bails out silently for anonymous submissions
-- (NEW.email is null/empty) so people who want to stay anonymous
-- never get any mail.
--
-- Depends on:
--   - Resend API key already configured (use the same one you used
--     for notify_admin_on_new_row).
--   - The `submissions.approved_mascot_id` column we add below — the
--     approval email's deep-link button reads it to send the user
--     straight to their new pin on the map.
--
-- HOW TO RUN:
--   1. Find-and-replace REPLACE_ME_RESEND_API_KEY below with your
--      real Resend key (starts with "re_...").
--   2. Paste the whole file into Supabase SQL Editor → Run.
-- ===================================================================

-- 1. Make sure the column exists. If it already does, this is a no-op.
alter table public.submissions
  add column if not exists approved_mascot_id integer;

-- 2. The function — formats and sends the right email for the event
create or replace function public.notify_submitter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- !! REPLACE THE PLACEHOLDER BEFORE RUNNING !!
  resend_api_key text := 'REPLACE_ME_RESEND_API_KEY';
  from_address   text := 'TJ Mascots <onboarding@resend.dev>';
  -- Single source of truth for the public site URL — change this one
  -- line when DNS finally points at tjmascots.com.
  site_url       text := 'https://dolphin-app-aj5qf.ondigitalocean.app';
  to_email       text;
  store_label    text;
  mascot_label   text;
  mascot_link    text;
  subject        text;
  body_html      text;
begin
  -- Anonymous submissions (no email) never trigger a thank-you. Bail.
  to_email := nullif(NEW.email, '');
  if to_email is null then
    return NEW;
  end if;

  store_label := coalesce(nullif(NEW.store, ''), 'your store');
  mascot_label :=
    coalesce(nullif(NEW.name, ''), 'unnamed') ||
    ' the ' ||
    coalesce(nullif(NEW.animal, ''), 'mascot');

  if TG_OP = 'INSERT' then
    -- ----- Acknowledgment email -----
    subject := '🐾 Thanks! We''ve got your TJ Mascot submission';
    body_html :=
      '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:560px;">' ||
      '<p>Hi there!</p>' ||
      '<p>Thanks so much for sending us your snap of <b>' || mascot_label ||
        '</b> at the <b>' || store_label ||
        '</b> Trader Joe''s. The human admin will review your submission soon and post it to the map if everything checks out.</p>' ||
      '<p>All the rest of the animals can''t wait to see their new relative in the greater Trader Joe''s mascot family. 🐾</p>' ||
      '<p>We''ll send another note the moment your contribution goes live. Until then — keep your eyes open above the bananas, behind the wine, and tucked into the produce cooler. There are still hundreds of mascots waiting to be found.</p>' ||
      '<p style="margin-top:18px;">Warmly,<br><b>The TJ Mascots project</b><br>' ||
      '<a href="' || site_url || '" style="color:#C8102E;">' || site_url || '</a></p>' ||
      '</div>';

  elsif TG_OP = 'UPDATE'
    and OLD.status = 'pending'
    and NEW.status = 'approved'
  then
    -- ----- Approval celebration email -----
    -- If approved_mascot_id is set, deep-link to that pin; otherwise
    -- fall back to the homepage.
    mascot_link := site_url ||
      case when NEW.approved_mascot_id is not null
           then '/?mascot=' || NEW.approved_mascot_id
           else '' end;
    subject := '🌟 ' ||
      coalesce(nullif(NEW.name, ''), 'Your TJ mascot') ||
      ' is now on the map!';
    body_html :=
      '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:560px;">' ||
      '<p>Wonderful news!</p>' ||
      '<p><b>' || mascot_label || '</b> from the <b>' || store_label ||
        '</b> Trader Joe''s is now officially part of the TJ Mascots family — and <i>you''re</i> the one who put them there. 🦆</p>' ||
      '<p style="margin:22px 0;text-align:center;"><a href="' || mascot_link ||
        '" style="background:#C8102E;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold;">🗺️  See ' ||
        coalesce(nullif(NEW.name, ''), 'your mascot') ||
        ' live on the map →</a></p>' ||
      '<p>Thanks to you, every visitor to the map can now meet ' ||
        coalesce(nullif(NEW.name, ''), 'this mascot') ||
        ', learn their story, and recognize them on their next shopping trip. ' ||
        'Your spotter credit appears on the <b>Hall of Fame</b> leaderboard, ' ||
        'and the pin glows red to mark that this mascot has a real photo — all because of you.</p>' ||
      '<p>Mascots all over the country are still hiding, waiting for someone to vouch for them. ' ||
        'If you spot another — at a different store, or back at this one if a new mascot ever takes over — please share again. ' ||
        'The map only fills in because of people like you.</p>' ||
      '<p style="margin-top:18px;">With great thanks,<br><b>The TJ Mascots project</b><br>🦆 🦌 🐢 🐙 🦖 🐊 🦊</p>' ||
      '</div>';

  else
    -- Other UPDATE events (e.g. rejection, dismissed) — no email.
    return NEW;
  end if;

  -- Fire the email via Resend
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || resend_api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from',    from_address,
      'to',      to_email,
      'subject', subject,
      'html',    body_html
    )
  );

  return NEW;
end;
$$;

-- 3. Wire the function to fire on the right events
drop trigger if exists notify_submitter_on_insert on public.submissions;
create trigger notify_submitter_on_insert
  after insert on public.submissions
  for each row execute function public.notify_submitter();

drop trigger if exists notify_submitter_on_approval on public.submissions;
create trigger notify_submitter_on_approval
  after update on public.submissions
  for each row execute function public.notify_submitter();
