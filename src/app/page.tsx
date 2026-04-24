import { getMascots, getPreviousMascots, getStores } from '@/lib/data';
import SiteShell from '@/components/SiteShell';

// Static export: the mascot list is read from the JSON data file at BUILD
// time and baked into the HTML. Updates become visible on the next rebuild,
// which happens whenever you push to main.
export const dynamic = 'force-static';

export default async function HomePage() {
  const [mascots, stores, previousMascots] = await Promise.all([
    getMascots(),
    getStores(),
    getPreviousMascots(),
  ]);
  return <SiteShell mascots={mascots} stores={stores} previousMascots={previousMascots} />;
}
