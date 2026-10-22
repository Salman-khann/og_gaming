import { createHash } from 'node:crypto';
import { createAdminClient } from './supabase/admin';
import { ApiError } from './api';
export async function rateLimit(request: Request, purpose: string, limit: number, seconds = 60, identity?: string) {
  // Trust the platform's client address only on Vercel. Self-hosted operators
  // must set a proxy-controlled header; arbitrary forwarded headers are ignored.
  const header = process.env.VERCEL ? 'x-vercel-forwarded-for' : process.env.TRUSTED_CLIENT_IP_HEADER;
  const address = identity || (header ? request.headers.get(header)?.split(',')[0]?.trim() : null) || 'shared';
  const key = createHash('sha256').update(purpose + ':' + address).digest('hex');
  const { data, error } = await createAdminClient().rpc('consume_rate_limit', { bucket_key: key, allowed: limit, window_seconds: seconds });
  if (error) throw new ApiError('Request protection is unavailable. Please try again shortly.', 503);
  if (!data) throw new ApiError('Too many requests. Please try again shortly.', 429);
}
