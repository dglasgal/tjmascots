-- ===================================================================
-- TJ Mascots — photo GPS verification columns on submissions
-- ===================================================================
-- Adds four nullable columns that capture the result of comparing the
-- submitted photo's EXIF GPS coordinates against the store the user
-- picked. The admin dashboard renders a badge per submission so the
-- moderator can see at a glance whether the photo's location matches.
--
-- We never auto-approve based on these — many legit photos lose EXIF
-- when sent through chat apps. The badge is purely an aid for the
-- human moderator.
--
-- Run this once in Supabase SQL Editor.
-- ===================================================================

alter table public.submissions
  add column if not exists photo_lat double precision,
  add column if not exists photo_lng double precision,
  add column if not exists photo_distance_m integer,
  add column if not exists photo_location_status text
    check (photo_location_status in ('match', 'mismatch', 'no_gps', 'error') or photo_location_status is null);

-- Refresh PostgREST so the REST API exposes the new columns immediately.
notify pgrst, 'reload schema';
