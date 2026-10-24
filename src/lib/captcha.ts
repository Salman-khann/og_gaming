import 'server-only';
import { ApiError } from './api-input';
import { trustedClientAddress } from './request-address';

export async function verifyCaptcha(
  request: Request,
  token: unknown,
  action: 'match-post' | 'registration',
) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!secret && !siteKey && process.env.NODE_ENV !== 'production') return;
  if (!secret || !siteKey)
    throw new ApiError('Form protection is temporarily unavailable. Please try again later.', 503);
  if (typeof token !== 'string' || !token || token.length > 2048)
    throw new ApiError('Complete the security check before submitting.');
  const fields = new URLSearchParams({ secret, response: token });
  const address = trustedClientAddress(request);
  if (address) fields.set('remoteip', address);
  let result;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: fields,
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Verification unavailable');
    result = await response.json();
  } catch {
    throw new ApiError('Security verification is unavailable. Please try again.', 503);
  }
  const hostname = new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).hostname;
  if (result.success !== true || result.hostname !== hostname || result.action !== action)
    throw new ApiError('The security check expired or failed. Please complete it again.');
}
