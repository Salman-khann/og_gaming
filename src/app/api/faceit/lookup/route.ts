import { NextRequest, NextResponse } from 'next/server';
import { getFaceitPlayerByNickname } from '@/lib/faceit';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get('nickname');

  if (!nickname) {
    return NextResponse.json({ error: 'Nickname parameter is required' }, { status: 400 });
  }

  const player = await getFaceitPlayerByNickname(nickname);
  if (!player) {
    return NextResponse.json({ error: 'Player not found on FACEIT' }, { status: 404 });
  }

  return NextResponse.json({ player });
}
