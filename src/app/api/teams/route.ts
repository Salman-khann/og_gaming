import { connection } from 'next/server';
import { apiError, ApiError, requireProfile, jsonObject, sameOrigin, textField, uuidField } from '@/lib/api';
import { communityAction } from '@/lib/community';
import { verifyFaceitPlayer } from '@/lib/faceit';
import { rateLimit } from '@/lib/rate-limit';
export async function GET() {
  await connection();
  try {
    const { db,profile } = await requireProfile();
    const [owned, members] = await Promise.all([db.from('teams').select('id,name,captain_id,created_at').eq('captain_id',profile.id).limit(5), db.from('team_members').select('*').order('created_at').limit(500)]);
    if (owned.error || members.error) throw new ApiError('Unable to load teams.', 503);
    const ids=[...new Set([...(owned.data||[]).map(team=>team.id),...(members.data||[]).map(member=>member.team_id)])];
    const teams=ids.length?await db.from('teams').select('id,name,captain_id,created_at').in('id',ids).order('created_at',{ascending:false}).limit(500):{data:[],error:null};
    if(teams.error)throw teams.error;
    return Response.json({ teams: teams.data, members: members.data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request); const body = await jsonObject(request); const { profile } = await requireProfile();
    await rateLimit(request, 'team-action', 20, 60, profile.id);
    const action = textField(body.action, 'action', 30);
    let payload: Record<string, unknown>;
    if (action === 'create_team') payload = { name: textField(body.name, 'team name', 80) };
    else if (action === 'accept') payload = { invitation_id: uuidField(body.invitation_id, 'invitation') };
    else if (action === 'invite') {
      const player = await verifyFaceitPlayer(textField(body.nickname, 'FACEIT player', 200));
      payload = { team_id: uuidField(body.team_id, 'team'), faceit_id: player.id, nickname: player.nickname };
    } else if (action === 'remove_member') payload = { team_id: uuidField(body.team_id, 'team'), member_id: uuidField(body.member_id, 'member') };
    else throw new ApiError('Unknown team action.');
    return Response.json({ success: true, result: await communityAction(profile.id, action, payload) });
  } catch (error) { return apiError(error); }
}
