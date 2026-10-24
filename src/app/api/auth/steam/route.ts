import { siteOrigin, startSteamState, loginFailure } from '@/lib/provider-auth';
import { steamLoginUrl } from '@/lib/steam-openid';
import { createAdminClient } from '@/lib/supabase/admin';
export async function GET(request: Request) {
  try {
    createAdminClient();
    const callback = new URL('/api/auth/steam/callback', siteOrigin(request));
    callback.searchParams.set('state', await startSteamState());
    return Response.redirect(steamLoginUrl(callback.toString()), 303);
  } catch {
    return loginFailure(request, 'Steam login is not configured yet.');
  }
}
