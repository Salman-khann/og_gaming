import { NextRequest, NextResponse } from 'next/server';
import { DataService } from '@/lib/data-service';

export async function GET() {
  const tournaments = await DataService.getTournaments();
  const registrations = await DataService.getRegistrations();
  return NextResponse.json({ tournaments, registrations });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tournament_id, captain_id, team_name, roster_nicknames } = body;

    if (!tournament_id || !captain_id || !team_name || !roster_nicknames || !Array.isArray(roster_nicknames)) {
      return NextResponse.json({ error: 'Missing registration details' }, { status: 400 });
    }

    if (roster_nicknames.length !== 5) {
      return NextResponse.json({ error: 'Tournament roster must have exactly 5 players' }, { status: 400 });
    }

    const result = await DataService.registerTournamentTeam({
      tournament_id,
      captain_id,
      team_name,
      roster_nicknames,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, registration: result.registration });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to process tournament registration' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { registration_id, action, status } = body;

    if (!registration_id) {
      return NextResponse.json({ error: 'Missing registration_id' }, { status: 400 });
    }

    if (action === 'toggle_checkin') {
      const result = await DataService.toggleRegistrationCheckIn(registration_id);
      return NextResponse.json(result);
    }

    if (status) {
      const result = await DataService.updateRegistrationStatus(registration_id, status);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update registration' }, { status: 500 });
  }
}
