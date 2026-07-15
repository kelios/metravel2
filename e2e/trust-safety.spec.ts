import { expect, test } from './fixtures';
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth';
import { preacceptCookies } from './helpers/navigation';

const CURRENT_USER_ID = '1';
const TARGET_USER_ID = '2';

async function setupSafetyScenario(page: import('@playwright/test').Page) {
  await ensureAuthedStorageFallback(page, {
    userId: CURRENT_USER_ID,
    userName: 'E2E User',
  });
  await preacceptCookies(page);

  // Keep this product-flow test independent from storage-state users and the
  // live dev API. Live auth/contracts belong to the live-contract project.
  await page.route('**/api/**', async (route) => {
    const method = route.request().method();
    await route.fulfill({
      status: method === 'GET' ? 200 : 201,
      contentType: 'application/json',
      body: JSON.stringify(method === 'GET' ? {} : { id: 1, status: 'created' }),
    });
  });
  await mockFakeAuthApis(page);

  await page.route(`**/api/user/${TARGET_USER_ID}/profile/**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: Number(TARGET_USER_ID),
        user: Number(TARGET_USER_ID),
        first_name: 'Другой',
        last_name: 'Пользователь',
        avatar: null,
        cover_photo: null,
        reported_by_me: false,
        is_blocked_by_me: false,
      }),
    }),
  );

  await page.route(`**/api/user/${TARGET_USER_ID}/report/**`, async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1, status: 'created' }),
    });
  });
}

test.describe('Trust & Safety — report a user', () => {
  test('submits a selected report reason for another user', async ({ page }) => {
    await setupSafetyScenario(page);
    await page.goto(`/user/${TARGET_USER_ID}`, { waitUntil: 'domcontentloaded' });

    const menu = page.getByTestId('user-safety-menu');
    await expect(menu).toBeVisible();
    await menu.click();
    await page.getByTestId('user-safety-report').click();

    const spam = page.getByTestId('report-reason-spam');
    await expect(spam).toBeVisible();
    await spam.click();

    const reportRequest = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname.endsWith(`/api/user/${TARGET_USER_ID}/report/`),
    );
    const submit = page.getByTestId('report-submit');
    await expect(submit).toBeEnabled();
    await submit.click();

    const request = await reportRequest;
    expect(request.postDataJSON()).toMatchObject({ reason: 'spam' });
    await expect(page.getByTestId('report-submit')).not.toBeVisible();
  });
});
