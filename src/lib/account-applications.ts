import 'server-only';
import { createClient } from './supabase/server';
import { ApiError } from './api-input';
import type { User } from '@supabase/supabase-js';

export function checkCaptainAccount(user: User | null, email: string) {
  if (
    user?.email_confirmed_at &&
    user.app_metadata.provider === 'email' &&
    user.email?.toLowerCase() !== email.toLowerCase()
  )
    throw new ApiError(
      'Use your signed-in account email for the captain, or sign in to the captain account before registering.',
      409,
    );
}

export async function recoverGuestApplications(db: Awaited<ReturnType<typeof createClient>>) {
  const { error } = await db.rpc('claim_my_guest_applications');
  if (error) throw new Error('Unable to restore your account applications.');
}
