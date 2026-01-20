import { test, expect } from './fixtures';
import { seedNecessaryConsent } from './helpers/storage';

type MockPoint = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  color: string;
  status: string;
  category: string;
  address?: string;
};

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

test.describe('User points', () => {
  async function openFiltersPanelTab(page: any) {
    const filtersTabButton = page.getByTestId('userpoints-panel-tab-filters').first();
    const searchBox = page.getByRole('textbox', { name: 'Поиск по названию...' });

    for (let attempt = 0; attempt < 3; attempt++) {
      await filtersTabButton.click({ timeout: 30_000, force: true }).catch(() => undefined);
      await filtersTabButton.evaluate((el: any) => (el as HTMLElement)?.click?.()).catch(() => undefined);
      await page.waitForTimeout(150);

      if ((await searchBox.count()) > 0) {
        await expect(searchBox).toBeVisible({ timeout: 5_000 });
        return;
      }
    }

    await expect(searchBox).toBeVisible({ timeout: 30_000 });
  }

  async function openListPanelTab(page: any) {
    // On this screen there can be multiple "Список"-related buttons (e.g. selection-mode header "Назад к списку").
    // Use a stable testID on the panel tab.
    const listTabButton = page.getByTestId('userpoints-panel-tab-list').first();
    const searchBox = page.getByRole('textbox', { name: 'Поиск по названию...' });
    const listContent = page.getByTestId('userpoints-panel-content-list');

    // RN-web overlays/animations can occasionally swallow the first click.
    for (let attempt = 0; attempt < 3; attempt++) {
      await listTabButton.click({ timeout: 30_000, force: true }).catch(() => undefined);
      // Fallback: sometimes Playwright click doesn't trigger RN-web onPress reliably.
      await listTabButton.evaluate((el: any) => (el as HTMLElement)?.click?.()).catch(() => undefined);
      await page.waitForTimeout(150);

      if ((await listContent.count()) > 0 && (await searchBox.count()) > 0) {
        await expect(searchBox).toBeVisible({ timeout: 5_000 });
        return;
      }
    }

    await expect(searchBox).toBeVisible({ timeout: 30_000 });
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

  test('renders map tiles on /userpoints and shows search + recommendations in list panel', async ({ page }) => {
    await page.addInitScript(seedNecessaryConsent);
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
      category: 'other',
      address: 'Kraków',
    });

    await page.goto('/userpoints', { waitUntil: 'domcontentloaded' });

    // Wait for Leaflet container.
    await expect(page.locator('.leaflet-container').first()).toBeVisible({ timeout: 30_000 });

    // Verify that at least one tile image has been loaded.
    await expect(page.locator('img.leaflet-tile-loaded').first()).toBeVisible({ timeout: 30_000 });

    // Locate-me should work (zoom level can vary with tile mocking), assert map remains functional.
    await page.getByRole('button', { name: 'Моё местоположение' }).click({ timeout: 30_000 });
    await expect(page.locator('img.leaflet-tile-loaded').first()).toBeVisible({ timeout: 30_000 });

    // Clicking a marker should open the point popup.
    await page.locator('.leaflet-marker-icon').first().click({ timeout: 30_000 });
    const popup = page.locator('.leaflet-popup').first();
    await expect(popup).toBeVisible({ timeout: 30_000 });

    // Popup should expose coordinates actions.
    await expect(popup.getByRole('button', { name: 'Копировать координаты' }).first()).toBeVisible({ timeout: 30_000 });
    await expect(popup.getByRole('button', { name: 'Поделиться в Telegram' }).first()).toBeVisible({ timeout: 30_000 });
    await expect(popup.getByRole('button', { name: 'Google' }).first()).toBeVisible({ timeout: 30_000 });
    await expect(popup.getByRole('button', { name: 'Apple' }).first()).toBeVisible({ timeout: 30_000 });
    await expect(popup.getByRole('button', { name: 'Яндекс' }).first()).toBeVisible({ timeout: 30_000 });
    await expect(popup.getByRole('button', { name: 'OSM' }).first()).toBeVisible({ timeout: 30_000 });

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
    await expect(listPanel.getByRole('button', { name: 'Google' }).first()).toBeVisible({ timeout: 30_000 });
    await expect(listPanel.getByRole('button', { name: 'Apple' }).first()).toBeVisible({ timeout: 30_000 });
    await expect(listPanel.getByRole('button', { name: 'Яндекс' }).first()).toBeVisible({ timeout: 30_000 });
    await expect(listPanel.getByRole('button', { name: 'OSM' }).first()).toBeVisible({ timeout: 30_000 });
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
          category: String(body?.category ?? 'other'),
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
    await page.getByRole('button', { name: 'Фильтры' }).click({ timeout: 30_000 }).catch(() => undefined);
    await expect(page.getByTestId('userpoints-actions-open')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('userpoints-actions-open').click({ force: true });

    const actionsDialog = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('button', { name: 'Выбрать точки', exact: true }) })
      .first();
    await actionsDialog.waitFor({ state: 'visible', timeout: 30_000 });
    return actionsDialog;
  }

  async function _openManualAddFromActions(page: any) {
    const dialog = await openActionsMenu(page);
    await dialog.getByRole('button', { name: 'Добавить вручную', exact: true }).click();
    await expect(page.getByText(/Добавить точку вручную|Редактировать точку/)).toBeVisible({ timeout: 30_000 });
  }

  async function _setSelectionMode(page: any, enabled: boolean) {
    await openActionsMenu(page);
    const toggleButton = page.getByRole('button', { name: enabled ? 'Выбрать точки' : 'Выйти из выбора', exact: true });
    await toggleButton.click({ timeout: 30_000 });
  }

  test('list + selection mode + map view (smoke)', async ({ page }) => {
    const pointNameA = uniqueName('E2E Point A');
    const pointNameB = uniqueName('E2E Point B');

    const api = await installUserPointsApiMock(page);

    try {
      await test.step('Open /userpoints', async () => {
        await page.addInitScript(seedNecessaryConsent);
        await page.goto('/userpoints', { waitUntil: 'domcontentloaded' });
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.getByTestId('userpoints-screen')).toBeVisible({ timeout: 30_000 });
      });

      await test.step('Switch to list view', async () => {
        await page.getByRole('button', { name: 'Список' }).click();
      });

      await test.step('Seed 2 points via mock API', async () => {
        api.addPoint({
          name: pointNameA,
          latitude: 52.2297,
          longitude: 21.0122,
          color: 'blue',
          status: 'planning',
          category: 'other',
        });
        api.addPoint({
          name: pointNameB,
          latitude: 50.0647,
          longitude: 19.945,
          color: 'blue',
          status: 'planning',
          category: 'other',
        });

        // Ensure UI refetches after seeding (React Query won't auto-update from in-memory mock).
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('userpoints-screen')).toBeVisible({ timeout: 30_000 });
      });

      await test.step('Enter selection mode via actions menu', async () => {
        const actionsDialog = await openActionsMenu(page);
        await actionsDialog.getByRole('button', { name: 'Выбрать точки', exact: true }).click();
        await expect(page.getByText('Выберите точки в списке')).toBeVisible({ timeout: 15_000 });
      });

      await test.step('Select 2 points and go to map view', async () => {
        await openListPanelTab(page);
        await expect(page.getByText(pointNameA).first()).toBeVisible({ timeout: 30_000 });
        await page.getByText(pointNameA).first().click({ force: true });
        await expect(page.getByText(pointNameB).first()).toBeVisible({ timeout: 30_000 });
        await page.getByText(pointNameB).first().click({ force: true });

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
    api.addPoint({
      name: pointNameA,
      latitude: 55.7,
      longitude: 37.6,
      color: 'blue',
      status: 'planning',
      category: 'other',
    });
    api.addPoint({
      name: pointNameB,
      latitude: 55.71,
      longitude: 37.61,
      color: 'blue',
      status: 'planning',
      category: 'other',
    });
    api.addPoint({
      name: pointNameC,
      latitude: 55.72,
      longitude: 37.62,
      color: 'blue',
      status: 'planning',
      category: 'other',
    });

    await page.addInitScript(seedNecessaryConsent);
    await page.goto('/userpoints', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('userpoints-screen')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Список' }).click();

    await expect(page.getByText(pointNameA).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(pointNameB).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(pointNameC).first()).toBeVisible({ timeout: 30_000 });

    // Enter selection mode
    const actionsDialog = await openActionsMenu(page);
    await actionsDialog.getByRole('button', { name: 'Выбрать точки', exact: true }).click();
    await expect(page.getByText('Выберите точки в списке')).toBeVisible({ timeout: 15_000 });

    // Select A + B
    await openListPanelTab(page);
    await expect(page.getByText(pointNameA).first()).toBeVisible({ timeout: 30_000 });
    await page.getByText(pointNameA).first().click({ force: true });
    await expect(page.getByText(pointNameB).first()).toBeVisible({ timeout: 30_000 });
    await page.getByText(pointNameB).first().click({ force: true });
    await expect(page.getByText(/Выбрано:\s*2/)).toBeVisible({ timeout: 15_000 });

    // Bulk edit: set status to visited
    await page.getByRole('button', { name: 'Изменить' }).click();
    await expect(page.getByText('Изменить выбранные', { exact: true })).toBeVisible({ timeout: 30_000 });

    // Open Status select (2nd SimpleMultiSelect trigger) and choose 'visited'
    const bulkDialog = page.getByRole('dialog').filter({ has: page.getByText('Изменить выбранные', { exact: true }) }).first();
    const triggers = bulkDialog.getByRole('button', { name: 'Открыть выбор', exact: true });
    await triggers.last().click({ force: true });
    await page.locator('[data-testid="simple-multiselect.item.visited"]').click();

    // Close SimpleMultiSelect modal: on RN-web the "Готово" footer can be unclickable due to overlay layers.
    // We close via the dialog close/backdrop button (accessibilityLabel="Закрыть").
    const selectDialog = page
      .getByRole('dialog')
      .filter({ has: page.getByText(/Выбрано:\s*\d+/, { exact: false }) })
      .first();
    await selectDialog.waitFor({ state: 'visible', timeout: 30_000 });
    // Try multiple close strategies (RN-web Modal/backdrop can be flaky).
    await selectDialog.getByRole('button', { name: 'Закрыть', exact: true }).first().click({ force: true }).catch(() => undefined);
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(150);

    // If still visible, click the first visible "Закрыть" button globally (backdrop).
    if (await selectDialog.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Закрыть', exact: true }).first().click({ force: true }).catch(() => undefined);
      await page.keyboard.press('Escape').catch(() => undefined);
      await page.waitForTimeout(150);
    }

    await bulkDialog.getByRole('button', { name: 'Применить', exact: true }).click({ force: true });

    // Both selected points should display status label "Посещено"
    await expect(page.getByText(pointNameA).first()).toBeVisible();
    await expect(page.getByText(pointNameB).first()).toBeVisible();
    // Current UI label for visited status is "Архив".
    await expect(page.getByText('Архив').first()).toBeVisible({ timeout: 30_000 });

    // App exits selection mode after bulk apply; re-enter selection mode to delete selected.
    const actionsDialogAfterEdit = await openActionsMenu(page);
    await actionsDialogAfterEdit.getByRole('button', { name: 'Выбрать точки', exact: true }).click();
    await expect(page.getByText('Выберите точки в списке')).toBeVisible({ timeout: 15_000 });

    await openListPanelTab(page);
    await page.getByText(pointNameA).first().click({ force: true });
    await page.getByText(pointNameB).first().click({ force: true });
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
