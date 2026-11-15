import { test, expect } from '@playwright/test';
import { fixtureCookie } from '../fixtures/browser-session.mjs';

const event = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'browser-test',
  title: 'Browser Test Cup',
  game: 'CS2',
  status: 'upcoming',
  start_date: '2099-11-01T12:00:00Z',
  registration_deadline: '2099-10-31T12:00:00Z',
  entry_fee: 0,
  prize_pool: 0,
  max_teams: 16,
  registrations_count: 0,
};

test.beforeEach(async ({ page }) => {
  await page.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.turnstile={render:(element,options)=>{options.callback('browser-captcha-token');return 'widget';},remove:()=>{}};`,
    }),
  );
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const body =
      path === '/api/auth'
        ? { profile: null }
        : {
            matches: [],
            tournaments: [event],
            registrations: [],
            has_more: false,
            registrations_has_more: false,
          };
    return route.fulfill({ json: body });
  });
});

test('homepage defers arena requests until visible and has no startup overlay', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/matches') requests.push(request.url());
  });
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('[data-startup-loader]')).toHaveCount(0);
  expect(requests).toHaveLength(0);
  await page.locator('#arena').scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Post a match', exact: true })).toBeVisible();
  expect(requests.length).toBeGreaterThan(0);
});

test('temporary account refresh failure keeps the user signed in and retries on resume', async ({
  page,
}) => {
  let mode: 'signed-in' | 'offline' | 'signed-out' = 'signed-in';
  let requests = 0;
  await page.clock.install();
  await page.route('**/api/auth', async (route) => {
    requests++;
    if (mode === 'offline')
      return route.fulfill({ status: 503, json: { error: 'Temporary provider outage' } });
    return route.fulfill({
      json: {
        profile:
          mode === 'signed-out'
            ? null
            : {
                id: '11111111-1111-4111-8111-111111111112',
                role: 'player',
                faceit_nickname: 'SessionCaptain',
              },
      },
    });
  });
  await page.goto('/matches');
  await expect(page.getByRole('link', { name: 'SessionCaptain', exact: true })).toBeVisible();
  mode = 'offline';
  const before = requests;
  await page.clock.fastForward(16000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => requests).toBeGreaterThan(before);
  await expect(page.getByRole('link', { name: 'SessionCaptain', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in', exact: true })).toHaveCount(0);
  mode = 'signed-in';
  const retry = requests;
  await page.clock.fastForward(16000);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => requests).toBeGreaterThan(retry);
  await expect(page.getByRole('link', { name: 'SessionCaptain', exact: true })).toBeVisible();
  mode = 'signed-out';
  await page.clock.fastForward(60000);
  await expect(page.getByRole('link', { name: 'Log in', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'SessionCaptain', exact: true })).toHaveCount(0);
});

test('arena shimmer stays centered and readable before the initial results appear', async ({
  page,
}) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/matches?**', async (route) => {
      await pending;
      await route.fulfill({ json: { matches: [], has_more: false } });
    });
    await page.goto('/matches');
    const loader = page.getByRole('status', { name: 'Loading the arena...', exact: true }).last();
    await expect(loader).toBeVisible();
    const box = await loader.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs(box!.x + box!.width / 2 - width / 2)).toBeLessThan(3);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await expect.poll(() => !!release).toBe(true);
    await expect(loader).toBeVisible();
    release!();
    await expect(loader).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Post a match', exact: true })).toBeVisible();
    await page.unroute('**/api/matches?**');
  }
});

test('guest match keeps form after error and submits CAPTCHA on retry', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/matches', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON();
    expect(body.captcha_token).toBe('browser-captcha-token');
    expect(body.title).toBe('Evening gather');
    attempts++;
    return route.fulfill(
      attempts === 1
        ? { status: 429, json: { error: 'Please try again shortly.' } }
        : { json: { success: true } },
    );
  });
  await page.goto('/matches');
  await page.getByRole('button', { name: 'Post a match', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Phone number').fill('03001234567');
  await dialog.getByLabel('Title', { exact: true }).fill('Evening gather');
  await dialog.getByLabel('Match date and time (PKT)').fill('2099-11-01T18:00');
  await expect(dialog.locator('[name=captcha_token]')).toHaveValue('browser-captcha-token');
  await dialog.getByRole('button', { name: 'Post match', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Please try again shortly.');
  await expect(dialog.locator('[name=captcha_token]')).toHaveValue('browser-captcha-token');
  await dialog.getByRole('button', { name: 'Post match', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Match updated.', { exact: true })).toBeVisible();
  expect(attempts).toBe(2);
});

test('guest tournament application sends roster and CAPTCHA', async ({ page }) => {
  await page.route('**/api/tournaments', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON();
    expect(body.captcha_token).toBe('browser-captcha-token');
    expect(body.players).toHaveLength(5);
    expect(body.team_name).toBe('Test Team');
    return route.fulfill({ json: { success: true } });
  });
  await page.goto('/tournaments');
  await page.getByRole('button', { name: /apply|register/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Team name', { exact: true }).fill('Test Team');
  await dialog.getByLabel('Captain name', { exact: true }).fill('Captain');
  await dialog.getByLabel('WhatsApp / phone').fill('03001234567');
  await dialog.getByLabel('Captain email').fill('captain@example.com');
  for (let i = 1; i <= 5; i++)
    await dialog.getByLabel(`Player ${i} name`, { exact: true }).fill(`Player ${i}`);
  await dialog.getByRole('checkbox').check();
  await expect(dialog.locator('[name=captcha_token]')).toHaveValue('browser-captcha-token');
  await dialog.getByRole('button', { name: 'Submit team application' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Team application saved. Organisers will review it.')).toBeVisible();
});

test('signed-in payment status survives switching devices without a guest cookie', async ({
  page,
  context,
}) => {
  const account = '11111111-1111-4111-8111-111111111112';
  await page.route('**/api/auth', (route) =>
    route.fulfill({
      json: {
        profile: {
          id: account,
          role: 'player',
          faceit_nickname: 'Captain',
          account_email: 'captain@example.test',
        },
      },
    }),
  );
  await page.route('**/api/tournaments?**', (route) =>
    route.fulfill({
      json: {
        tournaments: [{ ...event, entry_fee: 1000 }],
        registrations: [
          {
            id: 'entry',
            tournament_id: event.id,
            captain_id: account,
            can_manage: true,
            team_name: 'Account Team',
            status: 'pending',
            amount_due: 1000,
            payment_status: 'pending',
          },
        ],
        has_more: false,
        registrations_has_more: false,
      },
    }),
  );
  for (const width of [1440, 390]) {
    await context.clearCookies();
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/tournaments');
    await expect(
      page.getByText('Signed in as captain@example.test', { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Send paid screenshot' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register your team', exact: true })).toHaveCount(
      0,
    );
  }
});

test('teams page loads only its current page and can navigate back', async ({ page }) => {
  const id = '22222222-2222-4222-8222-222222222222';
  await page.route('**/api/auth', (route) =>
    route.fulfill({
      json: {
        profile: {
          id,
          role: 'player',
          faceit_id: 'faceit-player',
          faceit_nickname: 'Captain',
          faceit_level: 5,
        },
      },
    }),
  );
  await page.route('**/api/teams?**', (route) => {
    const current = Number(new URL(route.request().url()).searchParams.get('page') || 1);
    return route.fulfill({
      json: {
        teams: [{ id: 'team-' + current, name: 'Squad page ' + current, captain_id: id }],
        members: [],
        page: current,
        has_more: current === 1,
      },
    });
  });
  await page.goto('/teams');
  await expect(page.getByRole('heading', { name: 'Squad page 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next teams', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Squad page 2', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Squad page 1', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Previous teams', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Squad page 1', exact: true })).toBeVisible();
});

test('admin cancellation requires a password and removes the cancelled team', async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: 'sb-127-auth-token',
      value: fixtureCookie(),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  let cancelled = false;
  await page.route('**/api/auth', (route) =>
    route.fulfill({
      json: { profile: { id: 'admin-fixture', role: 'admin', faceit_nickname: 'Admin' } },
    }),
  );
  await page.route('**/api/admin/operations**', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      expect(body.action).toBe('cancel_registration');
      if (body.password !== 'fixture password')
        return route.fulfill({ status: 403, json: { error: 'Incorrect account password.' } });
      cancelled = true;
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({
      json: {
        items: cancelled
          ? []
          : [
              {
                id: 'entry',
                team_name: 'Cancel Fixture Team',
                status: 'pending',
                payment_status: 'pending',
                roster_details: [],
                tournament: { title: event.title },
              },
            ],
        total: cancelled ? 0 : 1,
      },
    });
  });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Teams', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Cancel Fixture Team', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel registration', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('button', { name: 'Confirm cancellation', exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel('Your admin account password').fill('wrong fixture');
  await dialog.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Incorrect account password.');
  await expect(dialog.getByLabel('Your admin account password')).toHaveValue('');
  await dialog.getByLabel('Your admin account password').fill('fixture password');
  await dialog.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cancel Fixture Team', exact: true })).toHaveCount(
    0,
  );
});

test('tournament description and rules offer formatting controls and safe previews', async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: 'sb-127-auth-token',
      value: fixtureCookie(),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await page.route('**/api/auth', (route) =>
    route.fulfill({
      json: { profile: { id: 'admin-fixture', role: 'admin', faceit_nickname: 'Admin' } },
    }),
  );
  await page.goto('/admin');
  await page.getByRole('button', { name: '+ Create tournament', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const description = dialog.getByLabel('Description', { exact: true });
  await description.fill('Important');
  await description.evaluate((element: HTMLTextAreaElement) =>
    element.setSelectionRange(0, element.value.length),
  );
  await dialog.getByRole('button', { name: 'Bold in Description', exact: true }).click();
  await expect(description).toHaveValue('**Important**');
  await dialog.getByRole('button', { name: 'Preview Description', exact: true }).click();
  await expect(
    dialog.getByRole('region', { name: 'Description preview' }).locator('strong'),
  ).toHaveText('Important');
  const rules = dialog.getByLabel('Rules', { exact: true });
  await rules.fill('First rule\nSecond rule');
  await rules.evaluate((element: HTMLTextAreaElement) =>
    element.setSelectionRange(0, element.value.length),
  );
  await dialog.getByRole('button', { name: 'Bullets in Rules', exact: true }).click();
  await dialog.getByRole('button', { name: 'Preview Rules', exact: true }).click();
  await expect(dialog.getByRole('region', { name: 'Rules preview' }).locator('li')).toHaveCount(2);
});

test('load more retains visible matches, then a refresh discards stale pages', async ({ page }) => {
  let refreshed = false;
  let release: (() => void) | undefined;
  const match = (id: string, title: string) => ({
    id,
    title,
    type: 'gather_5v5',
    status: 'open',
    scheduled_time: '2099-11-01T18:00:00Z',
    roster: [],
    min_faceit_level: 1,
    max_faceit_level: 10,
    target_players_count: 10,
    creator_id: null,
    created_at: '2099-01-01',
  });
  await page.route('**/api/matches?**', async (route) => {
    const current = Number(new URL(route.request().url()).searchParams.get('page') || 1);
    if (current === 2)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    return route.fulfill({
      json: {
        matches: [
          current === 1
            ? match('first', refreshed ? 'Fresh first page' : 'First page match')
            : match('second', 'Second page match'),
        ],
        has_more: current === 1,
      },
    });
  });
  await page.goto('/matches');
  await expect(page.getByText('First page match', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Load more matches', exact: true }).click();
  await expect.poll(() => !!release).toBe(true);
  await expect(page.getByText('First page match', { exact: true })).toBeVisible();
  release!();
  await expect(page.getByText('Second page match', { exact: true })).toBeVisible();
  refreshed = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByText('Fresh first page', { exact: true })).toBeVisible();
  await expect(page.getByText('Second page match', { exact: true })).toHaveCount(0);
});

test('early-bird offer appears on the event on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/tournaments**', (route) =>
    route.fulfill({
      json: {
        tournaments: [
          {
            ...event,
            entry_fee: 2000,
            early_bird_fee: 1500,
            early_bird_deadline: '2099-10-30T12:00:00Z',
          },
        ],
        registrations: [],
        has_more: false,
        registrations_has_more: false,
      },
    }),
  );
  await page.goto('/tournaments');
  await expect(page.getByText('Early-bird access', { exact: false })).toBeVisible();
  await expect(page.getByText('PKR 1,500', { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/early-bird-mobile.png', fullPage: true });
});

test('admin early-bird setting reveals fee and PKT deadline', async ({ page, context }) => {
  await context.addCookies([
    {
      name: 'sb-127-auth-token',
      value: fixtureCookie(),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await page.route('**/api/auth', (route) =>
    route.fulfill({
      json: { profile: { id: 'admin-fixture', role: 'admin', faceit_nickname: 'Admin' } },
    }),
  );
  await page.goto('/admin');
  await page.getByRole('button', { name: '+ Create tournament', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Enable early-bird pricing').check();
  await dialog.getByRole('spinbutton', { name: /^Entry fee per team/ }).fill('2000');
  await dialog.getByLabel('Early-bird fee per team (PKR)').fill('1500');
  await dialog.getByLabel('Offer ends (PKT)').fill('2099-10-30T17:00');
  await expect(dialog.getByLabel('Early-bird fee per team (PKR)')).toHaveValue('1500');
  await dialog.getByLabel('Enable early-bird pricing').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/early-bird-admin.png' });
  await dialog.getByLabel('Enable early-bird pricing').uncheck();
  await expect(dialog.getByLabel('Early-bird fee per team (PKR)')).toHaveCount(0);
});
