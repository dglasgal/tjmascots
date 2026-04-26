-- ==================================================================
-- TJ Mascots — email alerts on new submissions and corrections
-- ==================================================================
-- Sends an email to the admin every time someone submits a new mascot
-- or files a correction report.
--
-- HOW IT WORKS
--   - pg_net extension lets Postgres make outbound HTTP calls.
--   - A trigger function fires after every INSERT on submissions or
--     corrections, formats a nice HTML email, and POSTs it to Resend.
--   - Resend's free tier (100 emails/day, 3,000/month) is plenty.
--
-- ONE-TIME SETUP STEPS BEFORE RUNNING THIS:
--   1. Sign up at https://resend.com using david@7ate9.com.
--   2. Create an API key (https://resend.com/api-keys), copy it.
--      It starts with "re_..."
--   3. Replace REPLACE_ME_RESEND_API_KEY below with your real key.
--   4. (Optional) If you want the email FROM tjmascots.com, verify the
--      domain in Resend first. Otherwise leave the from-address as
--      "onboarding@resend.dev" — Resend's safe-default that works
--      without any DNS work but can only send TO the email you signed
--      up with (which is fine since you're the only recipient).
--   5. Paste this whole file into the Supabase SQL editor and Run.
--
-- TO ROTATE THE KEY LATER:
--   Re-run only the function-creation block (CREATE OR REPLACE FUNCTION).
--   The key is hardcoded inside the function body — your only secret.
--   Don't commit a real key into git; this file should keep the placeholder.
-- ==================================================================

-- 1. Enable pg_net for outbound HTTP requests
create extension if not exists pg_net with schema extensions;

-- 2. The trigger function — formats and sends the email
create or replace function public.notify_admin_on_new_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- !! REPLACE THE PLACEHOLDER BEFORE RUNNING !!
  resend_api_key text := 'REPLACE_ME_RESEND_API_KEY';
  admin_email     text := 'david@7ate9.com';
  from_address    text := 'TJ Mascots <onboarding@resend.dev>';
  -- Single source of truth for the admin URL — change this one line
  -- when DNS is finally pointed at tjmascots.com.
  admin_url       text := 'https://dolphin-app-aj5qf.ondigitalocean.app/admin-7c4t-mc9q-3p';
  subject         text;
  body_html       text;
  store_label     text;
  reply_to        text := null;  -- only set for `messages` rows where the user gave a contact email
begin
  if TG_TABLE_NAME = 'submissions' then
    subject := '🦆 New TJ Mascots submission: '
      || coalesce(nullif(NEW.name, ''), 'unnamed') || ' the ' || NEW.animal;
    store_label := coalesce(NEW.store, '(no store specified)');
    body_html :=
      '<h2 style="color:#C8102E;font-family:Helvetica,Arial,sans-serif;">New mascot submission</h2>' ||
      '<table style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;">' ||
        '<tr><td><b>Name:</b></td><td>' || coalesce(NEW.name, '<i>unnamed</i>') || '</td></tr>' ||
        '<tr><td><b>Animal:</b></td><td>' || NEW.animal || '</td></tr>' ||
        '<tr><td><b>Store:</b></td><td>' || store_label || '</td></tr>' ||
        '<tr><td><b>Store #:</b></td><td>' || coalesce(NEW.store_number, '<i>not specified</i>') || '</td></tr>' ||
        '<tr><td><b>Notes:</b></td><td>' || coalesce(NEW.notes, '<i>none</i>') || '</td></tr>' ||
        '<tr><td><b>Email:</b></td><td>' || coalesce(NEW.email, '<i>anonymous</i>') || '</td></tr>' ||
        '<tr><td><b>Photo:</b></td><td>' || case when NEW.photo_path is not null then 'yes (review in admin)' else 'no photo' end || '</td></tr>' ||
      '</table>' ||
      '<p style="margin-top:20px;"><a href="' || admin_url || '" style="background:#C8102E;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:bold;">Review in admin →</a></p>';

  elsif TG_TABLE_NAME = 'corrections' then
    subject := '🦆 TJ Mascots correction report: '
      || coalesce(NEW.mascot_name, 'mascot #' || NEW.mascot_id);
    body_html :=
      '<h2 style="color:#C8102E;font-family:Helvetica,Arial,sans-serif;">New correction report</h2>' ||
      '<table style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;">' ||
        '<tr><td><b>Mascot:</b></td><td>' || coalesce(NEW.mascot_name, '#' || NEW.mascot_id) || '</td></tr>' ||
        '<tr><td><b>Store:</b></td><td>' || coalesce(NEW.store, '<i>unknown</i>') || '</td></tr>' ||
        '<tr><td><b>Issues:</b></td><td>' || array_to_string(NEW.issues, ', ') || '</td></tr>' ||
        '<tr><td><b>Details:</b></td><td>' || coalesce(NEW.details, '<i>none</i>') || '</td></tr>' ||
        '<tr><td><b>Corrected store #:</b></td><td>' || coalesce(NEW.corrected_store_number, '<i>not provided</i>') || '</td></tr>' ||
        '<tr><td><b>Reporter email:</b></td><td>' || coalesce(NEW.reporter_email, '<i>anonymous</i>') || '</td></tr>' ||
      '</table>' ||
      '<p style="margin-top:20px;"><a href="' || admin_url || '" style="background:#C8102E;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:bold;">Review in admin →</a></p>';

  elsif TG_TABLE_NAME = 'messages' then
    -- Privacy-page contact form. If the visitor provided a reply-to
    -- email, set it on the Resend payload so the admin can hit Reply
    -- in their mail client and respond directly.
    subject := '✉️  TJ Mascots contact message';
    reply_to := nullif(NEW.reply_to, '');
    body_html :=
      '<h2 style="color:#C8102E;font-family:Helvetica,Arial,sans-serif;">New contact-form message</h2>' ||
      '<p style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#666;margin-bottom:6px;">'
        || case when reply_to is not null
             then 'From: <b>' || reply_to || '</b> — hit Reply in your mail client to respond directly.'
             else '<i>Anonymous (no reply-to email provided)</i>' end ||
      '</p>' ||
      '<blockquote style="font-family:Georgia,serif;font-size:15px;line-height:1.55;border-left:4px solid #C8102E;padding:6px 14px;margin:14px 0;color:#222;background:#FBF6EE;">' ||
        regexp_replace(NEW.message, E'\n', '<br>', 'g') ||
      '</blockquote>' ||
      '<p style="margin-top:20px;"><a href="' || admin_url || '" style="background:#C8102E;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:bold;">Review in admin →</a></p>';

  else
    return NEW;
  end if;

  -- Fire the email via Resend
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || resend_api_key,
      'Content-Type', 'application/json'
    ),
    body := case
      when reply_to is not null then
        jsonb_build_object(
          'from',     from_address,
          'to',       admin_email,
          'subject',  subject,
          'html',     body_html,
          'reply_to', reply_to
        )
      else
        jsonb_build_object(
          'from',    from_address,
          'to',      admin_email,
          'subject', subject,
          'html',    body_html
        )
    end
  );

  return NEW;
end;
$$;

-- 3. Wire the function to fire after each insert
drop trigger if exists email_alert_on_new_submission on public.submissions;
create trigger email_alert_on_new_submission
  after insert on public.submissions
  for each row execute function public.notify_admin_on_new_row();

drop trigger if exists email_alert_on_new_correction on public.corrections;
create trigger email_alert_on_new_correction
  after insert on public.corrections
  for each row execute function public.notify_admin_on_new_row();

drop trigger if exists email_alert_on_new_message on public.messages;
create trigger email_alert_on_new_message
  after insert on public.messages
  for each row execute function public.notify_admin_on_new_row();
