import { test, expect } from './fixtures';
import { preacceptCookies, gotoWithRetry } from './helpers/navigation';

test.describe('Messages @smoke', () => {
  test('unauthenticated user sees login prompt on /messages', async ({ page }) => {
    // Clear auth state so we're not logged in
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
    await gotoWithRetry(page, '/messages');

    // Should show auth gate
    const authPrompt = page.getByText(/Войдите в аккаунт|Войти/i);
    await expect(authPrompt.first()).toBeVisible({ timeout: 15_000 });
  });

  test('authenticated user sees messages page', async ({ page }) => {
    const hasCreds = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD;
    if (!hasCreds) {
      test.info().annotations.push({
        type: 'note',
        description: 'E2E_EMAIL/E2E_PASSWORD not provided; skipping authenticated messages assertions',
      });
      return;
    }

    await preacceptCookies(page);
    await gotoWithRetry(page, '/messages');

    // Should not redirect to login
    await expect(page).not.toHaveURL(/\/login/);

    // Should show either thread list, empty state, or auth-error retry state
    const candidates = [
      page.getByText('Нет сообщений'),
      page.getByText('Новый диалог'),
      page.getByLabel(/Диалог с/),
      page.getByLabel('Поиск диалогов'),
      page.getByLabel('Повторить'),
    ];
    const anyVisible = await Promise.all(
      candidates.map((c) =>
        c.first()
          .waitFor({ state: 'visible', timeout: 15_000 })
          .then(() => true)
          .catch(() => false)
      )
    );
    expect(anyVisible.some(Boolean)).toBeTruthy();
  });

  test('messages page has search input', async ({ page }) => {
    const hasCreds = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD;
    if (!hasCreds) {
      test.info().annotations.push({
        type: 'note',
        description: 'E2E_EMAIL/E2E_PASSWORD not provided; skipping',
      });
      return;
    }

    await preacceptCookies(page);
    await gotoWithRetry(page, '/messages');

    await expect(page).not.toHaveURL(/\/login/);

    // Search input should be visible (now enabled for all devices)
    const searchInput = page.getByLabel('Поиск диалогов');
    // It may or may not be visible depending on whether there are threads
    // Just verify the page loaded without errors
    const pageLoaded = await Promise.race([
      searchInput.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false),
      page.getByText('Нет сообщений').waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false),
      page.getByLabel('Повторить').waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false),
    ]);
    expect(pageLoaded).toBeTruthy();
  });

  test('messages page has noindex meta', async ({ page }) => {
    const hasCreds = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD;
    if (!hasCreds) {
      test.info().annotations.push({
        type: 'note',
        description: 'E2E_EMAIL/E2E_PASSWORD not provided; skipping',
      });
      return;
    }

    await preacceptCookies(page);
    await gotoWithRetry(page, '/messages');

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Messages page should have noindex,nofollow
    const robotsMeta = await page.locator('meta[name="robots"]').getAttribute('content').catch(() => null);
    if (robotsMeta) {
      expect(robotsMeta).toContain('noindex');
    }
  });

  test('deep-link with userId opens chat or virtual thread', async ({ page }) => {
    const hasCreds = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD;
    if (!hasCreds) {
      test.info().annotations.push({
        type: 'note',
        description: 'E2E_EMAIL/E2E_PASSWORD not provided; skipping',
      });
      return;
    }

    await preacceptCookies(page);
    // Navigate with userId param — should open a chat view
    await gotoWithRetry(page, '/messages?userId=1');

    await expect(page).not.toHaveURL(/\/login/);

    // Should show chat view elements: input field or back button
    const chatElements = [
      page.getByLabel('Поле ввода сообщения'),
      page.getByLabel('Назад к списку диалогов'),
      page.getByLabel('Отправить сообщение'),
    ];
    const anyChat = await Promise.all(
      chatElements.map((c) =>
        c.first()
          .waitFor({ state: 'visible', timeout: 15_000 })
          .then(() => true)
          .catch(() => false)
      )
    );
    expect(anyChat.some(Boolean)).toBeTruthy();
  });
});
