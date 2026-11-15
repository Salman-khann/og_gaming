import assert from 'node:assert/strict';
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), 'https://worker.test/api/worker');
  assert.equal(options.headers.Authorization, 'Bearer test-cron-secret-for-worker-check');
  assert.ok(options.signal instanceof AbortSignal);
  return new Response('{}', { status: 200 });
};
