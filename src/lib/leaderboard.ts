import { createAdminClient } from './supabase/admin';
import { getFaceitPlayerById } from './faceit';
import { statNumber } from './faceit-stats';
import { after } from 'next/server';
export type LeaderboardPlayer = {
  faceit_id: string;
  nickname: string;
  level: number;
  elo: number;
  matches: number | null;
  wins: number | null;
  win_rate: number | null;
  kd_ratio: number | null;
  headshot_rate: number | null;
  stats_updated_at: string | null;
  updated_at: string;
};
const inFlight = new Map<string, Promise<void>>();
export async function refreshLeaderboardPlayer(id: string) {
  if (inFlight.has(id)) return inFlight.get(id);
  const task = (async () => {
    const admin = createAdminClient();
    const { data: cached, error: cacheError } = await admin
      .from('faceit_leaderboard')
      .select('updated_at,stats_updated_at')
      .eq('faceit_id', id)
      .maybeSingle();
    if (cacheError) throw cacheError;
    if (
      cached?.stats_updated_at &&
      Date.now() - Date.parse(cached.updated_at) < 900000 &&
      Date.now() - Date.parse(cached.stats_updated_at) < 900000
    )
      return;
    const gate = await admin.rpc('consume_rate_limit', {
      bucket_key: 'faceit-player-refresh:' + id,
      allowed: 1,
      window_seconds: 60,
    });
    if (gate.error) throw gate.error;
    if (!gate.data) return;
    const globalGate = await admin.rpc('consume_rate_limit', {
      bucket_key: 'faceit-global-refresh',
      allowed: 30,
      window_seconds: 60,
    });
    if (globalGate.error || !globalGate.data) return;
    const player = await getFaceitPlayerById(id, true);
    if (!player || player.id !== id) return;
    let lifetime: Record<string, unknown> | null = null;
    try {
      const response = await fetch(
        'https://open.faceit.com/data/v4/players/' + encodeURIComponent(id) + '/stats/cs2',
        {
          headers: { Authorization: 'Bearer ' + process.env.FACEIT_API_KEY },
          cache: 'no-store',
          signal: AbortSignal.timeout(6000),
        },
      );
      if (response.ok) lifetime = (await response.json()).lifetime || null;
    } catch {
      /* Preserve previously verified stats during API outages. */
    }
    const now = new Date().toISOString();
    const stats = lifetime
      ? {
          matches: statNumber(lifetime.Matches),
          wins: statNumber(lifetime.Wins),
          win_rate: statNumber(lifetime['Win Rate %']),
          kd_ratio: statNumber(lifetime['Average K/D Ratio']),
          headshot_rate: statNumber(lifetime['Average Headshots %']),
          stats_updated_at: now,
        }
      : {};
    const { error } = await admin.from('faceit_leaderboard').upsert({
      faceit_id: id,
      nickname: player.nickname,
      level: player.level,
      elo: player.elo,
      ...stats,
      updated_at: now,
    });
    if (error) throw new Error('Unable to save FACEIT leaderboard stats.');
  })();
  inFlight.set(id, task);
  try {
    await task;
  } finally {
    inFlight.delete(id);
  }
}
export async function readLeaderboard(page = 1) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('read_faceit_ranking', {
    page_number: page,
    page_size: 25,
  });
  if (error) throw error;
  // Public reads must not multiply provider calls across app instances.
  after(async () => {
    try {
      const gate = await admin.rpc('consume_rate_limit', {
        bucket_key: 'leaderboard-background-refresh',
        allowed: 1,
        window_seconds: 60,
      });
      if (gate.error || !gate.data) return;
      const candidates = await admin.rpc('faceit_refresh_candidates', { batch_size: 8 });
      if (candidates.error) throw new Error('Unable to load refresh candidates.');
      const stale = (candidates.data || []) as { faceit_id: string }[];
      for (let index = 0; index < stale.length; index += 4)
        await Promise.allSettled(
          stale.slice(index, index + 4).map((row) => refreshLeaderboardPlayer(row.faceit_id)),
        );
    } catch {
      console.error('Leaderboard refresh deferred to the next worker run.');
    }
  });
  return data as { players: LeaderboardPlayer[]; total: number; page: number };
}
