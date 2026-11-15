import 'server-only';
import { createAdminClient } from './supabase/admin';
export async function registrationReviewFlags(actorId: string, ids: string[]) {
  if (!ids.length) return {} as Record<string, string[]>;
  const result = await createAdminClient().rpc('registration_review_flags', {
    actor_id: actorId,
    entry_ids: ids,
  });
  if (result.error) {
    // Local development can run ahead of the shared database. Keep review
    // availability explicit; never downgrade permissions or provider failures.
    if (process.env.NODE_ENV === 'development' && result.error.code === 'PGRST202')
      return Object.fromEntries(
        ids.map((id) => [
          id,
          [
            'Roster review checks unavailable: the connected database needs the pending review migrations. Verify this application manually before approval.',
          ],
        ]),
      ) as Record<string, string[]>;
    throw new Error('Unable to load registration review warnings.');
  }
  return (result.data || {}) as Record<string, string[]>;
}
