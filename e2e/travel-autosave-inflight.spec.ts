import { test, expect } from './fixtures';
import type { Page, Request, Route } from '@playwright/test';
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth';
import { seedNecessaryConsent } from './helpers/storage';

/**
 * #1511 — background autosave must not abort an in-flight save when debounce
 * fires again during a slow upsert. The engine is a 5s debounce with no
 * maxWait; a second tick while a request is still open used to cancel it
 * (nginx 499) and start another, looping forever on heavy articles.
 *
 * Unit coverage lives in `__tests__/hooks/useImprovedAutoSave.test.tsx`.
 * This spec is the browser-level contract: type, let the first save start,
 * keep typing while the mocked API is still holding the response, and assert
 * the client never cancels or overlaps travel save requests.
 */
const AUTOSAVE_DEBOUNCE_MS = 5_000;
const SAVE_HOLD_MS = 7_000;
const FIRST_TRAVEL_ID = 15_111;
const NAME_PLACEHOLDER = 'Например: Неделя в Грузии';

const UPSERT_PATTERNS = [
  '**/api/travels/upsert/**',
  '**/api/travels/upsert/',
  '**/travels/upsert/**',
  '**/travels/upsert/',
];

const CONTENT_PATTERNS = [
  '**/api/travels/*/content/**',
  '**/api/travels/*/content/',
  '**/travels/*/content/**',
  '**/travels/*/content/',
];

type SaveRecord = {
  url: string;
  startedAt: number;
  finishedAt?: number;
  status?: number;
  failure?: string;
};

function isTravelSaveRequest(request: Request): boolean {
  const method = request.method().toUpperCase();
  if (method !== 'PUT' && method !== 'POST' && method !== 'PATCH') return false;
  const url = request.url();
  return url.includes('/travels/upsert/') || /\/travels\/\d+\/content\//.test(url);
}

function parseJsonBody(request: Request): Record<string, unknown> {
  try {
    const raw = request.postData();
    const parsed = raw ? JSON.parse(raw) : null;
    const payload = parsed?.data ?? parsed ?? {};
    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function mockSlowTravelSaves(page: Page, lastPayload: { current: Record<string, unknown> }) {
  const fulfillSave = async (route: Route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    if (method !== 'PUT' && method !== 'POST' && method !== 'PATCH') {
      await route.fallback();
      return;
    }

    const payload = parseJsonBody(request);
    const id = Number(payload.id ?? lastPayload.current.id ?? FIRST_TRAVEL_ID);
    lastPayload.current = {
      ...lastPayload.current,
      ...payload,
      id,
      name: typeof payload.name === 'string' ? payload.name : 'E2E inflight autosave',
    };

    await new Promise((resolve) => setTimeout(resolve, SAVE_HOLD_MS));

    try {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(lastPayload.current),
      });
    } catch {
      // The client aborted; requestfailed records that separately.
    }
  };

  for (const pattern of [...UPSERT_PATTERNS, ...CONTENT_PATTERNS]) {
    await page.route(pattern, fulfillSave);
  }

  await page.route(
    (url) => /\/api\/travels\/\d+\/?$/.test(url.pathname) && !url.pathname.includes('/content'),
    async (route) => {
      if (route.request().method() !== 'GET' || route.request().resourceType() === 'document') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: lastPayload.current.id ?? FIRST_TRAVEL_ID,
          slug: String(lastPayload.current.id ?? FIRST_TRAVEL_ID),
          name: lastPayload.current.name ?? 'E2E inflight autosave',
          description: lastPayload.current.description ?? '<p></p>',
          publish: false,
          moderation: false,
          gallery: [],
          travelAddress: [],
          coordsMeTravel: [],
        }),
      });
    },
  );
}

test.describe('#1511 autosave does not abort an in-flight save', () => {
  test('continuous typing keeps at most one in-flight travel save', async ({ page }) => {
    const records: SaveRecord[] = [];
    const byRequest = new Map<Request, SaveRecord>();
    let inFlight = 0;
    let maxConcurrent = 0;
    const lastPayload: { current: Record<string, unknown> } = { current: { id: FIRST_TRAVEL_ID } };

    page.on('request', (request) => {
      if (!isTravelSaveRequest(request)) return;
      inFlight += 1;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      const record: SaveRecord = { url: request.url(), startedAt: Date.now() };
      records.push(record);
      byRequest.set(request, record);
    });
    page.on('requestfinished', async (request) => {
      const record = byRequest.get(request);
      if (!record) return;
      inFlight = Math.max(0, inFlight - 1);
      record.finishedAt = Date.now();
      record.status = (await request.response())?.status();
    });
    page.on('requestfailed', (request) => {
      const record = byRequest.get(request);
      if (!record) return;
      inFlight = Math.max(0, inFlight - 1);
      record.finishedAt = Date.now();
      record.failure = request.failure()?.errorText || 'failed';
    });

    await page.addInitScript(seedNecessaryConsent);
    await page.addInitScript(() => {
      try {
        window.localStorage.removeItem('metravel_travel_draft_new');
        Object.keys(window.localStorage)
          .filter((key) => key.startsWith('metravel_travel_draft_'))
          .forEach((key) => window.localStorage.removeItem(key));
      } catch {
        // ignore
      }
    });
    await mockFakeAuthApis(page);
    await ensureAuthedStorageFallback(page, { userId: '1', userName: 'E2E User' });
    await mockSlowTravelSaves(page, lastPayload);

    await page.goto('/travel/new', { waitUntil: 'domcontentloaded' });
    await page
      .waitForFunction(
        () =>
          !document.body?.innerText?.includes('Bundling...') &&
          !document.body?.innerText?.includes('Загрузка...'),
        undefined,
        { timeout: 60_000 },
      )
      .catch(() => null);

    const nameInput = page.getByPlaceholder(NAME_PLACEHOLDER);
    await expect(nameInput).toBeVisible({ timeout: 60_000 });
    await nameInput.fill('E2E inflight autosave');

    const editor = page.locator('.ql-editor').first();
    await expect(editor).toBeVisible({ timeout: 60_000 });
    await editor.click();

    const firstSave = page.waitForRequest(isTravelSaveRequest, {
      timeout: AUTOSAVE_DEBOUNCE_MS + 15_000,
    });
    await page.keyboard.type('Первый абзац для автосохранения во время полёта. ', { delay: 15 });
    await firstSave;

    await page.keyboard.type('Правка пока первый запрос ещё летит. ', { delay: 15 });
    await expect(editor).toContainText('Правка пока первый запрос ещё летит');

    // Старый баг рвал первый запрос на следующем debounce (~5 с). Живой
    // мок держит ответ 7 с — если abort вернулся, первый сейв умрёт раньше.
    await expect
      .poll(() => records[0]?.finishedAt != null, {
        timeout: SAVE_HOLD_MS + 10_000,
      })
      .toBe(true);

    const first = records[0];
    expect(first, 'первый travel save стартовал').toBeTruthy();
    expect(first.failure, 'первый travel save оборван клиентом').toBeUndefined();
    expect((first.finishedAt ?? 0) - first.startedAt, 'первый save дожил до медленного ответа, а не abort на debounce').toBeGreaterThanOrEqual(
      SAVE_HOLD_MS - 400,
    );
    expect(first.status, first.url).toBeGreaterThanOrEqual(200);
    expect(first.status, first.url).toBeLessThan(300);

    // Правка во время полёта не должна теряться: после ответа уходит один
    // следующий сейв. Это и есть доказательство, что второй debounce-тик
    // пропустил in-flight, а не отменил его.
    await expect
      .poll(() => records.length, {
        timeout: AUTOSAVE_DEBOUNCE_MS + SAVE_HOLD_MS + 15_000,
      })
      .toBeGreaterThanOrEqual(2);

    await expect
      .poll(() => inFlight === 0 && records.every((record) => record.finishedAt != null), {
        timeout: SAVE_HOLD_MS + 10_000,
      })
      .toBe(true);

    expect(maxConcurrent, 'одновременно летящих travel save').toBeLessThanOrEqual(1);
    expect(
      records.filter((record) => record.failure),
      'оборванных клиентом travel save',
    ).toEqual([]);
    for (const record of records) {
      expect(record.status, record.url).toBeGreaterThanOrEqual(200);
      expect(record.status, record.url).toBeLessThan(300);
    }
  });
});
