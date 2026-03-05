import { test, expect } from './fixtures';
import { apiContextFromEnv, apiRequestContext, createOrUpdateTravel } from './helpers/e2eApi';
import { preacceptCookies } from './helpers/navigation';
import { simpleEncrypt } from './helpers/auth';

const basePayload = {
  id: null,
  name: '',
  description: 'E2E travel for metravel edit/delete flow',
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
  travelImageThumbUrArr: [],
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

function pickOwnerId(raw: unknown): string {
  if (raw == null) return '';
  if (Array.isArray(raw)) {
    const first = raw.find((value) => String(value ?? '').trim().length > 0);
    return first == null ? '' : String(first).trim();
  }
  const normalized = String(raw).trim();
  if (!normalized) return '';
  if (!normalized.includes(',')) return normalized;
  return normalized
    .split(',')
    .map((value) => value.trim())
    .find(Boolean) ?? '';
}

test.describe('Metravel edit/delete flow', () => {
  test('creates travel, edits it from /metravel and then deletes it', async ({ page, createdTravels }) => {
    test.setTimeout(240_000);

    const ctx = await apiContextFromEnv().catch(() => null);
    if (!ctx?.apiBase || !ctx?.token) {
      test.info().annotations.push({
        type: 'note',
        description:
          'Missing E2E auth context (set E2E_EMAIL/E2E_PASSWORD or E2E_API_TOKEN + E2E_API_URL).',
      });
      return;
    }

    const uniqueSuffix = String(Date.now());
    const initialName = `E2E Metravel ${uniqueSuffix}`;
    const editedName = `E2E Metravel Edited ${uniqueSuffix}`;

    const created = await createOrUpdateTravel(ctx, {
      ...basePayload,
      name: initialName,
    });

    const travelId = created?.id;
    expect(travelId, 'Upsert did not return id').toBeTruthy();
    createdTravels.add(travelId);

    const ownerId =
      pickOwnerId((created as any)?.userIds) ||
      pickOwnerId((created as any)?.user?.id) ||
      String(ctx.userId || '').trim();

    const encryptedToken = simpleEncrypt(ctx.token, 'metravel_encryption_key_v1');
    await page.addInitScript(
      (payload: { token: string; userId: string }) => {
        try {
          window.localStorage.setItem('secure_userToken', payload.token);
          if (payload.userId) window.localStorage.setItem('userId', payload.userId);
        } catch {
          // ignore
        }
      },
      { token: encryptedToken, userId: ownerId }
    );
    await preacceptCookies(page);

    await page.goto('/metravel', { waitUntil: 'domcontentloaded', timeout: 120_000 });

    const searchInput = page.getByLabel('Поиск путешествий');
    await expect(searchInput).toBeVisible({ timeout: 30_000 });
    await searchInput.fill(initialName);

    const initialCard = page
      .locator('[data-testid^="travel-card-"], [testID^="travel-card-"]')
      .filter({ hasText: initialName })
      .first();
    await expect(initialCard).toBeVisible({ timeout: 30_000 });

    await initialCard.hover();
    const editButton = initialCard.getByLabel('Редактировать').first();
    await expect(editButton).toBeVisible({ timeout: 10_000 });
    await editButton.click();

    await expect(page).toHaveURL(/\/travel\/(edit\/)?\d+/, { timeout: 30_000 });

    const nameInput = page.getByPlaceholder('Например: Неделя в Грузии');
    await expect(nameInput).toBeVisible({ timeout: 30_000 });

    const upsertResponsePromise = page.waitForResponse(
      (resp) => {
        if (resp.request().method() !== 'PUT') return false;
        if (!resp.url().includes('/api/travels/upsert/')) return false;
        const body = resp.request().postData() || '';
        return body.includes(editedName);
      },
      { timeout: 60_000 }
    );

    await nameInput.fill(editedName);
    await nameInput.blur();

    const upsertResponse = await upsertResponsePromise;
    expect(
      upsertResponse.ok(),
      `Expected upsert response to be OK, got ${upsertResponse.status()}`
    ).toBeTruthy();

    await page.goto('/metravel', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await expect(searchInput).toBeVisible({ timeout: 30_000 });
    await searchInput.fill(editedName);

    const editedCard = page
      .locator('[data-testid^="travel-card-"], [testID^="travel-card-"]')
      .filter({ hasText: editedName })
      .first();
    await expect(editedCard).toBeVisible({ timeout: 30_000 });

    const deleteResponsePromise = page.waitForResponse(
      (resp) =>
        resp.request().method() === 'DELETE' &&
        resp.url().includes(`/api/travels/${travelId}/`),
      { timeout: 60_000 }
    );

    const confirmDialogPromise = page
      .waitForEvent('dialog', { timeout: 10_000 })
      .then(async (dialog) => {
        await dialog.accept();
      });

    await editedCard.hover();
    const deleteButton = editedCard.getByLabel('Удалить').first();
    await expect(deleteButton).toBeVisible({ timeout: 10_000 });
    await deleteButton.click();

    await confirmDialogPromise;

    const deleteResponse = await deleteResponsePromise;
    expect(
      deleteResponse.ok() || deleteResponse.status() === 404,
      `Expected delete response OK/404, got ${deleteResponse.status()}`
    ).toBeTruthy();

    await expect(editedCard).toHaveCount(0, { timeout: 30_000 });

    const api = await apiRequestContext(ctx);
    try {
      const readAfterDelete = await api.get(`/api/travels/${travelId}/`);
      expect(readAfterDelete.status()).toBe(404);
    } finally {
      await api.dispose();
    }

    createdTravels.delete(travelId);
  });
});
