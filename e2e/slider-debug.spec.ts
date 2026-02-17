/**
 * Temporary debug spec — delete after investigation
 */
import { test } from './fixtures';
import { preacceptCookies, gotoWithRetry } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

test('debug autoplay state', async ({ page }) => {
  await preacceptCookies(page);
  await gotoWithRetry(page, getTravelsListPath());

  const cards = page.locator('[data-testid="travel-card-link"]');
  await cards.first().waitFor({ state: 'visible', timeout: 30_000 });

  // Find a multi-image travel
  for (let i = 0; i < 5; i++) {
    if (i > 0) {
      await gotoWithRetry(page, getTravelsListPath());
      await cards.first().waitFor({ state: 'visible', timeout: 30_000 });
    }
    await cards.nth(i).click();
    await page.waitForURL(url => url.pathname.startsWith('/travels/'), { timeout: 15_000 }).catch(() => null);
    const hasNext = await page.locator('[aria-label="Next slide"]').first().waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
    if (hasNext) break;
  }

  // Wait for slider to fully mount
  await page.waitForTimeout(1000);

  // Debug: check what attributes the scroll node has
  const attrDebug = await page.evaluate(() => {
    const scroll = document.querySelector('[data-testid="slider-scroll"]') as HTMLElement;
    if (!scroll) return { error: 'no scroll node' };
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(scroll.attributes)) {
      attrs[attr.name] = attr.value.slice(0, 40);
    }
    // Also check if querySelector with data-slider-instance works
    const byInstance = document.querySelector('[data-slider-instance]');
    const instanceVal = scroll.getAttribute('data-slider-instance') ?? '';
    // Try the exact querySelector that resolveNodes uses
    let exactQueryResult: string | null = null;
    try {
      const found = document.querySelector(`[data-testid="slider-scroll"][data-slider-instance="${instanceVal}"]`);
      exactQueryResult = found ? 'FOUND' : 'NOT FOUND';
    } catch (e) {
      exactQueryResult = `ERROR: ${e}`;
    }
    // Try CSS.escape
    let escapedQueryResult: string | null = null;
    try {
      const escaped = CSS.escape(instanceVal);
      const found2 = document.querySelector(`[data-testid="slider-scroll"][data-slider-instance="${escaped}"]`);
      escapedQueryResult = found2 ? 'FOUND' : 'NOT FOUND';
    } catch (e) {
      escapedQueryResult = `ERROR: ${e}`;
    }
    return { attrs, byInstanceFound: !!byInstance, instanceVal, exactQueryResult, escapedQueryResult };
  });
  console.log('ATTR DEBUG:', JSON.stringify(attrDebug, null, 2));

  // Debug: check state
  const debug = await page.evaluate(() => {
    const scroll = document.querySelector('[data-testid="slider-scroll"]') as HTMLElement;
    const wrapper = document.querySelector('[data-testid="slider-wrapper"]') as HTMLElement;
    if (!scroll || !wrapper) return { error: 'nodes missing' };

    const scrollRect = scroll.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();

    return {
      scrollWidth: scrollRect.width,
      wrapperWidth: wrapperRect.width,
      scrollLeft: scroll.scrollLeft,
      scrollScrollWidth: scroll.scrollWidth,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollStyle_overflowX: getComputedStyle(scroll).overflowX,
      scrollStyle_scrollSnapType: getComputedStyle(scroll).scrollSnapType,
    };
  });

  console.log('DEBUG initial state:', JSON.stringify(debug, null, 2));

  // Check what testids exist for images
  const imageTestids = await page.evaluate(() => {
    const allImgs = document.querySelectorAll('img');
    const testids: string[] = [];
    for (const img of allImgs) {
      const tid = img.getAttribute('data-testid') ?? img.getAttribute('testid') ?? img.getAttribute('testID') ?? '';
      if (tid) testids.push(tid);
    }
    // Also check parent elements
    const allWithTestid = document.querySelectorAll('[data-testid]');
    const allTestids: string[] = [];
    for (const el of allWithTestid) {
      const tid = el.getAttribute('data-testid') ?? '';
      if (tid.includes('slider')) allTestids.push(tid);
    }
    return { imgTestids: testids.slice(0, 10), sliderTestids: allTestids.slice(0, 20) };
  });
  console.log('IMAGE TESTIDS:', JSON.stringify(imageTestids, null, 2));

  const counterAfter = await page.evaluate(() => {
    const re = /^(\d+)\/(\d+)$/;
    const all = document.querySelectorAll('*');
    for (const el of all) {
      if (el.children.length > 0) continue;
      const t = (el.textContent || '').trim();
      const m = t.match(re);
      if (m) return { current: Number(m[1]), total: Number(m[2]) };
    }
    return null;
  });

  const scrollPosAfter = await page.evaluate(() => {
    const scroll = document.querySelector('[data-testid="slider-scroll"]') as HTMLElement;
    return scroll?.scrollLeft ?? -1;
  });

  console.log('Counter after 8s:', counterAfter);
  console.log('ScrollLeft after 8s:', scrollPosAfter);
});
