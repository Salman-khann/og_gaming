import { expect, it } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { checkCaptainAccount } from '../../src/lib/account-applications';
it('prevents email/password registrations silently linking to a different account', () => {
  const user = {
    email: 'captain@example.test',
    email_confirmed_at: '2026-01-01',
    app_metadata: { provider: 'email' },
  } as User;
  expect(() => checkCaptainAccount(user, 'CAPTAIN@example.test')).not.toThrow();
  expect(() => checkCaptainAccount(user, 'other@example.test')).toThrow('signed-in account email');
  expect(() => checkCaptainAccount(null, 'guest@example.test')).not.toThrow();
  expect(() =>
    checkCaptainAccount({ ...user, email_confirmed_at: undefined }, 'other@example.test'),
  ).not.toThrow();
});
