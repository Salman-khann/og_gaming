import { createClient } from '@/lib/supabase/server';
import { connection } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  apiError,
  ApiError,
  requireProfile,
  sameOrigin,
  uuidField,
  integer,
  jsonObject,
  dbError,
} from '@/lib/api';
import { buildPairedBracket, validatePairings } from '@/lib/bracket-pairings';
import { validSeriesScore } from '@/lib/bracket-series';
import { scheduleMatches, validateSchedule } from '@/lib/bracket-schedule';
import type { TournamentMatch } from '@/types';
import { verifyBracketResetPassword } from '@/lib/bracket-reset-password';
import { rateLimit } from '@/lib/rate-limit';
import { SCORECARD_BUCKET } from '@/lib/scorecard-image';
import { dispatchAfterResponse } from '@/lib/notifications';
async function eligibleEntrants(eventId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('eligible_registrations', { event_id: eventId });
  if (error) throw new ApiError('Unable to verify bracket entrants.', 503);
  return (data || []) as {
    id: string;
    team_name: string;
    captain_id: string | null;
    roster_details: { faceit_id?: string }[];
    amount_due: number;
    payment_status: string;
  }[];
}
export async function GET(request: Request) {
  await connection();
  try {
    const params = new URL(request.url).searchParams;
    const id = uuidField(params.get('tournament_id'), 'tournament');
    const manage = params.get('manage') === '1';
    if (manage) await requireProfile(true);
    const db = await createClient();
    const { data: tournament, error: tournamentError } = await db
      .from('tournaments')
      .select('id,start_date,bracket_schedule')
      .eq('id', id)
      .single();
    if (tournamentError && tournamentError.code !== 'PGRST116')
      throw new ApiError(
        'Unable to load tournament schedule. Apply the latest database migration.',
        503,
      );
    if (!tournament) throw new ApiError('Tournament not found.', 404);
    const [games, teams] = await Promise.all([
      db
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', id)
        .order('round')
        .order('position')
        .limit(256),
      db
        .from('public_registrations')
        .select('id,team_name')
        .eq('tournament_id', id)
        .eq('status', 'approved')
        .limit(128),
    ]);
    if (games.error || teams.error) throw new ApiError('Unable to load the bracket.', 503);
    const eligibleTeams = manage
      ? (await eligibleEntrants(id)).map((team) => ({ id: team.id, team_name: team.team_name }))
      : undefined;
    const schedule = validateSchedule(tournament.bracket_schedule);
    const times = scheduleMatches(games.data as TournamentMatch[], schedule);
    return Response.json(
      {
        matches: games.data.map((match) => ({ ...match, scheduled_at: times[match.id] || null })),
        teams: teams.data,
        eligibleTeams,
        schedule,
        startDate: tournament.start_date,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await requireProfile(true);
    const body = await jsonObject(request);
    const eventId = uuidField(body.tournament_id, 'tournament');
    const admin = createAdminClient();
    const { data: tournament, error: eventError } = await admin
      .from('tournaments')
      .select('bracket_type')
      .eq('id', eventId)
      .single();
    if (eventError || !tournament) throw new ApiError('Unable to load the tournament.', 503);
    const entrants = await eligibleEntrants(eventId);
    if (entrants.length < 2)
      throw new ApiError(
        'At least two approved teams with any required payment verified are required.',
      );
    let graph;
    try {
      graph = buildPairedBracket(
        entrants.map((team) => team.id),
        tournament.bracket_type,
        body.pairings,
      );
    } catch (error) {
      throw new ApiError(error instanceof Error ? error.message : 'Invalid matchups.');
    }
    const { error } = await admin.rpc('create_competition_bracket', { event_id: eventId, graph });
    if (error) throw dbError(error);
    dispatchAfterResponse();
    return Response.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const { db, profile } = await requireProfile(true);
    const body = await jsonObject(request);
    if (body.action === 'reset_bracket') {
      const eventId = uuidField(body.tournament_id, 'tournament');
      await rateLimit(request, 'bracket-reset', 5, 900, profile.id);
      await verifyBracketResetPassword(db, profile.id, body.password);
      const admin = createAdminClient();
      const reset = await admin.rpc('reset_competition_bracket', {
        event_id: eventId,
        actor_id: profile.id,
      });
      if (reset.error) throw dbError(reset.error);
      const paths: string[] = Array.isArray(reset.data)
        ? reset.data.filter((path): path is string => typeof path === 'string')
        : [];
      for (let index = 0; index < paths.length; index += 100) {
        const cleanup = await admin.storage
          .from(SCORECARD_BUCKET)
          .remove(paths.slice(index, index + 100));
        if (cleanup.error)
          console.error('Bracket reset: private scorecard storage cleanup failed.');
      }
      return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (body.action === 'set_schedule') {
      const eventId = uuidField(body.tournament_id, 'tournament');
      let schedule;
      try {
        schedule = validateSchedule(body.schedule);
      } catch (error) {
        throw new ApiError(error instanceof Error ? error.message : 'Invalid schedule.');
      }
      const result = await db
        .from('tournaments')
        .update({ bracket_schedule: schedule, updated_at: new Date().toISOString() })
        .eq('id', eventId)
        .select('id')
        .single();
      if (result.error)
        throw new ApiError(
          'Unable to change schedule. Apply the latest migration and save before the first result.',
          409,
        );
      return Response.json({ success: true });
    }
    if (body.action === 'set_pairings') {
      const eventId = uuidField(body.tournament_id, 'tournament'),
        admin = createAdminClient();
      const opening = await admin
        .from('tournament_matches')
        .select('team_a,team_b')
        .eq('tournament_id', eventId)
        .eq('bracket', 'winners')
        .eq('round', 1)
        .order('position');
      if (opening.error) throw new ApiError('Unable to load opening matches.', 503);
      const ids = (opening.data || [])
        .flatMap((match) => [match.team_a, match.team_b])
        .filter((id): id is string => typeof id === 'string');
      let pairings;
      try {
        pairings = validatePairings(body.pairings, ids, opening.data?.length);
      } catch (error) {
        throw new ApiError(error instanceof Error ? error.message : 'Invalid matchups.');
      }
      const result = await admin.rpc('set_competition_pairings', { event_id: eventId, pairings });
      if (result.error) throw dbError(result.error);
      return Response.json({ success: true });
    }
    if (body.action === 'clear_result') {
      const { error } = await createAdminClient().rpc('clear_competition_result', {
        game_id: uuidField(body.match_id, 'match'),
      });
      if (error) throw dbError(error);
      return Response.json({ success: true });
    }
    if (body.action !== undefined) throw new ApiError('Invalid bracket action.');
    const a = integer(body.score_a, 0, 2),
      b = integer(body.score_b, 0, 2);
    if (!validSeriesScore(a, b))
      throw new ApiError('A BO3 result must be 2–0, 2–1, 1–2 or 0–2. Enter maps won, not rounds.');
    const { error } = await createAdminClient().rpc('record_competition_result', {
      game_id: uuidField(body.match_id, 'match'),
      a_score: a,
      b_score: b,
    });
    if (error) throw dbError(error);
    return Response.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
