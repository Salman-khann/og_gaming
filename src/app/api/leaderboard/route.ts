import { readLeaderboard } from '@/lib/leaderboard';
import { apiError,integer } from '@/lib/api';
import {connection} from 'next/server';
export async function GET(request:Request) {
  await connection();
  try { return Response.json(await readLeaderboard(integer(new URL(request.url).searchParams.get('page')||1,1,10000)), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return apiError(error); }
}
