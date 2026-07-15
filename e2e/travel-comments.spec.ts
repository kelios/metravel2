import { expect, test } from './fixtures';
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth';
import { preacceptCookies } from './helpers/navigation';

const SLUG = 'e2e-travel-comments';
const TRAVEL_ID = 999_997;
const THREAD_ID = 910_001;
const SEED_COMMENT_ID = 920_000;
const OWN_COMMENT_ID = 920_001;

type MockComment = {
  id: number;
  thread: number;
  sub_thread: number | null;
  user: number;
  text: string;
  created_at: string;
  updated_at: string;
  likes_count: number;
  user_name: string;
  user_avatar: null;
  is_liked: boolean;
  is_author: boolean;
  parentId?: number;
};

const mockedTravel = {
  id: TRAVEL_ID,
  name: 'E2E Travel Comments',
  slug: SLUG,
  url: `/travels/${SLUG}`,
  userName: 'E2E Author',
  cityName: 'Тбилиси',
  countryName: 'Грузия',
  countryCode: 'GE',
  countUnicIpView: '0',
  travel_image_thumb_url: null,
  travel_image_thumb_small_url: null,
  gallery: [],
  travelAddress: [],
  coordsMeTravel: [],
  year: '2025',
  monthName: 'Январь',
  number_days: 1,
  companions: [],
  youtube_link: '',
  description: '<p>Тестовое описание маршрута.</p>',
  recommendation: '',
  plus: '',
  minus: '',
  userIds: '',
};

const json = (route: any, status: number, value: unknown) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(value),
  });

async function setupComments(page: import('@playwright/test').Page, authenticated: boolean) {
  // Production HTML starts a raw travel-detail preload before React mounts.
  // Disable it so every request in this contract goes through the test routes.
  await page.addInitScript(() => {
    (window as Window & { __metravelTravelPreloadScriptLoaded?: boolean })
      .__metravelTravelPreloadScriptLoaded = true;
  });
  const now = '2026-07-15T12:00:00.000Z';
  let nextId = 920_100;
  let comments: MockComment[] = [
    {
      id: SEED_COMMENT_ID,
      thread: THREAD_ID,
      sub_thread: null,
      user: 777,
      text: 'Seed comment',
      created_at: now,
      updated_at: now,
      likes_count: 0,
      user_name: 'Other user',
      user_avatar: null,
      is_liked: false,
      is_author: false,
    },
    {
      id: OWN_COMMENT_ID,
      thread: THREAD_ID,
      sub_thread: null,
      user: 1,
      text: 'Own comment',
      created_at: now,
      updated_at: now,
      likes_count: 0,
      user_name: 'E2E User',
      user_avatar: null,
      is_liked: false,
      is_author: true,
    },
  ];

  if (authenticated) {
    await ensureAuthedStorageFallback(page, { userId: '1', userName: 'E2E User' });
  } else {
    await page.addInitScript(() => {
      window.localStorage.removeItem('userId');
      window.localStorage.removeItem('userName');
      window.localStorage.removeItem('isSuperuser');
      window.localStorage.removeItem('secure_userToken');
    });
  }
  await preacceptCookies(page);

  // Catch unrelated travel-detail requests before registering specific routes.
  await page.route('**/api/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('.bundle') || pathname.endsWith('.map')) return route.fallback();
    if (
      pathname.includes(`/travels/by-slug/${SLUG}/`) ||
      pathname.includes(`/travels/resolve-slug/${SLUG}/`) ||
      pathname.endsWith(`/travels/${TRAVEL_ID}/`)
    ) {
      return json(route, 200, mockedTravel);
    }
    return json(route, 200, {});
  });
  if (authenticated) await mockFakeAuthApis(page);

  const travelHandler = (route: any) => json(route, 200, mockedTravel);
  await page.route(`**/api/travels/by-slug/${SLUG}**`, travelHandler);
  await page.route(`**/travels/by-slug/${SLUG}**`, travelHandler);

  const treePayload = () => {
    const childrenByParent = new Map<number, MockComment[]>();
    for (const comment of comments) {
      if (comment.parentId == null) continue;
      const children = childrenByParent.get(comment.parentId) ?? [];
      children.push(comment);
      childrenByParent.set(comment.parentId, children);
    }

    const node = (comment: MockComment, depth: number): Record<string, unknown> => {
      const { parentId: _parentId, ...plain } = comment;
      const replies = (childrenByParent.get(comment.id) ?? []).map((child) => node(child, depth + 1));
      return { ...plain, depth, replies_count: replies.length, replies };
    };
    const flat = comments.map(({ parentId: _parentId, ...comment }) => comment);
    return {
      travel_id: TRAVEL_ID,
      total_count: comments.length,
      top_level: comments.filter((comment) => comment.parentId == null).map((comment) => node(comment, 0)),
      flat,
    };
  };

  await page.route('**/travel-comments/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const pathname = new URL(request.url()).pathname;

    if (method === 'GET' && pathname.endsWith('/travel-comments/tree/')) {
      return json(route, 200, treePayload());
    }

    if (method === 'POST' && pathname.endsWith('/travel-comments/')) {
      const body = request.postDataJSON() as { text: string };
      const created: MockComment = {
        id: nextId++,
        thread: THREAD_ID,
        sub_thread: null,
        user: 1,
        text: body.text,
        created_at: now,
        updated_at: now,
        likes_count: 0,
        user_name: 'E2E User',
        user_avatar: null,
        is_liked: false,
        is_author: true,
      };
      comments = [created, ...comments];
      return json(route, 201, created);
    }

    const likeMatch = pathname.match(/\/travel-comments\/(\d+)\/like\/$/);
    if (likeMatch) {
      const id = Number(likeMatch[1]);
      const index = comments.findIndex((comment) => comment.id === id);
      if (index < 0) return json(route, 404, { detail: 'Not found' });
      if (method === 'POST') {
        comments[index] = { ...comments[index], is_liked: true, likes_count: 1 };
        return json(route, 200, comments[index]);
      }
      if (method === 'DELETE') {
        comments[index] = { ...comments[index], is_liked: false, likes_count: 0 };
        return route.fulfill({ status: 204, body: '' });
      }
    }

    const replyMatch = pathname.match(/\/travel-comments\/(\d+)\/reply\/$/);
    if (method === 'POST' && replyMatch) {
      const parentId = Number(replyMatch[1]);
      const body = request.postDataJSON() as { text: string };
      const created: MockComment = {
        id: nextId++,
        thread: THREAD_ID + parentId,
        sub_thread: null,
        user: 1,
        text: body.text,
        created_at: now,
        updated_at: now,
        likes_count: 0,
        user_name: 'E2E User',
        user_avatar: null,
        is_liked: false,
        is_author: true,
        parentId,
      };
      comments = [...comments, created];
      return json(route, 201, created);
    }

    const itemMatch = pathname.match(/\/travel-comments\/(\d+)\/$/);
    if (itemMatch) {
      const id = Number(itemMatch[1]);
      const index = comments.findIndex((comment) => comment.id === id);
      if (index < 0) return json(route, 404, { detail: 'Not found' });
      if (method === 'PUT' || method === 'PATCH') {
        const body = request.postDataJSON() as { text: string };
        comments[index] = { ...comments[index], text: body.text, updated_at: now };
        return json(route, 200, comments[index]);
      }
      if (method === 'DELETE') {
        comments = comments.filter((comment) => comment.id !== id && comment.parentId !== id);
        return route.fulfill({ status: 204, body: '' });
      }
    }

    return json(route, 404, { detail: 'Unhandled comments request' });
  });

  return { treePayload };
}

async function openComments(page: import('@playwright/test').Page) {
  await page.goto(`/travels/${SLUG}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#root')).toHaveAttribute('data-travel-details-ready', 'true');
  const commentsSlot = page.locator('[data-section-key="comments"]');
  await expect(commentsSlot).toBeAttached();
  const commentsButton = page.getByRole('button', { name: 'Перейти к разделу Комментарии' });
  await expect(commentsButton).toBeVisible();
  await commentsButton.click();
  await commentsSlot.scrollIntoViewIfNeeded();
  // The deferred section may request its tree before the quick-nav click on a
  // warm production bundle. Rendering the seeded fixture is the stable proof
  // that the strict tree route was consumed successfully.
  await expect(commentsSlot.getByText('Seed comment', { exact: true })).toBeVisible();
}

test.describe('Travel comments — guest contract', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('shows public comments and requires login before writing', async ({ page }) => {
    await setupComments(page, false);
    await openComments(page);

    await expect(page.getByText('Войдите, чтобы оставить комментарий', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Написать комментарий...')).not.toBeVisible();
    await expect(page.getByTestId('comment-reply')).toHaveCount(0);
    await expect(page.getByTestId('comment-like')).toHaveCount(0);
  });
});

test.describe('Travel comments — authenticated contracts', () => {
  test.beforeEach(async ({ page }) => {
    await setupComments(page, true);
    await openComments(page);
  });

  test('creates a comment through the accessible form', async ({ page }) => {
    const input = page.getByPlaceholder('Написать комментарий...');
    await expect(input).toHaveAccessibleName('Поле ввода комментария');
    await input.focus();
    await page.keyboard.type('Created comment');

    const createRequest = page.waitForRequest((request) =>
      request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/travel-comments/'),
    );
    const submit = page.getByRole('button', { name: /отправить комментарий/i });
    await expect(submit).toBeEnabled();
    await submit.click();

    expect((await createRequest).postDataJSON()).toMatchObject({
      text: 'Created comment',
      travel_id: TRAVEL_ID,
    });
    await expect(page.getByText('Created comment', { exact: true })).toBeVisible();
  });

  test('toggles a like with POST and DELETE', async ({ page }) => {
    const seed = page.getByTestId('comment-item').filter({ hasText: 'Seed comment' });
    const like = seed.getByTestId('comment-like');
    await expect(like).toHaveAccessibleName('Поставить лайк');

    const likeRequest = page.waitForRequest((request) =>
      request.method() === 'POST' && new URL(request.url()).pathname.endsWith(`/${SEED_COMMENT_ID}/like/`),
    );
    await like.click();
    await likeRequest;
    await expect(seed.getByTestId('comment-like')).toHaveAccessibleName('Убрать лайк');

    const unlikeRequest = page.waitForRequest((request) =>
      request.method() === 'DELETE' && new URL(request.url()).pathname.endsWith(`/${SEED_COMMENT_ID}/like/`),
    );
    await seed.getByTestId('comment-like').click();
    await unlikeRequest;
    await expect(seed.getByTestId('comment-like')).toHaveAccessibleName('Поставить лайк');
  });

  test('creates a reply under the selected comment', async ({ page }) => {
    const seed = page.getByTestId('comment-item').filter({ hasText: 'Seed comment' });
    await seed.getByTestId('comment-reply').click();
    await expect(page.getByText(/ответ на комментарий/i)).toBeVisible();

    await page.getByPlaceholder('Написать комментарий...').fill('Reply comment');
    const replyRequest = page.waitForRequest((request) =>
      request.method() === 'POST' && new URL(request.url()).pathname.endsWith(`/${SEED_COMMENT_ID}/reply/`),
    );
    await page.getByRole('button', { name: /отправить комментарий/i }).click();
    expect((await replyRequest).postDataJSON()).toMatchObject({ text: 'Reply comment' });
    await expect(page.getByText('Reply comment', { exact: true })).toBeVisible();
  });

  test('edits and deletes the current user comment', async ({ page }) => {
    let own = page.getByTestId('comment-item').filter({ hasText: 'Own comment' });
    await own.getByTestId('comment-actions-trigger').click();
    await own.getByTestId('comment-actions-edit').click();

    const input = page.getByPlaceholder('Написать комментарий...');
    await expect(input).toHaveValue('Own comment');
    await input.fill('Edited own comment');
    const updateRequest = page.waitForRequest((request) =>
      request.method() === 'PUT' && new URL(request.url()).pathname.endsWith(`/${OWN_COMMENT_ID}/`),
    );
    await page.getByRole('button', { name: /сохранить изменения/i }).click();
    expect((await updateRequest).postDataJSON()).toEqual({ text: 'Edited own comment' });
    await expect(page.getByText('Edited own comment', { exact: true })).toBeVisible();

    own = page.getByTestId('comment-item').filter({ hasText: 'Edited own comment' });
    await own.getByTestId('comment-actions-trigger').click();
    await own.getByTestId('comment-actions-delete').click();
    const deleteRequest = page.waitForRequest((request) =>
      request.method() === 'DELETE' && new URL(request.url()).pathname.endsWith(`/${OWN_COMMENT_ID}/`),
    );
    await page.getByTestId('comment-delete-confirm').click();
    await deleteRequest;
    await expect(page.getByText('Edited own comment', { exact: true })).not.toBeVisible();
  });
});
