import { test, expect } from './fixtures';
import {
  createMockThreads,
  openAuthenticatedMessages,
  prepareAuthenticatedMessaging,
} from './helpers/messages';
import { gotoWithRetry } from './helpers/navigation';

test.describe('Messages — unread integration', () => {
  test('desktop account menu shows the exact aggregate unread count', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await prepareAuthenticatedMessaging(page, { threads: createMockThreads([3, 1, 0]) });
    await gotoWithRetry(page, '/');

    const accountMenu = page.getByTestId('account-menu-anchor');
    await expect(accountMenu).toBeVisible({ timeout: 20_000 });
    await accountMenu.click();
    await expect(page.getByText('Сообщения (4)', { exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test('desktop account menu omits the counter when all threads are read', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await prepareAuthenticatedMessaging(page, { threads: createMockThreads([0, 0, 0]) });
    await gotoWithRetry(page, '/');

    const accountMenu = page.getByTestId('account-menu-anchor');
    await expect(accountMenu).toBeVisible({ timeout: 20_000 });
    await accountMenu.click();
    await expect(page.getByText('Сообщения', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Сообщения \(\d+\)/)).toHaveCount(0);
  });

  test('mobile menu exposes unread count in text and accessible name', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await prepareAuthenticatedMessaging(page, { threads: createMockThreads([3, 1, 0]) });
    await gotoWithRetry(page, '/');

    const openMenu = page.getByTestId('mobile-menu-open');
    await expect(openMenu).toBeVisible({ timeout: 20_000 });
    await openMenu.click();
    await expect(page.getByText('Сообщения (4)', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel(/Сообщения.*4.*непрочитанных/i)).toBeVisible();
  });

  test('unread thread label is explicit and opening it calls mark-read', async ({ page }) => {
    const tracker = await openAuthenticatedMessages(page, '/messages', {
      threads: createMockThreads([3, 1, 0]),
    });

    const unreadThread = page.getByLabel(/Диалог с Алексей Петров.*3 непрочитанных/i);
    await expect(unreadThread).toBeVisible({ timeout: 20_000 });
    const threadLabels = await page.getByLabel(/Диалог с/).allTextContents();
    expect(threadLabels.length).toBeGreaterThanOrEqual(3);
    await unreadThread.click();

    await expect(page.getByLabel('Поле ввода сообщения')).toBeVisible();
    await expect.poll(() => tracker.markReadThreadIds, { timeout: 10_000 }).toContain(10);
  });
});
