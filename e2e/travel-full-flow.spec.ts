import { test, expect } from '@playwright/test';
import { apiLogin, createOrUpdateTravel, deleteTravel, markAsFavorite, readTravel } from './helpers/e2eApi';

const basePayload = {
  id: null,
  name: 'E2E Travel',
  description:
    'Autotest travel description long enough to pass validation and allow stable navigation in the wizard flow.',
  countries: [],
  cities: [],
  over_nights_stay: [],
  complexity: [],
  companions: [],
  recommendation: null,
  plus: null,
  minus: null,
  youtube_link: null,
  gallery: [],
  categories: [],
  countryIds: [],
  travelAddressIds: [],
  travelAddressCity: [],
  travelAddressCountry: [],
  travelAddressAdress: [],
  travelAddressCategory: [],
  coordsMeTravel: [],
  thumbs200ForCollectionArr: [],
  travelImageThumbUrlArr: [],
  travelImageAddress: [],
  categoriesIds: [],
  transports: [],
  month: [],
  year: '2026',
  budget: '',
  number_peoples: '2',
  number_days: '3',
  visa: false,
  publish: false,
  moderation: false,
};

test.describe('Travel full flow (API seed + UI verify)', () => {
  test('create -> open details -> favorite -> edit -> cleanup', async ({ page }) => {
    const email = (process.env.E2E_EMAIL || '').trim();
    const password = (process.env.E2E_PASSWORD || '').trim();
    expect(email, 'E2E_EMAIL must be set for full-flow tests').toBeTruthy();
    expect(password, 'E2E_PASSWORD must be set for full-flow tests').toBeTruthy();

    const apiCtx = await apiLogin(email, password);

    const uniqueSuffix = `${Date.now()}`;
    const initialName = `E2E Full Flow ${uniqueSuffix}`;
    const editedName = `E2E Full Flow Edited ${uniqueSuffix}`;

    const created = await createOrUpdateTravel(apiCtx, {
      ...basePayload,
      name: initialName,
      publish: true,
      moderation: true,
    });

    const travelId = created?.id;
    expect(travelId, 'Upsert did not return id').toBeTruthy();

    const createdSlug = typeof created?.slug === 'string' ? created.slug.trim() : '';
    const detailsPath = `/travels/${createdSlug || travelId}`;
    expect(detailsPath.startsWith('/travels/')).toBeTruthy();

    const createdReadback = await readTravel(apiCtx, travelId);
    expect(createdReadback?.id).toBeTruthy();

    try {
      const travelApiRespPromise = page
        .waitForResponse(
          (resp) => {
            const url = resp.url();
            return (
              url.includes(`/api/travels/${travelId}/`) ||
              url.includes('/api/travels/by-slug/')
            );
          },
          { timeout: 60_000 }
        )
        .catch(() => null);

      await page.goto(detailsPath, { waitUntil: 'networkidle', timeout: 120_000 });

      const travelApiResp = await travelApiRespPromise;
      if (travelApiResp) {
        expect(
          travelApiResp.ok(),
          `Travel details API failed: ${travelApiResp.status()} ${travelApiResp.url()}`
        ).toBeTruthy();
      }

      await expect(page.locator('[testID="travel-details-page"]').first()).toBeVisible({ timeout: 60_000 });
      await expect(page.locator(`text=${initialName}`).first()).toBeVisible({ timeout: 30_000 });

      await markAsFavorite(apiCtx, travelId);

      await page.goto('/favorites', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('text=Избранное').first()).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(`text=${initialName}`).first()).toBeVisible({ timeout: 30_000 });

      await page.goto(`/travel/edit/${travelId}`, { waitUntil: 'domcontentloaded' });

      const authGate = page.getByText('Войдите, чтобы создать путешествие', { exact: true });
      expect(await authGate.isVisible().catch(() => false), 'Edit page requires auth but storageState is anonymous').toBeFalsy();

      const nameInput = page.getByPlaceholder('Например: Неделя в Грузии');
      await expect(nameInput).toBeVisible({ timeout: 30_000 });
      await nameInput.fill(editedName);

      await page.waitForTimeout(1500);

      const updated = await readTravel(apiCtx, travelId);
      expect(String(updated?.name || '')).toBe(editedName);

      await page.goto(detailsPath, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[testID="travel-details-page"]').first()).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(`text=${editedName}`).first()).toBeVisible({ timeout: 30_000 });
    } finally {
      await deleteTravel(apiCtx, travelId);
    }
  });
});
