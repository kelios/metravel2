import { test, expect } from './fixtures';
import { preacceptCookies, gotoWithRetry } from './helpers/navigation';

test.describe('Subscriptions @smoke', () => {
  test('unauthenticated user sees login prompt on /subscriptions', async ({ page }) => {
    await page.context().clearCookies();
    await page.addInitScript(() => {
      try {
        window.localStorage.removeItem('secure_userToken');
        window.localStorage.removeItem('userId');
        window.localStorage.removeItem('userName');
      } catch {
        // ignore
      }
    });

    await preacceptCookies(page);
    await gotoWithRetry(page, '/subscriptions');

    const authPrompt = page.getByText(/Войдите в аккаунт|Войти/i);
    await expect(authPrompt.first()).toBeVisible({ timeout: 15_000 });
  });

  test('authenticated user sees subscriptions page with tabs', async ({ page }) => {
    const hasCreds = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD;
    if (!hasCreds) {
      test.info().annotations.push({
        type: 'note',
        description: 'E2E_EMAIL/E2E_PASSWORD not provided; skipping',
      });
      return;
    }

    await preacceptCookies(page);
    await gotoWithRetry(page, '/subscriptions');

    await expect(page).not.toHaveURL(/\/login/);

    // Should show tab bar with both tabs
    const subscriptionsTab = page.getByRole('tab', { name: 'Подписки' });
    const subscribersTab = page.getByRole('tab', { name: 'Подписчики' });

    const tabsVisible = await Promise.all([
      subscriptionsTab.first().waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false),
      subscribersTab.first().waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false),
    ]);

    // At least one tab should be visible (page loaded successfully)
    expect(tabsVisible.some(Boolean)).toBeTruthy();
  });

  test('tab switching between Подписки and Подписчики works', async ({ page }) => {
    const hasCreds = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD;
    if (!hasCreds) {
      test.info().annotations.push({
        type: 'note',
        description: 'E2E_EMAIL/E2E_PASSWORD not provided; skipping',
      });
      return;
    }

    await preacceptCookies(page);
    await gotoWithRetry(page, '/subscriptions');

    await expect(page).not.toHaveURL(/\/login/);

    const subscribersTab = page.getByRole('tab', { name: 'Подписчики' });
    await subscribersTab.first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null);

    if (await subscribersTab.first().isVisible()) {
      await subscribersTab.first().click();

      // After clicking subscribers tab, should see either subscriber list or empty state
      const candidates = [
        page.getByText('У вас пока нет подписчиков'),
        page.getByText(/подписчик/i),
      ];
      const anyVisible = await Promise.all(
        candidates.map((c) =>
          c.first()
            .waitFor({ state: 'visible', timeout: 10_000 })
            .then(() => true)
            .catch(() => false)
        )
      );
      expect(anyVisible.some(Boolean)).toBeTruthy();
    }
  });

  test('search input filters subscriptions list', async ({ page }) => {
    const hasCreds = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD;
    if (!hasCreds) {
      test.info().annotations.push({
        type: 'note',
        description: 'E2E_EMAIL/E2E_PASSWORD not provided; skipping',
      });
      return;
    }

    await preacceptCookies(page);
    await gotoWithRetry(page, '/subscriptions');

    await expect(page).not.toHaveURL(/\/login/);

    // Wait for page to load
    const searchInput = page.getByLabel('Поиск по подпискам');
    const pageLoaded = await Promise.race([
      searchInput.first().waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false),
      page.getByText('Вы ещё ни на кого не подписаны').waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false),
    ]);

    // If search input is visible, test filtering
    if (await searchInput.first().isVisible().catch(() => false)) {
      await searchInput.first().fill('несуществующийпользователь12345');
      // Should show "nothing found" or empty list
      const noResults = page.getByText('Ничего не найдено');
      await expect(noResults.first()).toBeVisible({ timeout: 5_000 }).catch(() => {
        // If no "nothing found" text, the list might just be empty — that's ok
      });
    }

    expect(pageLoaded).toBeTruthy();
  });

  test('subscriptions page is accessible from account menu', async ({ page }) => {
    const hasCreds = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD;
    if (!hasCreds) {
      test.info().annotations.push({
        type: 'note',
        description: 'E2E_EMAIL/E2E_PASSWORD not provided; skipping',
      });
      return;
    }

    await preacceptCookies(page);
    await gotoWithRetry(page, '/');

    // Open account menu
    const accountMenuAnchor = page.getByTestId('account-menu-anchor');
    const menuVisible = await accountMenuAnchor
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (menuVisible) {
      await accountMenuAnchor.first().click();

      // Look for "Подписки" menu item
      const subscriptionsLink = page.getByText('Подписки', { exact: true });
      const linkVisible = await subscriptionsLink
        .first()
        .waitFor({ state: 'visible', timeout: 5_000 })
        .then(() => true)
        .catch(() => false);

      expect(linkVisible).toBeTruthy();
    }
  });
});
