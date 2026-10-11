import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

const article = '/travels/marshruty-vykhodnogo-dnia-iz-minska-13-poezdok';

for (const width of [1280, 2048, 390]) {
  test(`article672 keeps its inline photo with its own narrative at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await preacceptCookies(page);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(article, { waitUntil: 'domcontentloaded' });
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
