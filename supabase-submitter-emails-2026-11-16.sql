-- ===================================================================
-- TJ Mascots — submitter emails, 2026-11-16 update
-- ===================================================================
-- DRAFT — NOT APPLIED. Written by Claude for David's review.
-- Safe to run more than once (every step is idempotent).
--
-- What changes:
--   A. The Resend API key moves out of the function body and into
--      Supabase Vault (encrypted storage). Step 1 copies the key that is
--      ALREADY inside the live notify_submitter() into Vault, so nobody
--      has to paste or see it. The admin-alert function
--      (notify_admin_on_new_row) is NOT touched and keeps its own copy.
--   B. Approval email, WITH a photo: same as today + a "Share your find"
--      block (Facebook, X, copy-the-link).
--   C. Approval email, WITHOUT a photo: replaced by the funny
--      "proof of mascot" plea. (Replaced, not added: one email per
--      approval, and today's copy wrongly says "the pin glows red to
--      mark that this mascot has a real photo" for photo-less mascots.)
--   D. One-time catch-up for mascots that were approved earlier without
--      a photo: send_proof_of_mascot_catchup(dry_run). Defaults to a dry
--      run that only LISTS who would be emailed. Nothing is sent until
--      someone runs it with dry_run => false.
--
-- Unchanged: the acknowledgment email on INSERT (same copy), html
-- escaping of every user field (public._html_escape), the trigger
-- wiring, and the REVOKE that keeps these functions off the public API.
--
-- Links point to https://tjmascots.com/?mascot={id} (the map card), not
-- /mascot/{slug}/: the slug is built from mascots.json's store label,
-- which the submissions table doesn't have, so computing it in SQL
-- would be fragile.
-- ===================================================================

-- 1. Copy the existing Resend key into Vault (once) --------------------
do $$
declare
  k text;
begin
  if exists (select 1 from vault.secrets where name = 'resend_api_key') then
    raise notice 'Vault already has resend_api_key — leaving it alone.';
    return;
  end if;
  -- Captures only the quoted literal assigned to resend_api_key.
  select substring(pg_get_functiondef('public.notify_submitter()'::regprocedure)
                   from 'resend_api_key\s+text\s*:=\s*''(re_[A-Za-z0-9_]+)''')
    into k;
  if k is null then
    raise exception 'Could not find a Resend key in notify_submitter(). Stop: add it to Vault by hand (name: resend_api_key) and re-run.';
  end if;
  perform vault.create_secret(k, 'resend_api_key', 'Resend API key used by notify_submitter + proof-of-mascot catch-up');
end;
$$;

-- 2. Small shared helper: the proof-of-mascot plea body ---------------
--    Inputs are raw; this function escapes them itself.
create or replace function public._proof_of_mascot_html(
  p_name text, p_animal text, p_store text, p_mascot_id integer, p_catchup boolean
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  site_url   text := 'https://tjmascots.com';
  nm         text := public._html_escape(coalesce(nullif(btrim(p_name), ''), 'your mascot'));
  an         text := public._html_escape(lower(coalesce(nullif(btrim(p_animal), ''), 'mascot')));
  st         text := public._html_escape(coalesce(nullif(btrim(p_store), ''), 'your'));
  card_link  text := site_url || case when p_mascot_id is not null then '/?mascot=' || p_mascot_id else '' end;
  opener     text;
begin
  if p_catchup then
    opener := '<p>A little while back you put <b>' || nm || '</b> the ' || an ||
      ' from the <b>' || st || '</b> Trader Joe''s on the map. Thank you! ' || nm ||
      ' has been enjoying the attention. Mostly.</p>';
  else
    opener := '<p>Great news: <b>' || nm || '</b> the ' || an ||
      ' from the <b>' || st || '</b> Trader Joe''s is officially on the map, and you''re the one who put them there. 🦆</p>';
  end if;

  return
    '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:560px;">' ||
    '<p>Hi there!</p>' ||
    opener ||
    '<p>Now for the slightly awkward part. Right now ' || nm || '''s map card shows our "missing mascot" stand-in: ' ||
      'a very earnest duck in a safari hat, holding a checklist. He is doing his best. He is not ' || nm || '.</p>' ||
    '<p>The whole point of the map is that a kid (or a grown-up, we don''t judge) can walk into that store knowing ' ||
      'exactly who to look for. Without a photo, shoppers are scanning the aisles for "some kind of ' || an || '?" ' ||
      'And then rumors start. Somebody swears ' || nm || ' is a llama. Nobody wants that, least of all ' || nm || '.</p>' ||
    '<p><b>So we''re officially requesting proof of mascot.</b> 📸 Next time you''re in, snap a quick photo of ' || nm ||
      ' (the crew is usually happy to help, and ' || nm || ' is used to fame by now) and send it either way:</p>' ||
    '<ol>' ||
      '<li><b>Just reply to this email</b> with the photo attached. It comes straight to me.</li>' ||
      '<li>Or open ' || nm || '''s card on the map, tap <b>⚠︎ Report incorrect info</b>, tick ' ||
        '<b>"I have a new / better photo to upload"</b>, and add it there.</li>' ||
    '</ol>' ||
    '<p style="margin:22px 0;text-align:center;"><a href="' || card_link ||
      '" style="background:#C8102E;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold;">🗺️  Open ' ||
      nm || '''s card →</a></p>' ||
    '<p>You''ll get the photo credit on the map. ' || nm || ' gets their close-up. The duck gets the day off.</p>' ||
    '<p style="margin-top:18px;">Thanks for vouching for ' || nm || ',<br><b>David, TJ Mascots</b><br>' ||
      '<a href="' || site_url || '" style="color:#C8102E;">tjmascots.com</a></p>' ||
    '</div>';
end;
$$;

-- 3. notify_submitter(), rebuilt --------------------------------------
create or replace function public.notify_submitter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resend_api_key text;
  from_address   text := 'TJ Mascots <mascots@tjmascots.com>';
  site_url       text := 'https://tjmascots.com';
  to_email       text;
  store_label    text;
  mascot_label   text;
  mascot_link    text;
  link_enc       text;
  subject        text;
  body_html      text;
  raw_name       text := nullif(btrim(coalesce(NEW.name, '')), '');
begin
  -- Anonymous submissions (no email, or not an email) never get mail.
  to_email := nullif(btrim(coalesce(NEW.email, '')), '');
  if to_email is null or position('@' in to_email) = 0 then
    return NEW;
  end if;

  select decrypted_secret into resend_api_key
    from vault.decrypted_secrets where name = 'resend_api_key';
  if resend_api_key is null then
    raise warning 'notify_submitter: resend_api_key missing from Vault — no email sent';
    return NEW;
  end if;

  -- HTML-escaped, display-safe versions of user-controlled fields
  store_label := public._html_escape(coalesce(nullif(NEW.store, ''), 'your store'));
  mascot_label :=
    public._html_escape(coalesce(raw_name, 'unnamed')) ||
    ' the ' ||
    public._html_escape(coalesce(nullif(btrim(NEW.animal), ''), 'mascot'));

  if TG_OP = 'INSERT' then
    -- ----- Acknowledgment email (copy unchanged) -----
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
    mascot_link := site_url ||
      case when NEW.approved_mascot_id is not null
           then '/?mascot=' || NEW.approved_mascot_id
           else '' end;

    if NEW.photo_path is null then
      -- ----- NEW: approved without a photo → proof-of-mascot plea -----
      subject := '🌟 ' || coalesce(raw_name, 'Your TJ mascot') ||
        ' is on the map! (…but we need proof 📸)';
      body_html := public._proof_of_mascot_html(
        NEW.name, NEW.animal, NEW.store, NEW.approved_mascot_id, false);

    else
      -- ----- Approval celebration email + NEW share block -----
      -- mascot_link is built only from our own digits, so a fixed
      -- percent-encoding of ':' '/' '?' '=' is enough.
      link_enc := replace(replace(replace(replace(mascot_link,
                    ':', '%3A'), '/', '%2F'), '?', '%3F'), '=', '%3D');
      subject := '🌟 ' || coalesce(raw_name, 'Your TJ mascot') || ' is now on the map!';
      body_html :=
        '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:560px;">' ||
        '<p>Wonderful news!</p>' ||
        '<p><b>' || mascot_label || '</b> from the <b>' || store_label ||
          '</b> Trader Joe''s is now officially part of the TJ Mascots family — and <i>you''re</i> the one who put them there. 🦆</p>' ||
        '<p style="margin:22px 0;text-align:center;"><a href="' || mascot_link ||
          '" style="background:#C8102E;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold;">🗺️  See ' ||
          public._html_escape(coalesce(raw_name, 'your mascot')) ||
          ' live on the map →</a></p>' ||
        '<p>Thanks to you, every visitor to the map can now meet ' ||
          public._html_escape(coalesce(raw_name, 'this mascot')) ||
          ', learn their story, and recognize them on their next shopping trip. ' ||
          'Your spotter credit appears on the <b>Hall of Fame</b> leaderboard — all because of you.</p>' ||
        -- Share block
        '<div style="margin:22px 0;padding:16px 18px;background:#FBF3E4;border-radius:14px;">' ||
          '<p style="margin:0 0 8px;"><b>Share your find 🎉</b><br>' ||
            public._html_escape(coalesce(raw_name, 'This mascot')) ||
            ' has waited a long time for fame. Show them off:</p>' ||
          '<p style="margin:0 0 8px;">' ||
            '<a href="https://www.facebook.com/sharer/sharer.php?u=' || link_enc ||
              '" style="color:#C8102E;font-weight:bold;">Share on Facebook</a> &nbsp;·&nbsp; ' ||
            '<a href="https://twitter.com/intent/tweet?url=' || link_enc ||
              '&text=I%20found%20a%20Trader%20Joe%27s%20mascot%20and%20put%20them%20on%20the%20map%21%20%F0%9F%A6%86' ||
              '" style="color:#C8102E;font-weight:bold;">Share on X</a></p>' ||
          '<p style="margin:0;font-size:13px;color:#555;">Or copy this link: ' ||
            '<a href="' || mascot_link || '" style="color:#C8102E;">' || mascot_link || '</a></p>' ||
        '</div>' ||
        '<p>Mascots all over the country are still hiding, waiting for someone to vouch for them. ' ||
          'If you spot another — at a different store, or back at this one if a new mascot ever takes over — please share again. ' ||
          'The map only fills in because of people like you.</p>' ||
        '<p style="margin-top:18px;">With great thanks,<br><b>David, TJ Mascots</b><br>🦆 🦌 🐢 🐙 🦖 🐊 🦊</p>' ||
        '</div>';
    end if;

  else
    return NEW;
  end if;

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

-- Trigger wiring is unchanged; re-stated so this file stands alone.
drop trigger if exists notify_submitter_on_insert on public.submissions;
create trigger notify_submitter_on_insert
  after insert on public.submissions
  for each row execute function public.notify_submitter();

drop trigger if exists notify_submitter_on_approval on public.submissions;
create trigger notify_submitter_on_approval
  after update on public.submissions
  for each row execute function public.notify_submitter();

revoke execute on function public.notify_submitter() from anon, authenticated, public;
revoke execute on function public._proof_of_mascot_html(text, text, text, integer, boolean) from anon, authenticated, public;

-- 4. One-time catch-up for earlier photo-less approvals ----------------
-- Photo status lives in mascots.json (GitHub), not in this database, so
-- the target mascot ids are listed explicitly. As of 2026-11-16 the
-- approved, emailable, still-photo-less mascots are:
--   #481 Glenda and Monty (Glenmont NY #579)
--   #486 Pierre the Peacock (Oakland CA #231)
--   #509 Lily (Brookfield WI #726)
-- (#507 Sebastian was approved without a photo but has one now.)
-- RE-CHECK mascots.json has_photo for each id right before sending.
--
-- Usage:
--   select * from public.send_proof_of_mascot_catchup(array[481,486,509]);          -- dry run, sends nothing
--   select * from public.send_proof_of_mascot_catchup(array[481,486,509], false);   -- SENDS
-- Each sent row gets a marker in submissions.admin_notes, so running it
-- twice never emails the same person twice.
create or replace function public.send_proof_of_mascot_catchup(
  mascot_ids integer[],
  dry_run boolean default true
)
returns table (mascot_id integer, mascot_name text, email_masked text, action text)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  k text;
  marker constant text := '[proof-of-mascot catch-up sent]';
begin
  if not dry_run then
    select decrypted_secret into k from vault.decrypted_secrets where name = 'resend_api_key';
    if k is null then raise exception 'resend_api_key missing from Vault'; end if;
  end if;

  for r in
    select distinct on (s.approved_mascot_id, lower(btrim(s.email)))
           s.id, s.approved_mascot_id, s.name, s.animal, s.store, btrim(s.email) as email, s.admin_notes
      from public.submissions s
     where s.status = 'approved'
       and s.approved_mascot_id = any(mascot_ids)
       and position('@' in coalesce(s.email, '')) > 0
     order by s.approved_mascot_id, lower(btrim(s.email)), s.reviewed_at desc
  loop
    mascot_id := r.approved_mascot_id;
    mascot_name := btrim(r.name);
    email_masked := regexp_replace(r.email, '^(.).*(@.*)$', '\1***\2');
    if coalesce(r.admin_notes, '') like '%' || marker || '%' then
      action := 'skip: already sent';
    elsif dry_run then
      action := 'would send';
    else
      perform net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object('Authorization', 'Bearer ' || k, 'Content-Type', 'application/json'),
        body := jsonb_build_object(
          'from',    'TJ Mascots <mascots@tjmascots.com>',
          'to',      r.email,
          'subject', '📸 A small favor for ' || coalesce(nullif(btrim(r.name), ''), 'your TJ mascot'),
          'html',    public._proof_of_mascot_html(r.name, r.animal, r.store, r.approved_mascot_id, true)
        )
      );
      update public.submissions
         set admin_notes = coalesce(admin_notes || E'\n', '') || marker || ' ' || now()::date
       where id = r.id;
      action := 'sent';
    end if;
    return next;
  end loop;
end;
$$;

revoke execute on function public.send_proof_of_mascot_catchup(integer[], boolean) from anon, authenticated, public;

-- Verify after applying (sends nothing):
--   select name from vault.secrets where name = 'resend_api_key';               -- 1 row
--   select pg_get_functiondef('public.notify_submitter()'::regprocedure) ~ 'resend_api_key\s+text\s*:=';     -- false = key no longer in the body
--   select * from public.send_proof_of_mascot_catchup(array[481,486,509]);       -- dry run list
