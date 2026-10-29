import { test, expect } from './fixtures';
import { FALLBACK_TRAVEL_ID, FALLBACK_TRAVEL_SLUG, mockFallbackTravelDetails, preacceptCookies } from './helpers/navigation';

const article = `/travels/${FALLBACK_TRAVEL_SLUG}`;
const photoUrl = 'https://example.com/e2e/inline-river.svg';
const narrative = 'Река проходит вдоль старого парка, где можно гулять по тропинкам и любоваться долиной. '.repeat(12);
const description = `<h3>Река Ислочь</h3><p>${narrative}</p><p class="img-float-right"><img src="${photoUrl}" alt="Речная долина" /></p><h2>Следующая остановка</h2><p>Продолжаем маршрут после прогулки у реки.</p>`;

for (const width of [1280, 2048, 390]) {
  test(`article keeps its inline photo with its own narrative at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await preacceptCookies(page);
    // Layout must not depend on a live article edit or production media storage.
    await mockFallbackTravelDetails(page, { description });
    await page.route((url) => url.pathname === '/api/travels/' || url.pathname === '/travels/', (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ total: 1, data: [{
          id: FALLBACK_TRAVEL_ID, slug: FALLBACK_TRAVEL_SLUG, url: article,
          name: 'E2E stable travel details', countryName: 'Беларусь', cityName: 'Гомель',
          travel_image_thumb_url: photoUrl, travel_image_thumb_small_url: photoUrl,
          publish: true, moderation: true,
        }] }),
      });
    });
    await page.route(photoUrl, (route) => route.fulfill({
      status: 200, contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="480"><rect width="320" height="480" fill="#32876c"/></svg>',
    }));
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    // A fictional article has no matching static document. Enter its mocked
    // content through the real SPA card, after the catalog shell has hydrated,
    // so API-only fixture data cannot disagree with a server-rendered article.
    await page.goto('/search', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveClass(/app-hydrated/);
    const catalogCard = page.locator('a[data-testid="travel-card-link"]').first();
    await expect(catalogCard).toHaveAttribute('href', article);
    const documentStart = await page.evaluate(() => performance.timeOrigin);
    await catalogCard.click();
    await expect(page).toHaveURL((url) => url.pathname === article);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStart);
    const heading = page.locator('.travel-rich-text h3', { hasText: 'Река Ислочь' });
    await heading.scrollIntoViewIfNeeded();
    const group = heading.locator('xpath=following-sibling::*[1]');
    await expect(group).toHaveClass(/rich-inline-photo-flow/);
    const image = group.locator('img');
    await expect(image).toHaveCount(1);
    await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
    const geometry = await group.evaluate(node => {
      const image = node.querySelector('img')!;
      const photo = image.closest('.img-float-right, .img-float-left')!;
      const rect = node.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();
      const photoRect = photo.getBoundingClientRect();
      const lines: Array<{ left: number; right: number; top: number; bottom: number }> = [];
      for (const paragraph of node.querySelectorAll('p:not([class*="img-float"])')) {
        const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
        let text: Node | null;
        while ((text = walker.nextNode())) {
          const range = document.createRange();
          range.selectNodeContents(text);
          lines.push(...Array.from(range.getClientRects()).filter(line => line.width > 0).map(line => ({ left: line.left, right: line.right, top: line.top, bottom: line.bottom })));
        }
      }
      const next = node.nextElementSibling?.getBoundingClientRect();
      return {
        width: rect.width,
        photoWidth: photoRect.width,
        side: getComputedStyle(photo).float,
        beside: lines.filter(line => line.top < imageRect.bottom && line.bottom > imageRect.top && (line.right <= photoRect.left - 15 || line.left >= photoRect.right + 15)).length,
        nextTop: next?.top,
        bottom: rect.bottom,
        imageBottom: imageRect.bottom,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        images: node.querySelectorAll('img').length,
      };
    });
    expect(geometry.width).toBeLessThanOrEqual(721);
    expect(geometry.images).toBe(1);
    expect(geometry.overflow).toBe(false);
    expect(geometry.nextTop).toBeGreaterThanOrEqual(geometry.bottom - 1);
    expect(geometry.bottom).toBeGreaterThanOrEqual(geometry.imageBottom - 1);
    if (width > 768) {
      expect(geometry.side).toBe('right');
      expect(geometry.photoWidth).toBeLessThanOrEqual(geometry.width * 0.45 + 1);
      expect(geometry.beside).toBeGreaterThan(0);
    } else expect(geometry.side).toBe('none');
    expect(await page.locator('.travel-rich-text').first().textContent()).not.toContain('\uFFFD');
    await test.info().attach('article-flow-geometry', { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
    await page.screenshot({ path: test.info().outputPath(`article-${width}.png`) });
    expect(errors).toEqual([]);
  });
}
