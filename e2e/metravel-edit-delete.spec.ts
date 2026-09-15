import { test, expect } from './fixtures';
import { apiContextFromEnv, apiRequestContext, createOrUpdateTravel } from './helpers/e2eApi';
import { preacceptCookies } from './helpers/navigation';
import { ensureWebAuthCookie } from './helpers/auth';

const basePayload = {
  id: null,
  name: '',
  description: 'E2E travel for metravel edit/delete flow with valid description length',
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

test.describe('Travel edit/delete flow', () => {
  test('creates a draft, edits it in the wizard and then deletes it', async ({ page, createdTravels, baseURL }) => {
    test.setTimeout(240_000);

    const ctx = await apiContextFromEnv().catch(() => null);
    expect(
      ctx?.apiBase && ctx?.token,
      'Live-contract auth is required (E2E_EMAIL/E2E_PASSWORD or E2E_API_TOKEN + E2E_API_URL)',
    ).toBeTruthy();
    if (!ctx?.apiBase || !ctx?.token) throw new Error('Live-contract auth context is unavailable');

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

    await preacceptCookies(page);

    // The editor route for a numeric id is resolved server-side by the
    // HttpOnly `authToken` session cookie (#1932), not by anything read from
    // localStorage: on web `secure_userToken` is never consulted at all
    // (utils/authPlatform.ts). Seed the real cookie the same way a genuine
    // login would — same pattern already proven in e2e/draft-recovery.spec.ts.
    expect(baseURL, 'baseURL is required to seed the web session cookie').toBeTruthy();
    await ensureWebAuthCookie(page, {
      url: String(baseURL),
      token: ctx.token,
      userId: ownerId,
    });

    // Hard document contract: without these the test degrades silently — a
    // 301/404 shell still runs addInitScript, so the URL-shape assertion
    // below could pass while no editor ever mounted (#1950/#1954).
    const response = await page.goto(`/travel/${travelId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });
    expect(response, `No document response for /travel/${travelId}`).toBeTruthy();
    expect(
      response!.status(),
      `Owner must receive the editor document, got HTTP ${response!.status()}`,
    ).toBe(200);
    expect(
      response!.request().redirectedFrom(),
      `Owner must not be redirected away from /travel/${travelId}`,
    ).toBeNull();
    await expect(page).toHaveURL(/\/travel\/\d+/, { timeout: 30_000 });

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

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await nameInput.click({ force: true });
      await nameInput.press('ControlOrMeta+A');
      await nameInput.press('Backspace');
      await nameInput.type(editedName);
      if ((await nameInput.inputValue()) === editedName) break;
    }
    await expect(nameInput).toHaveValue(editedName);

    await page.getByLabel('Сохранить путешествие').click();

    const upsertResponse = await upsertResponsePromise;
    expect(
      upsertResponse.ok(),
      `Expected upsert response to be OK, got ${upsertResponse.status()}`
    ).toBeTruthy();

    const api = await apiRequestContext(ctx);
    try {
      const readAfterEdit = await api.get(`/api/travels/${travelId}/`);
      expect(readAfterEdit.ok(), `Expected read after edit OK, got ${readAfterEdit.status()}`).toBeTruthy();
      const edited = await readAfterEdit.json();
      expect(edited?.name).toBe(editedName);

      const deleteResponse = await api.delete(`/api/travels/${travelId}/`);
      expect(
        deleteResponse.ok() || deleteResponse.status() === 404,
        `Expected delete response OK/404, got ${deleteResponse.status()}`
      ).toBeTruthy();

      const readAfterDelete = await api.get(`/api/travels/${travelId}/`);
      expect(readAfterDelete.status()).toBe(404);
    } finally {
      await api.dispose();
    }

    createdTravels.delete(travelId);
  });
});
