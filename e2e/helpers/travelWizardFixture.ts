import type { Page } from '@playwright/test';

/** The upsert fixture owns routes-list reads only for the fake IDs it returns. */
export async function mockTravelWizardUpsert(page: Page): Promise<void> {
  let lastId = 10_000;
  const fixtureTravelIds = new Set<string>();

  await page.route((url) => {
    const match = /^\/(?:api\/)?travels\/([^/]+)\/routes\/$/.exec(url.pathname);
    return Boolean(match && fixtureTravelIds.has(match[1]));
  }, async (route) => {
    if (route.request().method().toUpperCase() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  const upsertPatterns = ['**/api/travels/upsert/**', '**/api/travels/upsert/', '**/travels/upsert/**', '**/travels/upsert/'];
  for (const pattern of upsertPatterns) {
    await page.route(pattern, async (route) => {
      const req = route.request();
      if (req.method().toUpperCase() !== 'PUT' && req.method().toUpperCase() !== 'POST') {
        await route.fallback();
        return;
      }

      let body: (Record<string, unknown> & { data?: Record<string, unknown> }) | null = null;
      try {
        const raw = req.postData();
        body = raw ? JSON.parse(raw) : null;
      } catch {
        body = null;
      }

      const payload = body?.data ?? body ?? {};
      const id = payload?.id ?? lastId++;
      fixtureTravelIds.add(encodeURIComponent(String(id)));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...payload, id, name: payload?.name ?? 'E2E Travel' }),
      });
    });
  }
}
