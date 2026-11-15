import { isAuthSessionMissingError, type SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from './api-input';

const endedSessionCodes = new Set([
  'session_not_found',
  'session_expired',
  'refresh_token_not_found',
  'refresh_token_already_used',
  'user_not_found',
  'user_banned',
  'bad_jwt',
]);

export async function verifiedUser(db: Pick<SupabaseClient, 'auth'>) {
  const { data, error } = await db.auth.getUser();
  if (error) {
    if (isAuthSessionMissingError(error) || (error.code && endedSessionCodes.has(error.code)))
      return null;
    // A network/provider outage is not evidence that the user signed out.
    throw new ApiError('Unable to refresh your account. Please try again shortly.', 503);
  }
  return data.user;
}
