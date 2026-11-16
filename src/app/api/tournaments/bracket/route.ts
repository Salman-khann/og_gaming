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
import {
  scheduleMatches,
  validateSchedule,
  extractMatchTimings,
  injectMatchTimings,
} from '@/lib/bracket-schedule';
import type { TournamentMatch } from '@/types';
import { verifyBracketResetPassword } from '@/lib/bracket-reset-password';
import { rateLimit } from '@/lib/rate-limit';
import { cleanupScorecardsAfterResponse } from '@/lib/storage-cleanup';
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
    const db = await createClient();

    const authPromise = manage ? requireProfile(true, { db }) : Promise.resolve(null);
    const tournamentPromise = db
      .from('tournaments')
      .select('id,start_date,bracket_schedule,rules')
      .eq('id', id)
      .single();
    const gamesPromise = db
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', id)
      .order('round')
      .order('position')
      .limit(256);
    const teamsPromise = db
      .from('public_registrations')
      .select('id,team_name')
      .eq('tournament_id', id)
      .eq('status', 'approved')
      .limit(128);
    const eligiblePromise = manage ? eligibleEntrants(id) : Promise.resolve(null);

    const [, { data: tournament, error: tournamentError }, games, teams, eligibleData] =
      await Promise.all([
        authPromise,
        tournamentPromise,
        gamesPromise,
        teamsPromise,
        eligiblePromise,
      ]);

    if (tournamentError && tournamentError.code !== 'PGRST116')
      throw new ApiError(
        'Unable to load tournament schedule. Apply the latest database migration.',
        503,
      );
    if (!tournament) throw new ApiError('Tournament not found.', 404);
    if (games.error || teams.error) throw new ApiError('Unable to load the bracket.', 503);

    const eligibleTeams = eligibleData
      ? eligibleData.map((team) => ({ id: team.id, team_name: team.team_name }))
      : undefined;
    const schedule = validateSchedule(tournament.bracket_schedule);
    const matchTimes = extractMatchTimings(tournament.rules);
    const times = scheduleMatches(games.data as TournamentMatch[], schedule, {
      interleaveW2L1: true,
      matchTimes,
    });
    return Response.json(
      {
        matches: games.data.map((match) => ({
          ...match,
          scheduled_at: times[match.id] || null,
          is_custom_schedule: !!matchTimes[match.id],
        })),
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
    const [{ db, profile }, body] = await Promise.all([requireProfile(true), jsonObject(request)]);
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
      cleanupScorecardsAfterResponse();
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
    if (body.action === 'set_match_timing') {
      const eventId = uuidField(body.tournament_id, 'tournament');
      const matchId = uuidField(body.match_id, 'match');
      const scheduledAt =
        typeof body.scheduled_at === 'string' && body.scheduled_at.trim()
          ? new Date(body.scheduled_at).toISOString()
          : null;
      const admin = createAdminClient();
      const { data: event, error: eventError } = await admin
        .from('tournaments')
        .select('id,rules')
        .eq('id', eventId)
        .single();
      if (eventError || !event) throw new ApiError('Tournament not found.', 404);
      const timings = extractMatchTimings(event.rules);
      if (scheduledAt) {
        timings[matchId] = scheduledAt;
      } else {
        delete timings[matchId];
      }
      const updatedRules = injectMatchTimings(event.rules, timings);
      const updateResult = await admin
        .from('tournaments')
        .update({ rules: updatedRules, updated_at: new Date().toISOString() })
        .eq('id', eventId);
      if (updateResult.error) throw dbError(updateResult.error);
      return Response.json({ success: true, match_id: matchId, scheduled_at: scheduledAt });
    }
    if (body.action === 'swap_teams') {
      const eventId = uuidField(body.tournament_id, 'tournament');
      const teamAId = uuidField(body.team_a_id, 'team_a');
      const teamBId = uuidField(body.team_b_id, 'team_b');
      if (teamAId === teamBId) throw new ApiError('Select two different teams to swap.', 400);

      const admin = createAdminClient();
      const { data: matches, error } = await admin
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', eventId)
        .or(`team_a.eq.${teamAId},team_b.eq.${teamAId},team_a.eq.${teamBId},team_b.eq.${teamBId}`);
      if (error) throw dbError(error);

      for (const m of matches || []) {
        if (m.status === 'completed' || m.score_a != null || m.score_b != null) {
          throw new ApiError(
            'Cannot swap a team that is already playing or has finished a match.',
            400,
          );
        }
      }

      const sameMatch = matches?.find(
        (m) =>
          (m.team_a === teamAId && m.team_b === teamBId) ||
          (m.team_a === teamBId && m.team_b === teamAId),
      );

      if (sameMatch) {
        const update = await admin
          .from('tournament_matches')
          .update({
            team_a: sameMatch.team_b,
            team_b: sameMatch.team_a,
          })
          .eq('id', sameMatch.id);
        if (update.error) throw dbError(update.error);
      } else {
        for (const m of matches || []) {
          const updates: Record<string, string> = {};
          if (m.team_a === teamAId) updates.team_a = teamBId;
          else if (m.team_a === teamBId) updates.team_a = teamAId;

          if (m.team_b === teamAId) updates.team_b = teamBId;
          else if (m.team_b === teamBId) updates.team_b = teamAId;

          if (Object.keys(updates).length > 0) {
            const update = await admin.from('tournament_matches').update(updates).eq('id', m.id);
            if (update.error) throw dbError(update.error);
          }
        }
      }

      await admin.rpc('advance_competition', { event_id: eventId });
      return Response.json({ success: true });
    }
    if (body.action === 'replace_team') {
      const eventId = uuidField(body.tournament_id, 'tournament');
      const matchId = uuidField(body.match_id, 'match');
      const oldTeamId = uuidField(body.old_team_id, 'old_team');
      const newTeamId = uuidField(body.new_team_id, 'new_team');
      if (oldTeamId === newTeamId) throw new ApiError('Select a different replacement team.', 400);

      const admin = createAdminClient();
      const { data: match, error: matchError } = await admin
        .from('tournament_matches')
        .select('*')
        .eq('id', matchId)
        .eq('tournament_id', eventId)
        .single();
      if (matchError || !match) throw new ApiError('Match not found.', 404);
      if (match.status === 'completed' || match.score_a != null || match.score_b != null) {
        throw new ApiError('Cannot replace a team in a completed or in-progress match.', 400);
      }
      if (match.team_a !== oldTeamId && match.team_b !== oldTeamId) {
        throw new ApiError('The team to be replaced is not in this match.', 400);
      }

      const { data: newTeam, error: teamError } = await admin
        .from('registrations')
        .select('id,team_name,status')
        .eq('id', newTeamId)
        .eq('tournament_id', eventId)
        .eq('status', 'approved')
        .single();
      if (teamError || !newTeam) {
        throw new ApiError('The replacement team is not approved for this tournament.', 400);
      }

      const { data: existingMatches, error: existingError } = await admin
        .from('tournament_matches')
        .select('id')
        .eq('tournament_id', eventId)
        .or(`team_a.eq.${newTeamId},team_b.eq.${newTeamId}`);
      if (existingError) throw dbError(existingError);
      if (existingMatches && existingMatches.length > 0) {
        throw new ApiError(
          'This team is already in the bracket. Use "Swap Teams" to exchange positions instead.',
          400,
        );
      }

      const updates: Record<string, string> = {};
      if (match.team_a === oldTeamId) updates.team_a = newTeamId;
      if (match.team_b === oldTeamId) updates.team_b = newTeamId;
      if (match.status === 'bye') {
        const remaining = match.team_a === oldTeamId ? match.team_b : match.team_a;
        updates.winner_id = remaining || newTeamId;
      }

      const updateResult = await admin.from('tournament_matches').update(updates).eq('id', matchId);
      if (updateResult.error) throw dbError(updateResult.error);

      await admin.rpc('advance_competition', { event_id: eventId });
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
