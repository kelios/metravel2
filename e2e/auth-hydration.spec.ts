import { devices, type Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { gotoWithRetry, mockUnavailableApi, preacceptCookies } from './helpers/navigation';

const HYDRATION_ERROR = /Minified React error #418\b|Hydration failed because the server rendered/i;
const DESKTOP_VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const PIXEL_7 = devices['Pixel 7'];
const MOBILE_DEVICE = {
  userAgent: PIXEL_7.userAgent,
  deviceScaleFactor: PIXEL_7.deviceScaleFactor,
  isMobile: PIXEL_7.isMobile,
  hasTouch: PIXEL_7.hasTouch,
  viewport: MOBILE_VIEWPORT,
};
const AUTH_ROUTES = ['/login', '/registration'] as const;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const FACEBOOK_LOGIN_ENABLED =
  String(process.env.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED || '').trim().toLowerCase() === 'true';
type BoundingBox = { x: number; y: number; width: number; height: number };

function collectHydrationErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    const message = String(error?.message ?? error);
    if (HYDRATION_ERROR.test(message)) errors.push(message);
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (HYDRATION_ERROR.test(text)) errors.push(text);
  });
  return errors;
}

async function nextPaint(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

async function waitForStableFonts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts?.ready;
  });
  await nextPaint(page);
}

function expectStableBox(
  before: BoundingBox,
  after: BoundingBox | null,
  label: string,
): void {
  expect(after, `${label} must remain rendered after interaction`).not.toBeNull();
  if (!after) return;

  expect(after.x, `${label} x`).toBeCloseTo(before.x, 1);
  expect(after.y, `${label} y`).toBeCloseTo(before.y, 1);
  expect(after.width, `${label} width`).toBeCloseTo(before.width, 1);
  expect(after.height, `${label} height`).toBeCloseTo(before.height, 1);
}

async function verifyAuthHydrationAtViewport(
  page: Page,
  viewport: { width: number; height: number },
  { resizePage = true }: { resizePage?: boolean } = {},
): Promise<void> {
  if (resizePage) await page.setViewportSize(viewport);

  await preacceptCookies(page);
  await mockUnavailableApi(page);
  const hydrationErrors = collectHydrationErrors(page);

  for (const route of AUTH_ROUTES) {
    hydrationErrors.length = 0;
    await gotoWithRetry(page, route);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });
    await waitForStableFonts(page);

    const googleButton = page.locator('[role="button"][aria-label*="Google"]').first();
    await expect(googleButton).toBeVisible();
    const googleBox = await googleButton.boundingBox();
    expect(googleBox, `${route} Google button box at ${viewport.width}px`).not.toBeNull();
    if (!googleBox) continue;
    expect(
      googleBox.height,
      `${route} Google button height at ${viewport.width}px`,
    ).toBeGreaterThanOrEqual(44);
    expect(
      googleBox.width,
      `${route} Google button width at ${viewport.width}px`,
    ).toBeLessThanOrEqual(viewport.width);

    const facebookButton = page.getByTestId('facebook-sign-in-button');
    let facebookBox: Awaited<ReturnType<typeof facebookButton.boundingBox>> = null;
    if (FACEBOOK_LOGIN_ENABLED) {
      await expect(facebookButton).toBeVisible();
      facebookBox = await facebookButton.boundingBox();
      expect(facebookBox, `${route} Facebook button box at ${viewport.width}px`).not.toBeNull();
      expect(
        facebookBox?.height,
        `${route} Facebook button height at ${viewport.width}px`,
      ).toBeGreaterThanOrEqual(48);
      expect(
        facebookBox?.width,
        `${route} Facebook button width at ${viewport.width}px`,
      ).toBeLessThanOrEqual(viewport.width);
    } else {
      await expect(facebookButton).toHaveCount(0);
    }

    const hostname = new URL(page.url()).hostname;
    if (LOOPBACK_HOSTS.has(hostname)) {
      await expect(googleButton).toContainText(/localhost/i);
    } else {
      await expect(googleButton).not.toContainText(/localhost/i);
    }

    await page.locator('input').first().focus();
    await nextPaint(page);
    const viewportLabel = `${route} at ${viewport.width}px`;
    expectStableBox(googleBox, await googleButton.boundingBox(), `${viewportLabel} Google button`);
    if (FACEBOOK_LOGIN_ENABLED && facebookBox) {
      expectStableBox(
        facebookBox,
        await facebookButton.boundingBox(),
        `${viewportLabel} Facebook button`,
      );
    }
    expect(
      hydrationErrors,
      `${route} hydration errors at ${viewport.width}px after first interaction`,
    ).toEqual([]);
  }
}

test.describe('auth SSR hydration', () => {
  for (const viewport of DESKTOP_VIEWPORTS) {
    test(`keeps desktop social auth stable at ${viewport.width}px`, async ({ page }) => {
      await verifyAuthHydrationAtViewport(page, viewport);
    });
  }

  test.describe('mobile web', () => {
    test.use(MOBILE_DEVICE);

    test('keeps social auth stable before and after the first interaction', async ({ page }) => {
      await verifyAuthHydrationAtViewport(page, MOBILE_VIEWPORT, { resizePage: false });
    });
  });
});
