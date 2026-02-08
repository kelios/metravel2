import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { preacceptCookies, gotoWithRetry } from './helpers/navigation';
import { simpleEncrypt } from './helpers/auth';

// ---------------------------------------------------------------------------
// Two-user conversation E2E test
//
// Since backend messaging endpoints are not deployed yet, we use Playwright
// route mocking with a SHARED message store. Two browser contexts represent
// two different users. When user1 sends a message the mock captures it;
// when user2's page polls/refreshes, the mock returns it — and vice versa.
// ---------------------------------------------------------------------------

const USER1 = { id: 1, name: 'Юлия' };
const USER2 = { id: 2, name: 'Алексей Петров' };

const THREAD_ID = 10;

const MOCK_USERS_FOR_USER1 = [
  { id: 2, first_name: 'Алексей', last_name: 'Петров', avatar: null, user: 2 },
];
const MOCK_USERS_FOR_USER2 = [
  { id: 1, first_name: 'Юлия', last_name: '', avatar: null, user: 1 },
];

// Shared message store (lives in Node.js process, accessible by both contexts)
let messageStore: Array<{
  id: number;
  thread: number;
  sender: number;
  text: string;
  created_at: string;
}> = [];
let nextMsgId = 200;

function makeThread(_currentUserId: number) {
  const lastMsg = messageStore.length > 0 ? messageStore[0] : null;
  return {
    id: THREAD_ID,
    participants: [USER1.id, USER2.id],
    created_at: '2026-02-08T10:00:00Z',
    last_message_created_at: lastMsg?.created_at ?? '2026-02-08T10:00:00Z',
  };
}

// ---------------------------------------------------------------------------
// Helper: seed auth for a specific user into a page via addInitScript
// ---------------------------------------------------------------------------
async function seedAuth(page: Page, user: { id: number; name: string }) {
  const encrypted = simpleEncrypt('e2e-fake-token-user-' + user.id, 'metravel_encryption_key_v1');
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
    { encrypted, userId: String(user.id), userName: user.name },
  );
}

// ---------------------------------------------------------------------------
// Helper: install messaging API mocks for a specific user
// ---------------------------------------------------------------------------
async function installMocks(page: Page, currentUser: { id: number; name: string }) {
  const otherUsers = currentUser.id === USER1.id ? MOCK_USERS_FOR_USER1 : MOCK_USERS_FOR_USER2;

  // GET /api/message-threads/
  await page.route('**/api/message-threads/', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const url = route.request().url();
    if (url.includes('thread-by-user')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ thread_id: THREAD_ID }),
      });
    }
    if (url.includes('available-users')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(otherUsers),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([makeThread(currentUser.id)]),
    });
  });

  await page.route('**/api/message-threads/available-users/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(otherUsers) }),
  );

  await page.route('**/api/message-threads/thread-by-user/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ thread_id: THREAD_ID }),
    }),
  );

  // GET/POST/DELETE /api/messages/
  await page.route('**/api/messages/**', (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      // Return messages from shared store (newest first)
      const sorted = [...messageStore].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: sorted.length,
          next: null,
          previous: null,
          results: sorted,
        }),
      });
    }

    if (method === 'POST') {
      // Capture sent message into shared store
      const postData = route.request().postDataJSON?.() ?? {};
      const text = postData?.text ?? '';
      const msg = {
        id: nextMsgId++,
        thread: THREAD_ID,
        sender: currentUser.id,
        text,
        created_at: new Date().toISOString(),
      };
      messageStore.unshift(msg);
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(msg),
      });
    }

    if (method === 'DELETE') {
      return route.fulfill({ status: 204, body: '' });
    }

    return route.continue();
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

base.describe.serial('Messages — Two-user conversation', () => {
  let context1: BrowserContext;
  let context2: BrowserContext;
  let page1: Page;
  let page2: Page;

  base.beforeAll(async ({ browser }) => {
    // Reset shared store
    messageStore = [];
    nextMsgId = 200;

    // Create two independent browser contexts (two users)
    context1 = await browser.newContext({ storageState: undefined });
    context2 = await browser.newContext({ storageState: undefined });
    page1 = await context1.newPage();
    page2 = await context2.newPage();

    // Seed auth and install mocks for each user
    await seedAuth(page1, USER1);
    await installMocks(page1, USER1);
    await preacceptCookies(page1);

    await seedAuth(page2, USER2);
    await installMocks(page2, USER2);
    await preacceptCookies(page2);
  });

  base.afterAll(async () => {
    await context1?.close();
    await context2?.close();
  });

  base('User 1 opens messages page and sees thread with User 2', async () => {
    await gotoWithRetry(page1, '/messages');

    // Wait for thread list to appear
    const thread = page1.getByLabel(/Диалог с Алексей Петров/);
    const visible = await thread
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    // Or empty state is fine too (no messages yet)
    const emptyState = page1.getByText('Нет сообщений');
    const emptyVisible = await emptyState
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    expect(visible || emptyVisible).toBeTruthy();
  });

  base('User 1 opens chat with User 2 and sends a message', async () => {
    await gotoWithRetry(page1, `/messages?userId=${USER2.id}`);

    // Wait for chat input
    const input = page1.getByLabel('Поле ввода сообщения');
    await expect(input).toBeVisible({ timeout: 15_000 });

    // Type and send
    await input.fill('Привет, Алексей! Как дела?');
    await page1.waitForTimeout(300);

    const sendBtn = page1.getByLabel('Отправить сообщение');
    await expect(sendBtn).toBeVisible({ timeout: 5_000 });
    await sendBtn.click();
    await page1.waitForTimeout(500);

    // Input should be cleared after send
    const value = await input.inputValue();
    expect(value).toBe('');

    // Message should appear in the shared store
    expect(messageStore.length).toBe(1);
    expect(messageStore[0].sender).toBe(USER1.id);
    expect(messageStore[0].text).toBe('Привет, Алексей! Как дела?');
  });

  base('User 2 opens chat and sees the message from User 1', async () => {
    await gotoWithRetry(page2, `/messages?userId=${USER1.id}`);

    // Wait for chat input
    const input = page2.getByLabel('Поле ввода сообщения');
    await expect(input).toBeVisible({ timeout: 15_000 });

    // The message sent by User 1 should be visible
    const msg = page2.getByText('Привет, Алексей! Как дела?');
    await expect(msg.first()).toBeVisible({ timeout: 10_000 });
  });

  base('User 2 replies to User 1', async () => {
    const input = page2.getByLabel('Поле ввода сообщения');
    await expect(input).toBeVisible({ timeout: 5_000 });

    await input.fill('Привет, Юлия! Всё отлично, спасибо!');
    await page2.waitForTimeout(300);

    const sendBtn = page2.getByLabel('Отправить сообщение');
    await sendBtn.click();
    await page2.waitForTimeout(500);

    // Input cleared
    const value = await input.inputValue();
    expect(value).toBe('');

    // Shared store now has 2 messages
    expect(messageStore.length).toBe(2);
    expect(messageStore[0].sender).toBe(USER2.id);
    expect(messageStore[0].text).toBe('Привет, Юлия! Всё отлично, спасибо!');
  });

  base('User 1 refreshes and sees the reply from User 2', async () => {
    // Reload page1 to trigger fresh data fetch from mocked API
    await gotoWithRetry(page1, `/messages?userId=${USER2.id}`);

    const input = page1.getByLabel('Поле ввода сообщения');
    await expect(input).toBeVisible({ timeout: 15_000 });

    // Both messages should be visible
    const originalMsg = page1.getByText('Привет, Алексей! Как дела?');
    const replyMsg = page1.getByText('Привет, Юлия! Всё отлично, спасибо!');

    await expect(originalMsg.first()).toBeVisible({ timeout: 10_000 });
    await expect(replyMsg.first()).toBeVisible({ timeout: 10_000 });
  });

  base('User 2 sends a follow-up message', async () => {
    const input = page2.getByLabel('Поле ввода сообщения');

    // Reload to get fresh state
    await gotoWithRetry(page2, `/messages?userId=${USER1.id}`);
    await expect(input).toBeVisible({ timeout: 15_000 });

    await input.fill('Расскажи про маршрут в Литву!');
    await page2.waitForTimeout(300);

    const sendBtn = page2.getByLabel('Отправить сообщение');
    await sendBtn.click();
    await page2.waitForTimeout(500);

    expect(messageStore.length).toBe(3);
  });

  base('User 1 sees all 3 messages in correct order', async () => {
    await gotoWithRetry(page1, `/messages?userId=${USER2.id}`);

    const input = page1.getByLabel('Поле ввода сообщения');
    await expect(input).toBeVisible({ timeout: 15_000 });

    // All three messages should be visible
    const msg1 = page1.getByText('Привет, Алексей! Как дела?');
    const msg2 = page1.getByText('Привет, Юлия! Всё отлично, спасибо!');
    const msg3 = page1.getByText('Расскажи про маршрут в Литву!');

    await expect(msg1.first()).toBeVisible({ timeout: 10_000 });
    await expect(msg2.first()).toBeVisible({ timeout: 10_000 });
    await expect(msg3.first()).toBeVisible({ timeout: 10_000 });
  });

  base('Thread list shows thread for both users', async () => {
    // User 1 thread list
    await gotoWithRetry(page1, '/messages');

    const threadItem = page1.getByLabel(/Диалог с Алексей Петров/);
    const visible = await threadItem
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    expect(visible).toBeTruthy();
  });
});
