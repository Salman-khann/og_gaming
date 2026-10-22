import 'server-only';
import { createClient } from '@supabase/supabase-js';
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || (!key.startsWith('eyJ') && !key.startsWith('sb_secret_'))) throw new Error('Service role key is required for verified registrations.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
