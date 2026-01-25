import { test, expect } from './fixtures';

test.describe('Manual QA automation: auth entrypoints', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login -> registration link works with visible cookie banner', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const banner = page.getByTestId('consent-banner');
    await expect(banner).toBeVisible({ timeout: 10_000 });

    const registerLink = page.getByText('Зарегистрируйтесь', { exact: true });
    await expect(registerLink).toBeVisible();
    await registerLink.click();

    await expect(page).toHaveURL(/\/registration/);
  });

  test('account menu navigation works for guest users', async ({ page, context }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Открываем меню аккаунта
    const accountButton = page.getByTestId('account-menu-anchor');
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
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Открываем меню аккаунта
    const accountButton = page.getByTestId('account-menu-anchor');
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
