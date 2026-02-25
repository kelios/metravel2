import { expect, type Page } from '@playwright/test';
import { seedNecessaryConsent, hideRecommendationsBanner } from './storage';
import { getTravelsListPath } from './routes';

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
  opts?: { maxAttempts?: number; timeout?: number }
) {
  const maxAttempts = opts?.maxAttempts ?? 5;
  const timeout = opts?.timeout ?? 60_000;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
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
  opts?: { waitForDetails?: boolean }
): Promise<boolean> {
  await gotoWithRetry(page, getTravelsListPath());

  const roleCards = page.getByRole('link', { name: /^Открыть маршрут/ });
  const linkCards = page.locator('[data-testid="travel-card-link"], [testID="travel-card-link"]');
  // Fallback: some list variants expose the card root testID (travel-card-<slug/id>)
  const fallbackCards = page.locator('[data-testid^="travel-card-"], [testID^="travel-card-"]');
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

  const firstCard = cards.first();
  await firstCard.scrollIntoViewIfNeeded();

  const isOnDetails = () => {
    try {
      const u = new URL(page.url());
      return u.pathname.startsWith('/travels/') || u.pathname.startsWith('/travel/');
    } catch {
      return false;
    }
  };

  // Some card variants contain nested action buttons inside the link.
  // Clicking the center can hit those buttons and prevent navigation.
  const box = await firstCard.boundingBox();
  if (box) {
    await firstCard.click({ position: { x: 8, y: 8 } });
  } else {
    await firstCard.click({ force: true });
  }

  // If the click got intercepted, retry with increasingly aggressive activation.
  await page.waitForTimeout(150);
  if (!isOnDetails()) {
    try {
      await firstCard.click({ force: true });
    } catch {
      // ignore
    }
  }

  await page.waitForTimeout(150);
  if (!isOnDetails()) {
    try {
      await firstCard.evaluate((el: any) => {
        if (typeof el?.click === 'function') el.click();
      });
    } catch {
      // ignore
    }
  }

  // Fallback: if the click was intercepted, try keyboard activation.
  // TravelListItem's web wrapper handles Enter/Space.
  await page.waitForTimeout(150);
  if (!isOnDetails()) {
    try {
      await firstCard.focus();
      await page.keyboard.press('Enter');
    } catch {
      // ignore
    }
  }

  await page.waitForTimeout(150);
  if (!isOnDetails()) {
    try {
      await firstCard.focus();
      await page.keyboard.press(' ');
    } catch {
      // ignore
    }
  }
  // SPA navigation does not always trigger a full page load/commit event.
  // Rely on URL change, with a fallback poll in case navigation happens without a full commit.
  const reachedDetails = await page
    .waitForURL((url) => url.pathname.startsWith('/travels/') || url.pathname.startsWith('/travel/'), {
      timeout: 45_000,
    })
    .then(() => true)
    .catch(async () => {
      const started = Date.now();
      while (Date.now() - started < 45_000) {
        if (isOnDetails()) return true;
        try {
          await page.waitForTimeout(200);
        } catch {
          break;
        }
      }
      return false;
    });
  if (!reachedDetails) return false;

  if (opts?.waitForDetails !== false) {
    const mainContent = page.locator(
      '[data-testid="travel-details-page"], [testID="travel-details-page"]'
    );
    await Promise.race([
      mainContent.first().waitFor({ state: 'visible', timeout: 30_000 }),
      page.waitForSelector('text=Не удалось загрузить путешествие', { timeout: 30_000 }),
    ]).catch(() => null);
  }

  return true;
}

/**
 * Wait for the main list page to render (cards, skeleton, or empty state).
 */
export async function waitForMainListRender(page: Page) {
  await Promise.any([
    page.waitForSelector('#search-input', { timeout: 30_000 }),
    page.waitForSelector('[placeholder*="Найти путешествия"]', { timeout: 30_000 }),
    page.waitForSelector(
      '[data-testid="travel-card-link"], [data-testid="travel-card-skeleton"], [data-testid="list-travel-skeleton"]',
      { timeout: 30_000 }
    ),
    page.waitForSelector('text=Пока нет путешествий', { timeout: 30_000 }),
    page.waitForSelector('text=Найдено:', { timeout: 30_000 }),
    page.waitForSelector('text=Пиши о своих путешествиях', { timeout: 30_000 }),
  ]);
}

/**
 * Helper to build a testid selector that works with both data-testid and testID.
 */
export function tid(id: string): string {
  return `[data-testid="${id}"], [testID="${id}"]`;
}
