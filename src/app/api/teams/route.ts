import { connection } from 'next/server';
import {
  apiError,
  ApiError,
  requireProfile,
  jsonObject,
  sameOrigin,
  textField,
  uuidField,
  integer,
  dbError,
} from '@/lib/api';
import { communityAction } from '@/lib/community';
import { verifyFaceitPlayer, FaceitError } from '@/lib/faceit';
import { rateLimit } from '@/lib/rate-limit';
export async function GET(request: Request) {
  await connection();
  try {
    const { db } = await requireProfile();
    const page = integer(new URL(request.url).searchParams.get('page') || 1, 1, 10000);
    const result = await db.rpc('read_my_teams', { page_number: page, page_size: 25 });
    if (result.error) throw dbError(result.error);
    return Response.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await jsonObject(request);
    const { profile } = await requireProfile();
    await rateLimit(request, 'team-action', 20, 60, profile.id);
    const action = textField(body.action, 'action', 30);
    let payload: Record<string, unknown>;
    if (action === 'create_team') payload = { name: textField(body.name, 'team name', 80) };
    else if (action === 'accept')
      payload = { invitation_id: uuidField(body.invitation_id, 'invitation') };
    else if (action === 'invite') {
      let player;
      try {
        player = await verifyFaceitPlayer(textField(body.nickname, 'FACEIT player', 200));
      } catch (error) {
        if (error instanceof FaceitError) throw new ApiError(error.message, error.status);
        throw error;
      }
      payload = {
        team_id: uuidField(body.team_id, 'team'),
        faceit_id: player.id,
        nickname: player.nickname,
      };
    } else if (action === 'remove_member')
      payload = {
        team_id: uuidField(body.team_id, 'team'),
        member_id: uuidField(body.member_id, 'member'),
      };
    else throw new ApiError('Unknown team action.');
    return Response.json({
      success: true,
      result: await communityAction(profile.id, action, payload),
    });
  } catch (error) {
    return apiError(error);
  }
}
