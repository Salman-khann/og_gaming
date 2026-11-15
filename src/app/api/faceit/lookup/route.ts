import { NextRequest, NextResponse } from 'next/server';
import { FaceitError, verifyFaceitPlayer } from '@/lib/faceit';
import { rateLimit } from '@/lib/rate-limit';
import { apiError, requireProfile } from '@/lib/api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get('nickname');

  if (!nickname) {
    return NextResponse.json({ error: 'Nickname parameter is required' }, { status: 400 });
  }

  try {
    const { profile } = await requireProfile();
    await rateLimit(request, 'faceit-lookup', 30, 60, profile.id);
    const player = await verifyFaceitPlayer(nickname);
    return NextResponse.json({ player });
  } catch (error) {
    if (error instanceof FaceitError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } },
      );
    return apiError(error);
  }
}
