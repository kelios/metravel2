/**
 * Tests for P3.5 SSG Skeleton Shells.
 */
const {
  buildSkeletonCSS,
  buildHomeSkeletonHtml,
  buildSearchSkeletonHtml,
  buildMapSkeletonHtml,
  buildTravelSkeletonHtml,
  injectSkeletonShell,
  buildRemovalScript,
  sanitizeArticleBodyHtml,
  COLORS,
} = require('../../scripts/ssg-skeletons');
const {
  MAP_WEB_MOBILE_BREAKPOINT_PX,
  WEB_MOBILE_FOOTER_RESERVE_HEIGHT,
  WEB_HEADER_RESERVED_HEIGHT,
} = require('../../screens/tabs/map.styles');
const { buildCriticalCSS } = require('../../utils/criticalCSSBuilder');

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
      // Шелл обязан зарезервировать место под каждую обёртку раскладки, иначе до
      // гидрации группа схлопывается и статью дёргает. `img-grid-mixed` (лоскут из
      // трёх) не содержит токена `img-grid`, поэтому её перечисляем отдельно.
      for (const wrapper of ['img-row-2', 'img-grid', 'img-jrow', 'img-grid-mixed']) {
        expect(css).toContain(`.ssg-travel-article .${wrapper}>p`);
        expect(css).toContain(`.ssg-travel-article .${wrapper} img`);
      }
      expect(css).toContain('aspect-ratio:16/9');
      expect(css).toContain('width:100%;height:100%;max-width:none');
      expect(css).toContain('.ssg-travel-article p>img:only-child{width:100%;aspect-ratio:16/9');
    });
  });

  // #1206. Критический CSS (`utils/criticalCSSBuilder.ts`) содержит безусловное
  // `img[data-lcp]{aspect-ratio:16/9;min-height:…}` — оно резервирует место под
  // React-hero. Но `data-lcp` висит и на hero-картинке SSG-шелла, а селектор
  // `img[data-lcp]` (0,1,1) специфичнее одиночного класса (0,1,0). Пока шелл
  // полагался на `.ssg-travel-hero-img{height:100%}`, побеждал критический CSS:
  // фото рисовалось 412×240 в боксе 412×461 (43 226 px² — меньше заголовка
  // 51 888 px²), не попадало в LCP-кандидаты и получало полный размер только на
  // handoff. LCP травела равнялся времени гидрации: 7 820 мс вместо 1 908 мс.
  describe('travel hero geometry vs critical CSS (#1206)', () => {
    const heroImgRule = () => {
      const css = buildSkeletonCSS();
      const match = css.match(/\.ssg-travel-hero img\.ssg-travel-hero-img\{([^}]*)\}/);
      expect(match).not.toBeNull();
      return (match as RegExpMatchArray)[1];
    };

    it('critical CSS still sizes img[data-lcp] unconditionally (hazard is real)', () => {
      const critical = buildCriticalCSS();
      const unscoped = critical
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^img\[data-lcp\]\{/.test(line));

      expect(unscoped.length).toBeGreaterThan(0);
      expect(unscoped.join(' ')).toMatch(/aspect-ratio/);
    });

    it('shell hero image wins over img[data-lcp] by specificity', () => {
      const css = buildSkeletonCSS();
      // `.ssg-travel-hero img.ssg-travel-hero-img` = (0,2,1) > `img[data-lcp]` = (0,1,1).
      expect(css).toContain('.ssg-travel-hero img.ssg-travel-hero-img{');
      // Слабая форма (0,1,0) проигрывает критическому CSS — вернуть её нельзя.
      expect(css).not.toMatch(/(?:^|[\n,}])\s*\.ssg-travel-hero-img\{/);
    });

    it('shell hero image fills the hero box and neutralizes inherited sizing', () => {
      const rule = heroImgRule();
      // Абсолютный бокс по вставкам: высота определена, поэтому `aspect-ratio`
      // и `min-height` из критического CSS не могут её переопределить.
      expect(rule).toContain('position:absolute');
      expect(rule).toContain('inset:0');
      expect(rule).toContain('width:100%');
      expect(rule).toContain('height:100%');
      expect(rule).toContain('aspect-ratio:auto');
      expect(rule).toContain('min-height:0');
      expect(rule).toContain('max-height:none');
      // Кадр целиком, как в React-hero.
      expect(rule).toContain('object-fit:contain');
    });

    it('picture is a sized box so the image has a definite containing block', () => {
      const css = buildSkeletonCSS();
      // Критический CSS делает `picture` `display:block;height:auto` — бокс
      // неопределённой высоты, в котором процентная высота не разрешается.
      const match = css.match(/\.ssg-travel-hero picture\{([^}]*)\}/);
      expect(match).not.toBeNull();
      const rule = (match as RegExpMatchArray)[1];
      expect(rule).toContain('position:absolute');
      expect(rule).toContain('inset:0');
      expect(rule).toContain('height:100%');
    });

    it('keeps the scrim under the photo, as in the React hero', () => {
      const css = buildSkeletonCSS();
      // React-hero: `data-hero-backdrop-overlay` c zIndex 0 под картинкой —
      // тонируются только поля letterbox. При z-index:1 затемнение лежало
      // поверх кадра и фотография светлела на handoff.
      expect(css).toContain(
        '.ssg-travel-hero-bg{position:absolute;inset:0;background:rgba(7,12,19,0.24);pointer-events:none;z-index:0}',
      );
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

    /**
     * #1281: без hero-<img> в шелле LCP главной уезжал на гидрацию — текстовый
     * кандидат (21 918 px²) вдвое меньше фотографии React-hero (42 200 px²), и
     * Chrome переустанавливал метрику после handoff. Замер прода 2026-08-06:
     * LCP 9 469 мс, Render Delay 79 % при картинке, готовой к ~2 с.
     */
    describe('hero image (#1281)', () => {
      const HERO_HREF = '/assets/assets/images/cover_sorapiso.abc123.webp';

      it('renders the preloaded hero photo when href is known', () => {
        const html = buildHomeSkeletonHtml({ heroHref: HERO_HREF });
        expect(html).toContain('ssg-home-hero-img');
        expect(html).toContain(`src="${HERO_HREF}"`);
        expect(html).toContain('fetchpriority="high"');
      });

      it('keeps the photo inside the hero block, above the card grid', () => {
        const html = buildHomeSkeletonHtml({ heroHref: HERO_HREF });
        expect(html.indexOf('ssg-home-hero-img')).toBeGreaterThan(html.indexOf('ssg-hero-search'));
        expect(html.indexOf('ssg-home-hero-img')).toBeLessThan(html.indexOf('ssg-cards'));
      });

      it('escapes the href instead of interpolating it raw', () => {
        const html = buildHomeSkeletonHtml({ heroHref: '/a.webp" onerror="x' });
        expect(html).not.toContain('onerror="x"');
        expect(html).toContain('&quot;');
      });

      it('falls back to the text-only shell when the asset is missing', () => {
        const html = buildHomeSkeletonHtml();
        expect(html).not.toContain('ssg-home-hero');
        expect(html).toContain('ssg-hero-title');
      });

      /**
       * Инвариант из #1206: бокс шелла должен быть НЕ МЕНЬШЕ кадра React-hero,
       * иначе handoff создаёт новый, больший LCP-кандидат и метрика снова уезжает
       * на гидрацию. Слоты React-hero (замер 2026-08-06): 343×220 на 375 px,
       * 363×230 на 1280 px. Геометрия должна задаваться селектором специфичнее,
       * чем безусловное `img[data-lcp]` из критического CSS (0,1,1).
       */
      it('sizes the shell photo above the React hero slot and outranks img[data-lcp]', () => {
        const css = buildSkeletonCSS();
        expect(css).toContain('.ssg-home-hero{');
        expect(css).toContain('aspect-ratio:3/2');
        expect(css).toContain('.ssg-home-hero img.ssg-home-hero-img{');
        // Абсолютный бокс: aspect-ratio/min-height критического CSS не участвуют.
        expect(css).toMatch(/\.ssg-home-hero img\.ssg-home-hero-img\{[^}]*position:absolute/);
        expect(css).toMatch(/\.ssg-home-hero img\.ssg-home-hero-img\{[^}]*aspect-ratio:auto/);
        // Слабая форма (одиночный класс) проигрывает img[data-lcp] по специфичности.
        expect(css).not.toMatch(/(^|[\s,}])\.ssg-home-hero-img\{/);
      });
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

  describe('buildMapSkeletonHtml', () => {
    it('returns div with id ssg-skeleton', () => {
      const html = buildMapSkeletonHtml();
      expect(html).toContain('id="ssg-skeleton"');
    });

    it('keeps shared map shell geometry for desktop and mobile web', () => {
      const html = buildMapSkeletonHtml();
      expect(html).toContain('ssg-map-layout');
      expect(html).toContain('ssg-map-canvas');
      expect(html).toContain('ssg-map-sidebar-shell');
      expect(html).toContain('ssg-map-mobile-card');
      expect(html).toContain('Маршруты и достопримечательности Беларуси');
    });

    it('contains exactly one bounded tile slot mounted by the shared head bootstrap', () => {
      const html = buildMapSkeletonHtml();
      const tileTags = html.match(/<img[^>]*data-ssg-map-tile="true"[^>]*>/g) || [];

      expect(tileTags).toHaveLength(1);
      expect(tileTags[0]).toContain('width="256"');
      expect(tileTags[0]).toContain('height="256"');
      expect(tileTags[0]).toContain('alt=""');
      expect(tileTags[0]).toContain('aria-hidden="true"');
      expect(tileTags[0]).not.toMatch(/\ssrc=/);
      expect(html).toContain('window.__metravelMountMapShellTile');
      expect(html).toContain(
        'class="ssg-map-canvas" role="region" aria-label="Карта маршрутов и достопримечательностей Беларуси"',
      );

      const css = buildSkeletonCSS();
      expect(css).toContain('.ssg-map-canvas img.ssg-map-tile{position:absolute');
      expect(css).toContain('width:256px;height:256px');
      expect(css).toContain('max-width:none;max-height:none');
      expect(css).toContain(
        'transform:translate(var(--metravel-map-shell-tile-offset-x,-50%),var(--metravel-map-shell-tile-offset-y,-50%))',
      );
    });

    it('uses the measured map viewport contract instead of raw 100vh', () => {
      const css = buildSkeletonCSS();
      expect(css).toContain('var(--metravel-map-vh, 100svh)');
      expect(css).not.toContain('calc(100vh - 56px)');
    });

    it('matches runtime viewport reserves for mobile and desktop breakpoints', () => {
      const css = buildSkeletonCSS();
      expect(css).toContain(
        `.ssg-map-layout{display:flex;min-height:calc(var(--metravel-map-vh, 100svh) - ${WEB_MOBILE_FOOTER_RESERVE_HEIGHT}px)`,
      );
      expect(css).toContain(
        `.ssg-map-canvas{position:relative;flex:1;min-height:calc(var(--metravel-map-vh, 100svh) - ${WEB_MOBILE_FOOTER_RESERVE_HEIGHT}px)`,
      );
      expect(css).toContain(
        `@media(min-width:${MAP_WEB_MOBILE_BREAKPOINT_PX}px){.ssg-map-layout,.ssg-map-canvas{min-height:calc(var(--metravel-map-vh, 100svh) - ${WEB_HEADER_RESERVED_HEIGHT}px)}`,
      );
      expect(css).toContain(
        '.ssg-map-canvas{flex:0 0 calc(100% - 340px);min-width:0}.ssg-map-sidebar-shell{display:flex',
      );
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

    it('injects skeleton for /map', () => {
      const result = injectSkeletonShell(baseHtml, '/map');
      expect(result).toContain('id="ssg-skeleton"');
      expect(result).toContain('ssg-map-layout');
      expect(result).toContain('ssg-map-mobile-card');
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

    const setupMapDom = ({ rootHtml = '<div>shell</div>' } = {}) => {
      document.head.innerHTML = '<style id="ssg-skeleton-css"></style>';
      document.body.innerHTML =
        '<div id="ssg-skeleton"><div class="ssg-map-layout"><div class="ssg-map-canvas"></div></div></div>' +
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

    // #1207: наложение SSG-текста на интерфейс — это и есть кадры плавного
    // угасания шелла. Пока идёт fade, обе картинки видны одновременно; на
    // мобильном фаза растягивается (замер прода: 384 мс при CPU throttle 6×).
    // Поэтому шелл обязан исчезать в том же тике, без ожидания анимации.
    it('removes the skeleton in the same tick — no translucent fade frames', () => {
      setupDom({ travel: false });
      runScript();

      document.documentElement.classList.add('app-hydrated');
      jest.advanceTimersByTime(200); // тик интервала проверки

      expect(skeleton()).toBeNull();
      expect(document.getElementById('ssg-skeleton-css')).toBeNull();
    });

    it('does not rely on a CSS transition to hide the shell', () => {
      const css = buildSkeletonCSS();
      expect(css).not.toMatch(/#ssg-skeleton\{[^}]*transition/);
      // Класс остаётся страховкой на случай, если узел не удалился.
      expect(css).toContain('#ssg-skeleton.ssg-hiding{opacity:0;visibility:hidden;pointer-events:none}');
    });

    it('keeps SSG CSS while the painted hero node is adopted by React', () => {
      setupDom();
      runScript();

      const root = document.getElementById('root') as HTMLElement;
      const hero = document.querySelector('.ssg-travel-hero') as HTMLElement;
      hero.setAttribute('data-ssg-travel-hero-adopted', 'true');
      root.appendChild(hero);
      root.setAttribute('data-travel-details-ready', 'true');

      jest.advanceTimersByTime(500);

      expect(skeleton()).toBeNull();
      expect(root.contains(hero)).toBe(true);
      expect(document.getElementById('ssg-skeleton-css')).not.toBeNull();
    });

    it('keeps map skeleton while only the generic app-hydrated class is present', () => {
      setupMapDom();
      runScript();

      document.documentElement.classList.add('app-hydrated');
      jest.advanceTimersByTime(1000);

      expect(skeleton()).not.toBeNull();
      expect(document.getElementById('ssg-skeleton-css')).not.toBeNull();
    });

    it('removes map skeleton when the map route marks its first visible screen ready', () => {
      setupMapDom();
      runScript();

      document.documentElement.classList.add('app-hydrated');
      const root = document.getElementById('root') as HTMLElement;
      root.setAttribute('data-map-route-ready', 'true');
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
