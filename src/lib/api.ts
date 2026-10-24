import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/types';
import type { User } from '@supabase/supabase-js';
import { ApiError } from './api-input';
import { reportServerError } from './diagnostics';
export {
  ApiError,
  dbError,
  limitedFormData,
  integer,
  money,
  jsonObject,
  sameOrigin,
  textField,
  uuidField,
} from './api-input';
export const profileColumns =
  'id,faceit_id,faceit_nickname,faceit_avatar_url,faceit_elo,faceit_level,faceit_game_id,role,created_at,updated_at';
export async function requireProfile(
  admin = false,
  context?: { db: Awaited<ReturnType<typeof createClient>>; user: User | null },
) {
  const db = context?.db || (await createClient());
  const user = context ? context.user : (await db.auth.getUser()).data.user;
  if (!user) throw new ApiError('Please log in to continue.', 401);
  const { data, error } = await db
    .from('profiles')
    .select(profileColumns)
    .eq('id', user.id)
    .single();
  if (error || !data) throw new ApiError('Your player profile is unavailable.', 403);
  const profile = data as Profile;
  if (profile.role === 'banned' || (admin && profile.role !== 'admin'))
    throw new ApiError('Access denied.', 403);
  return { db, profile };
}
export function apiError(error: unknown) {
  if (error instanceof ApiError)
    return Response.json(
      { error: error.message },
      { status: error.status, headers: { 'Cache-Control': 'no-store', ...error.headers } },
    );
  // Exceptions can contain provider URLs, credentials or submitted private data.
  const requestId = reportServerError(error);
  return Response.json(
    { error: 'Arena service unavailable. Please try again.', requestId },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
