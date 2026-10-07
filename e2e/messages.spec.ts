import { test, expect } from './fixtures';
import { assertNoHorizontalScroll, gotoWithRetry, preacceptCookies } from './helpers/navigation';
import type { MessageThread } from '@/api/messages';
import {
  MOCK_MESSAGES,
  MOCK_USERS,
  openAuthenticatedMessages,
} from './helpers/messages';

const THREAD_ALEXEY = /Диалог с Алексей Петров/;

// Имена для замера строки диалога (#2264): два эталонных со скриншота владельца и
// имя из 40 знаков. Дата не сегодняшняя (сегодня строка показывает время) — это
// самая широкая форма метки: день и месяц.
const NAME_PROBE_NOW = new Date();
const NAME_PROBE_DAY = NAME_PROBE_NOW.getMonth() === 8 && NAME_PROBE_NOW.getDate() === 12 ? 13 : 12;
const NAME_PROBE_NAMES = [
  'Редакция metravel',
  'Julia Sauran',
  'Константин Константинопольский-Задунайский'.slice(0, 40),
];
const NAME_PROBE_THREADS: MessageThread[] = NAME_PROBE_NAMES.map((displayName, index) => ({
  id: 20 + index,
  participants: [1, 20 + index],
  participant_previews: [
    { id: 20 + index, display_name: displayName, avatar_url: null, username: null, is_deleted: false },
  ],
  created_at: '2026-01-15T10:00:00Z',
  last_message_created_at: `${NAME_PROBE_NOW.getFullYear()}-09-${NAME_PROBE_DAY}T10:00:00Z`,
  unread_count: index === 0 ? 150 : 0,
}));

// Fixture regression only. Production acceptance uses dedicated e2e-account
// conversations without these mocks after the reviewed SHA is deployed.
const PREVIEW_LOCALES = [
  { locale: 'ru', own: 'Вы', deleted: 'Сообщение удалено' },
  { locale: 'be', own: 'Вы', deleted: 'Паведамленне выдалена' },
  { locale: 'uk', own: 'Ви', deleted: 'Повідомлення видалено' },
  { locale: 'pl', own: 'Ty', deleted: 'Wiadomość usunięta' },
  { locale: 'en', own: 'You', deleted: 'Message deleted' },
] as const;

test.describe('Messages — deterministic user flows', () => {
  for (const width of [320, 390, 1440]) {
    for (const theme of ['light', 'dark']) {
      for (const { locale, own, deleted } of PREVIEW_LOCALES) {
        test(`safe compact previews ${width}px ${theme} ${locale}`, async ({ page }, testInfo) => {
          await page.setViewportSize({ width, height: 900 });
          await page.addInitScript(({ locale, theme }) => {
            window.localStorage.setItem('theme', theme);
            window.localStorage.setItem('@metravel/locale-preference:v1', JSON.stringify({
              version: 1, mode: 'explicit', locale,
            }));
          }, { locale, theme });
          const hidden = 'PRIVATE_DELETED_PREVIEW_DO_NOT_RENDER';
          const previewThreads: MessageThread[] = NAME_PROBE_THREADS.map((thread, index) => ({
            ...thread,
            participant_previews: [{ ...thread.participant_previews![0], display_name: index === 1 ? 'Julia Ivanova' : 'Julia Sauran' }],
            last_message_preview: {
              text: index === 2 ? hidden : index === 0 ? 'Short route' : 'Meeting by the lake',
              sender_id: index === 0 ? 1 : thread.participants[1], is_deleted: index === 2,
            },
          }));
          const errors: string[] = [];
          let messageRequests = 0;
          page.on('pageerror', (error) => errors.push(error.message));
          page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
          page.on('request', (request) => {
            if (new URL(request.url()).pathname === '/api/messages/') messageRequests += 1;
          });
          await openAuthenticatedMessages(page, '/messages', { threads: previewThreads });
          const preview = page.getByTestId('thread-preview-20');
          const row = page.getByTestId('thread-item-20');
          await expect(preview).toHaveText(`${own}: Short route`, { timeout: 20_000 });
          await expect(page.getByTestId('thread-preview-21')).toHaveText('Meeting by the lake');
          await expect(page.getByTestId('thread-preview-22')).toHaveText(deleted);
          const before = await row.boundingBox();
          expect(before).not.toBeNull();

          const long = 'М'.repeat(200);
          previewThreads[0].last_message_preview!.text = long;
          await page.reload();
          await expect(preview).toHaveText(`${own}: ${long}`, { timeout: 20_000 });
          const after = await row.boundingBox();
          expect(after).not.toBeNull();
          expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(1);
          const geometry = await preview.evaluate((element) => {
            const style = getComputedStyle(element);
            const name = element.parentElement!.parentElement!.querySelector('[data-testid="thread-name-20"]')!;
            return {
              overflow: style.overflow, ellipsis: style.textOverflow, whiteSpace: style.whiteSpace,
              scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
              top: element.getBoundingClientRect().top, nameBottom: name.getBoundingClientRect().bottom,
            };
          });
          expect(geometry).toMatchObject({ overflow: 'hidden', ellipsis: 'ellipsis', whiteSpace: 'nowrap' });
          expect(geometry.clientWidth).toBeGreaterThan(0);
          expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
          expect(geometry.top).toBeGreaterThanOrEqual(geometry.nameBottom - 1);
          await expect(row.getByRole('button').first()).toHaveAttribute('aria-label', new RegExp(long));
          await expect(row.getByText('99+', { exact: true })).toBeVisible();
          await expect(page.getByTestId('thread-time-20')).toBeVisible();
          await expect(page.getByText(hidden, { exact: true })).toHaveCount(0);
          expect(await page.locator('[aria-label]').evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label'))))
            .not.toEqual(expect.arrayContaining([expect.stringContaining(hidden)]));
          await assertNoHorizontalScroll(page);
          expect(messageRequests).toBe(0);
          expect(errors).toEqual([]);
          await testInfo.attach(`preview-${width}-${theme}-${locale}`, {
            body: await page.screenshot(), contentType: 'image/png',
          });
        });
      }
    }
  }

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
    const pageBackground = page.getByTestId('messages-screen');
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
    // #2264: кнопка удаления появляется по наведению на строку и до него клики не ловит.
    const deleteAction = card.locator('[data-thread-row-action="true"]');
    await expect(deleteAction).toHaveCSS('opacity', '0');
    await expect(deleteAction).toHaveCSS('pointer-events', 'none');
    await card.hover();
    await expect(deleteAction).toHaveCSS('opacity', '1');
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
    // #2267: на desktop кнопку пустого состояния несёт правая панель, в шапке
    // списка — иконка с той же подписью; в самом пустом списке второй кнопки нет.
    await expect(page.getByTestId('thread-list-new-conversation')).toBeVisible();
    await expect(page.getByTestId('thread-list-empty-action')).toHaveCount(0);
    await page.getByTestId('messages-empty-chat-action').click();
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

    const lightThemeBackgrounds = await page.getByTestId('messages-screen').evaluate((element) => ({
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

    await page.getByTestId('thread-item-10').hover();
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
    await page.getByTestId('thread-item-10').hover();
    await page.getByLabel('Удалить диалог с Алексей Петров').click();
    await page.getByLabel('Подтвердить удаление диалога').click();

    await expect.poll(() => tracker.deletedThreadIds).toContain(10);
    await expect(alexey).toHaveCount(0);
    tracker.releaseThreadDelete();

    await expect(alexey).toBeVisible();
    await expect(page.getByLabel('Поле ввода сообщения')).toBeVisible();
  });

  // #2264: имя собеседника делило линию с датой, счётчиком, шевроном и постоянной
  // корзиной — на панели 320 px ему оставалось 62 px («Реда…», «Julia …»).
  for (const { width, minNameWidth } of [
    { width: 320, minNameWidth: 200 },
    { width: 390, minNameWidth: 270 },
    { width: 1440, minNameWidth: 200 },
  ]) {
    test(`thread row keeps the peer name readable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openAuthenticatedMessages(page, '/messages', { threads: NAME_PROBE_THREADS });

      const rows = await Promise.all(
        NAME_PROBE_THREADS.map(async (thread) => {
          const name = page.getByTestId(`thread-name-${thread.id}`);
          await expect(name).toBeVisible({ timeout: 20_000 });
          return name.evaluate((element) => {
            const style = getComputedStyle(element);
            const context = document.createElement('canvas').getContext('2d')!;
            context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
            const text = element.textContent ?? '';
            const truncated = element.scrollWidth > element.clientWidth;
            let visibleChars = text.length;
            if (truncated) {
              const ellipsis = context.measureText('…').width;
              visibleChars = 0;
              while (
                visibleChars < text.length
                && context.measureText(text.slice(0, visibleChars + 1)).width + ellipsis <= element.clientWidth
              ) {
                visibleChars += 1;
              }
            }
            const time = element.parentElement?.querySelector('[data-testid^="thread-time-"]');
            return {
              text,
              truncated,
              visibleChars,
              width: element.clientWidth,
              title: element.getAttribute('title'),
              bottom: element.getBoundingClientRect().bottom,
              timeTop: time ? time.getBoundingClientRect().top : null,
            };
          });
        }),
      );

      const [editorial, julia, long] = rows;
      // Эталонные имена со скриншота владельца — целиком, при дате и бейдже «99+».
      expect(editorial).toMatchObject({ text: 'Редакция metravel', truncated: false });
      expect(julia).toMatchObject({ text: 'Julia Sauran', truncated: false });
      await expect(page.getByTestId('thread-item-20').getByText('99+')).toBeVisible();
      // Имя из 40 знаков: многоточие в конце, видно не меньше 20, полное — в подсказке.
      expect(long.text).toHaveLength(40);
      expect(long.truncated).toBe(true);
      expect(long.visibleChars).toBeGreaterThanOrEqual(20);
      expect(long.title).toBe(long.text);
      for (const row of rows) {
        expect(row.width).toBeGreaterThanOrEqual(minNameWidth);
        // Дата — на линии под именем, а не рядом с ним.
        expect(row.timeTop).not.toBeNull();
        expect(row.timeTop!).toBeGreaterThanOrEqual(row.bottom - 1);
      }
      // Дата — на языке интерфейса (e2e идёт на RU), а не браузера.
      await expect(page.getByTestId('thread-time-20')).toHaveText(`${NAME_PROBE_DAY} сент.`);
      await assertNoHorizontalScroll(page);
    });
  }

  // #2267: «Новый диалог» был карточкой той же формы, что строка диалога, а пустая
  // правая панель предлагала «начать новый» без кнопки.
  for (const width of [1440, 768]) {
    test(`desktop ${width}px: new conversation is a header action and an empty-panel button`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openAuthenticatedMessages(page, '/messages', { threads: NAME_PROBE_THREADS, users: MOCK_USERS });

      const headerButton = page.getByTestId('thread-list-new-conversation');
      await expect(headerButton).toBeVisible({ timeout: 20_000 });
      await expect(headerButton).toHaveAttribute('aria-label', 'Новый диалог');
      expect(await headerButton.evaluate((element) => Boolean(element.closest('[data-thread-row]')))).toBe(false);
      const headerBox = (await headerButton.boundingBox())!;
      expect(headerBox.width).toBeGreaterThanOrEqual(44);
      expect(headerBox.height).toBeGreaterThanOrEqual(44);
      const searchBox = (await page.getByLabel('Поиск диалогов').boundingBox())!;
      expect(Math.abs(headerBox.y + headerBox.height / 2 - (searchBox.y + searchBox.height / 2))).toBeLessThanOrEqual(2);

      // Список из трёх диалогов: было около 255 px, решение #2267 — не выше 200.
      const first = (await page.getByTestId('thread-item-20').boundingBox())!;
      const last = (await page.getByTestId('thread-item-22').boundingBox())!;
      expect(last.y + last.height - first.y).toBeLessThanOrEqual(200);

      await expect(page.getByText('Выберите диалог или начните новый')).toBeVisible();
      await page.getByTestId('messages-empty-chat-action').click();
      await expect(page.getByLabel('Поиск пользователя')).toBeVisible();
      await assertNoHorizontalScroll(page);
    });
  }

  // #2267: при открытии экрана пустое состояние «Нет сообщений» мелькало до ответа
  // сервера, шапка панели (поиск и «Новый диалог») снималась на время загрузки, а на
  // desktop первый коммит рисовал мобильную раскладку и следующий перекладывал её в
  // двухпанельную. Каждый коммит React ловит MutationObserver самой страницы — по
  // кадрам такой перемонтаж виден через раз.
  for (const width of [1440, 768, 390]) {
    test(`${width}px: the panel header mounts once and the empty state never flashes before the list`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript(() => {
        const probe = { headerNodes: 0, headerGone: 0, emptyFlashed: false, commits: 0 };
        (window as unknown as { __threadPanelProbe: typeof probe }).__threadPanelProbe = probe;
        const seen = new Set<Element>();
        let hadHeader = false;
        const sample = () => {
          probe.commits += 1;
          const header = document.querySelector('[data-testid="thread-list-new-conversation"]');
          if (header && !seen.has(header)) {
            seen.add(header);
            probe.headerNodes = seen.size;
          }
          if (hadHeader && !header) probe.headerGone += 1;
          hadHeader = hadHeader || Boolean(header);
          if (document.querySelector('[data-testid="thread-list-empty"]')) probe.emptyFlashed = true;
        };
        new MutationObserver(sample).observe(document, { childList: true, subtree: true });
      });
      await openAuthenticatedMessages(page);

      await expect(page.getByLabel(THREAD_ALEXEY)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('thread-list-new-conversation')).toBeVisible();
      // Поздний перемонтаж тоже считается: ждём, пока счётчик коммитов не совпадёт
      // в двух замерах подряд — страница перестала меняться.
      await page.waitForFunction(
        () => {
          const state = window as unknown as {
            __threadPanelProbe: { commits: number };
            __threadPanelSettledAt?: number;
          };
          const settled = state.__threadPanelSettledAt === state.__threadPanelProbe.commits;
          state.__threadPanelSettledAt = state.__threadPanelProbe.commits;
          return settled;
        },
        undefined,
        { polling: 250 },
      );

      const probe = await page.evaluate(
        () => (window as unknown as { __threadPanelProbe: Record<string, unknown> }).__threadPanelProbe,
      );
      expect(probe.commits as number).toBeGreaterThan(0);
      expect(probe).toMatchObject({ headerNodes: 1, headerGone: 0, emptyFlashed: false });
    });
  }

  test('desktop keyboard reaches the row delete button and opens the confirmation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openAuthenticatedMessages(page);

    const row = page.getByLabel(THREAD_ALEXEY);
    const deleteButton = page.getByLabel('Удалить диалог с Алексей Петров');
    const deleteAction = page.getByTestId('thread-item-10').locator('[data-thread-row-action="true"]');
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(deleteAction).toHaveCSS('opacity', '0');

    await page.getByLabel('Поиск диалогов').focus();
    for (let step = 0; step < 6 && !(await row.evaluate((element) => element === document.activeElement)); step += 1) {
      await page.keyboard.press('Tab');
    }
    await expect(row).toBeFocused();
    await expect(deleteAction).toHaveCSS('opacity', '1');

    await page.keyboard.press('Tab');
    await expect(deleteButton).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Подтвердить удаление диалога')).toBeVisible();
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
