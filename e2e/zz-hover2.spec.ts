import { test, expect, type Page } from '@playwright/test';
import { gotoWithRetry, preacceptCookies } from './helpers/navigation';

const createTravel = (id: number) => ({
  id,
  slug: `e2e-hover-${id}`,
  url: `/travels/e2e-hover-${id}`,
  name: `E2E hover ${id}`,
  countryName: 'Беларусь',
  cityName: 'Минск',
  travel_image_thumb_url: `/assets/images/open-book-bg.webp?id=${id}`,
  travel_image_thumb_small_url: `/assets/images/open-book-bg.webp?id=${id}`,
  publish: true,
  moderation: true,
});

const mockList = async (page: Page) => {
  await preacceptCookies(page);
  const travels = [createTravel(1), createTravel(2)];
  const fulfillList = async (route: import('@playwright/test').Route) => {
    const url = new URL(route.request().url());
    const isList = url.pathname.endsWith('/api/travels/') || url.pathname === '/travels/';
    if (!isList || route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: travels, total: travels.length }) });
  };
  await page.route('**/api/travels/**', fulfillList);
  await page.route('**/travels/**', fulfillList);
};

const dumpChain = (page: Page) =>
  page.evaluate(() => {
    const a = document.querySelector('a[data-testid="travel-card-link"]') as HTMLElement;
    const container = a.firstElementChild?.firstElementChild as HTMLElement;
    const cs = getComputedStyle(container);
    const action = document.querySelector('[data-card-action="true"]') as HTMLElement | null;
    return {
      transform: cs.transform,
      borderColor: cs.borderTopColor,
      boxShadow: cs.boxShadow.slice(0, 60),
      containerY: Math.round(container.getBoundingClientRect().y),
      actionY: action ? Math.round(action.getBoundingClientRect().y) : null,
    };
  });

test.use({ viewport: { width: 1280, height: 900 } });

test('hover chain', async ({ page }) => {
  await mockList(page);
  await gotoWithRetry(page, '/travelsby');
  const card = page.locator('a[data-testid="travel-card-link"]').first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  console.log('REST=' + JSON.stringify(await dumpChain(page)));
  await card.hover({ position: { x: 60, y: 120 } });
  await page.waitForTimeout(700);
  console.log('HOVER=' + JSON.stringify(await dumpChain(page)));
});
