import { isIP } from 'node:net';

export function trustedClientAddress(request: Request): string | null {
  const header =
    process.env.VERCEL === '1' ? 'x-vercel-forwarded-for' : process.env.TRUSTED_CLIENT_IP_HEADER;
  if (!header || !/^[a-z0-9-]+$/i.test(header)) return null;
  const raw = request.headers.get(header)?.trim();
  // The ingress must OVERWRITE this header with one address, never append input.
  if (!raw || !isIP(raw)) return null;
  if (raw.toLowerCase().startsWith('::ffff:') && isIP(raw.slice(7)) === 4) return raw.slice(7);
  return isIP(raw) === 6 ? new URL('http://[' + raw + ']').hostname.slice(1, -1) : raw;
}
