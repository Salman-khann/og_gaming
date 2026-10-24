import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from './api-input';

export async function verifyBracketResetPassword(
  db: SupabaseClient,
  actorId: string,
  supplied: unknown,
): Promise<void> {
  if (typeof supplied !== 'string' || !supplied || supplied.length > 128)
    throw new ApiError('Enter your account password.', 403);
  const {
    data: { user },
    error: userError,
  } = await db.auth.getUser();
  if (userError || !user || user.id !== actorId)
    throw new ApiError('Please log in again before resetting the bracket.', 401);
  if (!user.email)
    throw new ApiError(
      'Use an administrator account with an email and password to reset brackets.',
      403,
    );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new ApiError('Account password verification is unavailable. Try again later.', 503);
  // Isolate verification from the administrator's browser cookies and session.
  const verifier = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: supplied,
  });
  if (error) {
    if (error.status === 429)
      throw new ApiError('Too many password attempts. Try again later.', 429);
    if (error.status && error.status >= 500)
      throw new ApiError('Account password verification is unavailable. Try again later.', 503);
    throw new ApiError(
      'Incorrect account password. Use the password for your signed-in administrator account.',
      403,
    );
  }
  try {
    if (!data.user || !data.session || data.user.id !== actorId)
      throw new ApiError('Account password verification failed.', 403);
  } finally {
    // Revoke only the temporary verification session, never the browser session.
    if (data.session) {
      const { error: cleanupError } = await verifier.auth.signOut({ scope: 'local' });
      if (cleanupError)
        throw new ApiError(
          'Account password verification could not complete. Try again later.',
          503,
        );
    }
  }
}
