import assert from 'node:assert/strict';
import { it, vi } from 'vitest';
vi.mock('next/server', () => ({ after: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => globalThis.noticeTestDb }));
import { dispatchNotifications } from '../../src/lib/notifications';
it('fans out notifications with receipts, idempotency and retry limits without sending messages', async () => {
  const previous = {};
  for (const key of [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_ADMIN_CHAT_ID',
    'RESEND_API_KEY',
    'ADMIN_EMAIL',
    'NOTIFICATION_FROM_EMAIL',
    'NEXT_PUBLIC_SITE_URL',
  ]) {
    previous[key] = process.env[key];
    process.env[key] = 'test-only';
  }
  process.env.NEXT_PUBLIC_SITE_URL = 'https://og.test';
  const originalFetch = globalThis.fetch;
  const rows = [
    {
      id: 'event',
      channel: 'system',
      recipient: 'admins',
      event_type: 'registrations:insert',
      payload: { name: 'Consent squad' },
      event_key: 'event-key',
      status: 'pending',
      attempts: 0,
    },
  ];
  globalThis.noticeTestDb = {
    rpc: async () => ({
      data: rows
        .filter(
          (row) =>
            ['pending', 'failed'].includes(row.status) &&
            !row.lease_until &&
            (!row.available_at || Date.parse(row.available_at) <= Date.now()),
        )
        .slice(0, 10)
        .map((row) => {
          row.lease_until = 'leased';
          row.attempts++;
          return { ...row };
        }),
      error: null,
    }),
    from: () => ({
      upsert: async (row) => {
        if (!rows.some((existing) => existing.event_key === row.event_key))
          rows.push({ ...row, id: row.channel, status: 'pending', attempts: 0 });
        return { error: null };
      },
      update: (values) => ({
        eq: async (_, id) => {
          Object.assign(
            rows.find((row) => row.id === id),
            values,
          );
          return { error: null };
        },
      }),
    }),
  };

  const calls = [];
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      return url.includes('telegram')
        ? Response.json({ ok: true, result: { message_id: 123 } })
        : Response.json({ id: 'email-id' });
    };
    const result = await dispatchNotifications();
    assert.equal(result.delivered, 2);
    assert.equal(
      rows.every((row) => row.status === 'sent'),
      true,
    );
    assert.equal(calls.length, 2);
    assert.equal(
      calls.find((call) => call.url.includes('resend')).options.headers['Idempotency-Key'],
      'event-key:email',
    );
    assert.equal(rows.find((row) => row.channel === 'telegram').delivery_id, '123');
    rows.push({
      id: 'failure',
      channel: 'email',
      recipient: 'admin@test.invalid',
      event_type: 'test',
      payload: { name: 'Retry' },
      event_key: 'retry',
      status: 'pending',
      attempts: 0,
    });
    globalThis.fetch = async () => new Response('{}', { status: 500 });
    await dispatchNotifications();
    const failure = rows.find((row) => row.id === 'failure');
    assert.equal(failure.status, 'failed');
    assert.ok(Date.parse(failure.available_at) > Date.now());
    assert.equal(failure.lease_until, null);
    rows.push({
      id: 'deferred',
      channel: 'email',
      recipient: 'admin@test.invalid',
      event_type: 'test',
      payload: {},
      event_key: 'deferred',
      status: 'pending',
      attempts: 0,
    });
    const before = calls.length;
    await dispatchNotifications(0, Date.now() - 1);
    const deferred = rows.find((row) => row.id === 'deferred');
    assert.equal(deferred.status, 'pending');
    assert.equal(deferred.attempts, 0);
    assert.equal(deferred.lease_until, null);
    assert.equal(calls.length, before);
    console.log(
      'Notification channel fan-out, receipts, email idempotency, failed delivery and retry scheduling passed without sending messages.',
    );
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.noticeTestDb;
    for (const [key, value] of Object.entries(previous))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  }
});
