import { NextRequest, NextResponse } from 'next/server';
import { FaceitError, verifyFaceitPlayer } from '@/lib/faceit';
import { rateLimit } from '@/lib/rate-limit';
import { apiError,ApiError } from '@/lib/api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get('nickname');

  if (!nickname) {
    return NextResponse.json({ error: 'Nickname parameter is required' }, { status: 400 });
  }

  try {
    await rateLimit(request,'faceit-lookup',30,60);
    const player = await verifyFaceitPlayer(nickname);
    return NextResponse.json({ player });
  } catch (error) {
    if(error instanceof ApiError) return apiError(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'FACEIT is unavailable.' }, { status: error instanceof FaceitError ? error.status : 400 });
  }
}
