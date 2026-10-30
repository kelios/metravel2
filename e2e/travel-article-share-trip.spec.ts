import { test, expect, type Locator, type Page } from '@playwright/test';
import { DRAFT_PLACEHOLDER_PREFIX } from '../utils/travelFormNormalization';

import { hasWebAuthCookie, mockFakeAuthApis, WEB_AUTH_COOKIE_NAME } from './helpers/auth';
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
  loginUrl: string | null;
  upserts: Record<string, unknown>[];
  unexpectedMutations: string[];
  unexpectedReads: string[];
};

async function prepareArticleFlow(page: Page): Promise<FixtureState> {
  const state: FixtureState = {
    registrations: 0, logins: 0, loginUrl: null, upserts: [], unexpectedMutations: [], unexpectedReads: [],
  };

  // Register before every endpoint owner: an undeclared read is a fixture
  // failure, never a live-backend request carrying the synthetic session.
  await page.route('**/api/**', (route) => {
    const request = route.request();
    if (request.method() !== 'GET') return route.fallback();
    state.unexpectedReads.push(`${request.method()} ${new URL(request.url()).pathname}`);
    return route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"Unexpected fixture read"}' });
  });

  await preacceptCookies(page);
  await installAnalyticsIntentRecorder(page);
  await page.route((url) =>
    /(^|\.)(google-analytics\.com|analytics\.google\.com|mc\.yandex\.(ru|com))$/i.test(url.hostname),
  (route) => route.fulfill({ status: 204, body: '' }));

  await mockFakeAuthApis(page);
  // Retained article widgets share this synthetic reader session. Letting their
  // reads reach Django would delete its intentionally unknown fixture cookie.
  const fixtureReads = new Map<string, { status: number; data: unknown }>([
    ['/api/countriesforsearch/', { status: 200, data: [{ country_id: 616, title_ru: 'Польша', country_code: 'PL' }] }],
    ['/api/travels/facets/', { status: 200, data: { total: 1, facets: {} } }],
    ['/api/quest-cities/', { status: 200, data: { count: 0, next: null, previous: null, results: [] } }],
    ['/api/quests/near-location/', { status: 200, data: { results: [], count: 0 } }],
    ['/api/user/subscriptions/', { status: 200, data: [] }],
    ['/api/achievements/user/99/', { status: 200, data: { rank: {}, earned_badges: [], peer_received: [] } }],
    [`/api/achievements/travel/${FALLBACK_TRAVEL_ID}/`, { status: 200, data: { peer_received: [] } }],
    ['/api/achievements/peer-badges/', { status: 200, data: [] }],
    [`/api/travels/travel${FALLBACK_TRAVEL_ID}/rating/users/1/`, { status: 404, data: { detail: 'Not found' } }],
  ]);
  await page.route((url) => fixtureReads.has(url.pathname), (route) => {
    const fixture = fixtureReads.get(new URL(route.request().url()).pathname);
    if (route.request().method() !== 'GET' || !fixture) return route.fallback();
    return route.fulfill({ status: fixture.status, contentType: 'application/json', body: JSON.stringify(fixture.data) });
  });
  await page.route((url) => url.pathname === '/api/travels/' || url.pathname === '/travels/', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ total: 1, data: [{
        id: FALLBACK_TRAVEL_ID, slug: FALLBACK_TRAVEL_SLUG, url: `/travels/${FALLBACK_TRAVEL_SLUG}`,
        name: 'Заголовок исходной статьи не является местом', countryName: 'Польша', cityName: PLACE,
        countryCode: 'PL', publish: true, moderation: true,
      }] }),
    });
  });
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
    state.loginUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      // Match the backend cookie even on trustworthy HTTP loopback, as the
      // shared auth helper and Google-login fixture already do.
      headers: { 'set-cookie': `${WEB_AUTH_COOKIE_NAME}=article-reader-fixture; Path=/; HttpOnly; Secure; SameSite=Lax` },
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

function expectCreateContext(href: string, origin: string, mode?: 'note'): void {
  const target = new URL(href, origin);
  expect(target.origin).toBe(origin);
  expect(target.pathname).toBe('/travel/new');
  expect(Object.fromEntries(target.searchParams)).toEqual({
    source_travel_id: String(FALLBACK_TRAVEL_ID), country: 'PL', place: PLACE,
    ...(mode ? { mode } : {}),
  });
}

async function expectAuthContext(page: Page, pathname: '/registration' | '/login', mode?: 'note'): Promise<void> {
  await expect(page).toHaveURL((url) => url.pathname === pathname);
  const authUrl = new URL(page.url());
  expect(authUrl.searchParams.get('intent')).toBe('share-trip');
  expectCreateContext(authUrl.searchParams.get('redirect') ?? '', authUrl.origin, mode);
}

function activeAuthForm(page: Page, route: '/registration' | '/login'): Locator {
  // Expo retains earlier screens in the DOM. Their inputs and terms gates
  // must not compete with the currently accessible screen's form card.
  const title = route === '/registration' ? 'Создайте аккаунт MeTravel' : 'С возвращением';
  return page.getByRole('heading', { level: 1, name: title, exact: true }).locator('..');
}

async function openSourceArticle(page: Page): Promise<void> {
  // Client-only fictional details have no matching server-rendered document.
  // Enter through a hydrated catalog card so both flows exercise real SPA navigation.
  await page.goto('/search', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveClass(/app-hydrated/);
  const card = page.locator('a[data-testid="travel-card-link"]').first();
  const article = `/travels/${FALLBACK_TRAVEL_SLUG}`;
  await expect.poll(async () => {
    const href = await card.getAttribute('href');
    if (!href) return null;
    const target = new URL(href, page.url());
    return { origin: target.origin, pathname: target.pathname, query: Object.fromEntries(target.searchParams) };
  }).toEqual({ origin: new URL(page.url()).origin, pathname: article, query: { returnTo: '/search' } });
  const documentStart = await page.evaluate(() => performance.timeOrigin);
  await card.click();
  await expect(page).toHaveURL(url => url.pathname === article && url.searchParams.get('returnTo') === '/search');
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStart);
}

async function expectReaderSessionCookie(page: Page, loginUrl: string): Promise<void> {
  // The URL-filtered cookie jar omits Secure cookies on HTTP loopback.
  const cookies = await page.context().cookies();
  expect(hasWebAuthCookie(cookies, loginUrl), 'Login must establish and retain a browser session on its API origin').toBe(true);
  const cookie = cookies.find((entry) => hasWebAuthCookie([entry], loginUrl));
  expect(cookie?.httpOnly, 'The matching session cookie must be HttpOnly').toBe(true);
  expect(cookie?.secure, 'The matching session cookie must preserve the backend Secure contract').toBe(true);
}

async function fillAuthForm(form: Locator): Promise<void> {
  await expect(form).toBeVisible();
  await form.locator('input[type="email"]').fill(READER_EMAIL);
  await form.locator('input[type="password"]').fill(READER_PASSWORD);
  const terms = form.getByTestId('auth-terms-gate-checkbox');
  if (await terms.getAttribute('aria-checked') !== 'true') await terms.click();
  await expect(terms).toBeChecked();
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`Article share-trip roundtrip ${viewport.width}px`, () => {
    test.use({ viewport, storageState: { cookies: [], origins: [] } });

    test('primary invitation keeps note mode and article context through login', async ({ page }) => {
      const state = await prepareArticleFlow(page);
      await openSourceArticle(page);
      const invite = page.getByTestId('travel-article-share-trip-button');
      await expect(invite).toHaveAccessibleName('Были здесь? Расскажите о своей поездке');
      await invite.click();
      await expectAuthContext(page, '/registration', 'note');
      await activeAuthForm(page, '/registration')
        .getByRole('button', { name: 'Войти в аккаунт', exact: true }).click();
      await expectAuthContext(page, '/login', 'note');
      const form = activeAuthForm(page, '/login');
      await fillAuthForm(form);
      await form.getByRole('button', { name: 'Войти', exact: true }).click();

      await expect(page.getByTestId('travel-note.root')).toBeVisible();
      expectCreateContext(page.url(), new URL(page.url()).origin, 'note');
      await expect(page.locator('#field-name input')).toHaveCount(0);
      await expect(page.getByTestId('travel-wizard-progress')).toHaveRole('progressbar');
      await expect(page.getByTestId('travel-wizard-progress')).toHaveAttribute('aria-label', /^Шаг 1 из 2:/);
      // The mobile header delegates its primary action to WizardStepFooter.
      const next = page.getByTestId(viewport.width === 390 ? 'travel-note.footer-next' : 'travel-note.next');
      await expect(next).toBeVisible();
      await next.click();
      await expect(page.getByTestId('travel-note.name')).toHaveValue(PLACE);
      await expect(page.getByTestId('travel-note.story')).toHaveValue('');
      expect(state.registrations).toBe(0);
      expect(state.logins).toBe(1);
      expect(state.loginUrl).not.toBeNull();
      await expectReaderSessionCookie(page, state.loginUrl!);
      expect(state.upserts).toEqual([]);
      expect(state.unexpectedMutations).toEqual([]);
      expect(state.unexpectedReads, 'Every API read must have an explicit scenario fixture').toEqual([]);
    });

    test('email registration without a session retains context through login and seeds an editable own trip', async ({ page }, testInfo) => {
      const state = await prepareArticleFlow(page);
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await openSourceArticle(page);

      // This regression covers the full editor, including changing the seeded country.
      const invite = page.getByTestId('travel-article-share-trip-full-button');
      await expect(invite).toBeVisible();
      await expect(invite).toHaveAccessibleName('Написать полную статью с маршрутом');
      await invite.scrollIntoViewIfNeeded();
      const box = await invite.boundingBox();
      expect(box?.height, 'Invitation must be a usable touch target').toBeGreaterThanOrEqual(44);
      await expect.poll(async () => (await readAnalyticsIntents(page, 'content_create_cta_impression'))
        .filter((event) => event.params.source === 'travel_article').length).toBe(1);
      await page.screenshot({ path: testInfo.outputPath('article-invitation.png') });
      await invite.click();
      await expectAuthContext(page, '/registration');
      // Growth events are dispatched by requestIdleCallback (up to 2s), so
      // arriving at the auth route does not imply that the click was observed.
      await expect.poll(async () => (await readAnalyticsIntents(page, 'content_create_cta_click'))
        .filter((event) => event.params.source === 'travel_article').length,
      { timeout: 10_000 }).toBe(1);
      const clicks = (await readAnalyticsIntents(page, 'content_create_cta_click'))
        .filter((event) => event.params.source === 'travel_article');
      expect(clicks).toHaveLength(1);
      expect(clicks[0].params.source_travel_id).toBe(String(FALLBACK_TRAVEL_ID));

      // Both auth forms must preserve the nested query before any account exists.
      await activeAuthForm(page, '/registration')
        .getByRole('button', { name: 'Войти в аккаунт', exact: true }).click();
      await expectAuthContext(page, '/login');
      await activeAuthForm(page, '/login').getByText('Зарегистрируйтесь', { exact: true }).click();
      await expectAuthContext(page, '/registration');
      const registrationForm = activeAuthForm(page, '/registration');
      await fillAuthForm(registrationForm);
      await registrationForm.getByRole('button', { name: 'Зарегистрироваться', exact: true }).click();

      const authGate = page.getByTestId('travel-upsert.auth-required');
      await expect(authGate).toBeVisible();
      expectCreateContext(page.url(), new URL(page.url()).origin);
      expect(state.registrations).toBe(1);
      expect((await page.context().cookies()).some((cookie) => cookie.name === WEB_AUTH_COOKIE_NAME)).toBe(false);
      await authGate.getByRole('button', { name: /^Войти.*вернуться/ }).click();
      await expectAuthContext(page, '/login');
      const loginForm = activeAuthForm(page, '/login');
      await fillAuthForm(loginForm);
      await loginForm.getByRole('button', { name: 'Войти', exact: true }).click();

      const name = page.locator('#field-name input');
      const countries = page.getByTestId('travel-wizard.step-basic.countries');
      await expect(name).toHaveValue(PLACE);
      await expect(countries).toContainText('Польша');
      expectCreateContext(page.url(), new URL(page.url()).origin);
      expect(state.logins).toBe(1);
      expect(state.loginUrl, 'The fixture must observe the login request').not.toBeNull();
      await expectReaderSessionCookie(page, state.loginUrl!);

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
      expect(state.unexpectedReads, 'Every API read must have an explicit scenario fixture').toEqual([]);
      expect(pageErrors).toEqual([]);
      await expectReaderSessionCookie(page, state.loginUrl!);
      expect(await page.evaluate(() => window.localStorage.getItem('secure_userToken'))).toBeNull();
    });
  });
}
