import { test, expect } from '@playwright/test';

/**
 * E2E SEO regression tests for travel detail pages.
 *
 * Validates that the **raw HTML** (before JS execution) contains all required
 * SEO meta tags. This is what search-engine crawlers see.
 *
 * These tests run against the local E2E web server which serves the same
 * static HTML files that are deployed to production.
 *
 * @smoke
 */
test.describe('SEO: travel detail page meta tags', () => {
  const TRAVEL_SLUG = 'albaniya-vler-gorod-dvuh-morey';
  const TRAVEL_PATH = `/travels/${TRAVEL_SLUG}`;

  let rawHtml: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.get(TRAVEL_PATH);
    expect(res.status()).toBe(200);
    rawHtml = await res.text();
  });

  // --- Title ---
  test('has a page-specific <title> (not generic MeTravel)', () => {
    const match = rawHtml.match(/<title[^>]*>(.*?)<\/title>/i);
    expect(match).toBeTruthy();
    const title = match![1];
    expect(title.length).toBeGreaterThan(0);
    expect(title).not.toBe('MeTravel');
    expect(title).toContain('MeTravel');
  });

  // --- Meta description ---
  test('has a non-empty meta description', () => {
    const match = rawHtml.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i);
    expect(match).toBeTruthy();
    expect(match![1].length).toBeGreaterThan(10);
  });

  // --- Canonical ---
  test('has a canonical link with correct path', () => {
    const match = rawHtml.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i);
    expect(match).toBeTruthy();
    expect(match![1]).toContain(`/travels/${TRAVEL_SLUG}`);
  });

  test('has exactly 1 canonical link', () => {
    const count = (rawHtml.match(/<link[^>]*rel="canonical"/gi) || []).length;
    expect(count).toBe(1);
  });

  // --- Open Graph ---
  test('has og:type', () => {
    expect(rawHtml).toMatch(/<meta[^>]*property="og:type"[^>]*content="article"/i);
  });

  test('has og:title', () => {
    const match = rawHtml.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i);
    expect(match).toBeTruthy();
    expect(match![1].length).toBeGreaterThan(0);
    expect(match![1]).not.toBe('MeTravel');
  });

  test('has og:description', () => {
    const match = rawHtml.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/i);
    expect(match).toBeTruthy();
    expect(match![1].length).toBeGreaterThan(10);
  });

  test('has og:url with correct path', () => {
    const match = rawHtml.match(/<meta[^>]*property="og:url"[^>]*content="([^"]*)"/i);
    expect(match).toBeTruthy();
    expect(match![1]).toContain(`/travels/${TRAVEL_SLUG}`);
  });

  test('has og:image (not empty)', () => {
    const match = rawHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i);
    expect(match).toBeTruthy();
    expect(match![1].length).toBeGreaterThan(0);
  });

  test('og:image is not a 200px thumbnail', () => {
    const match = rawHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i);
    if (match) {
      expect(match[1]).not.toContain('thumb_200');
    }
  });

  test('has og:site_name', () => {
    expect(rawHtml).toMatch(/<meta[^>]*property="og:site_name"[^>]*content="MeTravel"/i);
  });

  // --- Twitter ---
  test('has twitter:card as summary_large_image', () => {
    expect(rawHtml).toMatch(/<meta[^>]*name="twitter:card"[^>]*content="summary_large_image"/i);
  });

  test('has twitter:title', () => {
    const match = rawHtml.match(/<meta[^>]*name="twitter:title"[^>]*content="([^"]*)"/i);
    expect(match).toBeTruthy();
    expect(match![1].length).toBeGreaterThan(0);
  });

  test('has twitter:description', () => {
    const match = rawHtml.match(/<meta[^>]*name="twitter:description"[^>]*content="([^"]*)"/i);
    expect(match).toBeTruthy();
    expect(match![1].length).toBeGreaterThan(10);
  });

  test('has twitter:image', () => {
    const match = rawHtml.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]*)"/i);
    expect(match).toBeTruthy();
    expect(match![1].length).toBeGreaterThan(0);
  });

  // --- No duplicates ---
  test('no duplicate og:title tags', () => {
    const count = (rawHtml.match(/<meta[^>]*property="og:title"/gi) || []).length;
    expect(count).toBe(1);
  });

  test('no duplicate og:description tags', () => {
    const count = (rawHtml.match(/<meta[^>]*property="og:description"/gi) || []).length;
    expect(count).toBe(1);
  });

  test('no duplicate og:image tags', () => {
    const count = (rawHtml.match(/<meta[^>]*property="og:image"/gi) || []).length;
    expect(count).toBe(1);
  });

  // --- lang attribute ---
  test('html has lang="ru"', () => {
    expect(rawHtml).toMatch(/<html[^>]*lang="ru"/i);
  });

  // --- No robots restriction (travel pages should be indexable) ---
  test('no robots noindex on travel pages', () => {
    const match = rawHtml.match(/<meta[^>]*name="robots"[^>]*content="([^"]*)"/i);
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

  for (const page of PAGES) {
    test(`${page.path} has all required SEO tags`, async ({ request }) => {
      const res = await request.get(page.path);
      expect(res.status()).toBe(200);
      const html = await res.text();

      // Title
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      expect(titleMatch).toBeTruthy();
      expect(titleMatch![1]).toContain(page.titleContains);

      // Canonical
      expect(html).toMatch(/<link[^>]*rel="canonical"/i);

      // OG tags
      expect(html).toMatch(/<meta[^>]*property="og:title"[^>]*content="[^"]+"/i);
      expect(html).toMatch(/<meta[^>]*property="og:description"[^>]*content="[^"]+"/i);
      expect(html).toMatch(/<meta[^>]*property="og:url"[^>]*content="[^"]+"/i);
      expect(html).toMatch(/<meta[^>]*property="og:image"[^>]*content="[^"]+"/i);
      expect(html).toMatch(new RegExp(`property="og:type"[^>]*content="${page.ogType}"`, 'i'));

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
    test(`${path} has robots noindex`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(html).toMatch(/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/i);
    });
  }
});
