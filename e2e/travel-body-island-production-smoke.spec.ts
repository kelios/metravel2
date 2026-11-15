import { test, expect } from '@playwright/test';
import { installReadOnlyTravelApi } from './helpers/readOnlyTravelApi';

const { fetchLiveSha } = require('../scripts/lib/live-build-source') as {
  fetchLiveSha(origin: string): { sha: string; reason?: string };
};

// A real SSR document is required: this companion is production-smoke only.
test.beforeAll(async ({ baseURL }) => {
  const expected = process.env.ARTICLE_BODY_EXPECTED_SOURCE_SHA;
  expect(expected, 'Pass the reviewed published source SHA').toMatch(/^[a-f0-9]{40}$/);
  if (!baseURL) throw new Error('SSR body acceptance requires an explicit baseURL');
  expect(fetchLiveSha(new URL(baseURL).origin).sha).toBe(expected);
});

// #3420: кадр тела статьи запрашивается один раз за всю жизнь страницы — и
// серверным островом, и полным рендером, который его подменяет. Прод 14.11.2026,
// статья 470: первый кадр приезжал трижды — остров адресовал его своим
// построителем (`…webp?w=800`), полный рендер манифестом (`…webp?pv=2&w=800`), и
// следом тот же файл качал `<link rel=prefetch>` с `Accept` документа.
// Нужна живая статья: адрес ступени задаёт манифест бэкенда, фикстура его не несёт.
test.describe('@perf Travel Details — article body images across the server island swap', () => {
  const ARTICLE = '/travels/tour-du-mont-blanc-vokrug-monblana-za-10-dney';
  const ARTICLE_ID = 470;

  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    test(`each body image file is requested once @ ${viewport.width}`, async ({ browser, baseURL }, testInfo) => {
      test.setTimeout(120_000);
      const context = await browser.newContext({ viewport, baseURL, storageState: { cookies: [], origins: [] } });
      try {
        const page = await context.newPage();
        const { unexpectedWrites } = await installReadOnlyTravelApi(context, { baseURL, travelId: ARTICLE_ID });
        await page.addInitScript(() => {
          localStorage.setItem('consent_v1', '1');
          // Статья с сотнями ресурсов: буфер по умолчанию (250) терял бы поздние записи.
          performance.setResourceTimingBufferSize(4000);
        });
        // Сетевые загрузки кадров тела по файлам; ответ из кэша (`transferSize: 0`) не загрузка.
        const readBodyImageFetches = () => page.evaluate(() => {
          const byFile: Record<string, { query: string; initiator: string; bytes: number }[]> = {};
          for (const entry of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) {
            if (!entry.name.includes('/travel-description-image/')) continue;
            const { pathname, search } = new URL(entry.name);
            (byFile[pathname] ??= []).push({ query: search, initiator: entry.initiatorType, bytes: entry.transferSize });
          }
          return byFile;
        });

        expect((await page.goto(ARTICLE, { waitUntil: 'load' }))?.ok()).toBe(true);
        const island = page.locator('[data-ssr-html-island="description"]');
        await expect(island, 'the article is served with the server island').toHaveCount(1);
        await expect.poll(async () => Object.keys(await readBodyImageFetches()).length, { message: 'the island loads its first frames' }).toBeGreaterThan(0);

        // Подводим первый кадр под верх экрана: прокрутка запускает подмену острова.
        await page.evaluate(() => {
          const owner = document.querySelector<HTMLElement>('[data-testid="travel-details-scroll"]')!;
          const first = document.querySelector('[data-ssr-html-island="description"] img')!;
          owner.scrollTop += first.getBoundingClientRect().top - 160;
        });
        await expect(island, 'the full render replaces the island').toHaveCount(0, { timeout: 60_000 });
        await expect(page.locator('[data-testid="travel-description"] img').first()).toBeVisible();
        // Простой после загрузки: сюда попадал отложенный на idle префетч.
        await page.waitForLoadState('networkidle').catch(() => null);
        await page.waitForFunction((since) => performance.now() - since >= 3000, await page.evaluate(() => performance.now()));

        const fetches = await readBodyImageFetches();
        await testInfo.attach('body-image-fetches', { body: JSON.stringify(fetches), contentType: 'application/json' });
        const repeated = Object.entries(fetches)
          .filter(([, entries]) => new Set(entries.map((entry) => entry.query)).size > 1 || entries.filter((entry) => entry.bytes > 0).length > 1)
          .map(([pathname, entries]) => ({ file: pathname.split('/').pop(), entries }));

        expect(Object.keys(fetches).length, 'body frames were requested').toBeGreaterThan(0);
        expect(repeated, `body image files downloaded more than once: ${JSON.stringify(repeated)}`).toEqual([]);
        expect(await page.locator('link[rel="prefetch"][as="image"]').count()).toBe(0);
        expect(unexpectedWrites).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
});

