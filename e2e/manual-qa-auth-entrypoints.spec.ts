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

  const getAccountAnchor = (page: any) =>
    page
      .locator('[data-testid="account-menu-anchor"]:visible')
      .or(page.getByRole('button', { name: /Открыть меню аккаунта/i }))
      .first();

  const openGuestAccountMenu = async (page: any) => {
    let accountButton = getAccountAnchor(page);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (await accountButton.isVisible().catch(() => false)) {
        break;
      }
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
      accountButton = getAccountAnchor(page);
    }
    await expect(accountButton).toBeVisible({ timeout: 15_000 });

    await accountButton.hover().catch(() => null);
    await accountButton.focus().catch(() => null);
    await accountButton.click();

    const menu = page.getByTestId('web-menu-panel');
    const loginItem = page.getByRole('menuitem', { name: 'Войти' });

    const menuOpened = await Promise.race([
      menu.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false),
      loginItem.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false),
    ]);

    expect(menuOpened).toBeTruthy();
    return { menu, loginItem };
  };

  test('login -> registration link works with visible cookie banner', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoWithRetry(page, '/login', { waitUntil: 'domcontentloaded', timeout: 60_000, attempts: 4 });

    const banner = page.getByTestId('consent-banner');
    await expect(banner).toBeVisible({ timeout: 10_000 });

    const registerLink = page.getByText('Зарегистрируйтесь', { exact: true });
    await expect(registerLink).toBeVisible();
    await registerLink.scrollIntoViewIfNeeded();
    await registerLink.click();

    await expect(page).toHaveURL(/\/registration/);
  });

  test('account menu navigation works for guest users', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoWithRetry(page, '/', { waitUntil: 'domcontentloaded', timeout: 60_000, attempts: 4 });

    const { loginItem } = await openGuestAccountMenu(page);

    await expect(loginItem).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/login/, { timeout: 10_000 }),
      loginItem.click(),
    ]);

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('account menu registration works for guest users', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoWithRetry(page, '/', { waitUntil: 'domcontentloaded', timeout: 60_000, attempts: 4 });

    await openGuestAccountMenu(page);

    const registerButton = page.getByRole('menuitem', { name: 'Зарегистрироваться' });
    await expect(registerButton).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/registration/, { timeout: 10_000 }),
      registerButton.click(),
    ]);

    await expect(page).toHaveURL(/\/registration/, { timeout: 10_000 });
  });
});
