import { NextRequest, NextResponse } from 'next/server';
import { DataService } from '@/lib/data-service';

export async function GET() {
  const matches = await DataService.getMatches();
  return NextResponse.json({ matches });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'join') {
      const { match_id, user_id, role } = body;
      const user = await DataService.getProfileById(user_id);
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      const result = await DataService.joinMatch(match_id, user, role);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    // Create match
    const { creator_id, title, type, description, preferred_cabin_id, scheduled_time, min_faceit_level, max_faceit_level, target_players_count } = body;

    if (!creator_id || !title || !type) {
      return NextResponse.json({ error: 'Missing required match fields' }, { status: 400 });
    }

    const match = await DataService.createMatch({
      creator_id,
      title,
      type,
      description,
      preferred_cabin_id,
      scheduled_time,
      min_faceit_level: Number(min_faceit_level) || 1,
      max_faceit_level: Number(max_faceit_level) || 10,
      target_players_count: Number(target_players_count) || 10,
    });

    return NextResponse.json({ success: true, match });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to process match request' }, { status: 500 });
  }
}
