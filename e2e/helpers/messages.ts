import type { Page, Route } from '@playwright/test';

import type { Message, MessageThread, MessagingUser } from '@/api/messages';

import { ensureAuthedStorageFallback, mockFakeAuthApis } from './auth';
import { gotoWithRetry, preacceptCookies } from './navigation';

export const MOCK_CURRENT_USER_ID = 1;

export const MOCK_USERS: MessagingUser[] = [
  { id: 2, user: 2, first_name: 'Алексей', last_name: 'Петров', avatar: null },
  { id: 3, user: 3, first_name: 'Мария', last_name: 'Иванова', avatar: null },
  { id: 4, user: 4, first_name: 'Дмитрий', last_name: 'Сидоров', avatar: null },
  { id: 5, user: 5, first_name: 'Елена', last_name: 'Козлова', avatar: null },
];

const USER_NAMES = new Map([
  [2, 'Алексей Петров'],
  [3, 'Мария Иванова'],
  [4, 'Дмитрий Сидоров'],
  [5, 'Елена Козлова'],
]);

export function createMockThreads(unreadCounts: number[] = [0, 0, 0]): MessageThread[] {
  return [2, 3, 4].map((participantId, index) => ({
    id: 10 + index,
    participants: [MOCK_CURRENT_USER_ID, participantId],
    participant_previews: [
      {
        id: participantId,
        display_name: USER_NAMES.get(participantId) ?? `User ${participantId}`,
        avatar_url: null,
        username: null,
        is_deleted: false,
      },
    ],
    created_at: `2026-01-${15 - index * 5}T10:00:00Z`,
    last_message_created_at:
      index === 0 ? new Date().toISOString() : `2026-02-0${7 - index}T14:30:00Z`,
    unread_count: unreadCounts[index] ?? 0,
  }));
}

export const MOCK_MESSAGES: Message[] = [
  {
    id: 100,
    thread: 10,
    sender: 2,
    text: 'Привет! Как добраться до озера?',
    created_at: new Date().toISOString(),
  },
  {
    id: 99,
    thread: 10,
    sender: 1,
    text: 'Лучше всего на машине, около 2 часов от Минска',
    created_at: new Date(Date.now() - 60_000).toISOString(),
  },
];

type MessagingMockOptions = {
  threads?: MessageThread[];
  users?: MessagingUser[];
  messages?: Message[];
};

export type MessagingMockTracker = {
  markReadThreadIds: number[];
  sentPayloads: Array<{ participants?: number[]; text?: string }>;
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export async function installMessagingMocks(
  page: Page,
  options: MessagingMockOptions = {},
): Promise<MessagingMockTracker> {
  const threads = options.threads ?? createMockThreads();
  const users = options.users ?? MOCK_USERS;
  const messages = options.messages ?? MOCK_MESSAGES;
  const tracker: MessagingMockTracker = { markReadThreadIds: [], sentPayloads: [] };

  await page.route('**/api/message-threads/*/mark-read/**', async (route) => {
    const match = new URL(route.request().url()).pathname.match(/message-threads\/(\d+)\/mark-read/);
    const threadId = Number(match?.[1]);
    tracker.markReadThreadIds.push(threadId);
    await fulfillJson(route, { thread_id: threadId, last_read_message_id: 100, unread_count: 0 });
  });

  await page.route('**/api/message-threads/available-users/**', (route) =>
    fulfillJson(route, users),
  );

  await page.route('**/api/message-threads/thread-by-user/**', (route) => {
    const userId = Number(new URL(route.request().url()).searchParams.get('user_id'));
    return fulfillJson(route, { thread_id: userId === 2 ? 10 : null });
  });

  await page.route('**/api/message-threads/', (route) => {
    if (route.request().method() === 'GET') return fulfillJson(route, threads);
    return route.fallback();
  });

  await page.route('**/api/messages/**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      const threadId = Number(new URL(request.url()).searchParams.get('thread_id'));
      const results = threadId === 10 ? messages : [];
      await fulfillJson(route, { count: results.length, next: null, previous: null, results });
      return;
    }
    if (request.method() === 'POST') {
      const payload = request.postDataJSON() as { participants?: number[]; text?: string };
      tracker.sentPayloads.push(payload);
      await fulfillJson(route, payload, 201);
      return;
    }
    if (request.method() === 'DELETE') {
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.fallback();
  });

  return tracker;
}

export async function prepareAuthenticatedMessaging(
  page: Page,
  options: MessagingMockOptions = {},
): Promise<MessagingMockTracker> {
  await preacceptCookies(page);
  const tracker = await installMessagingMocks(page, options);
  await mockFakeAuthApis(page);
  await ensureAuthedStorageFallback(page);
  return tracker;
}

export async function openAuthenticatedMessages(
  page: Page,
  path = '/messages',
  options: MessagingMockOptions = {},
): Promise<MessagingMockTracker> {
  const tracker = await prepareAuthenticatedMessaging(page, options);
  await gotoWithRetry(page, path);
  return tracker;
}
