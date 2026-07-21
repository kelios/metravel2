import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { preacceptCookies, gotoWithRetry } from './helpers/navigation';
import { simpleEncrypt, mockFakeAuthApis } from './helpers/auth';

// ---------------------------------------------------------------------------
// Mobile web: экранная клавиатура НЕ сжимает layout viewport, поэтому композер
// чата остаётся под ней. Настоящее перекрытие видно только через visualViewport
// (см. hooks/useWebKeyboardInset). Playwright не умеет открывать системную
// клавиатуру, поэтому подменяем visualViewport управляемой заглушкой и проверяем
// главное: поле ввода и кнопка «Отправить» уезжают выше кромки клавиатуры.
// ---------------------------------------------------------------------------

const USER = { id: 1, name: 'Юлия' };
const OTHER = { id: 2, name: 'Алексей Петров' };
const THREAD_ID = 10;
const KEYBOARD_HEIGHT = 320;

declare global {
    interface Window {
        __setKeyboardHeight?: (height: number) => void;
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
        window.__setKeyboardHeight = (height: number) => {
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

    await page.route('**/api/messages/**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
        }),
    );
}

base.describe('Messages — composer vs mobile web keyboard', () => {
    let context: BrowserContext;
    let page: Page;

    base.beforeAll(async ({ browser }) => {
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

    base.afterAll(async () => {
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

        await page.evaluate((height) => window.__setKeyboardHeight?.(height), KEYBOARD_HEIGHT);
        await page.waitForTimeout(300);

        const keyboardTop = viewportHeight - KEYBOARD_HEIGHT;
        const liftedInput = await input.boundingBox();
        const liftedSend = await sendButton.boundingBox();
        expect(liftedInput).not.toBeNull();
        expect(liftedSend).not.toBeNull();
        expect(liftedInput!.y + liftedInput!.height).toBeLessThanOrEqual(keyboardTop);
        expect(liftedSend!.y + liftedSend!.height).toBeLessThanOrEqual(keyboardTop);

        // Клавиатура закрылась — композер возвращается на место.
        await page.evaluate(() => window.__setKeyboardHeight?.(0));
        await page.waitForTimeout(300);
        const restoredInput = await input.boundingBox();
        expect(restoredInput!.y + restoredInput!.height).toBeGreaterThan(keyboardTop);
    });
});
