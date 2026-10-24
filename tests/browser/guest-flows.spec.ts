import { test, expect } from '@playwright/test';

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
