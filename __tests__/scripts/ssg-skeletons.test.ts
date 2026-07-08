/**
 * Tests for P3.5 SSG Skeleton Shells.
 */
const {
  buildSkeletonCSS,
  buildHomeSkeletonHtml,
  buildSearchSkeletonHtml,
  buildTravelSkeletonHtml,
  injectSkeletonShell,
  buildRemovalScript,
  sanitizeArticleBodyHtml,
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

    it('reserves geometry for travel article images before hydration', () => {
      const css = buildSkeletonCSS();
      expect(css).toContain('.ssg-travel-article .img-row-2>p');
      expect(css).toContain('aspect-ratio:16/9');
      expect(css).toContain('.ssg-travel-article .img-row-2 img,.ssg-travel-article .img-grid img{width:100%;height:100%;max-width:none');
      expect(css).toContain('.ssg-travel-article p>img:only-child{width:100%;aspect-ratio:16/9');
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

  describe('buildRemovalScript behavior (white-screen regression)', () => {
    const scriptSource = buildRemovalScript()
      .replace(/^<script>/, '')
      .replace(/<\/script>$/, '');

    const runScript = () => new Function(scriptSource)();

    const setupDom = ({ travel = true, rootHtml = '<div>shell</div>' } = {}) => {
      document.head.innerHTML = '<style id="ssg-skeleton-css"></style>';
      document.body.innerHTML =
        `<div id="ssg-skeleton">${travel ? '<div class="ssg-travel-hero"></div>' : ''}` +
        `<div class="ssg-travel-article">Текст статьи, видимый до гидратации.</div></div>` +
        `<div id="root">${rootHtml}</div>`;
    };

    const skeleton = () => document.getElementById('ssg-skeleton');

    beforeEach(() => {
      jest.useFakeTimers();
      document.documentElement.classList.remove('app-hydrated');
    });

    afterEach(() => {
      jest.useRealTimers();
      document.head.innerHTML = '';
      document.body.innerHTML = '';
    });

    it('does NOT remove the skeleton at 20s when React never mounted (static shell in #root)', () => {
      setupDom();
      runScript();
      jest.advanceTimersByTime(21000);
      jest.advanceTimersByTime(1000);
      expect(skeleton()).not.toBeNull();
    });

    it('keeps travel skeleton before 20s even when app-hydrated fires early (LCP guard)', () => {
      setupDom();
      runScript();
      document.documentElement.classList.add('app-hydrated');
      jest.advanceTimersByTime(10000);
      expect(skeleton()).not.toBeNull();
    });

    it('removes the travel skeleton when the React first screen is ready', () => {
      setupDom();
      runScript();
      document.getElementById('root')?.setAttribute('data-travel-details-ready', 'true');
      jest.advanceTimersByTime(500);
      expect(skeleton()).toBeNull();
      expect(document.getElementById('ssg-skeleton-css')).toBeNull();
    });

    it('removes travel skeleton after 20s once app-hydrated is set', () => {
      setupDom();
      runScript();
      jest.advanceTimersByTime(21000);
      expect(skeleton()).not.toBeNull();
      document.documentElement.classList.add('app-hydrated');
      jest.advanceTimersByTime(500); // interval tick + 300ms hide animation
      expect(skeleton()).toBeNull();
      expect(document.getElementById('ssg-skeleton-css')).toBeNull();
    });

    it('removes travel skeleton after 20s once React rendered its hero img[data-lcp]', () => {
      setupDom();
      runScript();
      jest.advanceTimersByTime(21000);
      const root = document.getElementById('root') as HTMLElement;
      root.innerHTML = '<img data-lcp src="/hero.jpg">';
      jest.advanceTimersByTime(500);
      expect(skeleton()).toBeNull();
    });

    it('45s deep fallback removes skeleton when #root accumulated real text without signals', () => {
      setupDom();
      runScript();
      jest.advanceTimersByTime(21000);
      const root = document.getElementById('root') as HTMLElement;
      root.innerHTML = `<div>${'Реальный контент страницы. '.repeat(20)}</div>`;
      jest.advanceTimersByTime(24000);
      jest.advanceTimersByTime(500);
      expect(skeleton()).toBeNull();
    });

    it('45s deep fallback keeps skeleton over a dead static shell', () => {
      setupDom({ rootHtml: '<div>Озеро Глубокое. Короткий статический шелл.</div>' });
      runScript();
      jest.advanceTimersByTime(46000);
      jest.advanceTimersByTime(1000);
      expect(skeleton()).not.toBeNull();
    });
  });

  describe('sanitizeArticleBodyHtml (FE-IDX-1)', () => {
    it('returns empty string for empty/missing input', () => {
      expect(sanitizeArticleBodyHtml('')).toBe('');
      expect(sanitizeArticleBodyHtml(null)).toBe('');
      expect(sanitizeArticleBodyHtml(undefined)).toBe('');
    });

    it('keeps semantic text tags (p, h2, ul, li)', () => {
      const out = sanitizeArticleBodyHtml('<p>Текст</p><h2>Раздел</h2><ul><li>Пункт</li></ul>');
      expect(out).toContain('<p>Текст</p>');
      expect(out).toContain('<h2>Раздел</h2>');
      expect(out).toContain('<li>Пункт</li>');
    });

    it('strips script, style, iframe and img entirely', () => {
      const out = sanitizeArticleBodyHtml(
        '<p>ok</p><script>alert(1)</script><style>x{}</style><iframe src="//e"></iframe><img src=x onerror=alert(1)>'
      );
      expect(out).toBe('<p>ok</p>');
      expect(out).not.toMatch(/script|style|iframe|img/i);
    });

    it('removes on*-event handlers and javascript: hrefs', () => {
      const out = sanitizeArticleBodyHtml('<a href="javascript:alert(1)" onclick="evil()">x</a>');
      expect(out).not.toMatch(/javascript:/i);
      expect(out).not.toMatch(/onclick/i);
      expect(out).toBe('<a>x</a>');
    });

    it('marks external links nofollow but keeps internal links followable', () => {
      const out = sanitizeArticleBodyHtml(
        '<a href="https://evil.com">e</a><a href="/travels/foo">i</a>'
      );
      expect(out).toContain('<a href="https://evil.com" rel="nofollow noopener">e</a>');
      expect(out).toContain('<a href="/travels/foo">i</a>');
    });

    it('strips attributes from non-anchor tags', () => {
      const out = sanitizeArticleBodyHtml('<p class="x" style="color:red">t</p>');
      expect(out).toBe('<p>t</p>');
    });

    it('clamps long content at a block boundary without cutting a tag', () => {
      const long = '<p>' + 'a'.repeat(200) + '</p>';
      const many = long.repeat(100); // ~20k chars
      const out = sanitizeArticleBodyHtml(many, 1000);
      expect(out.length).toBeLessThanOrEqual(1000);
      expect(out.endsWith('</p>')).toBe(true);
    });
  });

  describe('buildTravelSkeletonHtml (FE-IDX-1)', () => {
    it('renders a visible title and article body when description is provided', () => {
      const html = buildTravelSkeletonHtml({
        name: 'Тестовый маршрут',
        descriptionHtml: '<p>Подробное описание маршрута.</p><h2>Как добраться</h2><p>На машине.</p>',
      });
      expect(html).toContain('<div class="ssg-travel-h1">Тестовый маршрут</div>');
      expect(html).toContain('<div class="ssg-travel-article">');
      expect(html).toContain('Подробное описание маршрута.');
      expect(html).toContain('<h2>Как добраться</h2>');
    });

    it('does NOT emit any <h1> in the skeleton (single-H1 invariant lives in #root)', () => {
      const html = buildTravelSkeletonHtml({
        name: 'Маршрут',
        descriptionHtml: '<p>текст</p><h2>раздел</h2><h1>лишний</h1>',
      });
      expect(html).not.toMatch(/<h1[\s>]/i);
    });

    it('falls back to placeholder bars when description is empty', () => {
      const html = buildTravelSkeletonHtml({ name: 'Без текста', descriptionHtml: '' });
      expect(html).toContain('ssg-travel-line');
      expect(html).not.toContain('ssg-travel-article');
    });

    it('escapes the name in the h1', () => {
      const html = buildTravelSkeletonHtml({ name: 'A <b> & "C"', descriptionHtml: '<p>x</p>' });
      expect(html).toContain('A &lt;b&gt; &amp; &quot;C&quot;');
    });

    it('renders a crawlable related-travels block when related is provided (FE-IDX-3)', () => {
      const html = buildTravelSkeletonHtml({
        name: 'Маршрут',
        descriptionHtml: '<p>x</p>',
        related: [
          { path: '/travels/a', name: 'Поездка A' },
          { path: '/travels/b', name: 'Поездка B' },
        ],
      });
      expect(html).toContain('ssg-travel-related');
      expect(html).toContain('Похожие путешествия');
      expect(html).toContain('<a href="/travels/a">Поездка A</a>');
      expect(html).toContain('<a href="/travels/b">Поездка B</a>');
    });

    it('omits the related block when related is empty', () => {
      const html = buildTravelSkeletonHtml({ name: 'Маршрут', descriptionHtml: '<p>x</p>', related: [] });
      expect(html).not.toContain('ssg-travel-related');
    });
  });
});
