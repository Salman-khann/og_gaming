import { expect, it, vi } from 'vitest';
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn() }));
import { POST } from '../../src/app/api/csp-report/route';
it('bounds untrusted reports and logs no URL credentials, paths or query tokens', async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://oggaming.pk');
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const send = (body: unknown) =>
    POST(
      new Request('https://oggaming.pk/api/csp-report', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );
  expect(
    (
      await send({
        'csp-report': {
          'document-uri': 'https://oggaming.pk/private?token=secret',
          'effective-directive': 'script-src-elem',
          'blocked-uri': 'https://user:password@third.test/script.js?credential=secret',
        },
      })
    ).status,
  ).toBe(204);
  const logged = JSON.stringify(log.mock.calls);
  expect(logged).toContain('https://third.test');
  expect(logged).not.toMatch(/secret|password|credential|private|script.js/);
  expect((await send({ padding: 'x'.repeat(9000) })).status).toBe(413);
  expect(
    (
      await send({
        'csp-report': { 'document-uri': 'https://other.test', 'effective-directive': 'script-src' },
      })
    ).status,
  ).toBe(400);
});
