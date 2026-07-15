import { test, expect } from './fixtures';
import { assertNoHorizontalScroll, gotoWithRetry, preacceptCookies } from './helpers/navigation';
import {
  MOCK_MESSAGES,
  MOCK_USERS,
  createMockThreads,
  openAuthenticatedMessages,
} from './helpers/messages';

const THREAD_ALEXEY = /Диалог с Алексей Петров/;

test.describe('Messages — deterministic user flows', () => {
  test('guest sees the login gate and no private thread list', async ({ page }) => {
    await page.context().clearCookies();
    await page.addInitScript(() => {
      window.localStorage.removeItem('secure_userToken');
      window.localStorage.removeItem('userId');
      window.localStorage.removeItem('userName');
    });
    await preacceptCookies(page);
    await gotoWithRetry(page, '/messages');

    await expect(page.getByText('Войдите в аккаунт')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();
    await expect(page.getByLabel(THREAD_ALEXEY)).toHaveCount(0);
  });

  test('thread list renders canonical names, filters them, and stays noindex', async ({ page }) => {
    await openAuthenticatedMessages(page);

    const alexey = page.getByLabel(THREAD_ALEXEY);
    const maria = page.getByLabel(/Диалог с Мария Иванова/);
    await expect(alexey).toBeVisible({ timeout: 20_000 });
    await expect(maria).toBeVisible();

    const search = page.getByLabel('Поиск диалогов');
    await search.fill('Мария');
    await expect(search).toHaveValue('Мария');
    await expect(maria).toBeVisible();
    await expect(alexey).toBeHidden();

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/,
      { timeout: 15_000 },
    );
    await assertNoHorizontalScroll(page);
  });

  test('existing-user deep link opens chat and sending clears the composer', async ({ page }) => {
    const tracker = await openAuthenticatedMessages(page, '/messages?userId=2');

    const input = page.getByLabel('Поле ввода сообщения');
    const send = page.getByLabel('Отправить сообщение');
    await expect(input).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Алексей Петров').first()).toBeVisible();
    await expect(page.getByText(MOCK_MESSAGES[0].text)).toBeVisible();
    await expect(page.getByText(MOCK_MESSAGES[1].text)).toBeVisible();

    await expect(send).toBeDisabled();
    await input.fill('E2E новое сообщение');
    await expect(send).toBeEnabled();
    await send.click();
    await expect(input).toHaveValue('');
    await expect
      .poll(() => tracker.sentPayloads.at(-1)?.text, { timeout: 10_000 })
      .toBe('E2E новое сообщение');
  });

  test('empty list opens recipient picker and starts a virtual conversation', async ({ page }) => {
    await openAuthenticatedMessages(page, '/messages', { threads: [], users: MOCK_USERS });

    await expect(page.getByText('Нет сообщений')).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('Новый диалог').click();
    const userSearch = page.getByLabel('Поиск пользователя');
    await expect(userSearch).toBeVisible();
    await userSearch.fill('Елена');
    await expect(page.getByLabel('Написать Елена Козлова')).toBeVisible();
    await page.getByLabel('Написать Елена Козлова').click();

    await expect(page.getByText('Елена Козлова').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Поле ввода сообщения')).toBeVisible();
  });

  test('desktop keeps list and chat side by side without a chat back button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openAuthenticatedMessages(page);

    const search = page.getByLabel('Поиск диалогов');
    await expect(search).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Выберите диалог или начните новый')).toBeVisible();
    await page.getByLabel(THREAD_ALEXEY).click();

    await expect(page.getByLabel('Поле ввода сообщения')).toBeVisible();
    await expect(search).toBeVisible();
    await expect(page.getByLabel('Назад к списку диалогов')).toHaveCount(0);
  });

  test('mobile replaces the list with chat and returns through the back action', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openAuthenticatedMessages(page);

    const alexey = page.getByLabel(THREAD_ALEXEY);
    await expect(alexey).toBeVisible({ timeout: 20_000 });
    await alexey.click();

    const back = page.getByLabel('Назад к списку диалогов');
    await expect(page.getByLabel('Поле ввода сообщения')).toBeVisible();
    await expect(page.getByLabel('Поиск диалогов')).toBeHidden();
    await expect(back).toBeVisible();
    await back.click();

    await expect(page.getByLabel(THREAD_ALEXEY)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Поле ввода сообщения')).toHaveCount(0);
  });
});
