import { connection } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { apiError, ApiError } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { dispatchNotifications } from '@/lib/notifications';
import { refreshLeaderboardPlayer } from '@/lib/leaderboard';
import { getFaceitPlayerById } from '@/lib/faceit';
export const maxDuration=60;
export async function GET(request: Request) {
  await connection();
  try {
    const expected = process.env.CRON_SECRET;
    const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '');
    if (!expected || !supplied || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) throw new ApiError('Worker authorization required.', 401);
    const admin = createAdminClient();
    const { error: cleanupError } = await admin.rpc('release_tournament_no_shows');
    if (cleanupError) throw new Error('No-show processing failed.');
    const { data: profiles, error } = await admin.from('profiles').select('id,faceit_id').not('faceit_id','is',null).neq('role','banned').order('faceit_refresh_attempted_at',{nullsFirst:true}).order('id').limit(8);
    if (error) throw error;
    for (let index=0;index<(profiles||[]).length;index+=4) await Promise.allSettled((profiles||[]).slice(index,index+4).map(async profile=>{
      const {error:attemptError}=await admin.from('profiles').update({faceit_refresh_attempted_at:new Date().toISOString()}).eq('id',profile.id);
      if(attemptError)throw new Error('Unable to record profile refresh attempt.');
      const player = await getFaceitPlayerById(profile.faceit_id,true);
      if (player) {
        await admin.from('profiles').update({ faceit_level: player.level, faceit_elo: player.elo, faceit_nickname: player.nickname, faceit_avatar_url: player.avatar, updated_at: new Date().toISOString() }).eq('id',profile.id).eq('faceit_id', player.id);
        await refreshLeaderboardPlayer(player.id);
      }
    }));
    return Response.json(await dispatchNotifications(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
