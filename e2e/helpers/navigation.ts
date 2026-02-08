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

  const cards = page.locator('[data-testid="travel-card-link"]');

  // Wait for either cards or empty state
  await Promise.race([
    cards.first().waitFor({ state: 'visible', timeout: 30_000 }),
    page.waitForSelector('text=Пока нет путешествий', { timeout: 30_000 }),
  ]).catch(() => null);

  if ((await cards.count()) === 0) return false;

  await cards.first().click();
  await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 30_000 });

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
  await Promise.race([
    page.waitForSelector('#search-input', { timeout: 30_000 }),
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
