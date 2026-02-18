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

    const created = await createOrUpdateTravel(ctx, {
      ...basePayload,
      name: title,
      // In the app, description is stored as rich HTML (Quill). Use the same shape for preview rendering.
      description: '<p>test</p>',
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

    await page.goto(`/travels/${travelId}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });

    const loginGate = page.getByText('Войдите, чтобы создать путешествие', { exact: true });
    const loadError = page.getByText('Не удалось загрузить путешествие', { exact: true });

    // Basic gate/error handling.
    if (await loginGate.isVisible().catch(() => false)) {
      throw new Error(`Auth gate triggered on ${page.url()}`);
    }
    if (await loadError.isVisible().catch(() => false)) {
      const bodyText = (await page.locator('body').innerText().catch(() => '')) || '';
      throw new Error(`Details page rendered error state on ${page.url()}\n${bodyText.slice(0, 500)}`);
    }

    const detailsRoot = page
      .locator('[data-testid="travel-details-page"], [testID="travel-details-page"]')
      .first();
    await expect(detailsRoot).toBeVisible({ timeout: 120_000 });

    // Hero title should render near the top.
    await expect(page.locator('text=/Модынь/i').first()).toBeVisible({ timeout: 120_000 });

    const travelDescription = page.locator('[data-testid="travel-description"], [testID="travel-description"]').first();
    // Scroll down so description section is mounted/painted.
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(250);
      if (await travelDescription.isVisible().catch(() => false)) break;
    }

    await expect(travelDescription).toBeVisible({ timeout: 120_000 });
    await expect(travelDescription).toContainText(/\btest\b/i, { timeout: 120_000 });
  });
});
