import { getMascots, getStores } from '@/lib/data';
import SiteShell from '@/components/SiteShell';

// Revalidate at request time so Supabase-sourced data stays fresh
export const revalidate = 60;

export default async function HomePage() {
  const [mascots, stores] = await Promise.all([getMascots(), getStores()]);
  return <SiteShell mascots={mascots} stores={stores} />;
}
