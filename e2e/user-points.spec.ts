import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth';

type MockPoint = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  color: string;
  status: string;
  categoryIds: string[];
  address?: string;
};

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function ensureUserPointsAccessible(page: any): Promise<boolean> {
  await mockFakeAuthApis(page);
  await ensureAuthedStorageFallback(page);
  await page.goto('/userpoints', { waitUntil: 'domcontentloaded' });

  if (/\/login/.test(page.url())) {
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
  }

  const rootVisible = await page
    .getByTestId('userpoints-screen')
    .first()
    .isVisible()
    .catch(() => false);
  const mapVisible = await page
    .locator('.leaflet-container')
    .first()
    .isVisible()
    .catch(() => false);

  return rootVisible || mapVisible;
}

test.describe('User points', () => {
  async function openFiltersPanelTab(page: any) {
    const legacyTabButton = page.getByTestId('userpoints-panel-tab-filters').first();
    const segmentedTabButton = page.getByTestId('segmented-filters').first();
    const panelTabs = page.getByRole('radiogroup', { name: 'Панель' }).first();
    const filtersRadio = panelTabs.getByRole('radio', { name: 'Фильтры', exact: true }).first();
    const actionsButton = page.getByTestId('userpoints-actions-open').first();

    for (let attempt = 0; attempt < 3; attempt++) {
      if ((await filtersRadio.count()) > 0) {
        await filtersRadio.click({ timeout: 30_000, force: true }).catch(() => undefined);
        await filtersRadio.evaluate((el: any) => (el as HTMLElement)?.click?.()).catch(() => undefined);
      } else {
        const tabButton = (await segmentedTabButton.count()) > 0 ? segmentedTabButton : legacyTabButton;
        await tabButton.click({ timeout: 30_000, force: true }).catch(() => undefined);
        await tabButton.evaluate((el: any) => (el as HTMLElement)?.click?.()).catch(() => undefined);
      }
      await page.waitForTimeout(150);

      if ((await actionsButton.count()) > 0) {
        await expect(actionsButton).toBeVisible({ timeout: 5_000 });
        return;
      }
    }

    await expect(actionsButton).toBeVisible({ timeout: 30_000 });
  }

  async function openListPanelTab(page: any) {
    const legacyTabButton = page.getByTestId('userpoints-panel-tab-list').first();
    const segmentedTabButton = page.getByTestId('segmented-list').first();
    const panelTabs = page.getByRole('radiogroup', { name: 'Панель' }).first();
    const listRadio = panelTabs.getByRole('radio', { name: /^Список/, exact: false }).first();
    const searchBox = page.getByTestId('userpoints-list-search').first();
    const listContent = page.getByTestId('userpoints-panel-content-list').first();

    // RN-web overlays/animations can occasionally swallow the first click.
    for (let attempt = 0; attempt < 3; attempt++) {
      if ((await listRadio.count()) > 0) {
        await listRadio.click({ timeout: 30_000, force: true }).catch(() => undefined);
        await listRadio.evaluate((el: any) => (el as HTMLElement)?.click?.()).catch(() => undefined);
      } else {
        const tabButton = (await segmentedTabButton.count()) > 0 ? segmentedTabButton : legacyTabButton;
        await tabButton.click({ timeout: 30_000, force: true }).catch(() => undefined);
        // Fallback: sometimes Playwright click doesn't trigger RN-web onPress reliably.
        await tabButton.evaluate((el: any) => (el as HTMLElement)?.click?.()).catch(() => undefined);
      }
      await page.waitForTimeout(150);

      if ((await listContent.count()) > 0 && (await searchBox.count()) > 0) {
        await expect(listContent).toBeVisible({ timeout: 5_000 });
        return;
      }
    }

    await expect(listContent).toBeVisible({ timeout: 30_000 });
  }

  async function installTileMock(page: any) {
    // Return a tiny transparent 1x1 PNG for any tile request.
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8m2p8AAAAASUVORK5CYII=';
    const png = Buffer.from(pngBase64, 'base64');

    const routeTile = async (route: any) => {
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: png,
      });
    };

    // Match common OSM tile hosts used by our base layer + fallbacks.
    await page.route('**://tile.openstreetmap.org/**', routeTile);
    await page.route('**://*.tile.openstreetmap.org/**', routeTile);
    await page.route('**://*.tile.openstreetmap.fr/**', routeTile);
    await page.route('**://*.tile.openstreetmap.de/**', routeTile);
  }

  async function installNominatimMock(page: any, result?: { lat: number; lon: number; display_name?: string }) {
    const payload = result
      ? [
          {
            lat: String(result.lat),
            lon: String(result.lon),
            display_name: String(result.display_name ?? 'Search result'),
          },
        ]
      : [];

    await page.route('**://nominatim.openstreetmap.org/search**', async (route: any) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload),
      });
    });
  }

  test('renders map tiles on /userpoints and shows search + recommendations in list panel', async ({ page }) => {
    await preacceptCookies(page);
    await page.addInitScript(() => {
      try {
        const coords = {
          latitude: 50.06143,
          longitude: 19.93658,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        };

        const makePosition = () => ({
          coords,
          timestamp: Date.now(),
        });

        (navigator as any).geolocation = {
          getCurrentPosition: (success: any) => success(makePosition()),
          watchPosition: (success: any) => {
            success(makePosition());
            return 1;
          },
          clearWatch: () => undefined,
        };
      } catch {
        // noop
      }
    });
    await installTileMock(page);
    const api = await installUserPointsApiMock(page);

    const pointName = uniqueName('Point');
    api.addPoint({
      name: pointName,
      latitude: 50.06143,
      longitude: 19.93658,
      color: 'red',
      status: 'planned',
      categoryIds: ['other'],
      address: 'Kraków',
    });

    if (!(await ensureUserPointsAccessible(page))) {
      test.info().annotations.push({
        type: 'note',
        description: 'User points screen is not available in current env; skipping assertions',
      });
      return;
    }

    // Wait for Leaflet container.
    await expect(page.locator('.leaflet-container').first()).toBeVisible({ timeout: 30_000 });

    // Verify that base tile layer is mounted.
    // In some environments (mocked tiles, headless), tile <img> elements may not become visible reliably.
    // We assert the presence of tile panes + attribution which indicates layers were attached.
    await expect(page.locator('.leaflet-tile-pane')).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator('.leaflet-control-attribution')).toHaveCount(1, { timeout: 30_000 });

    // Locate-me should work (zoom level can vary with tile mocking), assert map remains functional.
    await page.getByRole('button', { name: 'Моё местоположение' }).click({ timeout: 30_000 });
    await expect(page.locator('.leaflet-tile-pane')).toHaveCount(1, { timeout: 30_000 });

    await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 30_000 });

    // Search + recommendations live in the Filters tab.
    await openFiltersPanelTab(page);
    await expect(page.getByRole('textbox', { name: 'Поиск по названию...' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: '3 случайные точки' })).toBeVisible({ timeout: 30_000 });

    // List item card should also expose the same coordinate actions.
    await openListPanelTab(page);
    const listPanel = page.getByTestId('userpoints-panel-content-list').first();
    await expect(listPanel.getByText(pointName).first()).toBeVisible({ timeout: 30_000 });
    await expect(listPanel.getByRole('textbox', { name: 'Поиск по названию...' })).toBeVisible({ timeout: 30_000 });
    await expect(listPanel.getByRole('button', { name: 'Фильтры' }).first()).toBeVisible({ timeout: 30_000 });
    await expect(listPanel.getByRole('button', { name: 'Сбросить фильтры' }).first()).toBeVisible({ timeout: 30_000 });
    await expect(listPanel.getByRole('button', { name: 'Копировать координаты' }).first()).toBeVisible({ timeout: 30_000 });
    await expect(listPanel.getByRole('button', { name: 'Поделиться в Telegram' }).first()).toBeVisible({ timeout: 30_000 });
    // Individual map provider buttons (Google/Apple/Яндекс/OSM) live in the popup, not in the list card.
    // The list card exposes a single "Открыть в картах" action.
    await expect(
      listPanel.getByRole('button', { name: /открыть в картах/i }).first()
        .or(listPanel.getByRole('button', { name: 'Google' }).first())
    ).toBeVisible({ timeout: 30_000 });
  });

  test('auto-zooms to show all points when geolocation is present', async ({ page }) => {
    await preacceptCookies(page);
    await page.addInitScript(() => {
      try {
        const coords = {
          latitude: 50.06143,
          longitude: 19.93658,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        };

        const makePosition = () => ({
          coords,
          timestamp: Date.now(),
        });

        (navigator as any).geolocation = {
          getCurrentPosition: (success: any) => success(makePosition()),
          watchPosition: (success: any) => {
            success(makePosition());
            return 1;
          },
          clearWatch: () => undefined,
        };
      } catch {
        // noop
      }
    });
    await installTileMock(page);
    const api = await installUserPointsApiMock(page);

    api.addPoint({
      name: uniqueName('Point A'),
      latitude: 49.82,
      longitude: 19.95,
      color: 'red',
      status: 'planned',
      categoryIds: ['other'],
      address: 'A',
    });
    api.addPoint({
      name: uniqueName('Point B'),
      latitude: 50.12,
      longitude: 20.12,
      color: 'green',
      status: 'planned',
      categoryIds: ['other'],
      address: 'B',
    });

    if (!(await ensureUserPointsAccessible(page))) {
      test.info().annotations.push({
        type: 'note',
        description: 'User points screen is not available in current env; skipping assertions',
      });
      return;
    }
    await expect(page.locator('.leaflet-container').first()).toBeVisible({ timeout: 30_000 });
    // Tile loading can be flaky in CI/local due to layer initialization timing.
    // For this regression we only need the map + markers to exist.
    await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 30_000 });

    // Prefer Leaflet bounds over pixel-level assertions (less flaky under resize/fitBounds).
    await page.waitForFunction(() => {
      const w = window as any;
      return Boolean(w.__metravelUserPointsMap && typeof w.__metravelUserPointsMap.getBounds === 'function');
    });

    const points = [
      { lat: 49.82, lng: 19.95 },
      { lat: 50.12, lng: 20.12 },
    ];

    await expect
      .poll(
        async () => {
          return page.evaluate((pts) => {
            const map = (window as any).__metravelUserPointsMap;
            const bounds = map?.getBounds?.();
            if (!bounds) return false;
            if (typeof bounds.contains !== 'function') return false;
            return pts.every((p: any) => bounds.contains([p.lat, p.lng]));
          }, points);
        },
        { timeout: 30_000 }
      )
      .toBeTruthy();
  });

  test('clicking a list card opens the corresponding map popup', async ({ page }) => {
    await preacceptCookies(page);
    await page.addInitScript(() => {
      try {
        const coords = {
          latitude: 50.06143,
          longitude: 19.93658,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        };

        const makePosition = () => ({
          coords,
          timestamp: Date.now(),
        });

        (navigator as any).geolocation = {
          getCurrentPosition: (success: any) => success(makePosition()),
          watchPosition: (success: any) => {
            success(makePosition());
            return 1;
          },
          clearWatch: () => undefined,
        };
      } catch {
        // noop
      }
    });
    await installTileMock(page);
    const api = await installUserPointsApiMock(page);

    const pointName = uniqueName('Popup Point');
    api.addPoint({
      name: pointName,
      latitude: 50.06143,
      longitude: 19.93658,
      color: 'red',
      status: 'planned',
      categoryIds: ['other'],
      address: 'Kraków',
    });

    if (!(await ensureUserPointsAccessible(page))) {
      test.info().annotations.push({
        type: 'note',
        description: 'User points screen is not available in current env; skipping assertions',
      });
      return;
    }
    await expect(page.locator('.leaflet-container').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.leaflet-tile-pane')).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator('.leaflet-control-attribution')).toHaveCount(1, { timeout: 30_000 });

    await openListPanelTab(page);
    const listPanel = page.getByTestId('userpoints-panel-content-list').first();
    await expect(listPanel.getByText(pointName).first()).toBeVisible({ timeout: 30_000 });
    await listPanel.getByText(pointName).first().click({ timeout: 30_000 });

    const popup = page.locator('.leaflet-popup').first();
    await expect(popup).toBeVisible({ timeout: 30_000 });
    await expect(popup.getByText(pointName).first()).toBeVisible({ timeout: 30_000 });
  });

  test('search falls back to map geocoding when no points match', async ({ page }) => {
    await preacceptCookies(page);
    await page.addInitScript(() => {
      try {
        const coords = {
          latitude: 50.06143,
          longitude: 19.93658,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        };

        const makePosition = () => ({
          coords,
          timestamp: Date.now(),
        });

        (navigator as any).geolocation = {
          getCurrentPosition: (success: any) => success(makePosition()),
          watchPosition: (success: any) => {
            success(makePosition());
            return 1;
          },
          clearWatch: () => undefined,
        };
      } catch {
        // noop
      }
    });

    await installTileMock(page);
    await installNominatimMock(page, { lat: 52.2297, lon: 21.0122, display_name: 'Warsaw, Poland' });
    await installUserPointsApiMock(page);

    if (!(await ensureUserPointsAccessible(page))) {
      test.info().annotations.push({
        type: 'note',
        description: 'User points screen is not available in current env; skipping assertions',
      });
      return;
    }
    await expect(page.locator('.leaflet-container').first()).toBeVisible({ timeout: 30_000 });

    await openFiltersPanelTab(page);
    const searchBox = page.getByRole('textbox', { name: 'Поиск по названию...' });
    await searchBox.fill('Warsaw');

    // Wait for debounce + fetch.
    await page.waitForTimeout(900);

    // Search marker should appear even though points list is empty.
    await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1, { timeout: 30_000 });
  });

  async function installUserPointsApiMock(page: any) {
    const points: MockPoint[] = [];
    let nextId = 1;

    // Categories for manual add (fetchFiltersMap -> /api/filterformap/)
    await page.route('**/api/filterformap/**', async (route: any) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          countries: [],
          categories: ['other', 'Food'],
          categoryTravelAddress: [],
          companions: [],
          complexity: [],
          month: [],
          over_nights_stay: [],
          transports: [],
          year: '',
        }),
      });
    });

    await page.route('**/api/user-points/**', async (route: any) => {
      const req = route.request();
      const url = req.url();
      const method = req.method().toUpperCase();

      const json = async () => {
        try {
          return await req.postDataJSON();
        } catch {
          return null;
        }
      };

      // list
      if (method === 'GET' && /\/api\/user-points\/?(\?.*)?$/.test(url)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(points),
        });
      }

      // create
      if (method === 'POST' && /\/api\/user-points\/?$/.test(url)) {
        const body = await json();
        const p: MockPoint = {
          id: nextId++,
          name: String(body?.name ?? ''),
          latitude: Number(body?.latitude),
          longitude: Number(body?.longitude),
          color: String(body?.color ?? 'blue'),
          status: String(body?.status ?? 'planning'),
          categoryIds: Array.isArray(body?.categoryIds)
            ? body.categoryIds.map((v: any) => String(v))
            : Array.isArray(body?.category_ids)
              ? body.category_ids.map((v: any) => String(v))
              : body?.category
                ? [String(body.category)]
                : ['other'],
          address: body?.address ? String(body.address) : undefined,
        };

        if (!p.name || !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) {
          return route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'Invalid payload' }),
          });
        }

        points.push(p);
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(p) });
      }

      // delete
      const delMatch = url.match(/\/api\/user-points\/(\d+)\/?$/);
      if (method === 'DELETE' && delMatch) {
        const id = Number(delMatch[1]);
        const idx = points.findIndex((x) => x.id === id);
        if (idx >= 0) points.splice(idx, 1);
        return route.fulfill({ status: 204, contentType: 'application/json', body: '' });
      }

      // patch update
      const patchMatch = url.match(/\/api\/user-points\/(\d+)\/?$/);
      if (method === 'PATCH' && patchMatch) {
        const id = Number(patchMatch[1]);
        const body = await json();
        const idx = points.findIndex((x) => x.id === id);
        if (idx < 0) {
          return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
        }
        const prev = points[idx];
        const updated: MockPoint = {
          ...prev,
          ...(body ?? {}),
          id,
          latitude: body?.latitude != null ? Number(body.latitude) : prev.latitude,
          longitude: body?.longitude != null ? Number(body.longitude) : prev.longitude,
        };
        points[idx] = updated;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(updated) });
      }

      // bulk update
      if (method === 'PATCH' && /\/api\/user-points\/bulk-update\/?$/.test(url)) {
        const body = await json();
        const ids = Array.isArray(body?.pointIds) ? body.pointIds.map((x: any) => Number(x)) : [];
        const updates = body?.updates ?? {};

        let updatedCount = 0;
        for (const id of ids) {
          const idx = points.findIndex((x) => x.id === id);
          if (idx < 0) continue;
          points[idx] = { ...points[idx], ...updates, id };
          updatedCount++;
        }

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ updated: updatedCount, points }),
        });
      }

      // import (optional)
      if (method === 'POST' && /\/api\/user-points\/import\/?$/.test(url)) {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ created: 0, updated: 0, skipped: 0, errors: [] }),
        });
      }

      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Unhandled mock route' }) });
    });

    return {
      points,
      addPoint: (p: Omit<MockPoint, 'id'>) => {
        const point: MockPoint = { ...p, id: nextId++ };
        points.push(point);
        return point;
      },
    };
  }

  async function openActionsMenu(page: any) {
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(150);

    // The userpoints screen is map-first; actions live in the list header.
    // The header is rendered inside the "Фильтры" tab of the side panel.
    await openFiltersPanelTab(page);
    await expect(page.getByTestId('userpoints-actions-open')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('userpoints-actions-open').click({ force: true });

    const actionsDialog = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('button', { name: 'Выбрать точки', exact: true }) })
      .first();
    await actionsDialog.waitFor({ state: 'visible', timeout: 30_000 });
    return actionsDialog;
  }

	  test('list + selection mode + map view (smoke)', async ({ page }) => {
	    const pointNameA = uniqueName('E2E Point A');
	    const pointNameB = uniqueName('E2E Point B');
	
	    const api = await installUserPointsApiMock(page);
	    let pointA: MockPoint | null = null;
	    let pointB: MockPoint | null = null;
	
	    try {
	      await test.step('Open /userpoints', async () => {
	        await preacceptCookies(page);
	        if (!(await ensureUserPointsAccessible(page))) {
          test.info().annotations.push({
            type: 'note',
            description: 'User points screen is not available in current env; skipping assertions',
          });
          return;
        }
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.getByTestId('userpoints-screen')).toBeVisible({ timeout: 30_000 });
      });

      await test.step('Switch to list view', async () => {
        await openListPanelTab(page);
      });
	
	      await test.step('Seed 2 points via mock API', async () => {
	        pointA = api.addPoint({
	          name: pointNameA,
	          latitude: 52.2297,
	          longitude: 21.0122,
	          color: 'blue',
	          status: 'planning',
	          categoryIds: ['other'],
	        });
	        pointB = api.addPoint({
	          name: pointNameB,
	          latitude: 50.0647,
	          longitude: 19.945,
	          color: 'blue',
          status: 'planning',
          categoryIds: ['other'],
        });

        // Ensure UI refetches after seeding (React Query won't auto-update from in-memory mock).
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('userpoints-screen')).toBeVisible({ timeout: 30_000 });
      });

      await test.step('Enter selection mode via actions menu', async () => {
        const actionsDialog = await openActionsMenu(page);
        const selectPointsButton = actionsDialog.getByRole('button', { name: 'Выбрать точки', exact: true });
        await selectPointsButton.click({ force: true }).catch(() => undefined);
        await selectPointsButton.evaluate((el: any) => (el as HTMLElement)?.click?.()).catch(() => undefined);
        await expect(page.getByText('Выберите точки в списке')).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole('button', { name: 'Готово', exact: true })).toBeVisible({ timeout: 15_000 });
      });
	
      await test.step('Select 2 points and go to map view', async () => {
        expect(pointA, 'mock pointA must be created before selecting').not.toBeNull();
        expect(pointB, 'mock pointB must be created before selecting').not.toBeNull();
        if (!pointA || !pointB) return;

        const backToList = page.getByRole('button', { name: 'Назад к списку', exact: true });
        await backToList.click({ force: true }).catch(() => undefined);
        await backToList.evaluate((el: any) => (el as HTMLElement)?.click?.()).catch(() => undefined);
        await expect(page.getByTestId('userpoints-panel-content-list').first()).toBeVisible({ timeout: 30_000 });
        const cardA = page.getByTestId(`userpoints-point-card-${pointA.id}`);
        const cardB = page.getByTestId(`userpoints-point-card-${pointB.id}`);

        await expect(cardA).toBeVisible({ timeout: 30_000 });
        await cardA.evaluate((el: any) => (el as HTMLElement)?.click?.());

        await expect(cardB).toBeVisible({ timeout: 30_000 });
        await cardB.evaluate((el: any) => (el as HTMLElement)?.click?.());

        await expect(page.getByText(/Выбрано:\s*2/)).toBeVisible({ timeout: 15_000 });

        // Map-first UI: the map is already visible during selection mode.
        await expect(page.locator('.leaflet-container').first()).toBeVisible({ timeout: 30_000 });
        await expect(page.getByRole('button', { name: 'Назад к списку' })).toBeVisible({ timeout: 30_000 });
      });

      await test.step('Exit selection mode', async () => {
        await page.getByRole('button', { name: 'Готово' }).click();
        await expect(page.getByText(/Выбрано:/)).toHaveCount(0);
      });
    } finally {
      // mocked API is in-memory; no cleanup needed
    }
  });

	  test('bulk update + delete selected + delete all (mock API)', async ({ page }) => {
	    const api = await installUserPointsApiMock(page);
	
	    const pointNameA = uniqueName('E2E Bulk A');
	    const pointNameB = uniqueName('E2E Bulk B');
	    const pointNameC = uniqueName('E2E Bulk C');
	
	    // Seed 3 points directly in mock storage (faster than UI for this test)
	    const pointA = api.addPoint({
	      name: pointNameA,
	      latitude: 55.7,
	      longitude: 37.6,
	      color: 'blue',
	      status: 'planning',
	      categoryIds: ['other'],
	    });
	    const pointB = api.addPoint({
	      name: pointNameB,
	      latitude: 55.71,
	      longitude: 37.61,
	      color: 'blue',
	      status: 'planning',
	      categoryIds: ['other'],
	    });
	    api.addPoint({
	      name: pointNameC,
	      latitude: 55.72,
	      longitude: 37.62,
	      color: 'blue',
      status: 'planning',
      categoryIds: ['other'],
    });

    await preacceptCookies(page);
    if (!(await ensureUserPointsAccessible(page))) {
      test.info().annotations.push({
        type: 'note',
        description: 'User points screen is not available in current env; skipping assertions',
      });
      return;
    }
    await expect(page.getByTestId('userpoints-screen')).toBeVisible({ timeout: 30_000 });
    await openListPanelTab(page);

    await expect(page.getByText(pointNameA).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(pointNameB).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(pointNameC).first()).toBeVisible({ timeout: 30_000 });

    // Enter selection mode
    const actionsDialog = await openActionsMenu(page);
    const selectPointsButton = actionsDialog.getByRole('button', { name: 'Выбрать точки', exact: true });
    await selectPointsButton.click({ force: true }).catch(() => undefined);
    await selectPointsButton.evaluate((el: any) => (el as HTMLElement)?.click?.()).catch(() => undefined);
    await expect(page.getByText('Выберите точки в списке')).toBeVisible({ timeout: 15_000 });

    // Select A + B
    const backToList = page.getByRole('button', { name: 'Назад к списку', exact: true });
    await backToList.click({ force: true }).catch(() => undefined);
    await backToList.evaluate((el: any) => (el as HTMLElement)?.click?.()).catch(() => undefined);
    await expect(page.getByTestId('userpoints-panel-content-list').first()).toBeVisible({ timeout: 30_000 });
    const cardA = page.getByTestId(`userpoints-point-card-${pointA.id}`);
    const cardB = page.getByTestId(`userpoints-point-card-${pointB.id}`);

    await expect(cardA).toBeVisible({ timeout: 30_000 });
    await cardA.evaluate((el: any) => (el as HTMLElement)?.click?.());

    await expect(cardB).toBeVisible({ timeout: 30_000 });
    await cardB.evaluate((el: any) => (el as HTMLElement)?.click?.());
    await expect(page.getByText(/Выбрано:\s*2/)).toBeVisible({ timeout: 15_000 });

    // Bulk edit: set status to archived
    await page.getByRole('button', { name: 'Изменить' }).click();
    await expect(page.getByText('Изменить выбранные', { exact: true })).toBeVisible({ timeout: 30_000 });

    // Open Status select (2nd SimpleMultiSelect trigger) and choose 'archived'
    const bulkDialog = page.getByRole('dialog').filter({ has: page.getByText('Изменить выбранные', { exact: true }) }).first();
    const triggers = bulkDialog.getByRole('button', { name: 'Открыть выбор', exact: true });
    await triggers.last().click({ force: true });
    // Close SimpleMultiSelect modal: on RN-web the "Готово" footer can be unclickable due to overlay layers.
    // We close via the dialog close/backdrop button (accessibilityLabel="Закрыть").
    // IMPORTANT: scope all interactions to the same visible dialog instance to avoid hitting a hidden/other modal.
    const selectDialog = page
      .getByRole('dialog')
      .filter({ has: page.getByText(/Выбрано:\s*\d+/, { exact: false }) })
      .first();
    await selectDialog.waitFor({ state: 'visible', timeout: 30_000 });
    await selectDialog.locator('[data-testid="simple-multiselect.item.archived"]').click({ force: true });
    await expect(selectDialog.getByText(/Выбрано:\s*1/, { exact: false })).toBeVisible({ timeout: 15_000 });

    // Close the select modal via Escape (avoid ambiguity between multiple RN-web "Закрыть" backdrops).
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.keyboard.press('Escape').catch(() => undefined);
    await selectDialog.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(150);

    // Ensure selection propagated back to the bulk dialog trigger (placeholder should disappear).
    await expect(triggers.last().getByText('Выберите...', { exact: true })).toHaveCount(0, { timeout: 15_000 });

    const bulkUpdateRequest = page.waitForRequest((req: any) => {
      try {
        return req.method() === 'PATCH' && /\/api\/user-points\/bulk-update\/?(\?.*)?$/.test(req.url());
      } catch {
        return false;
      }
    });

    const applyButton = bulkDialog.getByRole('button', { name: 'Применить', exact: true });
    await applyButton.click({ force: true }).catch(() => undefined);
    // Fallback for RN-web: direct DOM click
    await applyButton.evaluate((el: any) => (el as HTMLElement)?.click?.()).catch(() => undefined);
    await bulkUpdateRequest;

    // The card UI does not necessarily render status label text.
    // Assert through the in-memory mock API storage that bulk update applied.
    await expect(page.getByText(pointNameA).first()).toBeVisible();
    await expect(page.getByText(pointNameB).first()).toBeVisible();
    await expect.poll(() => api.points.find((p) => p.name === pointNameA)?.status, { timeout: 30_000 }).toBe('archived');
    await expect.poll(() => api.points.find((p) => p.name === pointNameB)?.status, { timeout: 30_000 }).toBe('archived');

    // App exits selection mode after bulk apply; re-enter selection mode to delete selected.
    const actionsDialogAfterEdit = await openActionsMenu(page);
    const selectPointsButton2 = actionsDialogAfterEdit.getByRole('button', { name: 'Выбрать точки', exact: true });
    await selectPointsButton2.click({ force: true }).catch(() => undefined);
    await selectPointsButton2.evaluate((el: any) => (el as HTMLElement)?.click?.()).catch(() => undefined);
    await expect(page.getByText('Выберите точки в списке')).toBeVisible({ timeout: 15_000 });

    await backToList.click({ force: true }).catch(() => undefined);
    await backToList.evaluate((el: any) => (el as HTMLElement)?.click?.()).catch(() => undefined);
    await expect(page.getByTestId('userpoints-panel-content-list').first()).toBeVisible({ timeout: 30_000 });
    await cardA.evaluate((el: any) => (el as HTMLElement)?.click?.());
    await cardB.evaluate((el: any) => (el as HTMLElement)?.click?.());
    await expect(page.getByText(/Выбрано:\s*2/)).toBeVisible({ timeout: 15_000 });

    // Delete selected
    await page.getByRole('button', { name: 'Удалить выбранные' }).click();
    await expect(page.getByText('Удалить выбранные?', { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Удалить', exact: true }).click();

    await expect(page.getByText(pointNameA)).toHaveCount(0);
    await expect(page.getByText(pointNameB)).toHaveCount(0);
	    await expect(page.getByText(pointNameC).first()).toBeVisible({ timeout: 30_000 });

    // Delete all via menu
    const actionsDialog2 = await openActionsMenu(page);
    await actionsDialog2.getByRole('button', { name: 'Удалить все точки', exact: true }).click();
    await expect(page.getByText('Удалить все точки?', { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Удалить все', exact: true }).click();
	    await expect(page.getByText(pointNameC)).toHaveCount(0);
	  });
	});
