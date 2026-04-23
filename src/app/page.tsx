import { getMascots, getStores } from '@/lib/data';
import SiteShell from '@/components/SiteShell';

// Static export: the mascot list is fetched from Supabase at BUILD time and
// baked into the HTML. New submissions become visible on the next rebuild,
// which is triggered by a webhook when you approve one in Supabase.
export const dynamic = 'force-static';

export default async function HomePage() {
  const [mascots, stores] = await Promise.all([getMascots(), getStores()]);
  return <SiteShell mascots={mascots} stores={stores} />;
}
