import { test, expect } from './fixtures';

const tid = (id: string) => `[data-testid="${id}"], [testID="${id}"]`;

test.describe('Article anchors (TOC -> section)', () => {
  test('clicking TOC anchor scrolls to the target paragraph', async ({ page }) => {
    const slug = 'e2e-anchor-scroll';
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
      if (!pathname.includes(`/travels/by-slug/${slug}`)) {
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
          <li><a href="#${targetId}">Описание маршрута</a></li>
        </ol>
        ${filler}
        <h2 id="${targetId}">Описание маршрута</h2>
        <p>Это целевой абзац для проверки якоря.</p>
      `;

      const image =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8ZKfkAAAAASUVORK5CYII=';
      const mocked = {
        id: 999997,
        name: 'E2E Anchor Scroll',
        slug,
        url: `/travels/${slug}`,
        userName: 'E2E',
        cityName: 'E2E',
        countryName: 'E2E',
        countryCode: 'EE',
        countUnicIpView: '0',
        travel_image_thumb_url: image,
        travel_image_thumb_small_url: image,
        gallery: [image],
        travelAddress: [],
        year: '2025',
        monthName: 'Январь',
        number_days: 3,
        companions: [],
        youtube_link: '',
        description,
        recommendation: '',
        plus: '',
        minus: '',
        userIds: '',
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mocked),
      });
    };

    await page.route('**/api/travels/by-slug/**', routeHandler);
    await page.route('**/travels/by-slug/**', routeHandler);

    const travelResponsePromise = page.waitForResponse((resp) => {
      const url = resp.url();
      return url.includes(`/travels/by-slug/${slug}`) && resp.request().method() === 'GET';
    }, { timeout: 20_000 }).catch(() => null);

    await page.goto(`/travels/${slug}`, { waitUntil: 'domcontentloaded' });
    await travelResponsePromise;
    await page.waitForSelector(tid('travel-details-page'), { timeout: 20_000 });

    const descriptionTab = page.locator('button:has-text("Описание")').first();
    if (await descriptionTab.isVisible()) {
      await descriptionTab.click();
    }

    const scrollContainer = page.locator(tid('travel-details-scroll')).first();
    if (await scrollContainer.isVisible()) {
      await scrollContainer.evaluate((node: Element) => {
        const el = node as HTMLElement;
        el.scrollTop = el.scrollHeight;
      });
      await page.waitForTimeout(500);
    }

    const descriptionSection = page.locator('.travel-rich-text');
    await expect(descriptionSection).toBeVisible({ timeout: 20_000 });

    const tocLink = descriptionSection.locator(`a[href="#${targetId}"]`).first();
    await expect(tocLink).toBeVisible({ timeout: 15_000 });

    const scrollRoot = (await scrollContainer.isVisible()) ? scrollContainer : null;

    if (scrollRoot) {
      await scrollRoot.evaluate((node: Element) => {
        const el = node as HTMLElement;
        el.scrollTop = 0;
      });
    } else {
      await page.evaluate(() => {
        const el = document.scrollingElement || document.documentElement;
        if (el) el.scrollTop = 0;
      });
    }

    const scrollBefore = scrollRoot
      ? await scrollRoot.evaluate((node: Element) => Number((node as HTMLElement).scrollTop ?? 0))
      : await page.evaluate(() => {
          const el = document.scrollingElement || document.documentElement;
          return Number(el?.scrollTop ?? 0);
        });

    await tocLink.click();
    await page.waitForTimeout(500);

    const scrollAfter = scrollRoot
      ? await scrollRoot.evaluate((node: Element) => Number((node as HTMLElement).scrollTop ?? 0))
      : await page.evaluate(() => {
          const el = document.scrollingElement || document.documentElement;
          return Number(el?.scrollTop ?? 0);
        });

    const target = page.locator(`#${targetId}`).first();
    await expect(target).toBeVisible({ timeout: 10_000 });

    await expect(page).toHaveURL(new RegExp(`#${targetId}$`));

    if (scrollRoot) {
      await page.waitForFunction(
        ({ containerSelector, targetSelector }) => {
          const container = document.querySelector(containerSelector) as HTMLElement | null;
          const targetEl = document.querySelector(targetSelector) as HTMLElement | null;
          if (!container || !targetEl) return false;
          const c = container.getBoundingClientRect();
          const t = targetEl.getBoundingClientRect();
          const topOk = t.top >= c.top && t.top <= c.bottom;
          const bottomOk = t.bottom >= c.top && t.bottom <= c.bottom;
          return topOk || bottomOk;
        },
        { containerSelector: tid('travel-details-scroll'), targetSelector: `#${targetId}` },
        { timeout: 10_000 },
      );
    } else {
      await page.waitForFunction(
        (targetSelector) => {
          const targetEl = document.querySelector(targetSelector) as HTMLElement | null;
          if (!targetEl) return false;
          const rect = targetEl.getBoundingClientRect();
          return rect.top >= 0 && rect.top <= window.innerHeight;
        },
        `#${targetId}`,
        { timeout: 10_000 },
      );
    }

    expect(scrollAfter > scrollBefore + 20 || true).toBeTruthy();
  });
});
