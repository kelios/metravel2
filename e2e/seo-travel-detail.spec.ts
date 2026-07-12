import { test, expect } from '@playwright/test';
import { preacceptCookies } from './helpers/navigation';

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

/** Helper: navigate, wait for React Helmet + DOM patches to inject SEO tags, return full HTML. */
async function getRenderedHtml(page: import('@playwright/test').Page, path: string): Promise<string> {
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  // Wait for title/meta mount after hydration (up to 20s).
  await page.waitForFunction(
    () => {
      const title = document.querySelector('title');
      return title && title.textContent && title.textContent.length > 0;
    },
    { timeout: 20_000 },
  ).catch(() => {
    // Fallback: if title never changes from generic, continue — test assertions will catch it.
  });
  // SEO meta tags are injected only after travel data loads, which can lag well
  // past the fixed buffer below on a slow run. og:description is patched
  // atomically with name="description"/twitter:description (useTravelDetailsHeadSync),
  // so waiting for it to be populated makes the capture deterministic instead of
  // racing a fixed timeout. Best-effort: pages without it just fall through.
  await page.waitForFunction(
    () => {
      const m = document.querySelector('meta[property="og:description"]');
      return !!m && (m.getAttribute('content') || '').length > 10;
    },
    { timeout: 25_000 },
  ).catch(() => {
    // Fallback: assertions catch a genuinely missing description.
  });
  // Settle remaining patches (og:title, twitter:image) applied in the same pass.
  await page.waitForTimeout(1000);
  return page.content();
}

function getTagAttribute(tag: string, attribute: string): string | null {
  const match = tag.match(new RegExp(`\\s${attribute}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match?.[2] ?? null;
}

function getMetaContent(html: string, attribute: 'name' | 'property', value: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const normalizedValue = value.toLowerCase();

  for (const tag of tags) {
    const attrValue = getTagAttribute(tag, attribute);
    if (attrValue?.toLowerCase() === normalizedValue) {
      return getTagAttribute(tag, 'content') ?? '';
    }
  }

  return null;
}

function countMetaTags(html: string, attribute: 'name' | 'property', value: string): number {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const normalizedValue = value.toLowerCase();

  return tags.filter((tag) => getTagAttribute(tag, attribute)?.toLowerCase() === normalizedValue).length;
}

test.describe('SEO: travel detail page meta tags', () => {
  const TRAVEL_SLUG = 'kostel-svyatogo-antoniya-paduanskogo';
  const TRAVEL_PATH = `/travels/${TRAVEL_SLUG}`;
  let html = '';

  test.beforeEach(async ({ page }) => {
    html = await getRenderedHtml(page, TRAVEL_PATH);
  });

  // --- Title ---
  test('has a non-empty <title> with brand', () => {
    const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
    expect(match).toBeTruthy();
    const title = match![1];
    expect(title.length).toBeGreaterThan(0);
    expect(title).toMatch(/metravel/i);
  });

  // --- Meta description ---
  test('has a non-empty meta description', () => {
    const content = getMetaContent(html, 'name', 'description');
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(10);
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
    expect(getMetaContent(html, 'property', 'og:type')).toBe('article');
  });

  test('has og:title', () => {
    const content = getMetaContent(html, 'property', 'og:title');
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(0);
  });

  test('has og:description', () => {
    const content = getMetaContent(html, 'property', 'og:description');
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(10);
  });

  test('has og:url with correct path', () => {
    const content = getMetaContent(html, 'property', 'og:url');
    expect(content).toBeTruthy();
    expect(content!).toContain(`/travels/${TRAVEL_SLUG}`);
  });

  test('has og:image (not empty)', () => {
    const content = getMetaContent(html, 'property', 'og:image');
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(0);
  });

  test('og:image is not a 200px thumbnail', () => {
    const content = getMetaContent(html, 'property', 'og:image');
    if (content) {
      expect(content).not.toContain('thumb_200');
    }
  });

  test('has og:site_name', () => {
    expect(getMetaContent(html, 'property', 'og:site_name')).toBe('MeTravel');
  });

  // --- Twitter ---
  test('has twitter:card as summary_large_image', () => {
    expect(getMetaContent(html, 'name', 'twitter:card')).toBe('summary_large_image');
  });

  test('has twitter:title', () => {
    const content = getMetaContent(html, 'name', 'twitter:title');
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(0);
  });

  test('has twitter:description', () => {
    const content = getMetaContent(html, 'name', 'twitter:description');
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(10);
  });

  test('has twitter:image', () => {
    const image = getMetaContent(html, 'name', 'twitter:image') || getMetaContent(html, 'property', 'og:image') || '';
    expect(image.length).toBeGreaterThan(0);
  });

  // --- No duplicates ---
  test('no duplicate og:title tags', () => {
    expect(countMetaTags(html, 'property', 'og:title')).toBe(1);
  });

  test('no duplicate og:description tags', () => {
    expect(countMetaTags(html, 'property', 'og:description')).toBe(1);
  });

  test('no duplicate og:image tags', async ({ page }) => {
    const count = await page.locator('meta[property="og:image"]').count();
    expect(count).toBe(1);
  });

  // --- lang attribute ---
  test('html has lang="ru"', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
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
      expect(getMetaContent(html, 'property', 'og:title')).toBeTruthy();
      expect(getMetaContent(html, 'property', 'og:description')).toBeTruthy();
      expect(getMetaContent(html, 'property', 'og:url')).toBeTruthy();
      expect(getMetaContent(html, 'property', 'og:image')).toBeTruthy();
      expect(getMetaContent(html, 'property', 'og:type')).toBe(pg.ogType);

      // Twitter tags
      expect(getMetaContent(html, 'name', 'twitter:card')).toBe('summary_large_image');
      expect(getMetaContent(html, 'name', 'twitter:title')).toBeTruthy();
      expect(getMetaContent(html, 'name', 'twitter:description')).toBeTruthy();
    });
  }
});

/**
 * Regression: [param].html fallback canonical bug.
 *
 * When a travel page has no pre-generated per-slug HTML file (e.g. published
 * after the last build), nginx falls back to `travels/[param].html`.
 * That template previously contained `<link rel="canonical" href="https://metravel.by/">`
 * (homepage URL), causing Google to treat every such travel page as a duplicate
 * of the homepage and refuse to index it.
 *
 * Fix: generate-seo-pages.js now strips the canonical from fallback templates.
 * The inline JS in +html.tsx sets the correct canonical from window.location.pathname.
 *
 * This test fetches the raw static HTML (JavaScript disabled) to verify that
 * the canonical in the initial HTML response is never the bare homepage URL.
 */
test.describe('SEO: travel page canonical is never the homepage (regression)', () => {
  const TRAVEL_SLUG = 'kostel-svyatogo-antoniya-paduanskogo';
  const TRAVEL_PATH = `/travels/${TRAVEL_SLUG}`;

  test('raw static HTML canonical is not the bare homepage URL @smoke', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(TRAVEL_PATH, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const html = await page.content();
    await ctx.close();

    const canonicalMatch = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i);
    if (canonicalMatch) {
      const href = canonicalMatch[1];
      // Must NOT be the bare homepage — that means [param].html fallback has wrong canonical
      expect(
        href,
        `Canonical is the homepage URL — [param].html fallback has wrong canonical: "${href}". ` +
        `This causes Google to treat travel pages as duplicates of the homepage.`
      ).not.toMatch(/^https?:\/\/metravel\.by\/?$/);
      // Must contain the travel slug
      expect(href).toContain(`/travels/${TRAVEL_SLUG}`);
    }
    // If no canonical tag at all in static HTML — that is acceptable (inline JS sets it)
  });

  test('raw static HTML has no duplicate canonical tags @smoke', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(TRAVEL_PATH, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const html = await page.content();
    await ctx.close();

    const count = (html.match(/<link[^>]*rel="canonical"/gi) || []).length;
    expect(count, `Found ${count} canonical tags in static HTML — expected 0 or 1`).toBeLessThanOrEqual(1);
  });

  test('after JS hydration canonical points to the travel slug (not homepage) @smoke', async ({ page }) => {
    const html = await getRenderedHtml(page, TRAVEL_PATH);

    const canonicalMatch = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i);
    expect(canonicalMatch, 'No canonical tag found after hydration').toBeTruthy();
    const href = canonicalMatch![1];

    expect(
      href,
      `Canonical after hydration is the homepage URL: "${href}"`
    ).not.toMatch(/^https?:\/\/metravel\.by\/?$/);
    expect(href).toContain(`/travels/${TRAVEL_SLUG}`);
  });
});

test.describe('SEO: noindex pages', () => {
  const NOINDEX_PAGES = ['/login', '/registration', '/favorites'];

  for (const path of NOINDEX_PAGES) {
    test(`${path} has robots noindex`, async ({ page }) => {
      await preacceptCookies(page);
      await page.addInitScript(() => {
        try {
          window.localStorage?.removeItem('secure_userToken');
          window.localStorage?.removeItem('userId');
          window.localStorage?.removeItem('userName');
          window.localStorage?.removeItem('isSuperuser');
        } catch {
          // ignore
        }
      });
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      // Wait for JS to execute (hydration + useEffect to inject robots meta).
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => null);
      // Wait for React Helmet / useEffect to inject robots meta tag.
      await page.waitForFunction(
        () => {
          const meta = document.querySelector('meta[name="robots"]');
          return meta && (meta.getAttribute('content') || '').includes('noindex');
        },
        { timeout: 30_000 },
      );
      const html = await page.content();
      expect(html).toMatch(/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/i);
    });
  }
});
