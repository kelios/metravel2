import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { preacceptCookies, gotoWithRetry } from './helpers/navigation';
import { simpleEncrypt, mockFakeAuthApis } from './helpers/auth';

// ---------------------------------------------------------------------------
// Mobile web: экранная клавиатура НЕ сжимает layout viewport. MessagesScreen
// теперь следует за реальной высотой visualViewport. Playwright не умеет открыть
// системную клавиатуру, поэтому подменяем viewport управляемой заглушкой и
// проверяем геометрию экрана, списка и композера напрямую.
// ---------------------------------------------------------------------------

const USER = { id: 1, name: 'Юлия' };
const OTHER = { id: 2, name: 'Алексей Петров' };
const THREAD_ID = 10;
const KEYBOARD_HEIGHT = 320;
const BROWSER_CHROME_HEIGHT = 96;

declare global {
    interface Window {
        __setVisualViewportInset?: (height: number) => void;
    }
}

async function seedAuth(page: Page) {
    const encrypted = simpleEncrypt('e2e-fake-token-user-' + USER.id, 'metravel_encryption_key_v1');
    await page.addInitScript(
        (payload: { encrypted: string; userId: string; userName: string }) => {
            try {
                window.localStorage.setItem('secure_userToken', payload.encrypted);
                window.localStorage.setItem('userId', payload.userId);
                window.localStorage.setItem('userName', payload.userName);
                window.localStorage.setItem('isSuperuser', 'false');
            } catch {
                // ignore
            }
        },
        { encrypted, userId: String(USER.id), userName: USER.name },
    );
}

async function installVisualViewportStub(page: Page) {
    await page.addInitScript(() => {
        const listeners: Record<string, Array<(event: Event) => void>> = {};
        const fake = {
            get width() {
                return window.innerWidth;
            },
            height: window.innerHeight,
            offsetTop: 0,
            offsetLeft: 0,
            pageTop: 0,
            pageLeft: 0,
            scale: 1,
            addEventListener(type: string, cb: (event: Event) => void) {
                (listeners[type] ||= []).push(cb);
            },
            removeEventListener(type: string, cb: (event: Event) => void) {
                listeners[type] = (listeners[type] || []).filter((item) => item !== cb);
            },
        };
        Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true });
        window.__setVisualViewportInset = (height: number) => {
            fake.height = window.innerHeight - height;
            (listeners.resize || []).forEach((cb) => cb(new Event('resize')));
        };
    });
}

async function installMocks(page: Page) {
    const thread = {
        id: THREAD_ID,
        participants: [USER.id, OTHER.id],
        created_at: '2026-02-08T10:00:00Z',
        last_message_created_at: '2026-02-08T10:00:00Z',
    };
    const users = [{ id: OTHER.id, first_name: 'Алексей', last_name: 'Петров', avatar: null, user: OTHER.id }];

    await page.route('**/api/message-threads/**', (route) => {
        const url = route.request().url();
        if (url.includes('thread-by-user')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ thread_id: THREAD_ID }) });
        }
        if (url.includes('available-users')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(users) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([thread]) });
    });

    const messages = Array.from({ length: 40 }, (_, index) => ({
        id: 100 + index,
        thread: THREAD_ID,
        sender: index % 2 === 0 ? USER.id : OTHER.id,
        text: `Тестовое сообщение ${index + 1}`,
        created_at: new Date(Date.UTC(2026, 7, 1, 12, index)).toISOString(),
    }));

    await page.route('**/api/messages/**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ count: messages.length, next: null, previous: null, results: messages }),
        }),
    );
}

base.describe('Messages — composer vs mobile web keyboard', () => {
    let context: BrowserContext;
    let page: Page;

    base.beforeEach(async ({ browser }) => {
        context = await browser.newContext({
            storageState: undefined,
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true,
        });
        page = await context.newPage();
        await seedAuth(page);
        await installVisualViewportStub(page);
        await installMocks(page);
        await mockFakeAuthApis(page);
        await preacceptCookies(page);
    });

    base.afterEach(async () => {
        await context?.close();
    });

    base('lifts the input and the send button above the keyboard', async () => {
        await gotoWithRetry(page, `/messages?userId=${OTHER.id}`);

        const input = page.getByLabel('Поле ввода сообщения');
        const sendButton = page.getByLabel('Отправить сообщение');
        await input.waitFor({ state: 'visible', timeout: 30_000 });

        const viewportHeight = await page.evaluate(() => window.innerHeight);
        const restingInput = await input.boundingBox();
        expect(restingInput).not.toBeNull();
        expect(restingInput!.y + restingInput!.height).toBeGreaterThan(viewportHeight - KEYBOARD_HEIGHT);

        await page.evaluate((height) => window.__setVisualViewportInset?.(height), KEYBOARD_HEIGHT);
        await page.waitForTimeout(300);

        const keyboardTop = viewportHeight - KEYBOARD_HEIGHT;
        const liftedInput = await input.boundingBox();
        const liftedSend = await sendButton.boundingBox();
        expect(liftedInput).not.toBeNull();
        expect(liftedSend).not.toBeNull();
        expect(liftedInput!.y + liftedInput!.height).toBeLessThanOrEqual(keyboardTop);
        expect(liftedSend!.y + liftedSend!.height).toBeLessThanOrEqual(keyboardTop);

        // Клавиатура закрылась — композер возвращается на место.
        await page.evaluate(() => window.__setVisualViewportInset?.(0));
        await page.waitForTimeout(300);
        const restoredInput = await input.boundingBox();
        expect(restoredInput!.y + restoredInput!.height).toBeGreaterThan(keyboardTop);
    });

    base('keeps the document fixed and scrolls only the message list under browser chrome', async () => {
        await gotoWithRetry(page, `/messages?userId=${OTHER.id}`);
        await page.getByTestId('messages-scroll-list').waitFor({ state: 'visible', timeout: 30_000 });
        await page.evaluate(
            (height) => window.__setVisualViewportInset?.(height),
            BROWSER_CHROME_HEIGHT,
        );

        await expect.poll(() => page.getByTestId('messages-screen').evaluate((element) => {
            const viewport = window.visualViewport;
            const viewportBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
            return Math.abs(Math.round(element.getBoundingClientRect().bottom - viewportBottom));
        })).toBeLessThanOrEqual(1);
        await expect.poll(() => page.evaluate(() => ({
            overflowY: getComputedStyle(document.body).overflowY,
            overscrollBehaviorY: getComputedStyle(document.body).overscrollBehaviorY,
        }))).toEqual({ overflowY: 'hidden', overscrollBehaviorY: 'none' });

        const list = page.getByTestId('messages-scroll-list');
        const chatHeader = page.getByText(OTHER.name, { exact: true }).first();
        const composer = page.getByTestId('message-composer');
        const before = await Promise.all([chatHeader.boundingBox(), composer.boundingBox()]);

        const scrollState = await list.evaluate((element) => {
            const beforeScrollTop = element.scrollTop;
            element.scrollTop = beforeScrollTop + 160;
            return {
                beforeScrollTop,
                afterScrollTop: element.scrollTop,
                clientHeight: element.clientHeight,
                scrollHeight: element.scrollHeight,
                pageScrollY: window.scrollY,
            };
        });

        const listBox = await list.boundingBox();
        expect(listBox).not.toBeNull();
        await list.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
        });
        await page.mouse.move(
            listBox!.x + listBox!.width / 2,
            listBox!.y + listBox!.height / 2,
        );
        await page.mouse.wheel(0, 400);

        const after = await Promise.all([chatHeader.boundingBox(), composer.boundingBox()]);
        expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
        expect(scrollState.afterScrollTop).not.toBe(scrollState.beforeScrollTop);
        expect(scrollState.pageScrollY).toBe(0);
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
        expect(after).toEqual(before);

        await page.evaluate(() => window.__setVisualViewportInset?.(0));
        await page.getByRole('link', { name: 'MeTravel логотип' }).click();
        await expect(page).toHaveURL(/\/$/);
        await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflowY))
            .not.toBe('hidden');
    });

    for (const scenario of [
        { label: 'small phone', width: 320, height: 700, keyboardHeight: 240 },
        { label: 'tablet', width: 820, height: 1180, keyboardHeight: 360 },
        { label: 'desktop', width: 1280, height: 800, keyboardHeight: 96 },
    ]) {
        base(`tracks the visible viewport on ${scenario.label} width`, async () => {
            await page.setViewportSize({ width: scenario.width, height: scenario.height });
            await gotoWithRetry(page, `/messages?userId=${OTHER.id}`);

            const screen = page.getByTestId('messages-screen');
            const input = page.getByLabel('Поле ввода сообщения');
            await input.waitFor({ state: 'visible', timeout: 30_000 });
            await page.evaluate(
                (height) => window.__setVisualViewportInset?.(height),
                scenario.keyboardHeight,
            );

            const visibleBottom = scenario.height - scenario.keyboardHeight;
            await expect.poll(() => screen.evaluate((element) => {
                const viewport = window.visualViewport;
                const viewportBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
                return Math.abs(Math.round(element.getBoundingClientRect().bottom - viewportBottom));
            })).toBeLessThanOrEqual(1);
            await expect.poll(async () => {
                const box = await input.boundingBox();
                return box ? Math.round(box.y + box.height) : Number.POSITIVE_INFINITY;
            }).toBeLessThanOrEqual(visibleBottom);
        });
    }
});
