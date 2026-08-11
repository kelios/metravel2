import { test, expect } from './fixtures';
import { devices, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { gotoWithRetry, preacceptCookies, tid } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

const CARD = '[data-testid="travel-card-link"], [testID="travel-card-link"]';
const IMAGE = '/e2e-catalog-cover.webp';
const IMAGE_BODY = fs.readFileSync(path.resolve('public/assets/images/open-book-bg.webp'));

const createTravel = (id: number) => ({
  id,
  slug: `e2e-pagination-${id}`,
  url: `/travels/e2e-pagination-${id}`,
  name: `E2E paginated travel ${id}`,
  countryName: 'Беларусь',
  cityName: 'Минск',
  travel_image_thumb_url: IMAGE,
  travel_image_thumb_small_url: IMAGE,
  publish: true,
  moderation: true,
});

const verifyCatalogMediaLoadingPolicy = async (page: Page, screenshotPath: string) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await preacceptCookies(page);

  const travels = Array.from({ length: 18 }, (_, index) => createTravel(index + 1));
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
  await page.route('**/e2e-catalog-cover.webp*', (route) => route.fulfill({
    status: 200,
    contentType: 'image/webp',
    body: IMAGE_BODY,
  }));
  await gotoWithRetry(page, getTravelsListPath());
  await expect
    .poll(() => page.locator(CARD).count(), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(2);

  const samplePolicy = () =>
    page.locator('[data-testid^="travel-row-"]').evaluateAll((rows) =>
      rows.flatMap((row) => {
        const match = (row.getAttribute('data-testid') || '').match(/^travel-row-(\d+)$/);
        if (!match) return [];
        return Array.from(row.querySelectorAll('img')).map((img) => ({
          row: Number(match[1]),
          loading: img.getAttribute('loading'),
          fetchPriority: img.getAttribute('fetchpriority'),
        }));
      }),
    );

  const scroll = page.locator(tid('right-column-scrollview')).first();
  await expect(scroll).toBeVisible();
  await scroll.evaluate((node: HTMLElement) => {
    node.scrollTop = 0;
    node.dispatchEvent(new Event('scroll', { bubbles: true }));
  });

  await expect
    .poll(samplePolicy, { timeout: 15_000 })
    .toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 0, loading: 'eager', fetchPriority: 'high' }),
      expect.objectContaining({ row: 1, loading: 'lazy', fetchPriority: 'low' }),
    ]));

  await scroll.evaluate((node: HTMLElement) => {
    node.scrollTop = 120;
    node.dispatchEvent(new Event('scroll', { bubbles: true }));
  });

  await expect
    .poll(async () => {
      const samples = await samplePolicy();
      return samples.length > 0 && samples.every(
        (sample) => sample.loading === 'lazy' && sample.fetchPriority === 'low',
      );
    })
    .toBe(true);

  for (let cycle = 0; cycle < 10; cycle += 1) {
    await scroll.evaluate((node: HTMLElement) => {
      node.scrollTop = Math.min(node.scrollHeight - node.clientHeight, 1160);
      node.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await page.waitForTimeout(50);
    await scroll.evaluate((node: HTMLElement) => {
      node.scrollTop = 0;
      node.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await page.waitForTimeout(50);
  }

  await expect
    .poll(async () => {
      const samples = await samplePolicy();
      return samples.length > 0 && samples.every(
        (sample) => sample.loading === 'lazy' && sample.fetchPriority === 'low',
      );
    })
    .toBe(true);

  await page.locator(CARD).first().scrollIntoViewIfNeeded();
  await expect
    .poll(() => page.locator(CARD).locator('img').evaluateAll((images) =>
      images.map((img) => ({
        complete: (img as HTMLImageElement).complete,
        decoded: (img as HTMLImageElement).naturalWidth > 0,
        naturalWidth: (img as HTMLImageElement).naturalWidth,
        src: (img as HTMLImageElement).src,
        currentSrc: (img as HTMLImageElement).currentSrc,
      })),
    ))
    .toEqual(expect.arrayContaining([
      expect.objectContaining({ complete: true, decoded: true }),
    ]));
  await page.screenshot({ path: screenshotPath, fullPage: false });
  expect(runtimeErrors).toEqual([]);
};

test.describe('Travels list — infinite scroll', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('keeps eager/high on the initial row only and demotes remounts after scrolling', async ({ page }, testInfo) => {
    await verifyCatalogMediaLoadingPolicy(page, testInfo.outputPath('search-loading-desktop.png'));
  });

  test.describe('mobile web', () => {
    test.use({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent: devices['Pixel 7'].userAgent,
    });

    test('uses the same catalog media loading policy', async ({ page }, testInfo) => {
      await verifyCatalogMediaLoadingPolicy(page, testInfo.outputPath('search-loading-mobile.png'));
    });
  });

  test('requests and renders the next page when the list reaches its end', async ({ page }) => {
    await preacceptCookies(page);

    const firstPage = [1, 2, 3, 4].map(createTravel);
    const secondPage = [5].map(createTravel);
    const requestedPages: number[] = [];

    const fulfillList = async (route: import('@playwright/test').Route) => {
      const url = new URL(route.request().url());
      const isListEndpoint =
        url.pathname.endsWith('/api/travels/') || url.pathname === '/travels/';
      if (!isListEndpoint || route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }

      const pageNumber = Number(url.searchParams.get('page') ?? '1');
      requestedPages.push(pageNumber);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: pageNumber === 1 ? firstPage : pageNumber === 2 ? secondPage : [],
          total: firstPage.length + secondPage.length,
        }),
      });
    };

    await page.route('**/api/travels/**', fulfillList);
    await page.route('**/travels/**', fulfillList);

    await gotoWithRetry(page, getTravelsListPath());

    const cards = page.locator(CARD);
    await expect(cards).toHaveCount(firstPage.length, { timeout: 30_000 });
    expect(requestedPages).toContain(1);

    const scroll = page.locator(tid('right-column-scrollview')).first();
    await expect(scroll).toBeVisible();
    await scroll.evaluate((node: HTMLElement) => {
      node.scrollTop = node.scrollHeight;
      node.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    await expect
      .poll(() => requestedPages.filter((pageNumber) => pageNumber === 2).length, {
        timeout: 15_000,
      })
      .toBe(1);

    await expect(page.getByText('E2E paginated travel 5', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });
});
