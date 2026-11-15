import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
export const deletionHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function ownsPost(token: string | undefined, hash: string | null) {
  return (
    !!token &&
    /^[a-f0-9]{64}$/.test(token) &&
    !!hash &&
    /^[a-f0-9]{64}$/.test(hash) &&
    timingSafeEqual(Buffer.from(deletionHash(token)), Buffer.from(hash))
  );
}
export function newDeletionCredential() {
  const token = randomBytes(32).toString('hex');
  return { token, hash: deletionHash(token) };
}
export async function issueDeletionCookie(id: string, scheduledTime: string, token: string) {
  (await cookies()).set('og_match_' + id, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/matches',
    maxAge: Math.max(
      60,
      Math.min(34560000, Math.ceil((Date.parse(scheduledTime) - Date.now()) / 1000)),
    ),
  });
}
