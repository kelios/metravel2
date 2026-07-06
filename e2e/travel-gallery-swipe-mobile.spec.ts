import { test, expect, devices, type Page, type CDPSession } from '@playwright/test';

import {
  FALLBACK_TRAVEL_SLUG,
  gotoWithRetry,
  mockFallbackTravelDetails,
  preacceptCookies,
  tid,
} from './helpers/navigation';

// Настоящие touch-события (CDP), а не mouse/click: свайп галереи на мобильном
// ломался ровно на touch-последовательности pointerup → lostpointercapture →
// touchend (implicit pointer capture), которую mouse-эмуляция не воспроизводит.
const iphone = devices['iPhone 13'];
test.use({
  viewport: iphone.viewport,
  userAgent: iphone.userAgent,
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: iphone.deviceScaleFactor,
});

async function touchSwipe(
  page: Page,
  cdp: CDPSession,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 12,
) {
  const dx = (to.x - from.x) / steps;
  const dy = (to.y - from.y) / steps;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: from.x, y: from.y, id: 1 }],
  });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x + dx * i, y: from.y + dy * i, id: 1 }],
    });
    await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.describe('Галерея на странице путешествия — мобильный touch @smoke', () => {
  test('свайп пальцем листает слайды, вертикальный жест скроллит страницу', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'CDP touch injection доступен только в chromium');

    await preacceptCookies(page);
    await mockFallbackTravelDetails(page);
    await gotoWithRetry(page, `/travels/${FALLBACK_TRAVEL_SLUG}`);

    const slider = page.locator(tid('slider-scroll')).first();
    await slider.waitFor({ state: 'visible', timeout: 60_000 });

    const counter = page.getByText('1/3', { exact: true }).first();
    await expect(counter).toBeVisible({ timeout: 30_000 });
    // Оверлей LCP-хиро снимается бэкстопом до 800мс; даём слушателям навеситься.
    await page.waitForTimeout(1200);

    const box = await slider.boundingBox();
    expect(box).toBeTruthy();
    const midY = box!.y + box!.height / 2;
    const cdp = await context.newCDPSession(page);

    // 1) Горизонтальный свайп влево → следующий слайд.
    await touchSwipe(page, cdp, { x: box!.x + box!.width - 30, y: midY }, { x: box!.x + 30, y: midY });
    await expect(page.getByText('2/3', { exact: true }).first()).toBeVisible({ timeout: 10_000 });

    // 2) Ещё один свайп влево → третий слайд (жест переживает серию, не залипает).
    await touchSwipe(page, cdp, { x: box!.x + box!.width - 30, y: midY }, { x: box!.x + 30, y: midY });
    await expect(page.getByText('3/3', { exact: true }).first()).toBeVisible({ timeout: 10_000 });

    // 3) Свайп вправо → назад на второй слайд.
    await touchSwipe(page, cdp, { x: box!.x + 30, y: midY }, { x: box!.x + box!.width - 30, y: midY });
    await expect(page.getByText('2/3', { exact: true }).first()).toBeVisible({ timeout: 10_000 });

    // 4) Вертикальный жест над слайдером не должен захватываться галереей —
    //    страница обязана проскроллиться (hero уезжает вверх).
    const heroTopBefore = (await slider.boundingBox())!.y;
    await touchSwipe(page, cdp, { x: box!.x + box!.width / 2, y: midY + 60 }, { x: box!.x + box!.width / 2, y: midY - 160 }, 10);
    await page.waitForTimeout(600);
    const heroTopAfter = (await slider.boundingBox())!.y;
    expect(heroTopAfter, 'вертикальный touch-жест над галереей должен скроллить страницу').toBeLessThan(heroTopBefore - 30);
  });
});
