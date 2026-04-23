/**
 * Supabase client. Both the client-side SDK (browser) and the server-side SDK
 * (Next.js route handlers / server components) use the same publishable key
 * because Row Level Security policies do the access-control work.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  if (!url || !key) return null;
  _client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return _client;
}

export const SUPABASE_CONFIGURED = Boolean(url && key);
