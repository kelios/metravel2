/**
 * Tests for P3.5 SSG Skeleton Shells.
 */
const {
  buildSkeletonCSS,
  buildHomeSkeletonHtml,
  buildSearchSkeletonHtml,
  injectSkeletonShell,
  buildRemovalScript,
  COLORS,
} = require('../../scripts/ssg-skeletons');

describe('ssg-skeletons', () => {
  describe('buildSkeletonCSS', () => {
    it('returns a <style> tag with id ssg-skeleton-css', () => {
      const css = buildSkeletonCSS();
      expect(css).toContain('<style id="ssg-skeleton-css">');
      expect(css).toContain('</style>');
    });

    it('includes light theme colors', () => {
      const css = buildSkeletonCSS();
      expect(css).toContain(COLORS.light.surface);
      expect(css).toContain(COLORS.light.border);
    });

    it('includes dark theme overrides', () => {
      const css = buildSkeletonCSS();
      expect(css).toContain('data-theme="dark"');
      expect(css).toContain(COLORS.dark.surface);
    });

    it('includes shimmer animation', () => {
      const css = buildSkeletonCSS();
      expect(css).toContain('@keyframes ssg-shimmer');
      expect(css).toContain('ssg-pulse');
    });
  });

  describe('buildHomeSkeletonHtml', () => {
    it('returns div with id ssg-skeleton', () => {
      const html = buildHomeSkeletonHtml();
      expect(html).toContain('id="ssg-skeleton"');
    });

    it('includes header bar, hero section, and card grid', () => {
      const html = buildHomeSkeletonHtml();
      expect(html).toContain('ssg-bar');
      expect(html).toContain('ssg-hero');
      expect(html).toContain('ssg-cards');
      expect(html).toContain('ssg-card');
    });

    it('includes hero search bar', () => {
      const html = buildHomeSkeletonHtml();
      expect(html).toContain('ssg-hero-search');
    });

    it('includes auto-removal script', () => {
      const html = buildHomeSkeletonHtml();
      expect(html).toContain('<script>');
      expect(html).toContain('ssg-skeleton');
    });
  });

  describe('buildSearchSkeletonHtml', () => {
    it('returns div with id ssg-skeleton', () => {
      const html = buildSearchSkeletonHtml();
      expect(html).toContain('id="ssg-skeleton"');
    });

    it('includes sidebar for desktop', () => {
      const html = buildSearchSkeletonHtml();
      expect(html).toContain('ssg-sidebar');
    });

    it('includes search bar', () => {
      const html = buildSearchSkeletonHtml();
      expect(html).toContain('ssg-search-bar');
    });

    it('includes card grid', () => {
      const html = buildSearchSkeletonHtml();
      expect(html).toContain('ssg-cards');
    });
  });

  describe('injectSkeletonShell', () => {
    const baseHtml = `<!DOCTYPE html><html><head><title>Test</title></head><body><div id="root"></div></body></html>`;

    it('injects skeleton for / route', () => {
      const result = injectSkeletonShell(baseHtml, '/');
      expect(result).toContain('id="ssg-skeleton"');
      expect(result).toContain('id="ssg-skeleton-css"');
      expect(result).toContain('ssg-hero');
    });

    it('injects skeleton for /search route', () => {
      const result = injectSkeletonShell(baseHtml, '/search');
      expect(result).toContain('id="ssg-skeleton"');
      expect(result).toContain('ssg-sidebar');
      expect(result).toContain('ssg-search-bar');
    });

    it('does NOT inject skeleton for other routes', () => {
      const result = injectSkeletonShell(baseHtml, '/about');
      expect(result).not.toContain('id="ssg-skeleton"');
      expect(result).not.toContain('id="ssg-skeleton-css"');
      expect(result).toBe(baseHtml);
    });

    it('does NOT inject skeleton for /map', () => {
      const result = injectSkeletonShell(baseHtml, '/map');
      expect(result).toBe(baseHtml);
    });

    it('injects CSS into head', () => {
      const result = injectSkeletonShell(baseHtml, '/');
      const headEnd = result.indexOf('</head>');
      const cssPos = result.indexOf('id="ssg-skeleton-css"');
      expect(cssPos).toBeLessThan(headEnd);
    });

    it('injects skeleton HTML into body', () => {
      const result = injectSkeletonShell(baseHtml, '/');
      const bodyStart = result.indexOf('<body>');
      const skelPos = result.indexOf('id="ssg-skeleton"');
      expect(skelPos).toBeGreaterThan(bodyStart);
    });
  });

  describe('buildRemovalScript', () => {
    it('includes MutationObserver', () => {
      const script = buildRemovalScript();
      expect(script).toContain('MutationObserver');
    });

    it('includes timeout fallback', () => {
      const script = buildRemovalScript();
      expect(script).toContain('setTimeout');
    });

    it('removes ssg-skeleton and ssg-skeleton-css', () => {
      const script = buildRemovalScript();
      expect(script).toContain('ssg-skeleton');
      expect(script).toContain('ssg-skeleton-css');
    });
  });
});

