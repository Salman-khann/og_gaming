import { afterEach, expect, it, vi } from 'vitest';
import { assertTestDatabase } from '../../scripts/lib/test-environment.mjs';

afterEach(() => vi.unstubAllEnvs());
it('refuses production even if explicitly designated as staging', () => {
  vi.stubEnv('OG_TEST_PROJECT_HOST', 'aupshyillqikzudabvjg.supabase.co');
  expect(() => assertTestDatabase('https://aupshyillqikzudabvjg.supabase.co')).toThrow();
});
it('accepts local or explicitly isolated staging origins only', () => {
  vi.stubEnv('OG_TEST_PROJECT_HOST', 'staging.supabase.co');
  expect(() => assertTestDatabase('http://127.0.0.1:54321')).not.toThrow();
  expect(() => assertTestDatabase('https://staging.supabase.co')).not.toThrow();
  for (const url of [
    'https://other.supabase.co',
    'https://user:password@staging.supabase.co',
    'https://staging.supabase.co?project=production',
    'file:///test',
  ]) {
    expect(() => assertTestDatabase(url)).toThrow();
  }
});
