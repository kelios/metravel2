import { expect, test } from './fixtures';
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth';
import { gotoWithRetry, preacceptCookies } from './helpers/navigation';

async function setupFakeSubscriptionsPage(page: import('@playwright/test').Page, paginate = false) {
  await ensureAuthedStorageFallback(page, { userId: '1', userName: 'E2E User' });
  await mockFakeAuthApis(page);

  const results = [
    {
      user: 42,
      display_name: 'Siarhey',
      avatar_url: null,
      travels_total: 3,
      travels_preview: [
        { id: 101, slug: 'plane-trip', name: 'Краков. Полёт на планере' },
        { id: 102, slug: 'exam-trip', name: 'Экзамен по маршруту' },
        { id: 103, slug: 'third-trip', name: 'Третий маршрут' },
      ],
    },
    { user: 43, display_name: 'Anna Nowak', avatar_url: null, travels_total: 0, travels_preview: [] },
    { user: 44, display_name: 'Ivan Test', avatar_url: null, travels_total: 0, travels_preview: [] },
  ];
  const requestedPages: number[] = [];
  let perAuthorTravelReads = 0;
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname === '/api/travels/' && url.searchParams.has('user_id')) {
      perAuthorTravelReads += 1;
    }
  });
  await page.route('**/api/user/subscriptions/?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (route.request().method() !== 'GET' || params.get('view') !== 'compact') return route.continue();
    const pageNumber = Number(params.get('page'));
    requestedPages.push(pageNumber);
    return route.fulfill({
      json: {
        count: paginate ? 4 : 3,
        next: paginate && pageNumber === 1 ? '/api/user/subscriptions/?view=compact&page=2&page_size=20' : null,
        previous: null,
        results: pageNumber === 1
          ? results
          : [{ user: 45, display_name: 'Second page', avatar_url: null, travels_total: 0, travels_preview: [] }],
      },
    });
  });

  await page.route('**/api/user/subscribers/?*', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } });
  });
  await preacceptCookies(page);
  return { requestedPages, perAuthorTravelReads: () => perAuthorTravelReads };
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

  test('can find an author on an explicitly loaded second page', async ({ page }) => {
    const { requestedPages, perAuthorTravelReads } = await setupFakeSubscriptionsPage(page, true);
    await gotoWithRetry(page, '/subscriptions');
    await expect(page.getByText('Siarhey', { exact: true })).toBeVisible();
    expect(requestedPages).toEqual([1]);

    await page.getByLabel('Поиск по подпискам').fill('Second page');
    await expect(page.getByText('Ничего не найдено', { exact: true })).toBeHidden();
    await page.getByRole('button', { name: 'Показать ещё' }).click();
    await expect(page.getByText('Second page', { exact: true })).toBeVisible();
    expect(requestedPages).toEqual([1, 2]);
    expect(perAuthorTravelReads()).toBe(0);
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
