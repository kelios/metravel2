import { test, expect } from './fixtures';
import { getTravelsListPath } from './helpers/routes';
import { hideRecommendationsBanner, seedNecessaryConsent } from './helpers/storage';

const tid = (id: string) => `[data-testid="${id}"], [testID="${id}"]`;

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
];

async function preacceptCookiesAndStabilize(page: any) {
  await page.addInitScript(seedNecessaryConsent);
  // Reduce perf noise in audits: recommendations can be heavy and not critical for base layout.
  await page.addInitScript(hideRecommendationsBanner);
}

async function waitForAppShell(page: any) {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('body')).toBeVisible();
}

async function scrollDownToTriggerDeferredSections(page: any) {
  // Travel details uses deferred/progressive rendering; scroll to ensure below-the-fold
  // sections mount (Share/CTA/etc).
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(250);
  await page.mouse.wheel(0, 1600);
  await page.waitForTimeout(250);
}

async function assertNoHorizontalScroll(page: any) {
  const res = await page.evaluate(() => {
    const docEl = document.documentElement;
    const body = document.body;
    const docScrollWidth = docEl?.scrollWidth ?? 0;
    const docClientWidth = docEl?.clientWidth ?? 0;
    const bodyScrollWidth = body?.scrollWidth ?? 0;
    const bodyClientWidth = body?.clientWidth ?? 0;

    return {
      docScrollWidth,
      docClientWidth,
      bodyScrollWidth,
      bodyClientWidth,
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

async function installClsAfterRenderMeter(page: any) {
  await page.addInitScript(() => {
    (window as any).__e2eClsAudit = {
      phase: 'total',
      clsAfterRender: 0,
      finalized: false,
    };

    try {
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          const s = (window as any).__e2eClsAudit;
          if (!s || s.finalized) return;
          if (!entry || entry.hadRecentInput || typeof entry.value !== 'number') continue;
          if (s.phase === 'afterRender') s.clsAfterRender += entry.value;
        }
      });
      obs.observe({ type: 'layout-shift', buffered: true } as any);
    } catch {
      // ignore
    }
  });
}

async function startClsAfterRenderPhase(page: any) {
  await page.evaluate(() => {
    const s = (window as any).__e2eClsAudit;
    if (!s) return;
    s.phase = 'afterRender';
    s.clsAfterRender = 0;
  });
}

async function finalizeClsAfterRender(page: any): Promise<number> {
  return page.evaluate(() => {
    const s = (window as any).__e2eClsAudit;
    if (!s) return 0;
    s.finalized = true;
    return typeof s.clsAfterRender === 'number' ? s.clsAfterRender : 0;
  });
}

test.describe('Render audit: main and travel details (responsive + perf)', () => {
  for (const vp of VIEWPORTS) {
    test(`main page renders key blocks (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await preacceptCookiesAndStabilize(page);
      await installClsAfterRenderMeter(page);

      await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
      await waitForAppShell(page);

      // Core header/search is expected
      const search = page.getByRole('textbox', { name: /Поиск путешествий/i });
      await expect(search).toBeVisible({ timeout: 30_000 });

      // Either list skeleton, list content, or empty state should render.
      const cards = page.locator('[data-testid="travel-card-link"], [testID="travel-card-link"]');
      const cardSkeleton = page.locator('[data-testid="travel-card-skeleton"], [testID="travel-card-skeleton"]');
      const listSkeleton = page.locator('[data-testid="list-travel-skeleton"], [testID="list-travel-skeleton"]');
      const emptyState = page.locator('text=Пока нет путешествий');
      const foundCountText = page.locator('text=Найдено:');

      await expect
        .poll(
          async () => {
            if ((await cards.count()) > 0) return 'cards';
            if ((await cardSkeleton.count()) > 0) return 'card-skeleton';
            if ((await listSkeleton.count()) > 0) return 'list-skeleton';
            // Text nodes can be inside scroll containers; treat presence as success even if not strictly "visible".
            if ((await emptyState.count()) > 0) return 'empty';
            if ((await foundCountText.count()) > 0) return 'found-count';

            const hasBodyText = await page
              .evaluate(() => {
                try {
                  const text = document?.body?.innerText || '';
                  return (
                    text.includes('Пока нет путешествий') ||
                    text.includes('Найдено:') ||
                    text.includes('Путешествия появятся здесь')
                  );
                } catch {
                  return false;
                }
              })
              .catch(() => false);
            if (hasBodyText) return 'body-text';
            return null;
          },
          {
            timeout: 30_000,
            message: 'main list should render cards, skeleton, or empty state',
          }
        )
        .not.toBeNull();

      await assertNoHorizontalScroll(page);

      // CLS after initial render
      await page.waitForTimeout(1000);
      await startClsAfterRenderPhase(page);
      await page.waitForTimeout(1000);
      const cls = await finalizeClsAfterRender(page);
      expect(cls, `CLS after render too high on main (${vp.name})`).toBeLessThanOrEqual(0.05);

      // Basic interaction: type and clear search.
      await search.fill('тест');
      await page.waitForTimeout(350);
      const clear = page.getByLabel('Очистить поиск');
      if (await clear.isVisible().catch(() => false)) {
        await clear.click({ force: true });
        if ((await search.inputValue().catch(() => '')) !== '') {
          await search.fill('');
        }
        await expect(search).toHaveValue('');
      }
    });

    test(`travel details renders key blocks (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await preacceptCookiesAndStabilize(page);
      await installClsAfterRenderMeter(page);

      // Go to list, open first card if available.
      await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
      await waitForAppShell(page);

      const cards = page.locator('[data-testid="travel-card-link"]');
      const count = await cards.count();
      if (count === 0) {
        test.info().annotations.push({
          type: 'note',
          description: 'No travel cards available in this environment',
        });
        return;
      }

      await expect(cards.first()).toBeVisible({ timeout: 30_000 });
      await cards.first().click();
      await page.waitForURL((url) => url.pathname.startsWith('/travels/'), { timeout: 45_000 });

      // Either error state or the page shell must render.
      await Promise.race([
        page.waitForSelector(tid('travel-details-page'), { timeout: 45_000 }),
        page.waitForSelector('text=Не удалось загрузить путешествие', { timeout: 45_000 }),
      ]);

      // If error state, stop here (still validates render).
      if (await page.locator('text=Не удалось загрузить путешествие').isVisible().catch(() => false)) {
        await assertNoHorizontalScroll(page);
        return;
      }

      // Must-have blocks (successful render)
      await expect(page.locator(tid('travel-details-page'))).toBeVisible();
      await expect(page.locator(tid('travel-details-scroll'))).toBeVisible();
      await expect(page.locator(tid('travel-details-section-gallery'))).toHaveCount(1);
      await expect(page.locator(tid('travel-details-hero'))).toHaveCount(1);
      await expect(page.locator(tid('travel-details-quick-facts'))).toHaveCount(1);
      await expect(page.locator(tid('travel-details-author'))).toHaveCount(1);

      // At least one content marker should exist.
      // data-section-key is best-effort on web (setAttribute via refs) and can be flaky during hydration.
      // Therefore accept either section-key anchors OR stable testIDs.
      const contentMarkers = page.locator(
        '[data-section-key="description"], [data-section-key="video"], [data-section-key="map"], [data-section-key="points"], ' +
          `${tid('travel-details-map')}, ${tid('travel-details-points')}`
      );
      await expect(contentMarkers.first()).toBeVisible({ timeout: 45_000 });
      const markerCount = await contentMarkers.count();
      expect(markerCount).toBeGreaterThanOrEqual(1);

      // Ensure the page is scrollable and stable.
      await assertNoHorizontalScroll(page);

      // Trigger deferred sections and assert engagement blocks render.
      await scrollDownToTriggerDeferredSections(page);
      await Promise.race([
        page.waitForSelector(tid('travel-details-share'), { timeout: 8_000 }),
        page.waitForSelector(tid('travel-details-cta'), { timeout: 8_000 }),
      ]);

      // Share/CTA blocks should be present on successful page.
      // Telegram block can be environment-dependent (widget availability), so do not hard-fail on it.
      await expect(page.locator(tid('travel-details-share'))).toHaveCount(1);
      await expect(page.locator(tid('travel-details-cta'))).toHaveCount(1);

      await page.waitForTimeout(1200);
      await startClsAfterRenderPhase(page);
      await page.waitForTimeout(1200);
      const cls = await finalizeClsAfterRender(page);
      expect(cls, `CLS after render too high on travel details (${vp.name})`).toBeLessThanOrEqual(0.05);

      // Performance smoke: first meaningful interaction should be possible.
      // There is a FAB on mobile labeled "Открыть меню разделов".
      const sectionMenuBtn = page.getByRole('button', { name: /Открыть меню разделов/i });
      if (vp.name !== 'desktop' && (await sectionMenuBtn.isVisible().catch(() => false))) {
        await sectionMenuBtn.click();
      }
    });
  }
});
