-- ==================================================================
-- TJ Mascots — Supabase schema + seed
-- Paste this whole file into the Supabase dashboard SQL editor and run.
-- Safe to re-run; uses IF NOT EXISTS and ON CONFLICT.
-- ==================================================================

-- ---------- Extensions ----------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- for gen_random_uuid()

-- ---------- Tables ----------

-- The approved, publicly-visible mascot list. We seed it from our local JSON.
CREATE TABLE IF NOT EXISTS public.mascots (
  id           BIGINT PRIMARY KEY,
  name         TEXT NOT NULL DEFAULT '',
  animal       TEXT NOT NULL DEFAULT '',
  store        TEXT NOT NULL DEFAULT '',
  state        TEXT NOT NULL DEFAULT '',
  notes        TEXT NOT NULL DEFAULT '',
  photo        TEXT,
  has_photo    BOOLEAN NOT NULL DEFAULT FALSE,
  retired      BOOLEAN NOT NULL DEFAULT FALSE,
  source_url   TEXT NOT NULL DEFAULT '',
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User-submitted mascots pending moderation.
CREATE TABLE IF NOT EXISTS public.submissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store        TEXT NOT NULL,
  animal       TEXT NOT NULL,
  name         TEXT,
  email        TEXT,
  notes        TEXT,
  photo_path   TEXT,                  -- path inside the 'submissions' storage bucket
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS submissions_status_idx ON public.submissions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS mascots_state_idx ON public.mascots (state) WHERE retired = FALSE;

-- ---------- Row Level Security ----------

-- Mascots: anyone can read non-retired rows. Only service_role can write.
ALTER TABLE public.mascots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mascots are public" ON public.mascots;
CREATE POLICY "mascots are public"
  ON public.mascots FOR SELECT
  USING (retired = FALSE);

-- Submissions: anyone can INSERT, nobody can read via anon key. Admin reads use service_role.
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can submit" ON public.submissions;
CREATE POLICY "anyone can submit"
  ON public.submissions FOR INSERT
  WITH CHECK (TRUE);
-- No SELECT policy on submissions → anon key can't read them back. Good.

-- ---------- Storage buckets ----------

-- Public bucket for approved mascot photos (served directly).
INSERT INTO storage.buckets (id, name, public)
VALUES ('mascot-photos', 'mascot-photos', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Submission photos bucket — not public. Only server-side code with service_role reads.
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Policies: anyone can UPLOAD to submissions (only) with size & mime caps.
DROP POLICY IF EXISTS "anyone can upload submission photos" ON storage.objects;
CREATE POLICY "anyone can upload submission photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = 'pending'
  );

-- Anyone can READ mascot-photos (since the bucket is public, this is already true,
-- but explicit policy helps with SDK-side type inference).
DROP POLICY IF EXISTS "mascot photos are public" ON storage.objects;
CREATE POLICY "mascot photos are public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'mascot-photos');

-- ---------- updated_at trigger ----------
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mascots_touch_updated_at ON public.mascots;
CREATE TRIGGER mascots_touch_updated_at
  BEFORE UPDATE ON public.mascots
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- Seed the mascots table ----------
INSERT INTO public.mascots
  (id, name, animal, store, state, notes, photo, has_photo, retired, source_url, lat, lng)
VALUES
  (1,'McQuackers','Duck','Lakeshore (Oakland)','CA','Green-head mallard with ''McQuackers CREW MEMBER'' red nametag. User-verified photo.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1n1pwsi/mcquackers_the_duck_at_oakland_calakeshore_trader/',NULL,NULL),
  (2,'Tuskanini','Elephant','East Liberty (Pittsburgh)','PA','Long-standing named mascot. Also mentioned in Tasting Table article.','002.png',TRUE,FALSE,'https://www.tastingtable.com/1256862/trader-joes-official-mascot/',NULL,NULL),
  (3,'Agnes','Cow','University Mall (Davis)','CA','Adopted July 2019; replaced ''Davis the Duck''. Represents local agriculture.',NULL,FALSE,FALSE,'https://theaggie.org/2019/08/22/davis-trader-joes-adopts-new-store-mascot-agnes-the-cow/',NULL,NULL),
  (4,'Ramsay','Ram','Fort Collins','CO','CSU Rams nod.','004.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (5,'Frank','Turtle','Hoboken','NJ','Named for Frank Sinatra (Hoboken''s favorite son). Paired with Steve the duck.','005.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (6,'Steve','Duck','Hoboken','NJ','Named for Stevens Institute of Tech. Paired with Frank the turtle.','006.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (7,'Monte','Sea otter','Monterey','CA','Store 204. Nod to Monterey Bay sea otters.','007.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (8,'Finley','Flamingo','Creedmoor Rd (Raleigh)','NC','8111 Creedmoor Rd Ste 136. New store.','008.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (9,'Danny','Dinosaur','Orem','UT','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (10,'','Black bear','Asheville','NC','Animal confirmed, name not shared.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (11,'Haze','Parrot (cherry-headed conure)','Hayes Valley (San Francisco)','CA','Nod to famous wild flock of conures in SF. Confirmed in thread.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (12,'','Armadillo','1440 S Voss Rd (Houston)','TX','Name not shared.','012.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (13,'Chewy','Unknown','Greenwood Village','CO','Hangs out by checkouts; animal type not specified.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (14,'Sanjay','Seahorse','Downtown Summerlin (Las Vegas)','NV','Hangs out in Organic Produce section.','014.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (15,'Brioche','Toast slice','El Cerrito','CA','Paired with Toastie. Used to have a lobster. Found on upper shelf above frozen breakfast.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (16,'Toastie','Toast slice','El Cerrito','CA','Paired with Brioche. Also a toast-shaped plushie.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (17,'Rocky','Lobster','Framingham','MA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (18,'','Unknown','Hermosa Beach','CA','Sees Valentine''s themed dress-up. Need full info.','018.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (19,'','Frog','Alpharetta','GA','New store. Name not yet shared.','019.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (20,'Trixie','Unknown','North Beach (San Francisco)','CA','Gets stolen often; repeatedly replaced.','020.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (21,'Beary','Polar bear','East Village (NYC)','NY','436 East 14th St.','021.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (22,'Petra','Pigeon','SoHo (NYC)','NY','233 Spring Street.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (23,'Octavia','Octopus','Upper West Side (NYC)','NY','670 Columbus Ave.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (24,'Carl','Pigeon','Union Square (NYC)','NY','142 E 14th St. No photo yet.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (25,'Tux','Turtle','Harlem 125 (NYC)','NY','Seen in festive winter wear; kept in manager''s station.','025.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (26,'Huckleberry','Moose','Coeur d''Alene','ID','New store; sometimes hangs on the bell.','026.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (27,'Taylor','Unknown','Millburn','NJ','Has a name tag. Animal type not specified.','027.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (28,'Boro','Fox','Patriot Place (Foxborough)','MA','Replaced a Tom Brady stuffed character after Brady left the Patriots.','028.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (29,'Garbanzo','Red fox','Shoreview','MN','Named because the store is on Red Fox Rd.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (30,'Pepper','Platypus','East Vancouver','WA','Chosen by customer vote over alternatives (including Mochi the Mammoth). Now has ''babies''.','030.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (31,'Angel','Bull / Longhorn','Santa Rosa','CA','Honors a real bull named Angel who survived the 2017 Tubbs Fire in CA''s deadliest wildfire at the time.','031.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (32,'','Unknown','Coppell','TX','New store. Mascot sighting linked from separate Reddit post.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (33,'Meatball','Gopher','DMV (DC / MD / VA)','','Exact store within DMV area not specified.','033.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (34,'Mingo','Flamingo','Delray Beach','FL','','034.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (35,'Ringo','Raccoon','Claremont','CA','Seen in Halloween costume in October.','035.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (36,'Mocha','Horse / Mare','Wellington','FL','Wears an orange tutu for Halloween/fall.','036.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (37,'TJ','Tiger','Royal Oak','MI','','037.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (38,'Hopster','Unknown','Ardmore','PA','Gets dressed up (had a mask in 2020).','038.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (39,'Jo-Jo','Tiger','Stockton','CA','','039.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/1gc35we/mascot_megathread_request_part_2_looking_for/',NULL,NULL),
  (40,'Willie','Unknown','Williamsburg','VA','Store 657.','040.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (41,'Stephen','Seagull','Downtown Salt Lake City','UT','Named after Steven Seagal; seagulls are Utah''s state bird.','041.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (42,'Gooseberry','Goose','Morrisville','NC','','042.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (43,'Fennel','Fox','Cary','NC','','043.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (44,'Ramses','Ram','Chapel Hill','NC','UNC mascot.','044.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (45,'Arnold','Avocado','Greensboro','NC','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (46,'TJ','Squirrel','Winston Salem','NC','Also mentioned as a brown teddy bear.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (47,'Sammy','Seahawk','Wilmington','NC','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (48,'Ollie','Octopus','Long Beach (Bellflower)','CA','','048.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (49,'Billy','Monkey','Carmel Mountain Ranch','CA','','049.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (50,'Joanna','Toucan','Valencia','CA','','050.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (51,'Herman and Shirley','Shark','Oceanside','NY','Shark duo; Long Island.','051.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (52,'Dixie','Dolphin','Huntington Beach (Brookhurst)','CA','Store 241.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (53,'Octavia','Octopus','West Seattle','WA','','053.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (54,'Weasley','Tiger','Toluca Lake — RETIRED','CA','RETIRED per David''s April 2026 visit. Replaced by Ruby the Swan. Original nod was to Toluca Lake Elementary Tigers. Store 54.','054.png',TRUE,TRUE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (55,'Iggy','Lion','Westchester (Los Angeles)','CA','LMU mascot.','055.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (56,'Piper','Sandpiper','Ft Myers','FL','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (57,'Lucky','Chicken','Maple Grove','MN','Store 713. Paired with Maple the maple-leaf mascot.','057.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (58,'Maple','Maple leaf','Maple Grove','MN','Store 713.','058.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (59,'Archie','Mammoth','Lincoln','NE','Named for world''s largest Columbian mammoth found in western Nebraska.','059.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (60,'Chomps','Dog','Pikesville','MD','','060.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (61,'Pickles','Panda','Hillcrest (San Diego)','CA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (62,'Ruby','Raccoon','Chattanooga','TN','','062.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (63,'Stroopy','Cow','Kettering','OH','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (64,'Sky','Owl','Folsom','CA','','064.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (65,'Fiona','Horse','Louisville','KY','Dressed as vampire for Halloween.','065.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (66,'Percy','Parrot','Brooklyn (Gold Street)','NY','','066.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (67,'Timber Joe','Timberwolf','St. Louis Park','MN','Store 710.','067.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (68,'TJ','Tiger','Tallahassee','FL','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (69,'Howie','Hippo','Leawood','KS','Store 723.','069.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (70,'Waldo','Walrus','Kansas City','MO','Also seen with the name Wally.','070.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (71,'Tilly','Tiger','Tigard','OR','','071.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (72,'Coco','Quahog','Warwick','RI','','072.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (73,'Snappy','Dragon','Southlake','TX','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (74,'Sue','T-Rex','South Loop (Chicago)','IL','Named for Chicago''s famed Sue the T-Rex.','074.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (75,'Rocky','Rock Dove / Pigeon','Rockridge (Oakland)','CA','','075.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (76,'Clementine','Cougar','Westfield','NJ','Store 601. Paired with Leopold the lobster.','076.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (77,'Leopold','Lobster','Westfield','NJ','Store 601. Paired with Clementine.','077.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (78,'Javier','Javelina','Phoenix Paradise Valley','AZ','Store 282. Replaced Penelope Peacock.','078.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (79,'Pepperjack','Race horse','Cypress','CA','Next to Los Alamitos Race Course.','079.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (80,'Ice','Polar bear','Charlottesville','VA','','080.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (81,'Chomps','Alligator','Jenkintown','PA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (82,'Flo','Flamingo','Madison','WI','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (83,'Mike','Tiger','Baton Rouge','LA','LSU mascot.','083.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (84,'Hamilton','Pig','Cincinnati','OH','Cincinnati was ''Porkopolis''; named for Hamilton County and the Flying Pig Marathon.','084.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (85,'Axel','Axolotl','Denville','NJ','Previously a Viking-lion combo. Kids vote.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (86,'Steven Sparkles','Unicorn','West Hollywood','CA','Harmonie-the-unicorn beanie baby.','086.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (87,'Vinny','Sea lion','Marina del Rey','CA','Lurks by vegetables; nod to main harbor.','087.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (88,'Phil','Parrot','Camarillo','CA','Store 114.','088.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (89,'Barnabus','Javelina','Surprise','AZ','','089.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (90,'Cosmo','Space dog','Halfmoon','NY','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (91,'Ollie','Otter','Walnut Creek','CA','Store 123.','091.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (92,'Ozzy','Otter','La Mesa / Grossmont','CA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (93,'Banjo','Bear','Mission Viejo','CA','','093.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (94,'Joey','Turtle','Sandy Springs','GA','','094.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (95,'Grace','Giraffe','Colorado Springs','CO','Named for Cheyenne Mountain Zoo giraffe herd. Has a sister giraffe on the sign.','095.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (96,'Edgar','Eagle','Bloomington','MN','','096.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (97,'Jawny','Raccoon','Philadelphia (Market & 22nd)','PA','','097.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (98,'Filbert','Duck','Nashua','NH','','098.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (99,'Mandy','Monkey','Costa Mesa','CA','Dressed as Santa.','099.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (100,'Paisley','Porcupine','Minneapolis','MN','','100.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (101,'Olly','Octopus','Newport News','VA','','101.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (102,'Herky','Hornet','Sacramento (Folsom Blvd)','CA','Sac State mascot.','102.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (103,'Schmooli','Shark','Lake Grove','NY','Store 556.','103.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (104,'Ozzy','Octopus','Evanston','IL','Purple octopus.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (105,'Tiramisu','Turtle','Stamford','CT','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (106,'Kody','Koala','Old Almaden (San Jose)','CA','Store 63.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (107,'Joe','Chicken','Marietta','GA','','107.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (108,'Alex and Mark','Monkey (x2)','Peachtree Corners (Norcross)','GA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (109,'Teddy Joe','Black teddy bear','Roswell','GA','','109.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (110,'Animal','Muppet / Animal','West Hollywood (Sunset Blvd)','CA','Store 192. Muppet-themed.','110.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (111,'James Gull','Seagull','Pacific Grove','CA','Named after late employee James Gill.','111.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (112,'Gully Joe','Seagull','Larchmont','NY','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (113,'Danny','Dolphin','Ashburn','VA','Store 619.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (114,'Maizy','Wolverine','Ann Arbor','MI','','114.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (115,'Miles and Maevis','Moose (x2)','Woodbury','MN','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (116,'Spaghetti','Yeti','Columbia','SC','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (117,'Raja','Cat / Tiger','Clackamas (Happy Valley)','OR','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (118,'Lex','Horse','Lexington','KY','','118.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (119,'Gnarly','Narwhal','Santa Cruz','CA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (120,'Wally','Walrus','Santa Barbara','CA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (121,'Felix','Fox','Denver','CO','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (122,'Ralphie','Buffalo','Boulder','CO','Store 301. CU Boulder mascot nod.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (123,'Flick','Lark','Larkspur','CA','New store in 2022.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (124,'Hank','Octopus','Pleasanton','CA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (125,'Myrtle','Turtle','Nashville (White Bridge)','TN','','125.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (126,'Wiggelow','Monkey','Queen Anne (Seattle)','WA','Store 135.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (127,'Rover','Raccoon','Huntsville','AL','Nod to Huntsville space program and ''Rocket City Trash Pandas'' baseball team.','127.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (128,'Billy','Black bear','Birmingham','AL','Store 737.','128.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (129,'Wolfie','Wolf','Reno','NV','University of Nevada Wolf Pack nod.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (130,'Charlie','Camel','Phoenix (Camelback Rd)','AZ','Store 90; named for Camelback Road and Camelback Mountain.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (131,'','T-Rex','Culver City Downtown','CA','Store 36. Opened July 2020.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (132,'Herman','Horseshoe crab','Newark','DE','Paired with Henrietta the hermit crab.','132.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (133,'Henrietta','Hermit crab','Newark','DE','Paired with Herman the horseshoe crab.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (134,'Betty','Yeti','Bellingham','WA','','134.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (135,'Cat','Coyote','Cathedral City','CA','Store 118. Replaced Felix the Frog.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (136,'Henrietta','Chicken','Petaluma','CA','Nod to Petaluma as former egg capital of the world.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (137,'Hidee','Yeti / Monkey','Rancho Cucamonga (Haven)','CA','Store 217.','137.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (138,'','Alligator','Stonestown (SF, near SFSU)','CA','SFSU mascot nod. Name unknown.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (139,'Parrot Joe','Parrot','Bellevue Downtown','WA','Store 162.','139.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (140,'Pearl','Pearl onion','Eagan','MN','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (141,'Sid','Sloth','College Ave (near SDSU)','CA','Near San Diego State University.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (142,'Alex','Fox','Acton','MA','Store 511.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (143,'Cacahuete','Elephant','Pasadena (Arroyo Pkwy)','CA','''Peanut'' in Spanish. This is the FIRST Trader Joe''s location ever.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (144,'CaraCara','Capybara','Williamsburg (Brooklyn)','NY','','144.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (145,'Marvin','Pigeon','Long Island City','NY','','145.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (146,'Carl','Crab','Lynnwood','WA','Store 129.','146.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (147,'Percy and Perry','Peregrine falcons (x2)','South Bend','IN','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (148,'Grant','Swan','Tucson (Grant & Swan)','AZ','Named for Grant Rd.','148.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (149,'Chip','Chipmunk','Beaverton Town Center','OR','Store 141. Has friends Rexy the dog and Clarice the sheep.','149.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (150,'Moto','Monkey','Tanasbourne (Hillsboro)','OR','Store 149.','150.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (151,'Bella','Pig','Allston','MA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (152,'Coba','Jaguar / Cheetah','Eastlake Chula Vista','CA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (153,'Nene','Goose','Rochester','MN','Store 718.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (154,'Sammy','Sea otter / sea lion','Hyannis','MA','','154.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (155,'JoeJoe','Frog','Fort Worth','TX','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (156,'Leslie','Lobster','Newington','NH','','156.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (157,'Javi','Javelina','Gilbert','AZ','Replaced Rocky the Roadrunner.','157.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (158,'Pearl','Squirrel','NW Portland','OR','Store 146. Wears a pearl necklace and TJ''s microtote.','158.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (159,'Snooty','Manatee','Sarasota','FL','Named after Snooty the manatee from the Manatee County aquarium.','159.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (160,'Javi','Javelina','Glendale','AZ','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (161,'Ollie','Octopus','Oceanside','CA','Store 22.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (162,'Eldingar','Viking','Ballard (Seattle)','WA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (163,'Lil'' Rocky','Rock (plush)','Little Rock','AR','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (164,'Lionel','Lion','Camp Hill','PA','','164.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (165,'Sara','Scorpion','Scottsdale','AZ','Store 94.','165.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (166,'Taylor','Sea turtle','Liberty Station (San Diego)','CA','Store 188. Point Loma area.','166.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (167,'Larry','Lizard','Woodbury (Irvine)','CA','Store 210.','167.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (168,'Confetti Yeti','Yeti','Silverdale','WA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (169,'Sparky','Sun Devil','Tempe (ASU University)','AZ','ASU mascot.','169.png',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (170,'Ringo','Lemur','Encinitas','CA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (171,'Kiwi','Kiwi','Scripps Ranch (San Diego)','CA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (172,'Lucille','Seal','SDSU (San Diego)','CA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (173,'Carmel','Race horse','Del Mar','CA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (174,'Whalen and Wanda','Whales (x2)','San Luis Obispo','CA','Store 41. Custom surfboard.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (175,'Freddie','Eagle','Eagle Rock (Los Angeles)','CA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (176,'Harry','Otter','Dallas (Far North)','TX','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (177,'Banjoe','Monkey','Fairfield','CT','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (178,'Bonnie','Koala','Stony Point (Richmond)','VA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (179,'Freddy','Fox','Fox Hills / Culver City','CA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (180,'Petey','Penguin','Torrance (Hawthorn Blvd)','CA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (181,'Pickles','Parrot','Santa Monica (23rd & Wilshire)','CA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (182,'Scoop and Penny','Pelicans (x2)','Manhattan Beach (Rosecrans)','CA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (183,'TJ','Turtle','Easton (Columbus)','OH','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (184,'Craig','Sandhill crane','Orlando','FL','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (185,'Parker','Peacock','Winter Park','FL','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (186,'Grover','Elk','Elk Grove','CA','Opened ~2004.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (187,'SJ Sharkie','Shark','Coleman (San Jose)','CA','Small replica of the San Jose Sharks mascot.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (188,'Peppa','Pig','Arlington','VA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (189,'Susan Bee Anthony','Bee','Rochester','NY','Bee dressed like Susan B. Anthony.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (190,'Terry','T-Rex','Tempe','AZ','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (191,'Maddie','Cow','Kent','WA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (192,'Midnight','Cow','Schaumburg (Woodfield Mall)','IL','Gives stickers to adults too.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (193,'Pronto','Longhorn','San Antonio (Basse Rd)','TX','Paired with Josephine as a second mascot.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (194,'Seymour','Seal','La Jolla','CA','Previously Pierre the pirate.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (195,'Holly','Hedgehog','Hollywood (Portland)','OR','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (196,'Charlie','Catamount','Burlington','VT','UVM mascot. No wild catamounts in VT anymore.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (197,'JoJo','Pony','Novato','CA','San Rafael may also have a JoJo.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (198,'Nutmeg','Groundhog','Elkridge (Columbia)','MD','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (199,'Chessie','Chessie','Towson','MD','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (200,'Cashew','Panda','Fort Wayne','IN','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (201,'Gorilla Joe','Gorilla','Park Ridge','IL','Store 698.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (202,'Shelby','Sea turtle','Virginia Beach','VA','Sometimes wears a bandana.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (203,'Wolfington','Wolf','Colonie','NY','Sports a Hawaiian shirt.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (204,'Iceberg','Penguin','South Hills (Pittsburgh)','PA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (205,'Quilliam','Porcupine','North Hills (Pittsburgh)','PA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (206,'Pearl','Parrot','Glendale','CA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (207,'Banjo','Bat','Austin','TX','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (208,'Mike','Monkey','Reston','VA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (209,'Nessie','Loch Ness Monster','Somerville','MA','Wears a kilt with bagpipes.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (210,'Pierre','Peacock','Rancho Palos Verdes (Golden Cove)','CA',' — Verified by David''s photo 4/22/2026.','210.jpg',TRUE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (211,'Ringo','Ringtail (lemur plush)','Ahwatukee','AZ','Store 177.',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (212,'Iggy','Iguana','Mesa','AZ','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (213,'Wally','Whale','Rancho Palos Verdes','CA','',NULL,FALSE,FALSE,'https://www.reddit.com/r/traderjoes/comments/z1ez6m/mascot_megathread_request_looking_for_information/',NULL,NULL),
  (214,'Davis the Duck','Duck','University Mall (Davis) — RETIRED','CA','RETIRED: replaced by Agnes the Cow in July 2019. Historical only.',NULL,FALSE,TRUE,'https://theaggie.org/2019/08/22/davis-trader-joes-adopts-new-store-mascot-agnes-the-cow/',NULL,NULL),
  (215,'Ruby','Swan','Toluca Lake','CA','CURRENT mascot as of April 2026 (replaced Weasley the Tiger). White swan with orange beak, ''TRADER JOE''S RUBY CREW MEMBER'' red nametag. Photographed in a pink carry basket.','215.jpg',TRUE,FALSE,'User-submitted: David (04/22/2026)',NULL,NULL),
  (216,'Comose','Llama','Concord','CA','Playful ''cómo se llama'' pun. Light tan plush with ''TRADER JOE''S COMOSE CREW MEMBER'' red nametag, perched on a wooden crate.','216.jpg',TRUE,FALSE,'User-submitted: David (04/22/2026)',NULL,NULL),
  (217,'Clyde','Gorilla','Canoga Park','CA','Dark brown gorilla plush in a pink Hawaiian shirt with butterflies and stars. Red ''CLYDE CREW MEMBER'' nametag.','217.jpg',TRUE,FALSE,'User-submitted: David (04/22/2026)',NULL,NULL),
  (218,'Josie','Octopus','Studio City','CA','Orange/yellow octopus with teal suckers, draped over a chest freezer. ''JOSIE CREW MEMBER'' nametag.','218.jpg',TRUE,FALSE,'User-submitted: David (04/22/2026)',NULL,NULL),
  (219,'Hoppy','Hummingbird','Vista','CA','Male ruby-throated hummingbird plush (green back, red throat). Perched among Autumnal Harvest jars. ''HOPPY CREW MEMBER'' nametag.','219.jpg',TRUE,FALSE,'User-submitted: David (04/22/2026)',NULL,NULL),
  (220,'Peter','Anteater','Campus Dr (Irvine — UCI)','CA','Store 111. Pink anteater plush — direct nod to UC Irvine''s official mascot ''Peter the Anteater'' (UCI''s mascot since 1965). Photographed in a ''HAPPY NEW YEAR'' crown + blue tuxedo, and separately in a UCLA-style baseball jersey.','220.jpg',TRUE,FALSE,'User-submitted: David (04/23/2026)',NULL,NULL),
  (221,'Woolly','Woolly Mammoth','La Brea (Los Angeles)','CA','Store 31, 263 S La Brea Ave. This store has TWO mascots — paired with Jake the Shark. Woolly is a brown wooly mammoth with long white tusks.','221.jpg',TRUE,FALSE,'User-submitted: David (04/23/2026)',NULL,NULL),
  (222,'Jake','Shark','La Brea (Los Angeles)','CA','Store 31, 263 S La Brea Ave. Paired with Woolly the Mammoth — this store has two mascots. Jake is a teal shark Squishmallow-style plush in a Hawaiian shirt.','222.jpg',TRUE,FALSE,'User-submitted: David (04/23/2026)',NULL,NULL),
  (223,'Bruce','Shark','Riverside Dr North (Sherman Oaks)','CA','Store 49, 14119 Riverside Dr. Gray striped shark. Seen in an Easter basket with bunny ears in the spring — this store dresses Bruce up for holidays.','223.jpg',TRUE,FALSE,'User-submitted: David (04/23/2026)',NULL,NULL),
  (224,'Ringo','Raccoon','Riverside Dr South (Sherman Oaks)','CA','Store 267, 14140 Riverside Dr. Note: different Ringo than Claremont''s Ringo the Raccoon (Row 35) — both stores named their raccoon Ringo.','224.jpg',TRUE,FALSE,'User-submitted: David (04/23/2026)',NULL,NULL),
  (225,'Ollie','Otter','Culver Dr (Irvine)','CA','Store 37, 14443 Culver Dr. Small brown otter plush in a blue-and-white winter hat and scarf. Note: different Ollie than Long Beach Bellflower''s Ollie the Octopus (Row 51).','225.jpg',TRUE,FALSE,'User-submitted: David (04/23/2026)',NULL,NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  animal = EXCLUDED.animal,
  store = EXCLUDED.store,
  state = EXCLUDED.state,
  notes = EXCLUDED.notes,
  photo = EXCLUDED.photo,
  has_photo = EXCLUDED.has_photo,
  retired = EXCLUDED.retired,
  source_url = EXCLUDED.source_url,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  updated_at = now();

-- Done. Run this whole script once; re-running is safe.
