import { test, expect } from './fixtures';

const gotoWithRetry = async (
  page: any,
  url: string,
  opts: { waitUntil?: 'domcontentloaded' | 'load' | 'networkidle'; timeout?: number; attempts?: number } = {}
) => {
  const attempts = Math.max(1, Number(opts.attempts ?? 3));
  const waitUntil = opts.waitUntil ?? 'domcontentloaded';
  const timeout = opts.timeout ?? 60_000;

  let lastErr: any = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await page.goto(url, { waitUntil, timeout });
      return;
    } catch (err: any) {
      lastErr = err;
      const msg = err?.message ? String(err.message) : String(err);
      const isConnRefused =
        msg.includes('ERR_CONNECTION_REFUSED') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('ERR_CONNECTION_RESET') ||
        msg.includes('net::ERR_CONNECTION_REFUSED');
      if (!isConnRefused) break;
      await page.waitForTimeout(1000);
    }
  }
  throw lastErr;
};

test.describe('@smoke Manual QA automation: auth entrypoints', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login -> registration link works with visible cookie banner', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoWithRetry(page, '/login', { waitUntil: 'domcontentloaded', timeout: 60_000, attempts: 4 });

    const banner = page.getByTestId('consent-banner');
    await expect(banner).toBeVisible({ timeout: 10_000 });

    const registerLink = page.getByText('Зарегистрируйтесь', { exact: true });
    await expect(registerLink).toBeVisible();
    await registerLink.click();

    await expect(page).toHaveURL(/\/registration/);
  });

  test('account menu navigation works for guest users', async ({ page, context }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoWithRetry(page, '/', { waitUntil: 'domcontentloaded', timeout: 60_000, attempts: 4 });

    // Открываем меню аккаунта
    const accountButton = page.locator('[data-testid="account-menu-anchor"]:visible').first();
    await expect(accountButton).toBeVisible({ timeout: 10_000 });
    await accountButton.click();

    // Проверяем что меню открылось
    const menu = page.getByTestId('web-menu-panel');
    await expect(menu).toBeVisible({ timeout: 5_000 });

    // Кликаем на "Войти" и ждем открытия новой вкладки
    const loginButton = page.getByRole('menuitem', { name: 'Войти' });
    await expect(loginButton).toBeVisible();
    
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      loginButton.click(),
    ]);

    // Проверяем что новая вкладка открылась на странице логина
    await newPage.waitForLoadState('domcontentloaded');
    await expect(newPage).toHaveURL(/\/login/, { timeout: 10_000 });
    await newPage.close();
  });

  test('account menu registration works for guest users', async ({ page, context }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoWithRetry(page, '/', { waitUntil: 'domcontentloaded', timeout: 60_000, attempts: 4 });

    // Открываем меню аккаунта
    const accountButton = page.locator('[data-testid="account-menu-anchor"]:visible').first();
    await expect(accountButton).toBeVisible({ timeout: 10_000 });
    await accountButton.click();

    // Проверяем что меню открылось
    const menu = page.getByTestId('web-menu-panel');
    await expect(menu).toBeVisible({ timeout: 5_000 });

    // Кликаем на "Зарегистрироваться" и ждем открытия новой вкладки
    const registerButton = page.getByRole('menuitem', { name: 'Зарегистрироваться' });
    await expect(registerButton).toBeVisible();
    
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      registerButton.click(),
    ]);

    // Проверяем что новая вкладка открылась на странице регистрации
    await newPage.waitForLoadState('domcontentloaded');
    await expect(newPage).toHaveURL(/\/registration/, { timeout: 10_000 });
    await newPage.close();
  });
});
