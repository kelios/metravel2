import { test, expect } from './fixtures';

test.describe('Article anchors (TOC -> section)', () => {
  test('clicking TOC anchor scrolls to the target element', async ({ page }) => {
    const id = 999997;
    const targetId = 'desc';

    let fulfilledOnce = false;
    const routeHandler = async (route: any, request: any) => {
      if (fulfilledOnce || request.method() !== 'GET') {
        await route.continue();
        return;
      }

      const url = request.url();
      let pathname = '';
      try {
        pathname = new URL(url).pathname;
      } catch {
        pathname = url;
      }

      // API is normalized as .../api/articles/{id}
      if (!pathname.endsWith(`/api/articles/${id}`) && !pathname.endsWith(`/articles/${id}`)) {
        await route.continue();
        return;
      }
      fulfilledOnce = true;

      const filler = Array.from({ length: 24 })
        .map((_, i) => `<p>Заполнитель ${i + 1}. Текст для прокрутки.</p>`)
        .join('');

      const description = `
        <p>Оглавление</p>
        <ol>
          <li><a href="#${targetId}">Описание</a></li>
        </ol>
        ${filler}
        <h2 id="${targetId}">Описание</h2>
        <p>Это целевой абзац для проверки якоря.</p>
      `;

      const mocked = {
        id,
        name: 'E2E Article Anchor Scroll',
        description,
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mocked),
      });
    };

    await page.route('**/api/articles/**', routeHandler);
    await page.route('**/articles/**', routeHandler);

    const articleResponsePromise = page
      .waitForResponse((resp) => {
        const url = resp.url();
        return (url.includes(`/api/articles/${id}`) || url.includes(`/articles/${id}`)) && resp.request().method() === 'GET';
      }, { timeout: 20_000 })
      .catch(() => null);

    await page.goto(`/article/${id}`, { waitUntil: 'domcontentloaded' });
    await articleResponsePromise;

    // Ensure page rendered
    await page.waitForSelector('text=E2E Article Anchor Scroll', { timeout: 20_000 });

    // Reset scroll
    await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement;
      if (el) el.scrollTop = 0;
    });

    const tocLink = page.locator(`a[href="#${targetId}"]`).first();
    await expect(tocLink).toBeVisible({ timeout: 15_000 });

    const scrollBefore = await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement;
      return Number(el?.scrollTop ?? 0);
    });

    await tocLink.click();
    await page.waitForTimeout(500);

    const scrollAfter = await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement;
      return Number(el?.scrollTop ?? 0);
    });

    expect(scrollAfter).toBeGreaterThan(scrollBefore + 50);

    const target = page.locator(`#${targetId}`).first();
    await expect(target).toBeVisible({ timeout: 10_000 });

    const box = await target.boundingBox();
    expect(box?.y ?? 9999).toBeLessThan(300);

    // Safety: ensure hash updated
    await expect(page).toHaveURL(new RegExp(`#${targetId}$`));
  });
});
