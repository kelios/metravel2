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
  async function installUserPointsApiMock(page: any) {
    const points: MockPoint[] = [];
    let nextId = 1;

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
    // Switch to list view before trying to open the actions menu.
    await page.getByRole('button', { name: 'Список' }).click({ timeout: 30_000 }).catch(() => undefined);
    await expect(page.getByTestId('userpoints-actions-open')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('userpoints-actions-open').click({ force: true });

    const actionsDialog = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('button', { name: 'Выбрать точки', exact: true }) })
      .first();
    await actionsDialog.waitFor({ state: 'visible', timeout: 30_000 });
    return actionsDialog;
  }

  async function openManualAddFromActions(page: any) {
    const dialog = await openActionsMenu(page);
    await dialog.getByRole('button', { name: 'Добавить вручную', exact: true }).click();
    await expect(page.getByText(/Добавить точку вручную|Редактировать точку/)).toBeVisible({ timeout: 30_000 });
  }

  async function createPointViaUi(page: any, name: string, lat: string, lng: string) {
    await openManualAddFromActions(page);
    await page.getByPlaceholder('Например: Любимое кафе').fill(name);
    await page.getByPlaceholder('55.755800').fill(lat);
    await page.getByPlaceholder('37.617300').fill(lng);
    await page.getByRole('button', { name: 'Сохранить точку' }).click();
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 30_000 });
  }

  test('list + selection mode + map view (smoke)', async ({ page }) => {
    const pointNameA = uniqueName('E2E Point A');
    const pointNameB = uniqueName('E2E Point B');

    await installUserPointsApiMock(page);

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

      await test.step('Create 2 points via manual add UI', async () => {
        await createPointViaUi(page, pointNameA, '52.2297', '21.0122');
        await createPointViaUi(page, pointNameB, '50.0647', '19.945');
      });

      await test.step('Enter selection mode via actions menu', async () => {
        const actionsDialog = await openActionsMenu(page);
        await actionsDialog.getByRole('button', { name: 'Выбрать точки', exact: true }).click();
        await expect(page.getByText(/Выбрано:/)).toBeVisible({ timeout: 15_000 });
      });

      await test.step('Select 2 points and go to map view', async () => {
        await page.getByText(pointNameA).first().click();
        await page.getByText(pointNameB).first().click();

        await expect(page.getByText(/Выбрано:\s*2/)).toBeVisible({ timeout: 15_000 });

        await page.getByRole('button', { name: 'На карте' }).click();
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
    await expect(page.getByText(/Выбрано:/)).toBeVisible({ timeout: 15_000 });

    // Select A + B
    await page.getByText(pointNameA).first().click();
    await page.getByText(pointNameB).first().click();
    await expect(page.getByText(/Выбрано:\s*2/)).toBeVisible({ timeout: 15_000 });

    // Bulk edit: set status to visited
    await page.getByRole('button', { name: 'Изменить' }).click();
    await expect(page.getByText('Изменить выбранные', { exact: true })).toBeVisible({ timeout: 30_000 });

    // Open Status select (2nd SimpleMultiSelect trigger) and choose 'visited'
    const bulkDialog = page.getByRole('dialog').filter({ has: page.getByText('Изменить выбранные', { exact: true }) }).first();
    const triggers = bulkDialog.getByRole('button', { name: 'Открыть выбор', exact: true });
    await triggers.nth(1).click();
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
    await expect(page.getByText('Посещено').first()).toBeVisible({ timeout: 30_000 });

    // App exits selection mode after bulk apply; re-enter selection mode to delete selected.
    const actionsDialogAfterEdit = await openActionsMenu(page);
    await actionsDialogAfterEdit.getByRole('button', { name: 'Выбрать точки', exact: true }).click();
    await expect(page.getByText(/Выбрано:/)).toBeVisible({ timeout: 15_000 });

    await page.getByText(pointNameA).first().click();
    await page.getByText(pointNameB).first().click();
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
