import { devices, type Page } from '@playwright/test';

import { test, expect } from './fixtures';
import { gotoWithRetry, preacceptCookies } from './helpers/navigation';

const createTravel = (id: number) => ({
  id,
  slug: `e2e-link-semantics-${id}`,
  url: `/travels/e2e-link-semantics-${id}`,
  name: `E2E link semantics ${id}`,
  countryName: 'Беларусь',
  cityName: 'Минск',
  travel_image_thumb_url: `/assets/images/open-book-bg.webp?id=${id}`,
  travel_image_thumb_small_url: `/assets/images/open-book-bg.webp?id=${id}`,
  publish: true,
  moderation: true,
});

/** Детерминированный список маршрутов: карточки не должны зависеть от контента. */
const mockTravelList = async (page: Page) => {
  await preacceptCookies(page);
  const travels = [createTravel(1), createTravel(2)];
  const fulfillList = async (route: import('@playwright/test').Route) => {
    const url = new URL(route.request().url());
    const isListEndpoint =
      url.pathname.endsWith('/api/travels/') || url.pathname === '/travels/';
    if (!isListEndpoint || route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: travels, total: travels.length }),
    });
  };

  await page.route('**/api/travels/**', fulfillList);
  await page.route('**/travels/**', fulfillList);
  return travels;
};

const verifyTravelCardLinkSemantics = async (page: Page, screenshotPath: string) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  const travels = await mockTravelList(page);
  await gotoWithRetry(page, '/travelsby');

  const cards = page.locator('a[data-testid="travel-card-link"]');
  await expect(cards).toHaveCount(travels.length, { timeout: 30_000 });

  const samples = await cards.evaluateAll((anchors) =>
    anchors.map((anchor) => {
      const href = anchor.getAttribute('href');

      return {
        href,
        ariaLabel: anchor.getAttribute('aria-label'),
        nestedPrimaryLinks: anchor.querySelectorAll('[role="link"][tabindex="0"]').length,
        // Внутри `<a>` не должно быть НИ ОДНОГО интерактивного потомка, а не
        // только вложенной ссылки: кнопки «Хочу поехать» и «Добавить в план»
        // давали по две лишние остановки Tab на карточку и невалидную по HTML
        // вложенность интерактивного контента в ссылку (#1626).
        nestedInteractive: anchor.querySelectorAll(
          'a, button, input, select, textarea, [role="link"], [role="button"], [tabindex]:not([tabindex="-1"])',
        ).length,
      };
    }),
  );

  // Кнопки действий никуда не делись — они просто переехали из якоря наружу.
  const strandedActions = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('[data-card-action="true"]')).filter((node) =>
        node.closest('a[data-testid="travel-card-link"]'),
      ).length,
  );
  expect(strandedActions).toBe(0);

  // Переезд из якоря не должен сдвинуть кнопки: их геометрия задаётся теми же
  // константами, что и слоты внутри карточки, и обязана остаться в её границах.
  const actionGeometry = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[data-testid="travel-card-link"]'))
    return Array.from(document.querySelectorAll('[data-card-action="true"]')).map((node) => {
      const a = node.getBoundingClientRect()
      const card = anchors
        .map((anchor) => anchor.getBoundingClientRect())
        .find((r) => a.left >= r.left - 1 && a.right <= r.right + 1 && a.top >= r.top - 1 && a.bottom <= r.bottom + 1)
      return { inside: !!card, w: Math.round(a.width), h: Math.round(a.height) }
    })
  })
  expect(actionGeometry.length).toBeGreaterThan(0)
  for (const action of actionGeometry) {
    expect(action.inside).toBe(true)
    expect(action.w).toBeGreaterThan(0)
    expect(action.h).toBeGreaterThan(0)
  }

  expect(samples).toHaveLength(travels.length);
  for (const [index, sample] of samples.entries()) {
    const href = new URL(sample.href!, 'https://metravel.by');
    expect(href.pathname).toBe(`/travels/e2e-link-semantics-${index + 1}`);
    expect(href.searchParams.get('returnTo')).toBe('/travelsby');
    expect(sample.ariaLabel).toContain(`E2E link semantics ${index + 1}`);
    expect(sample.nestedPrimaryLinks).toBe(0);
    expect(sample.nestedInteractive).toBe(0);
  }

  const firstCard = cards.first();
  await firstCard.focus();
  await expect(firstCard).toBeFocused();
  expect(await firstCard.ariaSnapshot()).toContain('link "');

  await page.screenshot({ path: screenshotPath, fullPage: false });
  expect(runtimeErrors).toEqual([]);

  const newTabPromise = page.context().waitForEvent('page');
  await firstCard.click({ modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'] });
  const newTab = await newTabPromise;
  await newTab.waitForURL(/\/travels\/e2e-link-semantics-1(?:\?|$)/);
  expect(new URL(newTab.url()).pathname).toBe('/travels/e2e-link-semantics-1');
  await newTab.close();
  await expect(page).toHaveURL(/\/travelsby(?:\?|$)/);

  await firstCard.click();
  await expect(page).toHaveURL(/\/travels\/e2e-link-semantics-1(?:\?|$)/);
};

test.describe('Travel card link semantics', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('desktop web has one real link owner per card', async ({ page }, testInfo) => {
    await verifyTravelCardLinkSemantics(page, testInfo.outputPath('desktop.png'));
  });

  test.describe('mobile web', () => {
    test.use({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent: devices['Pixel 7'].userAgent,
    });

    test('has the same single-link contract', async ({ page }, testInfo) => {
      await verifyTravelCardLinkSemantics(page, testInfo.outputPath('mobile.png'));
    });
  });
});
