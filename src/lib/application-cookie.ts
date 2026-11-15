import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { ApiError } from './api-input';
const NAME = 'og_entries';
const TTL = 90 * 86400;
const MAX_ENTRIES = 20;
type Entry = [string, string, number];
type Jar = { getAll(): { name: string; value: string }[] };
function key() {
  const value =
    process.env.RATE_LIMIT_SECRET ||
    (process.env.NODE_ENV !== 'production' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined);
  if (!value || value.length < 32)
    throw new ApiError('Application protection is unavailable.', 503);
  return value;
}
const signature = (payload: string) =>
  createHmac('sha256', key())
    .update('application-cookie:' + payload)
    .digest('base64url');
export function decodeApplications(value: string | undefined, now = Date.now()): Entry[] {
  if (!value || value.length > 3600) return [];
  try {
    const [payload, mac, extra] = value.split('.');
    const expected = signature(payload);
    if (
      extra ||
      !mac ||
      mac.length !== expected.length ||
      !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
    )
      return [];
    const rows = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!Array.isArray(rows) || rows.length > MAX_ENTRIES) return [];
    return rows.filter(
      (row): row is Entry =>
        Array.isArray(row) &&
        row.length === 3 &&
        /^[a-f0-9-]{36}$/.test(row[0]) &&
        /^[a-f0-9]{64}$/.test(row[1]) &&
        Number.isSafeInteger(row[2]) &&
        row[2] > now &&
        row[2] <= now + TTL * 1000,
    );
  } catch {
    return [];
  }
}
export function encodeApplications(entries: Entry[]) {
  const payload = Buffer.from(JSON.stringify(entries.slice(-MAX_ENTRIES))).toString('base64url');
  return payload + '.' + signature(payload);
}
export function applicationTokens(jar: Jar) {
  const all = jar.getAll();
  const tokens = new Map(
    decodeApplications(all.find((c) => c.name === NAME)?.value).map(([id, token]) => [id, token]),
  );
  for (const cookie of all.filter((c) => /^og_entry_[a-f0-9-]{36}$/.test(c.name)).slice(0, 50))
    if (/^[a-f0-9]{64}$/.test(cookie.value) && !tokens.has(cookie.name.slice(9)))
      tokens.set(cookie.name.slice(9), cookie.value);
  return tokens;
}
export async function rememberApplication(id: string, token: string) {
  const jar = await cookies();
  const now = Date.now();
  const previous = decodeApplications(jar.get(NAME)?.value, now);
  const expiries = new Map(previous.map(([entry, , expiry]) => [entry, expiry]));
  const entries: Entry[] = [...applicationTokens(jar)]
    .filter(([entry]) => entry !== id)
    .map(([entry, credential]) => [entry, credential, expiries.get(entry) || now + TTL * 1000]);
  entries.push([id, token, now + TTL * 1000]);
  jar.set(NAME, encodeApplications(entries), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TTL,
  });
  for (const cookie of jar.getAll())
    if (/^og_entry_[a-f0-9-]{36}$/.test(cookie.name)) jar.delete(cookie.name);
}
