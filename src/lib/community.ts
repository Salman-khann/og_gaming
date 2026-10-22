import { createAdminClient } from './supabase/admin';
import { ApiError } from './api';
import { getFaceitPlayerById } from './faceit';
export async function communityAction(actorId: string, action: string, payload: Record<string, unknown>) {
  const { data, error } = await createAdminClient().rpc('community_action', { actor_id: actorId, action_name: action, payload });
  if (error) throw new ApiError(error.code === '23505' ? 'This player is already on the roster.' : error.message, 409);
  return data;
}
export async function ownedRoster(actorId: string, teamId: string) {
  const db = createAdminClient();
  const { data: team, error } = await db.from('teams').select('id,name,captain_id').eq('id', teamId).single();
  if (error || !team || team.captain_id !== actorId) throw new ApiError('Only the team captain can use this roster.', 403);
  const { data: members, error: memberError } = await db.from('team_members').select('faceit_id,user_id').eq('team_id', teamId).eq('status', 'accepted');
  if (memberError || members?.length !== 5) throw new ApiError('Five players must accept their FACEIT roster invitations.');
  const players = await Promise.all(members.map(member => getFaceitPlayerById(member.faceit_id, true)));
  if (players.some(player => !player)) throw new ApiError('Unable to refresh the FACEIT roster. Please try again.', 503);
  const roster = players.map(player => ({ faceit_id: player!.id, nickname: player!.nickname, level: player!.level, elo: player!.elo }));
  for(let index=0;index<members.length;index++) {
    const {error:refreshError}=await db.from('profiles').update({faceit_level:roster[index].level,faceit_elo:roster[index].elo,faceit_nickname:roster[index].nickname,updated_at:new Date().toISOString()}).eq('id',members[index].user_id).eq('faceit_id',roster[index].faceit_id);
    if(refreshError) throw new ApiError('Unable to refresh roster eligibility.',503);
  }
  return { team, roster };
}
