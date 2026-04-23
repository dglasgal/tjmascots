# TJ Mascots

The unofficial fan map of every Trader Joe's hidden plush mascot.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** for styling
- **Leaflet / react-leaflet** for the map (upgradeable to Mapbox via env var)
- **Framer Motion** for transitions
- **Supabase** planned for the database + photo storage (currently reads from bundled JSON)

## Run locally

Requires Node 18+ (Node 20 recommended). From this folder:

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy `.env.example` to `.env.local` and fill in real values when you create the supporting accounts:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_MAPBOX_TOKEN=...
SUPABASE_SERVICE_ROLE_KEY=...   # server only, never exposed to browser
NEXT_PUBLIC_SITE_EMAIL=david@7ate9.com
```

The app works without any env vars — it falls back to the bundled seed data in `src/data/`.

## Project layout

```
src/
  app/
    layout.tsx          # Root layout, fonts, meta tags
    page.tsx            # Home page — server component, loads data
    globals.css         # Tailwind + custom pin styles
  components/
    SiteShell.tsx       # Client root — orchestrates state
    Header.tsx          # Logo + search + submit button
    MapView.tsx         # Leaflet map with pins (dynamic-imported, client-only)
    MascotCard.tsx      # Right-side sliding card
    SubmitModal.tsx     # Submission form modal
  lib/
    data.ts             # Data provider — Supabase if env vars set, else JSON
    search.ts           # Search index + ranking
    emoji.ts            # Animal → emoji lookup
    types.ts            # Mascot + Store types
  data/
    mascots.json        # 225 mascot seed records
    tj-stores.json      # 647 Trader Joe's stores scraped from locations.traderjoes.com
public/
  photos/               # Named by Row # (001.png, 002.jpg, …)
```

## Supabase setup

The first time you connect to a fresh Supabase project, run the migration to create tables + RLS + seed data:

1. Open your Supabase project's **SQL Editor**
2. Open `supabase-migration.sql` from this folder
3. Paste the whole file into the editor
4. Click **Run**

This creates two tables (`mascots`, `submissions`), two storage buckets (`mascot-photos` public, `submissions` private), RLS policies, and seeds the mascots table with all 225 rows from `src/data/mascots.json`.

The migration is idempotent — safe to re-run after the seed data changes.

## Deploy

Planned: DigitalOcean App Platform connected to GitHub. Env vars set in the App Platform dashboard. Custom domain `tjmascots.com` pointed via CNAME.

## Fan project disclaimer

Not affiliated with Trader Joe's Company. "Trader Joe's" is a trademark of Trader Joe's Company.
Photos sourced from Reddit carry attribution to the original poster and a link back to the thread; takedown requests go to the contact email.
