import { expect, test } from './fixtures';
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth';
import { preacceptCookies } from './helpers/navigation';

const TRAVEL_ID = 990_071;
const SLUG = 'e2e-travel-rating';

const mockedTravel = {
  id: TRAVEL_ID,
  name: 'E2E Travel Rating',
  slug: SLUG,
  url: `/travels/${SLUG}`,
  userName: 'E2E Author',
  cityName: 'Тбилиси',
  countryName: 'Грузия',
  countryCode: 'GE',
  countUnicIpView: '0',
  travel_image_thumb_url: null,
  travel_image_thumb_small_url: null,
  gallery: [],
  travelAddress: [],
  coordsMeTravel: [],
  year: '2025',
  monthName: 'Январь',
  number_days: 1,
  companions: [],
  youtube_link: '',
  description: '<p>Тестовое описание маршрута с рейтингом.</p>',
  recommendation: '',
  plus: '',
  minus: '',
  userIds: '',
  publish: true,
  moderation: true,
  rating: 4.6,
  rating_count: 12,
  user_rating: null,
};

const fulfillJson = (route: import('@playwright/test').Route, status: number, value: unknown) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(value),
  });

async function setupRating(
  page: import('@playwright/test').Page,
  options: { authenticated: boolean; initialUserRating?: number | null },
) {
  let userRating = options.initialUserRating ?? null;
  await page.addInitScript(() => {
    (window as Window & { __metravelTravelPreloadScriptLoaded?: boolean })
      .__metravelTravelPreloadScriptLoaded = true;
  });

  if (options.authenticated) {
    await ensureAuthedStorageFallback(page, { userId: '1', userName: 'E2E User' });
  } else {
    await page.addInitScript(() => {
      window.localStorage.removeItem('userId');
      window.localStorage.removeItem('userName');
      window.localStorage.removeItem('isSuperuser');
      window.localStorage.removeItem('secure_userToken');
      window.localStorage.removeItem('secure_refreshToken');
    });
  }
  await preacceptCookies(page);

  // Keep unrelated deferred travel-detail requests deterministic.
  await page.route('**/api/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('.bundle') || pathname.endsWith('.map')) return route.fallback();
    if (
      pathname.includes(`/travels/by-slug/${SLUG}/`) ||
      pathname.includes(`/travels/resolve-slug/${SLUG}/`) ||
      pathname.endsWith(`/travels/${TRAVEL_ID}/`)
    ) {
      return fulfillJson(route, 200, { ...mockedTravel, user_rating: userRating });
    }
    return fulfillJson(route, 200, {});
  });
  if (options.authenticated) await mockFakeAuthApis(page);

  const travelHandler = (route: import('@playwright/test').Route) =>
    fulfillJson(route, 200, { ...mockedTravel, user_rating: userRating });
  await page.route(`**/api/travels/by-slug/${SLUG}**`, travelHandler);
  await page.route(`**/travels/by-slug/${SLUG}**`, travelHandler);

  await page.route(`**/travels/travel${TRAVEL_ID}/rating/users/1/**`, (route) => {
    if (route.request().method() !== 'GET') return fulfillJson(route, 405, {});
    if (userRating == null) return fulfillJson(route, 404, { detail: 'Not found' });
    return fulfillJson(route, 200, {
      id: 70_001,
      user: 1,
      travel: TRAVEL_ID,
      rating: userRating,
    });
  });

  await page.route('**/travels/rating/**', (route) => {
    if (route.request().method() !== 'POST') return fulfillJson(route, 405, {});
    const body = route.request().postDataJSON() as { rating: number };
    const wasFirstRating = userRating == null;
    userRating = body.rating;
    return fulfillJson(route, 200, {
      rating: body.rating === 5 ? 4.7 : 4.6,
      rating_count: wasFirstRating ? 13 : 12,
      user_rating: userRating,
    });
  });
}

async function openRating(page: import('@playwright/test').Page) {
  await page.goto(`/travels/${SLUG}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#root')).toHaveAttribute('data-travel-details-ready', 'true');
  const ratingRegion = page.getByRole('region', { name: 'Рейтинг путешествия' });
  await expect(ratingRegion).toBeVisible({ timeout: 20_000 });
  await ratingRegion.scrollIntoViewIfNeeded();
  const section = page.getByTestId('travel-rating-section');
  await expect(section).toBeVisible({ timeout: 20_000 });
  return section;
}

test.describe('Travel rating — guest contract', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('shows the aggregate rating and a login action without interactive stars', async ({ page }) => {
    await setupRating(page, { authenticated: false });
    const section = await openRating(page);

    await expect(section.getByText('Рейтинг', { exact: true })).toBeVisible();
    await expect(section.getByText('12 оценок', { exact: true })).toBeVisible();
    await expect(section.getByRole('button', { name: 'Войдите, чтобы оценить маршрут' })).toBeVisible();
    await expect(section.getByRole('button', { name: /Оценить на [1-5] из 5/ })).toHaveCount(0);
  });
});

test.describe('Travel rating — authenticated contracts', () => {
  test('submits the first rating and updates the aggregate UI', async ({ page }) => {
    await setupRating(page, { authenticated: true });
    const section = await openRating(page);
    const fiveStars = section.getByRole('button', { name: 'Оценить на 5 из 5' });
    await expect(fiveStars).toBeVisible();

    const ratingRequest = page.waitForRequest((request) =>
      request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/travels/rating/'),
    );
    await fiveStars.click();

    expect((await ratingRequest).postDataJSON()).toEqual({
      user: 1,
      travel: TRAVEL_ID,
      rating: 5,
    });
    await expect(section.getByText('Ваша оценка', { exact: true })).toBeVisible();
    await expect(section.getByText('13 оценок', { exact: true })).toBeVisible();
  });

  test('loads and changes an existing user rating', async ({ page }) => {
    await setupRating(page, { authenticated: true, initialUserRating: 3 });
    const section = await openRating(page);
    const threeStars = section.getByRole('button', { name: 'Оценить на 3 из 5' });
    const fiveStars = section.getByRole('button', { name: 'Оценить на 5 из 5' });
    await expect(section.getByText('Ваша оценка', { exact: true })).toBeVisible();
    await expect(threeStars).toHaveText('★');
    await expect(fiveStars).toHaveText('☆');

    const ratingRequest = page.waitForRequest((request) =>
      request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/travels/rating/'),
    );
    await fiveStars.click();
    expect((await ratingRequest).postDataJSON()).toMatchObject({ rating: 5, travel: TRAVEL_ID });
    await expect(fiveStars).toHaveText('★');
    await expect(section.getByText('12 оценок', { exact: true })).toBeVisible();
  });
});
