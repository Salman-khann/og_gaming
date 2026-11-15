import 'server-only';
import { createHmac } from 'node:crypto';
import { createAdminClient } from './supabase/admin';
import { ApiError } from './api-input';
import { trustedClientAddress, clientNetwork } from './request-address';

export async function rateLimitSubject(
  purpose: string,
  subject: string,
  limit: number,
  seconds = 60,
) {
  const secret =
    process.env.RATE_LIMIT_SECRET ||
    (process.env.NODE_ENV !== 'production' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined);
  if (!secret || secret.length < 32)
    throw new ApiError('Request protection is unavailable. Please try again shortly.', 503);
  const key = createHmac('sha256', secret)
    .update(JSON.stringify([purpose, subject]))
    .digest('hex');
  const { data, error } = await createAdminClient().rpc('consume_rate_limit', {
    bucket_key: key,
    allowed: limit,
    window_seconds: seconds,
  });
  if (error || typeof data !== 'boolean')
    throw new ApiError('Request protection is unavailable. Please try again shortly.', 503);
  if (!data)
    throw new ApiError('Too many requests. Please try again shortly.', 429, {
      'Retry-After': String(seconds),
    });
}

export async function rateLimit(
  request: Request,
  purpose: string,
  limit: number,
  seconds = 60,
  identity?: string,
) {
  const address = trustedClientAddress(request);
  if (!address && process.env.NODE_ENV === 'production')
    throw new ApiError('Request protection is unavailable. Please try again shortly.', 503);
  // Shared venue Wi-Fi and carrier NAT need a coarser network ceiling. Subject
  // and account limits remain unchanged; guest mutations also verify CAPTCHA.
  const networkCaps: Record<string, number> = {
    signup: 100,
    'password-login': 300,
    'match-post': 100,
    registration: 100,
    'contact-reveal': 1000,
    'player-read': 300,
  };
  await rateLimitSubject(
    purpose + ':ip',
    address ? clientNetwork(address) : 'local-development',
    networkCaps[purpose] || (identity ? Math.max(100, limit * 10) : limit),
    seconds,
  );
  if (identity) await rateLimitSubject(purpose + ':account', identity, limit, seconds);
}
