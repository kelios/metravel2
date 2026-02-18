import { test, expect } from './fixtures';
import { apiContextFromEnv, createOrUpdateTravel, readTravel } from './helpers/e2eApi';
import { preacceptCookies } from './helpers/navigation';

function encryptForSecureStorage(token: string): string {
  const key = 'metravel_encryption_key_v1';
  let result = '';
  for (let i = 0; i < token.length; i++) {
    result += String.fromCharCode(token.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return `enc1:${Buffer.from(result, 'binary').toString('base64')}`;
}

const basePayload = {
  id: null,
  name: '',
  description: '',
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
  number_peoples: '1',
  number_days: '1',
  visa: false,
  publish: false,
  moderation: false,
};

test.describe('Draft travel owner preview', () => {
  test('creates a draft and owner can view description on details page', async ({ page, createdTravels }) => {
    test.setTimeout(240_000);
    const ctx = await apiContextFromEnv().catch(() => null);
    if (!ctx?.apiBase || !ctx?.token) {
      test.info().annotations.push({
        type: 'note',
        description:
          'Missing E2E auth context (set E2E_EMAIL/E2E_PASSWORD or E2E_API_TOKEN + E2E_API_URL). Draft owner preview was not exercised.',
      });
      return;
    }

    const title = 'Модынь  - одна из самых высоких вершин Бескидов (1029)';
    const uniqueSuffix = `${Date.now()}`;
    const descriptionMarker = `draft-description-${uniqueSuffix}`;

    const created = await createOrUpdateTravel(ctx, {
      ...basePayload,
      name: title,
      // In the app, description is stored as rich HTML (Quill). Use the same shape for preview rendering.
      description: `<p>${descriptionMarker}</p>`,
      slug: `draft-modyn-${uniqueSuffix}`,
      publish: false,
      moderation: false,
    });

    const travelId = created?.id;
    expect(travelId, 'Upsert did not return id').toBeTruthy();
    createdTravels.add(travelId);

    const seededDetails = await readTravel(ctx, travelId);
    const seededSlug = typeof seededDetails?.slug === 'string' ? seededDetails.slug.trim() : '';

    const encryptedToken = encryptForSecureStorage(ctx.token);
    const userId = ctx.userId ? String(ctx.userId) : '';

    await page.addInitScript(
      (payload: { token: string; userId: string }) => {
        try {
          window.localStorage.setItem('secure_userToken', payload.token);
          if (payload.userId) window.localStorage.setItem('userId', payload.userId);
        } catch {
          // ignore
        }
      },
      { token: encryptedToken, userId }
    );

    await preacceptCookies(page);

    // Make the test deterministic and fast: fulfill travel details API from the seeded payload.
    await page.route(`**/api/travels/${travelId}/`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(seededDetails),
      });
    });
    if (seededSlug) {
      await page.route(`**/api/travels/by-slug/${seededSlug}/`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(seededDetails),
        });
      });
    }
    const detailsResponsePromise = page
      .waitForResponse(
        (resp) =>
          resp.request().method() === 'GET' &&
          (resp.url().includes(`/api/travels/${travelId}/`) ||
            (seededSlug ? resp.url().includes(`/api/travels/by-slug/${seededSlug}/`) : false)),
        { timeout: 120_000 }
      )
      .catch(() => null);

    await page.goto(`/travels/${travelId}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });

    const detailsResponse = await detailsResponsePromise;
    expect(detailsResponse, 'Details API response was not observed').not.toBeNull();
    await page.waitForFunction(
      (marker: string) => {
        const preload = (window as any).__metravelTravelPreload;
        const data = preload?.data;
        const name = typeof data?.name === 'string' ? data.name : '';
        const description = typeof data?.description === 'string' ? data.description : '';
        return /модынь/i.test(name) && description.includes(marker);
      },
      descriptionMarker,
      { timeout: 120_000 }
    );
  });
});
