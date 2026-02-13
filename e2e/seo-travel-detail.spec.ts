import { test, expect } from '@playwright/test';

/**
 * E2E SEO regression tests for travel detail pages.
 *
 * Validates that the **rendered HTML** (after React hydration) contains all
 * required SEO meta tags. Expo static export injects SEO tags via React Helmet
 * at runtime, so we must check the DOM after JS execution — this is also what
 * modern search-engine crawlers (Googlebot) see.
 *
 * @smoke
 */

/** Helper: navigate, wait for React Helmet to inject SEO tags, return full HTML. */
async function getRenderedHtml(page: import('@playwright/test').Page, path: string): Promise<string> {
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  // Wait for React Helmet to inject data-rh meta tags (up to 15s).
  await page.waitForFunction(
    () => {
      const title = document.querySelector('title');
      return title && title.textContent && title.textContent.length > 0 && title.textContent !== 'MeTravel';
    },
    { timeout: 15_000 },
  ).catch(() => {
    // Fallback: if title never changes from generic, continue — test assertions will catch it.
  });
  // Small extra buffer for remaining meta tags to settle.
  await page.waitForTimeout(500);
  return page.content();
}

test.describe('SEO: travel detail page meta tags', () => {
  const TRAVEL_SLUG = 'albaniya-vler-gorod-dvuh-morey';
  const TRAVEL_PATH = `/travels/${TRAVEL_SLUG}`;

  let html: string;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    html = await getRenderedHtml(page, TRAVEL_PATH);
    await ctx.close();
  });

  // --- Title ---
  test('has a page-specific <title> (not generic MeTravel)', () => {
    const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
    expect(match).toBeTruthy();
    const title = match![1];
    expect(title.length).toBeGreaterThan(0);
    expect(title).not.toBe('MeTravel');
    expect(title).toContain('MeTravel');
  });

  // --- Meta description ---
  test('has a non-empty meta description', () => {
    const match = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i);
    expect(match).toBeTruthy();
    expect(match![1].length).toBeGreaterThan(10);
  });

  // --- Canonical ---
  test('has a canonical link with correct path', () => {
    const match = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i);
    expect(match).toBeTruthy();
    expect(match![1]).toContain(`/travels/${TRAVEL_SLUG}`);
  });

  test('has exactly 1 canonical link', () => {
    const count = (html.match(/<link[^>]*rel="canonical"/gi) || []).length;
    expect(count).toBe(1);
  });

  // --- Open Graph ---
  test('has og:type', () => {
    expect(html).toMatch(/<meta[^>]*property="og:type"[^>]*content="article"/i);
  });

  test('has og:title', () => {
    const match = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i);
    expect(match).toBeTruthy();
    expect(match![1].length).toBeGreaterThan(0);
    expect(match![1]).not.toBe('MeTravel');
  });

  test('has og:description', () => {
    const match = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/i);
    expect(match).toBeTruthy();
    expect(match![1].length).toBeGreaterThan(10);
  });

  test('has og:url with correct path', () => {
    const match = html.match(/<meta[^>]*property="og:url"[^>]*content="([^"]*)"/i);
    expect(match).toBeTruthy();
    expect(match![1]).toContain(`/travels/${TRAVEL_SLUG}`);
  });

  test('has og:image (not empty)', () => {
    const match = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i);
    expect(match).toBeTruthy();
    expect(match![1].length).toBeGreaterThan(0);
  });

  test('og:image is not a 200px thumbnail', () => {
    const match = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i);
    if (match) {
      expect(match[1]).not.toContain('thumb_200');
    }
  });

  test('has og:site_name', () => {
    expect(html).toMatch(/<meta[^>]*property="og:site_name"[^>]*content="MeTravel"/i);
  });

  // --- Twitter ---
  test('has twitter:card as summary_large_image', () => {
    expect(html).toMatch(/<meta[^>]*name="twitter:card"[^>]*content="summary_large_image"/i);
  });

  test('has twitter:title', () => {
    const match = html.match(/<meta[^>]*name="twitter:title"[^>]*content="([^"]*)"/i);
    expect(match).toBeTruthy();
    expect(match![1].length).toBeGreaterThan(0);
  });

  test('has twitter:description', () => {
    const match = html.match(/<meta[^>]*name="twitter:description"[^>]*content="([^"]*)"/i);
    expect(match).toBeTruthy();
    expect(match![1].length).toBeGreaterThan(10);
  });

  test('has twitter:image', () => {
    const match = html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]*)"/i);
    expect(match).toBeTruthy();
    expect(match![1].length).toBeGreaterThan(0);
  });

  // --- No duplicates ---
  test('no duplicate og:title tags', () => {
    const count = (html.match(/<meta[^>]*property="og:title"/gi) || []).length;
    expect(count).toBe(1);
  });

  test('no duplicate og:description tags', () => {
    const count = (html.match(/<meta[^>]*property="og:description"/gi) || []).length;
    expect(count).toBe(1);
  });

  test('no duplicate og:image tags', () => {
    const count = (html.match(/<meta[^>]*property="og:image"/gi) || []).length;
    expect(count).toBe(1);
  });

  // --- lang attribute ---
  test('html has lang="ru"', () => {
    expect(html).toMatch(/<html[^>]*lang="ru"/i);
  });

  // --- No robots restriction (travel pages should be indexable) ---
  test('no robots noindex on travel pages', () => {
    const match = html.match(/<meta[^>]*name="robots"[^>]*content="([^"]*)"/i);
    if (match) {
      expect(match[1]).not.toContain('noindex');
    }
  });
});

test.describe('SEO: static pages meta tags', () => {
  const PAGES = [
    { path: '/', titleContains: 'Metravel', ogType: 'website' },
    { path: '/search', titleContains: 'Поиск', ogType: 'website' },
    { path: '/map', titleContains: 'Карта', ogType: 'website' },
    { path: '/about', titleContains: 'MeTravel', ogType: 'website' },
  ];

  for (const pg of PAGES) {
    test(`${pg.path} has all required SEO tags`, async ({ page }) => {
      const html = await getRenderedHtml(page, pg.path);

      // Title
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      expect(titleMatch).toBeTruthy();
      expect(titleMatch![1]).toContain(pg.titleContains);

      // Canonical
      expect(html).toMatch(/<link[^>]*rel="canonical"/i);

      // OG tags
      expect(html).toMatch(/<meta[^>]*property="og:title"[^>]*content="[^"]+"/i);
      expect(html).toMatch(/<meta[^>]*property="og:description"[^>]*content="[^"]+"/i);
      expect(html).toMatch(/<meta[^>]*property="og:url"[^>]*content="[^"]+"/i);
      expect(html).toMatch(/<meta[^>]*property="og:image"[^>]*content="[^"]+"/i);
      expect(html).toMatch(new RegExp(`property="og:type"[^>]*content="${pg.ogType}"`, 'i'));

      // Twitter tags
      expect(html).toMatch(/<meta[^>]*name="twitter:card"[^>]*content="summary_large_image"/i);
      expect(html).toMatch(/<meta[^>]*name="twitter:title"[^>]*content="[^"]+"/i);
      expect(html).toMatch(/<meta[^>]*name="twitter:description"[^>]*content="[^"]+"/i);
    });
  }
});

test.describe('SEO: noindex pages', () => {
  const NOINDEX_PAGES = ['/login', '/registration', '/favorites'];

  for (const path of NOINDEX_PAGES) {
    test(`${path} has robots noindex`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      // Wait for React Helmet to inject robots meta tag.
      await page.waitForFunction(
        () => {
          const meta = document.querySelector('meta[name="robots"]');
          return meta && (meta.getAttribute('content') || '').includes('noindex');
        },
        { timeout: 15_000 },
      );
      const html = await page.content();
      expect(html).toMatch(/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/i);
    });
  }
});
