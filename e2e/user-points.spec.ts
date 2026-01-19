import { test, expect } from './fixtures';
import { seedNecessaryConsent } from './helpers/storage';
import { apiContextFromEnv, createUserPoint, deleteUserPoint } from './helpers/e2eApi';

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

test.describe('User points', () => {
  test('list + selection mode + map view (smoke)', async ({ page }) => {
    const hasCreds = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD;
    const ctx = (await apiContextFromEnv().catch(() => null)) ?? null;
    if (!hasCreds || !ctx) {
      test.info().annotations.push({
        type: 'note',
        description: 'E2E_EMAIL/E2E_PASSWORD + E2E_API_URL are required for user-points full-flow test',
      });
      return;
    }

    const pointNameA = uniqueName('E2E Point A');
    const pointNameB = uniqueName('E2E Point B');

    const createdIds: Array<string | number> = [];

    try {
      await test.step('Seed points via API', async () => {
        const createdA = await createUserPoint(ctx, {
          name: pointNameA,
          latitude: 52.2297,
          longitude: 21.0122,
          color: 'blue',
          status: 'planning',
          category: 'other',
        });
        const createdB = await createUserPoint(ctx, {
          name: pointNameB,
          latitude: 50.0647,
          longitude: 19.945,
          color: 'red',
          status: 'want_to_visit',
          category: 'other',
        });

        const idA = createdA?.id ?? createdA?.point?.id;
        const idB = createdB?.id ?? createdB?.point?.id;
        if (idA != null) createdIds.push(idA);
        if (idB != null) createdIds.push(idB);
      });

      await test.step('Open /userpoints', async () => {
        await page.addInitScript(seedNecessaryConsent);
        await page.goto('/userpoints', { waitUntil: 'domcontentloaded' });
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.getByText('Мои точки', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
      });

      await test.step('Switch to list view and see seeded points', async () => {
        await page.getByRole('button', { name: 'Список' }).click();
        await expect(page.getByText(pointNameA).first()).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText(pointNameB).first()).toBeVisible({ timeout: 30_000 });
      });

      await test.step('Enter selection mode via actions menu', async () => {
        await page.getByRole('button', { name: 'Добавить' }).click();
        await page.getByRole('button', { name: 'Выбрать точки' }).click();
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
      for (const id of createdIds) {
        await deleteUserPoint(ctx, id).catch(() => undefined);
      }
    }
  });
});
