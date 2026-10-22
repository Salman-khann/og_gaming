import { createClient } from '@/lib/supabase/server';
import { siteOrigin, loginFailure } from '@/lib/provider-auth';
export async function GET(request: Request) {
  try {
    const db = await createClient();
    const { data, error } = await db.auth.signInWithOAuth({ provider: 'custom:faceit', options: { scopes: 'openid profile email', redirectTo: new URL('/auth/callback', siteOrigin(request)).toString(), skipBrowserRedirect: true } });
    if (error || !data.url) throw new Error('FACEIT login is not configured yet.');
    return Response.redirect(data.url, 303);
  } catch { return loginFailure(request, 'FACEIT login is not configured yet. Please use email or Steam.'); }
}
