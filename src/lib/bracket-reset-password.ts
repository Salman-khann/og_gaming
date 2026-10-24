import { createHash, timingSafeEqual } from 'node:crypto';

export function validBracketResetPassword(supplied: unknown, expected: string): boolean {
  if (typeof supplied !== 'string' || !supplied || supplied.length > 1024 || !expected) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(supplied), digest(expected));
}
