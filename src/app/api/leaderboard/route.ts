import { readLeaderboard } from '@/lib/leaderboard';
import { publicCacheHeaders } from '@/lib/public-cache';
import { apiError, integer } from '@/lib/api';
import { connection } from 'next/server';
export async function GET(request: Request) {
  await connection();
  try {
    return Response.json(
      await readLeaderboard(integer(new URL(request.url).searchParams.get('page') || 1, 1, 10000)),
      { headers: publicCacheHeaders(request) },
    );
  } catch (error) {
    return apiError(error);
  }
}
