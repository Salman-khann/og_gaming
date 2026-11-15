import { connection } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { apiError, ApiError } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { dispatchNotifications } from '@/lib/notifications';
import { refreshLeaderboardPlayer } from '@/lib/leaderboard';
import { getFaceitPlayerById } from '@/lib/faceit';
import { drainScorecardCleanup } from '@/lib/storage-cleanup';
export const maxDuration = 60;
export async function GET(request: Request) {
  await connection();
  try {
    const expected = process.env.CRON_SECRET;
    const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '');
    if (
      !expected ||
      !supplied ||
      Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    )
      throw new ApiError('Worker authorization required.', 401);
    const deadline = Date.now() + 50000;
    const maintenanceDb = createAdminClient(4000);
    const [cleanup, purged] = await Promise.allSettled([
      drainScorecardCleanup(),
      maintenanceDb.rpc('purge_old_operations').then((result) => {
        if (result.error) throw new Error('Queue maintenance failed.');
        return result.data;
      }),
    ]);
    const profileSignal = AbortSignal.timeout(Math.max(1, deadline - Date.now() - 10000));
    const admin = createAdminClient(4000, profileSignal);
    let profileRefreshFailed = false;
    try {
      const { data: profiles, error } = await admin
        .from('profiles')
        .select('id,faceit_id')
        .not('faceit_id', 'is', null)
        .neq('role', 'banned')
        .order('faceit_refresh_attempted_at', { nullsFirst: true })
        .order('id')
        .limit(8);
      if (error) throw error;
      for (let index = 0; index < (profiles || []).length; index += 4) {
        if (Date.now() > deadline - 25000 || profileSignal.aborted) break;
        const refreshed = await Promise.allSettled(
          (profiles || []).slice(index, index + 4).map(async (profile) => {
            const { error: attemptError } = await admin
              .from('profiles')
              .update({ faceit_refresh_attempted_at: new Date().toISOString() })
              .eq('id', profile.id);
            if (attemptError) throw new Error('Unable to record profile refresh attempt.');
            const player = await getFaceitPlayerById(profile.faceit_id, true, profileSignal);
            if (player) {
              await admin
                .from('profiles')
                .update({
                  faceit_level: player.level,
                  faceit_elo: player.elo,
                  faceit_nickname: player.nickname,
                  faceit_avatar_url: player.avatar,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', profile.id)
                .eq('faceit_id', player.id);
              await refreshLeaderboardPlayer(player.id, deadline - 10000, profileSignal);
            }
          }),
        );
        if (refreshed.some((result) => result.status === 'rejected')) profileRefreshFailed = true;
      }
    } catch {
      profileRefreshFailed = true;
    }
    let notifications: { delivered: number; configured: boolean; failed?: boolean };
    try {
      notifications = await dispatchNotifications(0, deadline);
    } catch {
      notifications = { delivered: 0, configured: true, failed: true };
    }
    return Response.json(
      {
        ...notifications,
        cleanup: cleanup.status === 'fulfilled' ? cleanup.value : { failed: true },
        maintenanceFailed: purged.status === 'rejected',
        profileRefreshFailed,
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
