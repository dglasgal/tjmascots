import type { Metadata } from 'next';
import { getMascots, getPreviousMascots, getStores } from '@/lib/data';
import { SITE_URL } from '@/lib/site-url';
import SiteShell from '@/components/SiteShell';

// Static export: the mascot list is read from the JSON data file at BUILD
// time and baked into the HTML. Updates become visible on the next rebuild,
// which happens whenever you push to main.
export const dynamic = 'force-static';

// Self-referencing canonical for the homepage so Google treats
// https://tjmascots.com/ as the one true URL (no trailing-slash / query
// duplicates). Title/description live in layout.tsx's default metadata.
export const metadata: Metadata = {
  alternates: { canonical: `${SITE_URL}/` },
};

export default async function HomePage() {
  const [mascots, stores, previousMascots] = await Promise.all([
    getMascots(),
    getStores(),
    getPreviousMascots(),
  ]);
  return <SiteShell mascots={mascots} stores={stores} previousMascots={previousMascots} />;
}
