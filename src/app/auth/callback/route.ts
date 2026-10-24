import { createClient } from '@/lib/supabase/server';
import { loginFailure, siteOrigin } from '@/lib/provider-auth';
import { getFaceitPlayerById } from '@/lib/faceit';
import { createAdminClient } from '@/lib/supabase/admin';
import { refreshLeaderboardPlayer } from '@/lib/leaderboard';
import { after } from 'next/server';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (url.searchParams.has('error'))
    return loginFailure(request, 'FACEIT did not authorize this login. Please try again.');
  if (code) {
    try {
      const db = await createClient();
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error) {
        const {
          data: { user },
        } = await db.auth.getUser();
        const identity = user?.identities?.find(
          (identity) => identity.provider === 'custom:faceit',
        );
        const playerId = identity?.identity_data?.sub || identity?.id;
        if (user && typeof playerId === 'string') {
          // Provider identities are verified by Auth; editable user metadata is
          // never used to bind a FACEIT ID or assign a role.
          const player = await getFaceitPlayerById(playerId);
          if (player && player.id === playerId) {
            const { error: profileError } = await createAdminClient()
              .from('profiles')
              .update({
                faceit_id: player.id,
                faceit_nickname: player.nickname,
                faceit_avatar_url: player.avatar,
                faceit_level: player.level,
                faceit_elo: player.elo,
                updated_at: new Date().toISOString(),
              })
              .eq('id', user.id);
            if (profileError) console.error('Unable to refresh verified FACEIT skill data.');
            else
              after(async () => {
                try {
                  await refreshLeaderboardPlayer(player.id);
                } catch {
                  console.error('FACEIT statistics refresh deferred.');
                }
              });
          }
        }
        const { data: profile } = user
          ? await db.from('profiles').select('role').eq('id', user.id).single()
          : { data: null };
        if (!profile || profile.role === 'banned') {
          await db.auth.signOut();
          return loginFailure(request, 'This account cannot log in.');
        }
        return Response.redirect(
          new URL(profile?.role === 'admin' ? '/admin' : '/matches', siteOrigin(request)),
          303,
        );
      }
      console.error('OAuth session exchange failed:', error.code || error.name);
    } catch {
      /* Expired links or missing configuration return to login. */
    }
  }
  return loginFailure(request, 'Login could not be completed. Please try again.');
}
