import { createClient } from '@/lib/supabase/server';
import { connection } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError, ApiError, requireProfile, sameOrigin, uuidField, integer, jsonObject } from '@/lib/api';
import { buildPairedBracket, validatePairings } from '@/lib/bracket-pairings';
import { validSeriesScore } from '@/lib/bracket-series';
import { dispatchAfterResponse } from '@/lib/notifications';
async function eligibleEntrants(eventId: string) {
  const admin = createAdminClient();
  const { data: teams, error } = await admin.from('registrations').select('id,team_name,captain_id,roster_details,amount_due,payment_status').eq('tournament_id', eventId).eq('status', 'approved').eq('checked_in', true).eq('no_show', false).order('created_at').order('id').limit(128);
  if (error) throw new ApiError('Unable to load bracket entrants.', 503);
  const entries = teams || [];
  const faces = entries.flatMap(team => team.roster_details.map((player: { faceit_id?: string }) => player.faceit_id).filter(Boolean));
  const captains = entries.map(team => team.captain_id).filter((id: unknown): id is string => typeof id === 'string');
  const [bannedCaptains, bannedPlayers] = await Promise.all([
    captains.length ? admin.from('profiles').select('id').eq('role', 'banned').in('id', captains) : Promise.resolve({ data: [], error: null }),
    faces.length ? admin.from('profiles').select('faceit_id').eq('role', 'banned').in('faceit_id', faces) : Promise.resolve({ data: [], error: null }),
  ]);
  if (bannedCaptains.error || bannedPlayers.error) throw new ApiError('Unable to verify entrant eligibility.', 503);
  const captainBans = new Set((bannedCaptains.data || []).map(player => player.id)), faceBans = new Set((bannedPlayers.data || []).map(player => player.faceit_id));
  return entries.filter(team => !captainBans.has(team.captain_id) && !team.roster_details.some((player: { faceit_id?: string }) => faceBans.has(player.faceit_id)) && (Number(team.amount_due) === 0 || team.payment_status === 'verified'));
}
export async function GET(request: Request) {
  await connection();
  try {
    const params = new URL(request.url).searchParams;
    const id = uuidField(params.get('tournament_id'), 'tournament');
    const manage = params.get('manage') === '1';
    if (manage) await requireProfile(true);
    const db = await createClient();
    const { data: tournament } = await db.from('tournaments').select('id').eq('id', id).single();
    if (!tournament) throw new ApiError('Tournament not found.', 404);
    const [games, teams] = await Promise.all([db.from('tournament_matches').select('*').eq('tournament_id', id).order('round').order('position').limit(256), db.from('registrations').select('id,team_name,captain_id').eq('tournament_id', id).eq('status', 'approved').limit(128)]);
    if (games.error || teams.error) throw new ApiError('Unable to load the bracket.', 503);
    const eligibleTeams = manage ? (await eligibleEntrants(id)).map(team => ({ id: team.id, team_name: team.team_name })) : undefined;
    return Response.json({ matches: games.data, teams: teams.data, eligibleTeams }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request); await requireProfile(true);
    const body = await jsonObject(request);
    const eventId = uuidField(body.tournament_id, 'tournament');
    const admin = createAdminClient();
    const { data: tournament, error: eventError } = await admin.from('tournaments').select('bracket_type').eq('id', eventId).single();
    if (eventError || !tournament) throw new ApiError('Unable to load the tournament.', 503);
    const entrants = await eligibleEntrants(eventId);
    if(entrants.length<2)throw new ApiError('At least two eligible, paid and checked-in teams are required.');
    let graph;
    try { graph = buildPairedBracket(entrants.map(team => team.id), tournament.bracket_type, body.pairings); }
    catch (error) { throw new ApiError(error instanceof Error ? error.message : 'Invalid matchups.'); }
    const { error } = await admin.rpc('create_competition_bracket', { event_id: eventId, graph });
    if (error) throw new ApiError(error.message, 409);
    dispatchAfterResponse();
    return Response.json({ success: true });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request); await requireProfile(true);
    const body = await jsonObject(request);
    if (body.action === 'set_pairings') {
      const eventId = uuidField(body.tournament_id, 'tournament'), admin = createAdminClient();
      const opening = await admin.from('tournament_matches').select('team_a,team_b').eq('tournament_id', eventId).eq('bracket', 'winners').eq('round', 1).order('position');
      if (opening.error) throw new ApiError('Unable to load opening matches.', 503);
      const ids = (opening.data || []).flatMap(match => [match.team_a, match.team_b]).filter((id): id is string => typeof id === 'string');
      let pairings;
      try { pairings = validatePairings(body.pairings, ids, opening.data?.length); }
      catch (error) { throw new ApiError(error instanceof Error ? error.message : 'Invalid matchups.'); }
      const result = await admin.rpc('set_competition_pairings', { event_id: eventId, pairings });
      if (result.error) throw new ApiError(result.error.message, 409);
      return Response.json({ success: true });
    }
    if (body.action === 'clear_result') {
      const { error } = await createAdminClient().rpc('clear_competition_result', { game_id: uuidField(body.match_id, 'match') });
      if (error) throw new ApiError(error.message, 409);
      return Response.json({ success: true });
    }
    if (body.action !== undefined) throw new ApiError('Invalid bracket action.');
    const a = integer(body.score_a, 0, 2), b = integer(body.score_b, 0, 2);
    if (!validSeriesScore(a, b)) throw new ApiError('A BO3 result must be 2–0, 2–1, 1–2 or 0–2. Enter maps won, not rounds.');
    const { error } = await createAdminClient().rpc('record_competition_result', { game_id: uuidField(body.match_id, 'match'), a_score: a, b_score: b });
    if (error) throw new ApiError(error.message, 409);
    return Response.json({ success: true });
  } catch (error) { return apiError(error); }
}
