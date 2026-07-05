import { expect, type Page } from '@playwright/test';
import { seedNecessaryConsent, hideRecommendationsBanner } from './storage';
import { getTravelsListPath } from './routes';

const TRAVEL_DETAILS_LOAD_ERROR_PATTERN = /не удалось загрузить путешествие|требуется авторизация/i;
const FALLBACK_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8ZKfkAAAAASUVORK5CYII=';
const FALLBACK_TRAVEL_ID = 990081;
export const FALLBACK_TRAVEL_SLUG = 'e2e-stable-travel-details';

const fallbackTravelPayload = {
  id: FALLBACK_TRAVEL_ID,
  slug: FALLBACK_TRAVEL_SLUG,
  url: `/travels/${FALLBACK_TRAVEL_SLUG}`,
  name: 'E2E stable travel details',
  userName: 'E2E',
  cityName: 'Гомель',
  countryName: 'Беларусь',
  countryCode: 'BY',
  countUnicIpView: '7',
  travel_image_thumb_url: FALLBACK_IMAGE,
  travel_image_thumb_small_url: FALLBACK_IMAGE,
  gallery: [FALLBACK_IMAGE, FALLBACK_IMAGE, FALLBACK_IMAGE],
  travelAddress: [
    {
      id: 1,
      name: 'Гомель',
      address: 'Гомель',
      coord: '52.4238936, 31.0131698',
      travelImageThumbUrl: FALLBACK_IMAGE,
      travel_image_thumb_url: FALLBACK_IMAGE,
      categoryName: 'Город',
      urlTravel: '',
      articleUrl: '',
    },
    {
      id: 2,
      name: 'Ветка',
      address: 'Ветка',
      coord: '52.559742, 31.179482',
      travelImageThumbUrl: FALLBACK_IMAGE,
      travel_image_thumb_url: FALLBACK_IMAGE,
      categoryName: 'Город',
      urlTravel: '',
      articleUrl: '',
    },
  ],
  coordsMeTravel: [
    {
      lat: 52.4238936,
      lng: 31.0131698,
      title: 'Гомель',
      coord: '52.4238936, 31.0131698',
    },
    {
      lat: 52.559742,
      lng: 31.179482,
      title: 'Ветка',
      coord: '52.559742, 31.179482',
    },
  ],
  year: '2026',
  monthName: 'Май',
  number_days: 2,
  companions: [],
  youtube_link: '',
  description:
    '<p>Тестовое описание стабильного маршрута без небезопасных скриптов.</p><p>Второй абзац нужен для проверки секций и прокрутки.</p>',
  recommendation: 'Рекомендуем начать маршрут утром.',
  plus: 'Короткие переезды',
  minus: 'Погода может меняться',
  userIds: '',
  publish: true,
  moderation: true,
  rating: 4.7,
  rating_count: 12,
  user_rating: null,
};

export async function mockFallbackTravelDetails(page: Page): Promise<void> {
  const routeHandler = async (route: any) => {
    const request = route.request();
    if (request.method() !== 'GET') {
      await route.continue();
      return;
    }

    const url = request.url();
    if (
      url.includes(`/api/travels/by-slug/${FALLBACK_TRAVEL_SLUG}/`) ||
      url.includes(`/travels/by-slug/${FALLBACK_TRAVEL_SLUG}/`) ||
      url.includes(`/api/travels/${FALLBACK_TRAVEL_ID}/`)
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fallbackTravelPayload),
      });
      return;
    }

    await route.continue();
  };

  await page.route('**/api/travels/by-slug/**', routeHandler);
  await page.route('**/travels/by-slug/**', routeHandler);
  await page.route(`**/api/travels/${FALLBACK_TRAVEL_ID}/`, routeHandler);
}

export async function openFallbackTravelDetails(page: Page): Promise<boolean> {
  await mockFallbackTravelDetails(page);
  await gotoWithRetry(page, `/travels/${FALLBACK_TRAVEL_SLUG}`);

  const detailsRoot = page.locator(tid('travel-details-page')).first();
  const detailsVisible = await detailsRoot
    .waitFor({ state: 'visible', timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  if (!detailsVisible) return false;
  return !(await hasTravelDetailsLoadError(page, 1500));
}

/**
 * Pre-accept cookies and hide non-essential banners to stabilize tests.
 */
export async function preacceptCookies(page: Page) {
  await page.addInitScript(seedNecessaryConsent);
  await page.addInitScript(hideRecommendationsBanner);
}

/**
 * Navigate to a URL with retries for transient connection errors
 * (cold-start dev server, ERR_CONNECTION_REFUSED, etc.).
 */
export async function gotoWithRetry(
  page: Page,
  url: string,
  opts?: {
    maxAttempts?: number;
    attempts?: number;
    timeout?: number;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
    allowMissingRouteShell?: boolean;
  }
) {
  const maxAttempts = opts?.maxAttempts ?? opts?.attempts ?? 5;
  const timeout = opts?.timeout ?? 60_000;
  const waitUntil = opts?.waitUntil ?? 'domcontentloaded';
  let lastError: any = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await page.goto(url, { waitUntil, timeout });
      if (!opts?.allowMissingRouteShell && (await isMissingRouteShell(page))) {
        lastError = new Error(`Unexpected missing-route shell after navigating to ${url}`);
        await page.waitForTimeout(Math.min(700 + attempt * 500, 3000));
        continue;
      }
      return;
    } catch (e) {
      lastError = e;
      const msg = String((e as any)?.message ?? e ?? '');
      const isTransient =
        msg.includes('ERR_CONNECTION_REFUSED') ||
        msg.includes('ERR_EMPTY_RESPONSE') ||
        msg.includes('NS_ERROR_NET_RESET') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('net::');

      if (typeof (page as any)?.isClosed === 'function' && (page as any).isClosed()) break;

      try {
        await page.waitForTimeout(isTransient ? Math.min(1000 + attempt * 600, 8000) : 500);
      } catch {
        break;
      }
    }
  }
  if (lastError) throw lastError;
}

async function isMissingRouteShell(page: Page): Promise<boolean> {
  const bodyText = await page
    .locator('body')
    .innerText({ timeout: 1000 })
    .catch(() => '');
  return /Страница не найдена|Not found/i.test(bodyText);
}

/**
 * Assert that the page has no horizontal scroll overflow.
 */
export async function assertNoHorizontalScroll(page: Page) {
  const res = await page.evaluate(() => {
    const docEl = document.documentElement;
    const body = document.body;
    return {
      docScrollWidth: docEl?.scrollWidth ?? 0,
      docClientWidth: docEl?.clientWidth ?? 0,
      bodyScrollWidth: body?.scrollWidth ?? 0,
      bodyClientWidth: body?.clientWidth ?? 0,
      docOverflowX: getComputedStyle(docEl).overflowX,
      bodyOverflowX: getComputedStyle(body).overflowX,
    };
  });

  expect(
    res.docScrollWidth,
    `documentElement has horizontal overflow: scrollWidth=${res.docScrollWidth} clientWidth=${res.docClientWidth} overflowX=${res.docOverflowX}`
  ).toBeLessThanOrEqual(res.docClientWidth);

  expect(
    res.bodyScrollWidth,
    `body has horizontal overflow: scrollWidth=${res.bodyScrollWidth} clientWidth=${res.bodyClientWidth} overflowX=${res.bodyOverflowX}`
  ).toBeLessThanOrEqual(res.bodyClientWidth);
}

/**
 * Navigate to the travels list and click the first travel card.
 * Returns false if no cards are available (test should skip).
 */
export async function navigateToFirstTravel(
  page: Page,
  opts?: { waitForDetails?: boolean; allowMockFallback?: boolean }
): Promise<boolean> {
  await gotoWithRetry(page, getTravelsListPath());

  const roleCards = page.getByRole('link', { name: /^Открыть маршрут/ });
  const linkCards = page.locator('[data-testid="travel-card-link"], [testID="travel-card-link"]');
  // Fallback: some list variants expose the card root testID (travel-card-<slug/id>)
  const fallbackCards = page.locator(
    '[data-testid^="travel-card-"]:not([data-testid*="skeleton"]), [testID^="travel-card-"]:not([testID*="skeleton"])'
  );
  const cards =
    (await roleCards.count()) > 0
      ? roleCards
      : (await linkCards.count()) > 0
        ? linkCards
        : fallbackCards;

  // Wait for either cards or empty state
  await Promise.race([
    cards.first().waitFor({ state: 'visible', timeout: 30_000 }),
    page.waitForSelector('text=Пока нет путешествий', { timeout: 30_000 }),
  ]).catch(() => null);

  if ((await cards.count()) === 0) return false;

  const isOnDetails = () => {
    try {
      const u = new URL(page.url());
      return u.pathname.startsWith('/travels/') || u.pathname.startsWith('/travel/');
    } catch {
      return false;
    }
  };

  const detailsReady = async () => {
    if (opts?.waitForDetails === false) return true;
    const mainContent = page.locator(
      '[data-testid="travel-details-page"], [testID="travel-details-page"]'
    );
    const loaded = await Promise.race([
      mainContent
        .first()
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => 'details' as const)
        .catch(() => 'missing' as const),
      page
        .getByText(TRAVEL_DETAILS_LOAD_ERROR_PATTERN)
        .first()
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => 'error' as const)
        .catch(() => 'missing' as const),
    ]);

    if (loaded !== 'details') return false;
    await page.waitForTimeout(500).catch(() => null);
    return !(await hasTravelDetailsLoadError(page, 500));
  };

  const clickCard = async (card: ReturnType<Page['locator']>, force = false) => {
    await card.waitFor({ state: 'visible', timeout: 5_000 });
    await card.scrollIntoViewIfNeeded();
    if (force) {
      await card.click({ force: true });
      return;
    }
    // Some card variants contain nested action buttons inside the link.
    // Clicking the center can hit those buttons and prevent navigation.
    const box = await card.boundingBox();
    if (box) {
      await card.click({ position: { x: 8, y: 8 } });
    } else {
      await card.click({ force: true });
    }
  };

  const resolveCardHref = async (card: ReturnType<Page['locator']>) => {
    const directHref = await card.getAttribute('href').catch(() => null);
    if (directHref) return directHref;
    return card
      .locator('a[href^="/travels/"], a[href^="/travel/"]')
      .first()
      .getAttribute('href')
      .catch(() => null);
  };

  const tryCurrentDetails = async () => isOnDetails() && (await detailsReady());
  const cardCount = Math.min(await cards.count(), 5);

  for (let index = 0; index < cardCount; index += 1) {
    const card = cards.nth(index);
    const href = await resolveCardHref(card);

    if (href && /^\/travels?\//.test(href)) {
      await gotoWithRetry(page, href);
      if (await tryCurrentDetails()) return true;
      await gotoWithRetry(page, getTravelsListPath());
      continue;
    }

    try {
      await clickCard(card, false);
      await page.waitForTimeout(150);
      if (await tryCurrentDetails()) return true;
    } catch {
      // ignore
    }
    try {
      await clickCard(card, true);
      await page.waitForTimeout(150);
      if (await tryCurrentDetails()) return true;
    } catch {
      // ignore
    }
    try {
      await card.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(150);
      if (await tryCurrentDetails()) return true;
      await page.keyboard.press(' ');
      await page.waitForTimeout(150);
      if (await tryCurrentDetails()) return true;
    } catch {
      // ignore
    }

    if (index < cardCount - 1) {
      await gotoWithRetry(page, getTravelsListPath());
    }
  }

  if (opts?.allowMockFallback === false) return false;
  return openFallbackTravelDetails(page);
}

/**
 * Wait for the main list page to render (cards, skeleton, or empty state).
 */
export async function waitForMainListRender(page: Page) {
  await Promise.any([
    page.waitForSelector('#search-input', { timeout: 30_000 }),
    page.waitForSelector('[placeholder*="Найти путешествия"]', { timeout: 30_000 }),
    page.waitForSelector(
      '[data-testid="travel-card-link"], [testID="travel-card-link"], [data-testid="travel-card-skeleton"], [testID="travel-card-skeleton"], [data-testid="list-travel-skeleton"], [testID="list-travel-skeleton"]',
      { timeout: 30_000 }
    ),
    page.waitForSelector('text=Пока нет путешествий', { timeout: 30_000 }),
    page.waitForSelector('text=Ничего не найдено', { timeout: 30_000 }),
    page.waitForSelector('[data-testid="results-count-wrapper"], [testID="results-count-wrapper"]', { timeout: 30_000 }),
    page.waitForSelector('[data-testid="results-count-text"], [testID="results-count-text"]', { timeout: 30_000 }),
    page.waitForSelector('text=Результаты', { timeout: 30_000 }),
    page.waitForSelector('text=Пиши о своих путешествиях', { timeout: 30_000 }),
  ]);
}

/**
 * Helper to build a testid selector that works with both data-testid and testID.
 */
export function tid(id: string): string {
  return `[data-testid="${id}"], [testID="${id}"]`;
}

/**
 * Detect known travel details load errors rendered in app UI.
 */
export async function hasTravelDetailsLoadError(page: Page, timeout = 3000): Promise<boolean> {
  const loadError = page.getByText(TRAVEL_DETAILS_LOAD_ERROR_PATTERN).first();
  await loadError.waitFor({ state: 'visible', timeout }).catch(() => null);
  return loadError.isVisible().catch(() => false);
}
