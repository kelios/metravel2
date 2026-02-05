import { test, expect } from './fixtures';

let createdId: number | null = null;
let travelExists = false;

const nowIso = () => new Date().toISOString();

function installMockTravelRoutes(page: any) {
  page.route('**/api/travels/upsert/**', async (route: any) => {
    const req = route.request();
    const method = String(req.method() || 'GET').toUpperCase();
    if (method !== 'PUT' && method !== 'POST') {
      return route.continue();
    }

    createdId = createdId ?? 999_500;
    travelExists = true;

    return route.fulfill({
      status: method === 'POST' ? 201 : 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: createdId,
        slug: String(createdId),
        url: `/travels/${createdId}`,
        name: 'E2E Cleanup Mock',
      }),
    });
  });

  page.route(/.*\/api\/travels\/\d+\/?$/, async (route: any) => {
    const req = route.request();
    const url = String(req.url() || '');
    const method = String(req.method() || 'GET').toUpperCase();
    const match = url.match(/\/api\/travels\/(\d+)\/?$/);
    const id = match ? Number(match[1]) : NaN;

    if (!Number.isFinite(id)) return route.continue();
    if (createdId != null && id !== createdId) return route.continue();

    if (method === 'DELETE') {
      travelExists = false;
      return route.fulfill({ status: 204, contentType: 'text/plain', body: '' });
    }

    if (method === 'GET') {
      if (!travelExists) {
        return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id,
          slug: String(id),
          url: `/travels/${id}`,
          name: 'E2E Cleanup Mock',
          created_at: nowIso(),
          updated_at: nowIso(),
        }),
      });
    }

    return route.fulfill({ status: 405, contentType: 'text/plain', body: 'Method Not Allowed' });
  });
}

test.describe.serial('Created travels cleanup', () => {
  test('creates travel via API and registers it for cleanup', async ({ page, createdTravels }) => {
    installMockTravelRoutes(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const created = await page.evaluate(async () => {
      const resp = await fetch('/api/travels/upsert/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: null, name: 'E2E Cleanup Mock' }),
      });
      const json = await resp.json().catch(() => null);
      return { ok: resp.ok, status: resp.status, json };
    });

    expect(created.ok, `mock upsert failed: ${created.status}`).toBeTruthy();
    const id = Number((created as any).json?.id);
    expect(Number.isFinite(id)).toBeTruthy();
    createdId = id;
    travelExists = true;
    createdTravels.add(id);
  });

  test('removes created travel after previous test', async ({ page }) => {
    expect(createdId, 'Expected createdId from previous test').toBeTruthy();
    installMockTravelRoutes(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const deleted = await page.evaluate(async (id) => {
      const resp = await fetch(`/api/travels/${id}/`, { method: 'DELETE' });
      return { ok: resp.ok, status: resp.status };
    }, createdId);
    expect(deleted.ok, `mock delete failed: ${deleted.status}`).toBeTruthy();

    const readBack = await page.evaluate(async (id) => {
      const resp = await fetch(`/api/travels/${id}/`);
      return { status: resp.status };
    }, createdId);
    expect(readBack.status).toBe(404);
  });
});
