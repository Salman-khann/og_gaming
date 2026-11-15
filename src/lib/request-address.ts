import { isIP } from 'node:net';

export function trustedClientAddress(request: Request): string | null {
  const header =
    process.env.VERCEL === '1' ? 'x-vercel-forwarded-for' : process.env.TRUSTED_CLIENT_IP_HEADER;
  if (!header || !/^[a-z0-9-]+$/i.test(header)) return null;
  const raw = request.headers.get(header)?.trim();
  // The ingress must OVERWRITE this header with one address, never append input.
  if (!raw || !isIP(raw)) return null;
  if (raw.toLowerCase().startsWith('::ffff:') && isIP(raw.slice(7)) === 4) return raw.slice(7);
  if (isIP(raw) !== 6) return raw;
  const normalized = new URL('http://[' + raw + ']').hostname.slice(1, -1);
  const mapped = /^::ffff:([a-f0-9]+):([a-f0-9]+)$/i.exec(normalized);
  if (mapped) {
    const high = parseInt(mapped[1], 16),
      low = parseInt(mapped[2], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join('.');
  }
  return normalized;
}

// Keep the real address available for providers (e.g. Turnstile remoteip),
// but group IPv6 privacy addresses into the same /64 rate-limit bucket.
export function clientNetwork(address: string): string {
  if (isIP(address) !== 6) return address;
  const normalized = new URL('http://[' + address + ']').hostname.slice(1, -1);
  const [left, right = ''] = normalized.split('::');
  const start = left ? left.split(':') : [];
  const end = right ? right.split(':') : [];
  const groups = normalized.includes('::')
    ? [...start, ...Array(8 - start.length - end.length).fill('0'), ...end]
    : start;
  return (
    groups
      .slice(0, 4)
      .map((group) => group.padStart(4, '0'))
      .join(':') + '::/64'
  );
}
