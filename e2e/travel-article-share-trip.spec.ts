import { test, expect, type Page } from '@playwright/test';
import { DRAFT_PLACEHOLDER_PREFIX } from '../utils/travelFormNormalization';

import { acceptAuthTerms, mockFakeAuthApis, WEB_AUTH_COOKIE_NAME } from './helpers/auth';
import { installAnalyticsIntentRecorder, readAnalyticsIntents } from './helpers/analytics';
import {
  FALLBACK_TRAVEL_ID,
  FALLBACK_TRAVEL_SLUG,
  mockFallbackTravelDetails,
  preacceptCookies,
} from './helpers/navigation';

// This is a deterministic compiled-dist regression. All account and travel
// mutations are fulfilled in-browser; production acceptance uses real APIs.
const PLACE = 'Лидзбарк-Варминьски';
const SOURCE_DESCRIPTION = 'SOURCE_ARTICLE_DESCRIPTION_DO_NOT_COPY';
const READER_EMAIL = 'article-reader@example.test';
const READER_PASSWORD = 'FixtureOnly2677!';
const isUpsert = (url: URL) => /\/(?:api\/)?travels\/upsert\/?$/.test(url.pathname);

type FixtureState = {
  registrations: number;
  logins: number;
  upserts: Record<string, unknown>[];
  unexpectedMutations: string[];
};

async function prepareArticleFlow(page: Page): Promise<FixtureState> {
  const state: FixtureState = {
    registrations: 0, logins: 0, upserts: [], unexpectedMutations: [],
  };

  await preacceptCookies(page);
  await installAnalyticsIntentRecorder(page);
  await page.route((url) =>
    /(^|\.)(google-analytics\.com|analytics\.google\.com|mc\.yandex\.(ru|com))$/i.test(url.hostname),
  (route) => route.fulfill({ status: 204, body: '' }));

  await mockFakeAuthApis(page);
  await mockFallbackTravelDetails(page, {
    name: 'Заголовок исходной статьи не является местом',
    cityName: PLACE,
    countryCode: 'PL',
    countryName: 'Польша',
    userIds: '99',
    description: `<p>${SOURCE_DESCRIPTION}</p>`,
  });

  await page.route((url) => /\/(?:api\/)?getFiltersTravel\/?$/.test(url.pathname), (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        categories: [], transports: [], companions: [], complexity: [], month: [],
        over_nights_stay: [], categoryTravelAddress: [], sortings: [],
      }),
    }));
  await page.route((url) => /\/(?:api\/)?countries\/?$/.test(url.pathname), (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { country_id: 616, title_ru: 'Польша', country_code: 'PL' },
        { country_id: 250, title_ru: 'Франция', country_code: 'FR' },
      ]),
    }));

  await page.route((url) => url.pathname === '/api/user/registration/', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    state.registrations += 1;
    // Email registration creates an inactive account. No token/cookie/session.
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{"message":"Confirm your email"}' });
  });
  await page.route((url) => url.pathname === '/api/user/login/', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    state.logins += 1;
    const secure = new URL(route.request().url()).protocol === 'https:' ? '; Secure' : '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'set-cookie': `${WEB_AUTH_COOKIE_NAME}=article-reader-fixture; Path=/; HttpOnly; SameSite=Lax${secure}` },
      body: JSON.stringify({
        token: 'article-reader-fixture', refresh: 'article-reader-refresh-fixture',
        id: 1, name: 'Article reader', email: READER_EMAIL, is_superuser: false,
      }),
    });
  });
  await page.route((url) => url.pathname === '/api/user/consents/', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
  });
  await page.route(isUpsert, async (route) => {
    if (!['POST', 'PUT'].includes(route.request().method())) return route.fallback();
    const body = route.request().postDataJSON() as Record<string, unknown> & { data?: Record<string, unknown> };
    const payload = body.data ?? body;
    state.upserts.push(payload);
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ ...payload, id: FALLBACK_TRAVEL_ID + 1 }),
    });
  });
  await page.route((url) => url.pathname === `/api/travels/${FALLBACK_TRAVEL_ID + 1}/routes/`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  // Run before every shared fixture: some shared read handlers use continue()
  // for other methods, which would bypass a guard registered ahead of them.
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return route.fallback();
    const url = new URL(request.url());
    const isFixtureWrite = (method === 'POST'
      && ['/api/user/registration/', '/api/user/login/', '/api/user/consents/'].includes(url.pathname))
      || (['POST', 'PUT'].includes(method) && isUpsert(url));
    if (isFixtureWrite) return route.fallback();
    state.unexpectedMutations.push(`${method} ${url.pathname}`);
    return route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"Unexpected fixture mutation"}' });
  });
  return state;
}

function expectCreateContext(href: string, origin: string): void {
  const target = new URL(href, origin);
  expect(target.origin).toBe(origin);
  expect(target.pathname).toBe('/travel/new');
  expect(Object.fromEntries(target.searchParams)).toEqual({
    source_travel_id: String(FALLBACK_TRAVEL_ID), country: 'PL', place: PLACE,
  });
}

async function expectAuthContext(page: Page, pathname: '/registration' | '/login'): Promise<void> {
  await expect(page).toHaveURL((url) => url.pathname === pathname);
  const authUrl = new URL(page.url());
  expect(authUrl.searchParams.get('intent')).toBe('share-trip');
  expectCreateContext(authUrl.searchParams.get('redirect') ?? '', authUrl.origin);
}

async function fillAuthForm(page: Page): Promise<void> {
  await page.locator('input[type="email"]').fill(READER_EMAIL);
  await page.locator('input[type="password"]').fill(READER_PASSWORD);
  await acceptAuthTerms(page);
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`Article share-trip roundtrip ${viewport.width}px`, () => {
    test.use({ viewport, storageState: { cookies: [], origins: [] } });

    test('email registration without a session retains context through login and seeds an editable own trip', async ({ page }, testInfo) => {
      const state = await prepareArticleFlow(page);
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await page.goto(`/travels/${FALLBACK_TRAVEL_SLUG}`, { waitUntil: 'domcontentloaded' });

      const invite = page.getByTestId('travel-article-share-trip-button');
      await expect(invite).toBeVisible();
      await expect(invite).toHaveAccessibleName('Были здесь? Расскажите о своей поездке');
      await invite.scrollIntoViewIfNeeded();
      const box = await invite.boundingBox();
      expect(box?.height, 'Invitation must be a usable touch target').toBeGreaterThanOrEqual(44);
      await expect.poll(async () => (await readAnalyticsIntents(page, 'content_create_cta_impression'))
        .filter((event) => event.params.source === 'travel_article').length).toBe(1);
      await page.screenshot({ path: testInfo.outputPath('article-invitation.png') });
      await invite.click();
      await expectAuthContext(page, '/registration');
      const clicks = (await readAnalyticsIntents(page, 'content_create_cta_click'))
        .filter((event) => event.params.source === 'travel_article');
      expect(clicks).toHaveLength(1);
      expect(clicks[0].params.source_travel_id).toBe(String(FALLBACK_TRAVEL_ID));

      // Both auth forms must preserve the nested query before any account exists.
      await page.getByRole('button', { name: 'Войти в аккаунт', exact: true }).click();
      await expectAuthContext(page, '/login');
      await page.getByText('Зарегистрируйтесь', { exact: true }).click();
      await expectAuthContext(page, '/registration');
      await fillAuthForm(page);
      await page.getByRole('button', { name: 'Зарегистрироваться', exact: true }).click();

      const authGate = page.getByTestId('travel-upsert.auth-required');
      await expect(authGate).toBeVisible();
      expectCreateContext(page.url(), new URL(page.url()).origin);
      expect(state.registrations).toBe(1);
      expect((await page.context().cookies()).some((cookie) => cookie.name === WEB_AUTH_COOKIE_NAME)).toBe(false);
      await authGate.getByRole('button', { name: /^Войти.*вернуться/ }).click();
      await expectAuthContext(page, '/login');
      await fillAuthForm(page);
      await page.getByRole('button', { name: 'Войти', exact: true }).click();

      const name = page.locator('#field-name input');
      const countries = page.getByTestId('travel-wizard.step-basic.countries');
      await expect(name).toHaveValue(PLACE);
      await expect(countries).toContainText('Польша');
      expectCreateContext(page.url(), new URL(page.url()).origin);
      expect(state.logins).toBe(1);
      const cookie = (await page.context().cookies()).find((entry) => entry.name === WEB_AUTH_COOKIE_NAME);
      expect(cookie?.httpOnly, 'Login must establish a real browser cookie session').toBe(true);

      const editor = viewport.width === 390
        ? page.getByTestId('travel-wizard.basic.description.mobile-input')
        : page.locator('.ql-editor').first();
      await expect(editor).toBeVisible();
      if (viewport.width === 390) await expect(editor).toHaveValue('');
      else await expect(editor).toHaveText('');

      // The save debounce is 5s: observe the whole window, rather than asserting
      // zero immediately after render and missing an unintended delayed save.
      const seededSave = await page.waitForRequest((request) =>
        ['POST', 'PUT'].includes(request.method()) && isUpsert(new URL(request.url())),
      { timeout: 6_000 }).then(() => true, () => false);
      expect(seededSave, 'Prefill alone must not create a draft').toBe(false);
      expect(state.upserts).toEqual([]);
      await expect.poll(async () => (await readAnalyticsIntents(page, 'route_create_started'))
        .filter((event) => event.params.source === 'travel_article_cta'
          && event.params.source_travel_id === String(FALLBACK_TRAVEL_ID)).length).toBe(1);
      await page.screenshot({ path: testInfo.outputPath('seeded-own-trip.png') });

      await countries.getByTestId('simple-multiselect.open-button').click();
      await expect(page.getByTestId('simple-multiselect.item.616')).toBeChecked();
      await page.getByTestId('simple-multiselect.item.616').click();
      await page.getByTestId('simple-multiselect.item.250').click();
      await expect(page.getByTestId('simple-multiselect.item.250')).toBeChecked();
      await page.getByRole('button', { name: 'Закрыть', exact: true }).last().click();
      await expect(countries).toContainText('Франция');
      await expect(countries).not.toContainText('Польша');
      await name.fill('Моя самостоятельная поездка');
      await expect(name).toHaveValue('Моя самостоятельная поездка');
      await expect.poll(() => state.upserts.some((payload) =>
        payload.name === 'Моя самостоятельная поездка'
          && JSON.stringify(payload.countries) === '["250"]'), { timeout: 20_000 }).toBe(true);
      for (const payload of state.upserts) {
        // The existing draft API substitutes this exact sentinel for an empty
        // rich-text field; it is not copied source content.
        expect(['', DRAFT_PLACEHOLDER_PREFIX]).toContain(payload.description ?? '');
        expect(payload.coordsMeTravel ?? []).toEqual([]);
        expect(payload.gallery ?? []).toEqual([]);
        expect(payload.travel_image_thumb_url ?? '').toBe('');
        expect(JSON.stringify(payload)).not.toContain(SOURCE_DESCRIPTION);
      }
      expect(state.unexpectedMutations, 'Fixture flow must never write to a live backend').toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(await page.evaluate(() => window.localStorage.getItem('secure_userToken'))).toBeNull();
    });
  });
}
