import path from 'node:path';

import { test, expect } from './fixtures';
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth';
import { gotoWithRetry, preacceptCookies } from './helpers/navigation';

const SCREENSHOTS_DIR = path.join(process.cwd(), '.codex-temp', 'profile-inline-sections');

async function setupPublicProfile(page: import('@playwright/test').Page) {
  await ensureAuthedStorageFallback(page);
  await mockFakeAuthApis(page);
  await preacceptCookies(page);

  await page.route('**/api/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });

  await page.route('**/api/user/1/profile/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        user: 1,
        first_name: 'Юлия',
        last_name: '',
        avatar: null,
        cover_photo: null,
        participant_rating: null,
        rank_summary: { level: 5, title: 'Эксперт' },
      }),
    })
  );

  await page.route('**/api/user/subscriptions/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [{ id: 42, user: 42, first_name: 'Анна', last_name: 'Путешественница', avatar: null }],
      }),
    })
  );

  await page.route('**/api/user/subscribers/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [{ id: 43, user: 43, first_name: 'Иван', last_name: 'Подписчик', avatar: null }],
      }),
    })
  );

  await page.route('**/api/achievements/user/1/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rank: { level: 5, title: 'Эксперт', total_points: 700, badges_count: 13 },
        earned_badges: [],
        peer_received: [],
      }),
    })
  );

  await page.route('**/api/travels/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        count: 13,
        results: Array.from({ length: 12 }, (_, index) => ({
          id: index + 1,
          slug: `route-${index + 1}`,
          name: `Маршрут ${index + 1}`,
          countryName: 'Беларусь',
          travel_image_thumb_url: '',
        })),
      }),
    })
  );
}

test.describe('Public profile inline sections', () => {
  test('keeps routes and own subscription sections under one profile header', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await setupPublicProfile(page);
    await gotoWithRetry(page, '/user/1');

    const subscriptionsTab = page.getByRole('tab', { name: /Подписки/ });
    const subscribersTab = page.getByRole('tab', { name: /Подписчики/ });
    await expect(subscriptionsTab).toBeVisible();
    await expect(subscribersTab).toBeVisible();
    await expect(page.getByText('Ур.5 · Эксперт', { exact: true })).toBeVisible();

    const profileUrl = page.url();
    await subscribersTab.click();
    await expect(page.getByText('Иван Подписчик', { exact: true })).toBeVisible();
    expect(page.url()).toBe(profileUrl);

    await subscriptionsTab.click();
    await expect(page.getByText('Анна Путешественница', { exact: true })).toBeVisible();
    expect(page.url()).toBe(profileUrl);

    const routesTab = page.getByRole('tab', { name: 'Маршруты: 13', exact: true });
    await expect(routesTab).toBeVisible();
    await routesTab.click();
    await expect(page.getByRole('button', { name: 'Показать ещё путешествия автора' })).toBeVisible();
    expect(page.url()).toBe(profileUrl);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'desktop.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('tab', { name: /Подписки/ })).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'mobile.png'), fullPage: true });

    expect(consoleErrors).toEqual([]);
  });
});
