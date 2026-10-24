import { apiError, ApiError, requireProfile, uuidField } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { connection } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
export async function GET(request: Request) {
  await connection();
  try {
    const { db, profile } = await requireProfile();
    const id = uuidField(new URL(request.url).searchParams.get('match_id'), 'match');
    await rateLimit(request, 'contact-reveal', 10, 86400, profile.id);
    const { data: match } = await db
      .from('match_requests')
      .select('roster')
      .eq('id', id)
      .gt('scheduled_time', new Date().toISOString())
      .single();
    if (
      !match ||
      (profile.role !== 'admin' &&
        !match.roster.some((player: { id: string }) => player.id === profile.id))
    )
      throw new ApiError('Join this match to contact the host.', 403);
    const { data, error } = await createAdminClient()
      .from('match_contacts')
      .select('phone')
      .eq('match_id', id)
      .single();
    if (error || !data) throw new ApiError('Host contact is unavailable.', 404);
    const audit = await createAdminClient()
      .from('contact_reveals')
      .insert({ actor_id: profile.id, match_id: id });
    if (audit.error) throw new ApiError('Host contact is temporarily unavailable.', 503);
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
