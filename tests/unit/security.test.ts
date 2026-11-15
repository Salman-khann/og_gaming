import { afterEach, describe, expect, it, vi } from 'vitest';
import { dbError, limitedFormData } from '../../src/lib/api-input';
import { verifyCaptcha } from '../../src/lib/captcha';
import { cn } from '../../src/lib/utils';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('safe public errors and bounded uploads', () => {
  it('only exposes deliberate database exceptions', () => {
    expect(dbError({ code: 'P0001', message: 'Tournament is full.' }).message).toBe(
      'Tournament is full.',
    );
    for (const code of ['22P02', '23505', '42501', undefined]) {
      const error = dbError({ code, message: 'private_table secret-value captain@example.test' });
      expect(error.status).toBe(503);
      expect(error.message).not.toContain('private_table');
    }
  });
  it('rejects a chunked multipart upload before buffering more than the limit', async () => {
    let canceled = false;
    const body = new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array(700));
      },
      cancel() {
        canceled = true;
      },
    });
    const request = new Request('https://site.test/upload', {
      method: 'POST',
      body,
      duplex: 'half',
      headers: { 'Content-Type': 'multipart/form-data; boundary=test' },
    } as RequestInit);
    await expect(limitedFormData(request, 1024)).rejects.toMatchObject({ status: 413 });
    expect(canceled).toBe(true);
  });
  it('parses an ordinary bounded multipart request', async () => {
    const data = new FormData();
    data.set('match_id', 'test');
    data.set('file', new Blob(['image']), 'test.png');
    const parsed = await limitedFormData(
      new Request('https://site.test/upload', { method: 'POST', body: data }),
      1024,
    );
    expect(parsed.get('match_id')).toBe('test');
  });
  it('resolves Tailwind conflicts with the existing cn implementation', () => {
    expect(cn('px-2 text-sm', { 'px-6': true }, ['text-lg', false])).toBe('px-6 text-lg');
    expect(cn('hover:bg-black', 'hover:bg-orange-500')).toBe('hover:bg-orange-500');
  });
});
describe('Turnstile server verification', () => {
  const request = () => new Request('https://site.test/api/matches');
  function configure() {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.test');
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret');
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'test-site-key');
  }
  it('fails closed when production keys are absent', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '');
    await expect(verifyCaptcha(request(), 'token', 'match-post')).rejects.toMatchObject({
      status: 503,
    });
  });
  it('rejects forged, replayed, wrong-host and wrong-action tokens', async () => {
    configure();
    for (const response of [
      { success: false },
      { success: true, hostname: 'foreign.test', action: 'match-post' },
      { success: true, hostname: 'site.test', action: 'registration' },
    ]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(response)));
      await expect(verifyCaptcha(request(), 'token', 'match-post')).rejects.toMatchObject({
        status: 400,
      });
    }
  });
  it('accepts only the expected hostname and form action', async () => {
    configure();
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ success: true, hostname: 'site.test', action: 'registration' }),
      );
    vi.stubGlobal('fetch', fetcher);
    await verifyCaptcha(request(), 'verified-token', 'registration');
    expect(String(fetcher.mock.calls[0][1].body)).toContain('response=verified-token');
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    );
  });
});
