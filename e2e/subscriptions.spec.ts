import { expect, test } from './fixtures';
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth';
import { gotoWithRetry, preacceptCookies } from './helpers/navigation';

async function setupFakeSubscriptionsPage(page: import('@playwright/test').Page) {
  await ensureAuthedStorageFallback(page, { userId: '1', userName: 'E2E User' });
  await mockFakeAuthApis(page);

  await page.route('**/api/user/subscriptions/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          { id: 42, user: 42, first_name: 'Siarhey', last_name: '', avatar: null },
          { id: 43, user: 43, first_name: 'Anna', last_name: 'Nowak', avatar: null },
          { id: 44, user: 44, first_name: 'Ivan', last_name: 'Test', avatar: null },
        ],
      }),
    });
  });

  await page.route('**/api/user/subscribers/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [] }),
    });
  });

  await page.route('**/api/travels/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        count: 3,
        results: [
          {
            id: 101,
            slug: 'plane-trip',
            name: 'Краков. Полёт на планере',
            countryName: 'Польша',
            travel_image_thumb_url: '',
          },
          {
            id: 102,
            slug: 'exam-trip',
            name: 'Экзамен по маршруту',
            countryName: 'Литва',
            travel_image_thumb_url: '',
          },
          {
            id: 103,
            slug: 'third-trip',
            name: 'Третий маршрут',
            countryName: 'Беларусь',
            travel_image_thumb_url: '',
          },
        ],
      }),
    });
  });

  await preacceptCookies(page);
}

test.describe('Subscriptions @smoke', () => {
  test('shows the login prompt to a guest', async ({ page }) => {
    await page.context().clearCookies();
    await page.addInitScript(() => {
      window.localStorage.removeItem('secure_userToken');
      window.localStorage.removeItem('secure_refreshToken');
      window.localStorage.removeItem('userId');
      window.localStorage.removeItem('userName');
    });
    await preacceptCookies(page);

    await gotoWithRetry(page, '/subscriptions');

    await expect(page.getByText('Войдите в аккаунт', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();
  });

  test('switches tabs and filters the deterministic subscriptions list', async ({ page }) => {
    await setupFakeSubscriptionsPage(page);
    await gotoWithRetry(page, '/subscriptions');

    const subscriptionsTab = page.getByRole('tab', { name: 'Подписки' });
    const subscribersTab = page.getByRole('tab', { name: 'Подписчики' });
    await expect(subscriptionsTab).toBeVisible();
    await expect(subscribersTab).toBeVisible();
    await expect(page.getByText('Siarhey', { exact: true })).toBeVisible();
    await expect(page.getByText('Anna Nowak', { exact: true })).toBeVisible();

    const search = page.getByLabel('Поиск по подпискам');
    await search.fill('Anna');
    await expect(page.getByText('Anna Nowak', { exact: true })).toBeVisible();
    await expect(page.getByText('Siarhey', { exact: true })).toBeHidden();
    await search.fill('missing-author');
    await expect(page.getByText('Ничего не найдено', { exact: true })).toBeVisible();

    await subscribersTab.click();
    await expect(page.getByText('У вас пока нет подписчиков', { exact: true })).toBeVisible();
    await expect(page.getByText('Anna Nowak', { exact: true })).toBeHidden();
  });

  test('keeps the mobile travel rail horizontally scrollable without blocking vertical scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupFakeSubscriptionsPage(page);
    await gotoWithRetry(page, '/subscriptions');

    await expect(page.getByText('Siarhey', { exact: true })).toBeVisible({ timeout: 20_000 });
    const rail = page.getByTestId('subscription-travels-rail').first();
    await expect(rail).toBeVisible();

    const metrics = await rail.evaluate((node) => {
      const element = node as HTMLElement;
      const firstCard = element.querySelector('[data-testid*="tab-travel-card"]') as HTMLElement | null;
      let scrollParent: HTMLElement | null = element.parentElement;
      while (scrollParent && scrollParent !== document.body) {
        if (scrollParent.scrollHeight > scrollParent.clientHeight + 1) break;
        scrollParent = scrollParent.parentElement;
      }
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        overflowX: window.getComputedStyle(element).overflowX,
        touchAction: window.getComputedStyle(element).touchAction,
        firstCardTouchAction: firstCard ? window.getComputedStyle(firstCard).touchAction : null,
        hasVerticalScrollParent: Boolean(scrollParent && scrollParent !== document.body),
      };
    });

    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
    expect(metrics.overflowX).toMatch(/auto|scroll/);
    expect(metrics.touchAction).toContain('pan-x');
    expect(metrics.firstCardTouchAction).not.toBe('pan-y');
    expect(metrics.hasVerticalScrollParent).toBe(true);
  });
});
