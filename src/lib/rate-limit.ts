import 'server-only';
import { createHmac } from 'node:crypto';
import { createAdminClient } from './supabase/admin';
import { ApiError } from './api-input';
import { trustedClientAddress } from './request-address';

export async function rateLimitSubject(purpose: string, subject: string, limit: number, seconds = 60) {
  const secret = process.env.RATE_LIMIT_SECRET || (process.env.NODE_ENV !== 'production' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined);
  if (!secret || secret.length < 32) throw new ApiError('Request protection is unavailable. Please try again shortly.', 503);
  const key = createHmac('sha256', secret).update(JSON.stringify([purpose, subject])).digest('hex');
  const { data, error } = await createAdminClient().rpc('consume_rate_limit', { bucket_key: key, allowed: limit, window_seconds: seconds });
  if (error || typeof data !== 'boolean') throw new ApiError('Request protection is unavailable. Please try again shortly.', 503);
  if (!data) throw new ApiError('Too many requests. Please try again shortly.', 429, { 'Retry-After': String(seconds) });
}

export async function rateLimit(request: Request, purpose: string, limit: number, seconds = 60, identity?: string) {
  const address = trustedClientAddress(request);
  if (!address && process.env.NODE_ENV === 'production') throw new ApiError('Request protection is unavailable. Please try again shortly.', 503);
  // Keep the network cap alongside the account cap so new accounts cannot bypass it.
  await rateLimitSubject(purpose + ':ip', address || 'local-development', identity ? Math.max(20, limit * 3) : limit, seconds);
  if (identity) await rateLimitSubject(purpose + ':account', identity, limit, seconds);
}
