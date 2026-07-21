import { test, expect } from './fixtures';
import { assertNoHorizontalScroll, gotoWithRetry, preacceptCookies } from './helpers/navigation';
import {
  MOCK_MESSAGES,
  MOCK_USERS,
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

  test('desktop dark theme fills the viewport and keeps delete tooltip visible', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.addInitScript(() => window.localStorage.setItem('theme', 'dark'));
    await openAuthenticatedMessages(page);

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const pageBackground = page.getByTestId('messages-page-background');
    const desktopShell = page.getByTestId('messages-desktop-shell');
    const card = page.getByTestId('thread-item-10');
    const deleteButton = page.getByLabel('Удалить диалог с Алексей Петров');
    await expect(pageBackground).toBeVisible({ timeout: 20_000 });
    await expect(desktopShell).toBeVisible();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(deleteButton).toBeVisible();
    const [pageBackgroundBox, desktopShellBox, cardBoxBeforeHover, themeBackgrounds] = await Promise.all([
      pageBackground.boundingBox(),
      desktopShell.boundingBox(),
      card.boundingBox(),
      pageBackground.evaluate((element) => ({
        page: getComputedStyle(element).backgroundColor,
        html: getComputedStyle(document.documentElement).backgroundColor,
        parent: element.parentElement?.getBoundingClientRect().toJSON(),
      })),
    ]);

    expect(pageBackgroundBox).not.toBeNull();
    expect(desktopShellBox).not.toBeNull();
    expect(themeBackgrounds.parent).toBeDefined();
    expect(Math.abs(pageBackgroundBox!.x - themeBackgrounds.parent!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(pageBackgroundBox!.width - themeBackgrounds.parent!.width)).toBeLessThanOrEqual(1);
    expect(desktopShellBox!.width).toBeLessThanOrEqual(1000);
    expect(
      Math.abs(
        desktopShellBox!.x
        - (pageBackgroundBox!.x + (pageBackgroundBox!.width - desktopShellBox!.width) / 2),
      ),
    ).toBeLessThanOrEqual(1);
    expect(themeBackgrounds.page).toBe(themeBackgrounds.html);
    expect(themeBackgrounds.page).not.toBe('rgb(255, 255, 255)');
    await assertNoHorizontalScroll(page);

    const hoverConsoleErrors: string[] = [];
    page.on('pageerror', (error) => hoverConsoleErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') hoverConsoleErrors.push(message.text());
    });
    await deleteButton.hover();

    const tooltip = page.getByText('Удалить диалог с Алексей Петров', { exact: true });
    await expect(tooltip).toBeVisible();
    const [cardBoxAfterHover, tooltipBox, cardOverflow] = await Promise.all([
      card.boundingBox(),
      tooltip.boundingBox(),
      card.evaluate((element) => getComputedStyle(element).overflow),
    ]);

    expect(cardBoxBeforeHover).not.toBeNull();
    expect(cardBoxAfterHover).toEqual(cardBoxBeforeHover);
    expect(tooltipBox).not.toBeNull();
    expect(cardOverflow).toBe('visible');
    expect(tooltipBox!.y).toBeGreaterThanOrEqual(cardBoxAfterHover!.y);
    expect(tooltipBox!.y + tooltipBox!.height).toBeLessThanOrEqual(900);
    expect(tooltipBox!.y + tooltipBox!.height).toBeLessThanOrEqual(
      cardBoxAfterHover!.y + cardBoxAfterHover!.height,
    );
    expect(hoverConsoleErrors).toEqual([]);

    await testInfo.attach('messages-dark-theme-and-delete-tooltip', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
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

    const lightThemeBackgrounds = await page.getByTestId('messages-page-background').evaluate((element) => ({
      page: getComputedStyle(element).backgroundColor,
      html: getComputedStyle(document.documentElement).backgroundColor,
    }));
    expect(lightThemeBackgrounds.page).toBe(lightThemeBackgrounds.html);
    const search = page.getByLabel('Поиск диалогов');
    await expect(search).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Выберите диалог или начните новый')).toBeVisible();
    await page.getByLabel(THREAD_ALEXEY).click();

    await expect(page.getByLabel('Поле ввода сообщения')).toBeVisible();
    await expect(search).toBeVisible();
    await expect(page.getByLabel('Назад к списку диалогов')).toHaveCount(0);
  });

  test('desktop confirms and optimistically removes an active thread after 204', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const tracker = await openAuthenticatedMessages(page, '/messages', {
      deferThreadDelete: true,
    });

    const alexey = page.getByLabel(THREAD_ALEXEY);
    await expect(alexey).toBeVisible({ timeout: 20_000 });
    await alexey.click();
    await expect(page.getByLabel('Поле ввода сообщения')).toBeVisible();

    await page.getByLabel('Удалить диалог с Алексей Петров').click();
    const confirm = page.getByLabel('Подтвердить удаление диалога');
    await expect(confirm).toBeVisible();
    await testInfo.attach('messages-delete-confirm', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    const deletionConsoleErrors: string[] = [];
    page.on('pageerror', (error) => deletionConsoleErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') deletionConsoleErrors.push(message.text());
    });
    await confirm.click();

    await expect.poll(() => tracker.deletedThreadIds).toContain(10);
    await expect(alexey).toHaveCount(0);
    await expect(page.getByText('Выберите диалог или начните новый')).toBeVisible();

    tracker.releaseThreadDelete();
    await expect(alexey).toHaveCount(0);
    expect(deletionConsoleErrors).toEqual([]);
  });

  test('desktop restores an optimistically removed thread after delete failure', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const tracker = await openAuthenticatedMessages(page, '/messages', {
      deferThreadDelete: true,
      deleteThreadStatus: 500,
    });

    const alexey = page.getByLabel(THREAD_ALEXEY);
    await expect(alexey).toBeVisible({ timeout: 20_000 });
    await alexey.click();
    await page.getByLabel('Удалить диалог с Алексей Петров').click();
    await page.getByLabel('Подтвердить удаление диалога').click();

    await expect.poll(() => tracker.deletedThreadIds).toContain(10);
    await expect(alexey).toHaveCount(0);
    tracker.releaseThreadDelete();

    await expect(alexey).toBeVisible();
    await expect(page.getByLabel('Поле ввода сообщения')).toBeVisible();
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
