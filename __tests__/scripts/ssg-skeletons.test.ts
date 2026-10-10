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
  SSG_ARTICLE_BODY_MAX_CHARS,
  COLORS,
  HOME_COPY,
} = require('../../scripts/ssg-skeletons');
const {
  MAP_WEB_MOBILE_BREAKPOINT_PX,
  WEB_HEADER_RESERVED_HEIGHT,
} = require('../../screens/tabs/map.styles');
const { BOTTOM_DOCK_HEIGHT: WEB_MOBILE_FOOTER_RESERVE_HEIGHT } = require('../../components/layout/bottomDockModel');
const { buildCriticalCSS } = require('../../utils/criticalCSSBuilder');

describe('ssg-skeletons', () => {
  describe('actual SSG navigation before app JavaScript (#2216)', () => {
    const rootWithDock = '<div id="root"><div data-testid="web-mobile-dock-shell"><div data-testid="footer-dock-row"><a href="/more">Ещё</a></div></div></div>';
    const documentWithRoot = (root: string) => `<!DOCTYPE html><html><head></head><body>${root}</body></html>`;
    const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
    const emittedOpeningRule = () => {
      const style = document.createElement('style');
      style.textContent = buildSkeletonCSS().replace(/^<style[^>]*>|<\/style>$/g, '');
      document.head.appendChild(style);
      try {
        for (const candidate of Array.from(style.sheet!.cssRules)) {
          if (candidate.type !== CSSRule.MEDIA_RULE) continue;
          const media = candidate as CSSMediaRule;
          for (const rule of Array.from(media.cssRules)) {
            const selector = (rule as CSSStyleRule).selectorText;
            if (selector?.includes('body:has(#root') && selector.includes('#ssg-skeleton')) {
              return { media: media.media.mediaText, selector, bottom: (rule as CSSStyleRule).style.bottom };
            }
          }
        }
        throw new Error('Actual emitted SSG opening rule missing');
      } finally { style.remove(); }
    };

    it.each(['/', '/travels/actual-article'])('makes the existing single %s SSG header an ordinary accessible More destination', (route) => {
      const html = injectSkeletonShell(documentWithRoot(rootWithDock), route, { name: 'Путешествие', descriptionHtml: '<p>Текст</p>' });
      const dom = parse(html), shell = dom.getElementById('ssg-skeleton')!;
      const headers = shell.querySelectorAll('.ssg-bar');
      expect(headers).toHaveLength(1);
      const link = shell.querySelector('[data-testid="ssg-header-more-fallback"]')!;
      const { navigationGenerated1 } = require('../../i18n/locales/ru/generated/navigation_01');
      expect(link.tagName).toBe('A');
      expect(link.getAttribute('href')).toBe('/more');
      expect(link.getAttribute('aria-label')).toBe(navigationGenerated1['components.layout.CustomHeaderMobileAccountSection.otkryt_menyu_e43b6ae3']);
      expect(link.hasAttribute('aria-hidden')).toBe(false);
      expect(headers[0].contains(link)).toBe(true);
      expect(shell.querySelectorAll('[data-testid="ssg-header-more-fallback"]')).toHaveLength(1);
      expect(shell.querySelectorAll('[data-testid="footer-dock-row"]')).toHaveLength(0);
      expect(dom.querySelectorAll('#root [data-testid="footer-dock-row"]')).toHaveLength(1);
      expect(buildSkeletonCSS()).toContain('.ssg-header-more{display:none;align-items:center;justify-content:center;flex:0 0 44px;width:44px;height:44px');
      expect(buildSkeletonCSS()).toContain('.ssg-bar{width:100%;height:56px');
      expect(buildSkeletonCSS()).toContain('.ssg-home-bar{height:64px');
    });

    it('opens only Home/travel below1280 and only for a genuine dock inside root, preserving opaque LCP ownership', () => {
      const rule = emittedOpeningRule();
      const maximum = Number(rule.media.match(/^\(max-width:\s*([\d.]+)px\)$/)?.[1]);
      expect(Number.isFinite(maximum)).toBe(true);
      for (const width of [320, 390, 1279.98]) expect(width <= maximum).toBe(true);
      expect(1280 <= maximum).toBe(false);
      expect(rule.bottom).toBe('calc(56px + env(safe-area-inset-bottom,0px))');
      for (const route of ['/', '/travels/actual-article']) {
        const html = injectSkeletonShell(documentWithRoot(rootWithDock), route);
        expect(parse(html).querySelectorAll(rule.selector)).toHaveLength(1);
        const withoutDock = injectSkeletonShell(documentWithRoot('<div id="root"><div>Загрузка</div></div>'), route);
        expect(parse(withoutDock).querySelectorAll(rule.selector)).toHaveLength(0);
        const outsideRoot = injectSkeletonShell(documentWithRoot('<div id="root"></div><div data-testid="web-mobile-dock-shell"></div>'), route);
        expect(parse(outsideRoot).querySelectorAll(rule.selector)).toHaveLength(0);
      }
      for (const route of ['/search', '/map', '/about']) {
        expect(parse(injectSkeletonShell(documentWithRoot(rootWithDock), route)).querySelectorAll(rule.selector)).toHaveLength(0);
      }
      const css = buildSkeletonCSS();
      expect(css).toMatch(/#ssg-skeleton\{[^}]*position:fixed;inset:0;z-index:99999;overflow-x:hidden;overflow-y:auto;background:/);
      expect(buildRemovalScript()).toContain('data-first-screen-ready');
      expect(buildRemovalScript()).toContain('app-hydrated');
    });

    // #2359: the SSG hero and its React copy are one frame in one box (#1358),
    // so the LCP winner is decided by the clip of the scroller each one lives in.
    // A React clip taller than the SSG clip made the late React paint a larger
    // candidate (prod 412x823: 61560 vs 40660 px2) and moved LCP from ~2.2 s to ~6 s.
    it('keeps the SSG Home hero candidate at least as large as its React copy under the dock', () => {
      const fs = require('fs');
      const path = require('path');
      const { HOME_WEB_SCROLL_DOCK_CLIP, homeWebScrollEndPadding } = require('../../components/home/homeScrollDockClip');
      const { WEB_MOBILE_DOCK_RESERVE_CSS } = require('../../components/layout/webMobileDockLayout');
      const { HOME_HERO_MEDIA_SLOT_RATIO } = require('../../components/home/homeHeroShared');

      // Tiny px-only CSS evaluator: calc(), +/-, var(--mt-dock-h) and env(safe-area-inset-bottom).
      const dockVar = WEB_MOBILE_DOCK_RESERVE_CSS.match(/@media \(max-width:([\d.]+)px\)\{:root\{--mt-dock-h:([^}]+)\}/);
      expect(dockVar).not.toBeNull();
      const resolvePx = (expression: string, width: number, inset: number): number => {
        const source = expression
          .replace(/var\(--mt-dock-h,\s*0px\)/g, width <= Number(dockVar![1]) ? `(${dockVar![2]})` : '0px')
          .replace(/env\(safe-area-inset-bottom,\s*0px\)/g, `${inset}px`)
          .replace(/var\(--mt-consent-h,\s*0px\)/g, '0px')
          .replace(/calc/g, '')
          .replace(/max/g, 'M');
        const tokens = source.match(/M|[\d.]+px|[()+\-,]/g) ?? [];
        // Anything the evaluator does not understand fails here instead of being skipped.
        expect(tokens.join('')).toBe(source.replace(/\s/g, ''));
        let i = 0;
        const expr = (): number => {
          let value = term();
          while (tokens[i] === '+' || tokens[i] === '-') value = tokens[i++] === '+' ? value + term() : value - term();
          return value;
        };
        const term = (): number => {
          const token = tokens[i++];
          if (token === 'M') { i++; const a = expr(); i++; const b = expr(); i++; return Math.max(a, b); }
          if (token === '(') { const value = expr(); i++; return value; }
          return Number(token.replace('px', ''));
        };
        return expr();
      };

      const ssgRule = emittedOpeningRule();
      const ssgMax = Number(ssgRule.media.match(/^\(max-width:\s*([\d.]+)px\)$/)?.[1]);
      const ssgReserve = (width: number, inset: number) => (width <= ssgMax ? resolvePx(ssgRule.bottom, width, inset) : 0);
      const reactReserve = (width: number, inset: number) => resolvePx(HOME_WEB_SCROLL_DOCK_CLIP, width, inset);
      const visibleArea = (width: number, height: number, top: number, clipBottom: number) =>
        width * Math.max(0, Math.min(top + height, clipBottom) - Math.max(top, 0));

      for (const [width, viewport] of [[360, 740], [390, 844], [412, 823], [412, 915], [1280, 800]]) {
        const heroWidth = width < 1280 ? width - 32 : 365;
        const heroHeight = Math.round(heroWidth / HOME_HERO_MEDIA_SLOT_RATIO);
        for (const inset of [0, 34]) {
          expect(reactReserve(width, inset)).toBeGreaterThanOrEqual(ssgReserve(width, inset));
          for (let top = -heroHeight; top <= viewport; top += 1) {
            const ssg = visibleArea(heroWidth, heroHeight, top, viewport - ssgReserve(width, inset));
            const react = visibleArea(heroWidth, heroHeight, top, viewport - reactReserve(width, inset));
            if (react > ssg) throw new Error(`React hero copy outgrows SSG LCP at ${width}x${viewport}, inset ${inset}, top ${top}: ${react} > ${ssg}`);
          }
        }
      }
      // The prod failure geometry (412x823, hero top 660) stays pinned.
      expect(visibleArea(380, 253, 660, 823 - ssgReserve(412, 0))).toBe(40660);
      expect(visibleArea(380, 253, 660, 823 - reactReserve(412, 0))).toBe(40660);
      // Moving the scroller end up by the dock must not move the end of the page.
      for (const [width, minimum] of [[390, 96], [1000, 120], [1280, 120]]) {
        expect(resolvePx(homeWebScrollEndPadding(minimum), width, 0) + reactReserve(width, 0)).toBe(minimum + 8);
      }
      const homeSource = fs.readFileSync(path.join(__dirname, '../../components/home/Home.tsx'), 'utf8');
      expect(homeSource).toMatch(/const WEB_SCROLL_STYLE = IS_WEB[\s\S]*?marginBottom: HOME_WEB_SCROLL_DOCK_CLIP,[\s\S]*?: undefined/);
      expect(homeSource).toMatch(/style=\{\[styles\.container, WEB_SCROLL_STYLE\]\}/);
      expect(homeSource).toContain('web: homeWebScrollEndPadding(isMobile ? 96 : 120)');
    });

    // #2359 rework: equal areas are not enough when React copies paint under the
    // shell earlier or in the same frame (Lighthouse simulate observed trace: one
    // frame after hydration, React hero won). The shell alone paints the first
    // screen; only the #2216 root dock stays painted.
    it('keeps React under the Home shell unpainted except the root dock (#2359)', () => {
      const style = document.createElement('style');
      style.textContent = buildSkeletonCSS().replace(/^<style[^>]*>|<\/style>$/g, '');
      document.head.appendChild(style);
      const rules = Array.from(style.sheet!.cssRules) as CSSStyleRule[];
      style.remove();
      const hidden = rules.filter((rule) => rule.style?.visibility === 'hidden' && rule.selectorText?.includes('#root'));
      const shown = rules.filter((rule) => rule.style?.visibility === 'visible' && rule.selectorText?.includes('#root'));
      // Top-level rules: every width, and the gate leaves with #ssg-skeleton-css.
      expect(hidden).toHaveLength(1);
      expect(shown).toHaveLength(1);
      expect(shown[0].selectorText.startsWith(`${hidden[0].selectorText} `)).toBe(true);

      const home = parse(injectSkeletonShell(documentWithRoot(rootWithDock), '/'));
      expect(Array.from(home.querySelectorAll(hidden[0].selectorText))).toEqual([home.getElementById('root')]);
      expect(Array.from(home.querySelectorAll(shown[0].selectorText))).toEqual([
        home.querySelector('#root [data-testid="web-mobile-dock-shell"]'),
      ]);
      home.getElementById('ssg-skeleton')!.remove();
      expect(home.querySelectorAll(hidden[0].selectorText)).toHaveLength(0);
      // Travel adopts the SSG hero node into #root; search/map keep their own handoff.
      for (const route of ['/travels/actual-article', '/search', '/map']) {
        expect(parse(injectSkeletonShell(documentWithRoot(rootWithDock), route)).querySelectorAll(hidden[0].selectorText)).toHaveLength(0);
      }
    });

    // #2359 rework: prod 360x740 — the React subtitle (11 676 px2) replaced the SSG
    // one (11 340 px2) as LCP at hydration: letter-spacing .1px, the trailing space
    // that RN-web pre-wrap keeps in the text box and a 1px narrower column. At
    // 320x640 the small-phone container (8px) and 28/34 title gave 17 424 vs 15 246.
    it('mirrors the React hero text twins on phones: column, typography and RN-web text model', () => {
      const fs = require('fs');
      const { StyleSheet } = require('react-native');
      const { METRICS } = require('../../constants/layout');
      const { createHomeHeroStyles } = require('../../components/home/homeHeroStyles');
      const css = buildSkeletonCSS();
      const declarations = (block: string, selector: string): Record<string, string> => {
        const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const body = block.match(new RegExp(`(?:^|[}\\n])${escaped}\\{([^}]*)\\}`))?.[1];
        if (body == null) return {};
        return Object.fromEntries(body.split(';').filter(Boolean).map((part) => {
          const at = part.indexOf(':');
          return [part.slice(0, at), part.slice(at + 1)];
        }));
      };
      const smallPhoneMax = METRICS.breakpoints.phone - 0.02;
      const smallPhoneBlock = css.match(new RegExp(`@media\\(max-width:${smallPhoneMax}px\\)\\{(.*)\\}\\n`))?.[1];
      expect(smallPhoneBlock).toBeDefined();
      const ssg = (selector: string, smallPhone: boolean) => ({
        ...declarations(css, selector),
        ...(smallPhone ? declarations(smallPhoneBlock!, selector) : {}),
      });
      const px = (value: string) => Number(value.replace(/px$/, ''));
      const font = (decl: Record<string, string>) => {
        const [, weight, size, lineHeight] = decl.font.match(/^(\d+) (\d+)px\/(\d+)px /)!;
        return {
          fontWeight: weight,
          fontSize: decl['font-size'] ? px(decl['font-size']) : Number(size),
          lineHeight: decl['line-height'] ? px(decl['line-height']) : Number(lineHeight),
        };
      };
      // Right side of a 1-3 value padding shorthand (both sides are symmetric here).
      const sidePadding = (value: string) => {
        const parts = value.split(' ').map(px);
        return parts.length === 1 ? parts[0] : parts[1];
      };

      // The text model RN-web gives every <Text>: trailing spaces of wrapped lines stay in the box.
      const rnWebText = fs.readFileSync(require.resolve('react-native-web/dist/cjs/exports/Text/index.js'), 'utf8');
      const [, whiteSpace, wordWrap] = rnWebText.match(/var textStyle = \{[\s\S]*?whiteSpace: '([^']+)',\s*wordWrap: '([^']+)'/)!;
      // Phone/small-phone container padding of ResponsiveContainer around HomeHero.
      const container = fs.readFileSync(require.resolve('../../components/layout/ResponsiveContainer.tsx'), 'utf8');
      expect(container).toMatch(/if \(isSmallPhone\) \{\s*return \{\s*paddingHorizontal: horizontal \? METRICS\.spacing\.s/);
      expect(container).toMatch(/if \(isPhone \|\| isLargePhone\) \{\s*return \{\s*paddingHorizontal: horizontal \? METRICS\.spacing\.m/);

      const colors = new Proxy({}, { get: () => '#123456' });
      for (const smallPhone of [false, true]) {
        const react = createHomeHeroStyles({
          colors, isMobile: true, isSmallPhone: smallPhone, isNarrowLayout: true, isTablet: false, isDesktop: false,
          viewportWidth: smallPhone ? 320 : 390, showSideSlider: false, sliderHeight: 0,
        });
        const title = StyleSheet.flatten(react.title);
        const accent = StyleSheet.flatten(react.titleAccent);
        const subtitle = StyleSheet.flatten(react.subtitle);
        const section = StyleSheet.flatten(react.heroSection);

        const ssgTitle = ssg('.ssg-home-title', smallPhone);
        expect(font(ssgTitle)).toEqual({ fontWeight: title.fontWeight, fontSize: title.fontSize, lineHeight: title.lineHeight });
        expect(px(ssgTitle['letter-spacing'])).toBe(title.letterSpacing);
        // The accent line inherits the title metrics in the shell; React must keep them equal.
        expect([accent.fontSize, accent.lineHeight, accent.letterSpacing]).toEqual([title.fontSize, title.lineHeight, title.letterSpacing]);
        expect(ssg('.ssg-home-title .ssg-accent', smallPhone)['font-weight']).toBe(accent.fontWeight);

        const ssgSub = ssg('.ssg-home-sub', smallPhone);
        expect(font(ssgSub)).toEqual({ fontWeight: subtitle.fontWeight, fontSize: subtitle.fontSize, lineHeight: subtitle.lineHeight });
        expect(px(ssgSub['letter-spacing'])).toBe(subtitle.letterSpacing);
        expect(px(ssgSub['max-width'])).toBe(subtitle.maxWidth);

        for (const decl of [ssgTitle, ssgSub]) {
          expect(decl['white-space']).toBe(whiteSpace);
          expect(decl['overflow-wrap']).toBe(wordWrap);
        }

        // Same text column: shell padding + page border + page padding == container + heroSection padding.
        const page = ssg('.ssg-home-page', smallPhone);
        const pageBorder = px(page.border.split(' ')[0]);
        const ssgInset = sidePadding(ssg('.ssg-home-shell', smallPhone).padding) + pageBorder + sidePadding(page.padding);
        const reactInset = (smallPhone ? METRICS.spacing.s : METRICS.spacing.m) + section.paddingLeft;
        expect(section.paddingRight).toBe(section.paddingLeft);
        expect(ssgInset).toBe(reactInset);
      }
    });
  });

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
      expect(css).toContain(
        '@media(min-width:1280px){html[data-theme="dark"] .ssg-home-page{background-color:transparent}}',
      );
    });

    it('keeps below-fold raw content scrollable while the fixed shell is present', () => {
      const css = buildSkeletonCSS();
      const match = css.match(/#ssg-skeleton\{([^}]*)\}/);
      expect(match).not.toBeNull();
      const rule = (match as RegExpMatchArray)[1];
      expect(rule).toContain('overflow-x:hidden');
      expect(rule).toContain('overflow-y:auto');
      expect(rule).not.toContain('overflow:hidden');
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

    it('matches the measured 390x844 mobile first-screen slot (#1359)', () => {
      const css = buildSkeletonCSS();
      const outerWidth = 390 - 10 * 2;
      const outerHeight = Math.round(844 * 0.56);
      const imageArea = (outerWidth - 2) * (outerHeight - 2);

      expect(56 + 61).toBe(117);
      expect(outerWidth).toBe(370);
      expect(outerHeight).toBe(473);
      expect(imageArea).toBeGreaterThanOrEqual(152100);
      expect(css).toContain('.ssg-travel-spacer{height:61px}');
      expect(css).toContain('.ssg-travel-wrap{max-width:1200px;margin:0 auto;padding:0 10px}');
      expect(css).toContain('border:1px solid');
      expect(css).toContain('border-radius:8px');
      expect(css).toContain('.ssg-travel-first-screen{min-height:calc(100svh - 117px)}');
    });

    it('mirrors the desktop sidebar and content-column geometry (#1359)', () => {
      const css = buildSkeletonCSS();
      const html = buildTravelSkeletonHtml({ name: 'Маршрут', descriptionHtml: '<p>x</p>' });
      expect(css).toContain('grid-template-columns:307px minmax(0,1fr);gap:16px');
      expect(css).toContain('.ssg-travel-crawlable{width:calc(100% - 323px);margin-left:323px}');
      expect(html).toContain('ssg-travel-desktop-sidebar');
      expect(html.indexOf('ssg-travel-desktop-sidebar')).toBeLessThan(html.indexOf('ssg-travel-primary'));
    });
  });

  describe('buildHomeSkeletonHtml', () => {
    // #2170: шелл собирается на этапе билда и TS-константу импортировать не
    // может, поэтому адрес логотипа продублирован. Разойдись он с React-шапкой
    // и с preload в `app/+html.tsx` — браузер скачал бы логотип дважды.
    it('рисует логотип по тому же адресу, что React-шапка и preload', () => {
      const { HEADER_LOGO_WEB_SRC } = require('../../components/layout/headerLayoutContract');
      expect(buildHomeSkeletonHtml()).toContain(`<img class="ssg-home-bar-logo" src="${HEADER_LOGO_WEB_SRC}"`);
    });

    it('carries the site owner legal name for crawlers that skip JavaScript (#1999)', () => {
      // Meta Business Verification читает https://metravel.by/ без JS: React-футер в
      // статическом HTML главной отсутствует, имя владельца обязана нести оболочка.
      const legal = require('../../constants/legal.json');
      const html = buildHomeSkeletonHtml({});
      const footer = html.match(/<footer class="ssg-home-legal">([^<]*)<\/footer>/);
      expect(footer).not.toBeNull();
      expect(footer[1]).toBe(`© MeTravel 2020–${new Date().getFullYear()} · ${legal.siteOwnerLegalName}`);
      expect(html).not.toMatch(/<footer class="ssg-home-legal"[^>]*aria-hidden/);
      const css = buildSkeletonCSS();
      expect(css).toContain(`.ssg-home-legal{width:100%;max-width:1200px;margin:0 auto;padding:20px 16px 28px;text-align:center;font:400 12px/16px`);
      expect(css).toContain('@media(min-width:1280px){.ssg-home-legal{max-width:none;padding:8px 40px 0}}');
      expect(css).toContain(`html[data-theme="dark"] .ssg-home-legal{color:${COLORS.dark.textMuted}}`);
    });

    it('returns div with id ssg-skeleton', () => {
      const html = buildHomeSkeletonHtml();
      expect(html).toContain('id="ssg-skeleton"');
    });

    it('mirrors the hero composition instead of rendering six generic cards', () => {
      const html = buildHomeSkeletonHtml();
      expect(html).toContain('ssg-bar');
      expect(html).toContain('ssg-home-book');
      expect(html).toContain('ssg-home-page');
      expect(html).toContain('ssg-home-cta');
      expect(html).toContain('ssg-home-moods');
      expect(html.match(/class="ssg-home-mood"/g)).toHaveLength(5);
      expect(html.match(/class="ssg-home-note"/g)).toHaveLength(5);
      expect(html).toContain('ssg-home-week');
      expect(html.match(/class="ssg-home-popular-card"/g)).toHaveLength(2);
      expect(html.match(/class="ssg-home-popular-thumb ssg-pulse"/g)).toHaveLength(2);
      expect(html).not.toContain('ssg-cards');
      expect(html).not.toContain('class="ssg-card"');
    });

    // Чипы — вне белой карточки hero (как HomeHeroMoodRail после карточки),
    // page-notes — внутри левой страницы книги (desktop-tall ветка React).
    it('keeps mood chips outside the hero card and page notes inside it', () => {
      const html = buildHomeSkeletonHtml();
      const pageEnd = html.indexOf('</section>');
      expect(html.indexOf('ssg-home-notes')).toBeLessThan(pageEnd);
      expect(html.indexOf('ssg-home-moods')).toBeGreaterThan(pageEnd);
      expect(html.indexOf('ssg-home-moods')).toBeLessThan(html.indexOf('ssg-home-week'));
    });

    it('includes hero search bar with the round submit button', () => {
      const html = buildHomeSkeletonHtml();
      expect(html).toContain('ssg-home-search-row');
      expect(html).toContain('ssg-home-search');
      expect(html).toContain('ssg-home-search-btn');
    });

    // #1405: до гидрации первый экран обязан читаться как страница, а не как
    // скелетон. Подписи контролов дублируются из RU-ресурсов (fallback-локаль),
    // поэтому тест сверяет их с i18n, а не с самим собой.
    it('carries the real hero copy instead of blank grey blocks', () => {
      const html = buildHomeSkeletonHtml();
      const { homeGenerated1 } = require('../../i18n/locales/ru/generated/home_01');
      const { homeStaticResources } = require('../../i18n/locales/ru/static/home_static');

      const placeholder =
        homeGenerated1['components.home.HomeHeroSearchBar.kuda_hotite_poehat_gorod_ozero_zamok_5ca126e6'];
      const cta = homeGenerated1['components.home.HomeHeroBookLayout.smotret_marshruty_4a0b9a63'];
      // Бейдж карточки недели рендерит HomeHeroPopularSection — сверяем с ним.
      const weekKicker = homeGenerated1['components.home.HomeHeroPopularSection.marshrut_nedeli_b1be152b'];
      const moods = [
        homeStaticResources['components.home.homeHeroContent.u_vody_7c603574'],
        homeStaticResources['components.home.homeHeroContent.zamki_aec014c6'],
        homeStaticResources['components.home.homeHeroContent.ruiny_f6673a79'],
        homeStaticResources['components.home.homeHeroContent.hayking_3faa621d'],
        homeStaticResources['components.home.homeHeroContent.karta_do_60_km_23bb7996'],
      ];

      expect(html).toContain(`<span class="ssg-home-search-text">${placeholder}</span>`);
      expect(html).toContain(`</svg>${cta}</div>`);
      // Бейдж несёт тот же глиф map-pin, что реальный slideEyebrow.
      expect(html).toContain('class="ssg-home-week-ico"');
      expect(html).toContain(`</svg>${weekKicker}</div>`);
      moods.forEach((title) => {
        expect(html).toContain(`class="ssg-home-mood-ico"`);
        expect(html).toContain(`</svg>${title}</div>`);
      });
      // Иконка поиска — тот же Feather `search`, что в HomeHeroSearchBar.
      expect(html.match(/class="ssg-home-search-ico"/g)).toHaveLength(2);
      // Заголовок и подзаголовок шелла тоже обязаны совпадать с RU-каталогом.
      const title = homeGenerated1['components.home.HomeHeroBookLayout.kuda_poehat_07cb7b59'];
      const titleAccent = homeGenerated1['components.home.HomeHeroBookLayout.v_eti_vyhodnye_c69482dd'];
      const sub =
        homeGenerated1['components.home.HomeHero.realnye_marshruty_po_belarusi_i_evrope_s_fot_9e18c02e'];
      expect(html).toContain(`>${title} <span class="ssg-accent">${titleAccent}</span>`);
      // Подзаголовок в двух вариантах: у мобильной и книжной раскладки в
      // HomeHero.heroSubtitle разный текст.
      const subDesktop =
        homeGenerated1['components.home.HomeHero.realnye_marshruty_po_belarusi_i_evrope_ot_te_3f0b1078'];
      expect(html).toContain(`<p class="ssg-home-sub ssg-home-sub-mobile">${sub}</p>`);
      expect(html).toContain(`<p class="ssg-home-sub ssg-home-sub-desktop">${subDesktop}</p>`);
    });

    // Порядок и пара «иконка ↔ заголовок» тоже часть контракта: перестановка
    // MOOD_CARDS иначе разъехалась бы с шеллом молча — проверка вхождения
    // строк этого не ловит.
    it('mood chips match MOOD_CARDS one to one, in order and with the same icons', () => {
      const { MOOD_CARDS } = require('../../components/home/homeHeroContent');

      expect(HOME_COPY.moods).toEqual(
        MOOD_CARDS.map((card: { title: string; icon: string }) => ({
          title: card.title,
          icon: card.icon,
        })),
      );

      const html = buildHomeSkeletonHtml();
      const rendered = (html.match(/<div class="ssg-home-mood">[\s\S]*?<\/div>/g) || []).map((chunk: string) =>
        chunk.replace(/<svg[\s\S]*?<\/svg>/, '').replace(/<[^>]+>/g, ''),
      );
      expect(rendered).toEqual(MOOD_CARDS.map((card: { title: string }) => card.title));
    });

    // Подписи должны быть видимы: без flex/цвета текст лёг бы в угол плашки,
    // а пятый чип («Карта до 60 км») в React-ряду занимает всю ширину.
    it('lays out the shell copy like the React controls', () => {
      const css = buildSkeletonCSS();
      expect(css).toMatch(/\.ssg-home-cta\{[^}]*display:flex;align-items:center;justify-content:center/);
      // Текст на зелёном акценте тёмный (MODERN_MATTE_PALETTE.textOnPrimary),
      // белый на #7a9d8f дал бы ≈2:1 и разошёлся бы с React-кнопкой.
      expect(css).toMatch(new RegExp(`\\.ssg-home-cta\\{[^}]*color:${COLORS.light.textOnPrimary}`));
      expect(css).toMatch(new RegExp(`\\.ssg-home-search-btn\\{[^}]*color:${COLORS.light.textOnPrimary}`));
      expect(css).toMatch(
        new RegExp(`html\\[data-theme="dark"\\] \\.ssg-home-cta[^{]*\\{[^}]*color:${COLORS.dark.textOnPrimary}`),
      );
      expect(css).toMatch(/\.ssg-home-search\{[^}]*display:flex;align-items:center/);
      expect(css).toMatch(/\.ssg-home-search-text\{[^}]*text-overflow:ellipsis/);
      expect(css).toMatch(/\.ssg-home-mood\{[^}]*justify-content:center/);
      expect(css).toContain('.ssg-home-mood:nth-child(5){grid-column:1/-1}');
      // Регрессия ревью #1405: на desktop кнопка была прибита к 190px, и подпись
      // «Смотреть маршруты» (201px вместе с иконкой) резалась с обеих сторон.
      // Ширина должна идти от содержимого, 190px остаётся нижней границей.
      // На desktop кнопка тянется на ширину колонки (реальная — 288 px); жёсткие
      // 190 px резали подпись, поэтому фиксированная ширина запрещена.
      expect(css).toMatch(/@media\(min-width:1280px\)\{[^\n]*\.ssg-home-cta\{width:100%;min-width:190px/);
      expect(css).not.toMatch(/\.ssg-home-cta\{width:190px/);
      expect(css).toMatch(/html\[data-theme="dark"\] \.ssg-home-mood\{[^}]*color:#e8e8e8/);
    });

    // Скелетон обязан красить контролы в реальные цвета hero: зелёный primary
    // CTA/кнопка поиска, терракотовый акцент заголовка (brandText вне книги,
    // bookPageAccent на странице книги), заливка letterbox цветом кадра.
    // Старый оранжевый #f5842c давал цветовой скачок на гидрации.
    it('paints controls with the real hero palette instead of legacy orange', () => {
      const css = buildSkeletonCSS();
      expect(css).toContain(`.ssg-home-cta{width:100%;height:46px;border-radius:16px;background:${COLORS.light.primary}`);
      expect(css).toMatch(new RegExp(`\\.ssg-home-search-btn\\{[^}]*background:${COLORS.light.primary}`));
      expect(css).toMatch(new RegExp(`\\.ssg-home-title \\.ssg-accent\\{display:block;color:${COLORS.light.accent}`));
      expect(css).toContain('.ssg-home-title .ssg-accent{color:#b35900}');
      // Оранжевый #f5842c остаётся только у маркеров карты (бренд-цвет пинов);
      // в правилах главной его быть не должно.
      const homeRules = (css.match(/\.ssg-home-[^{]*\{[^}]*\}/g) || []).join('\n');
      expect(homeRules.length).toBeGreaterThan(0);
      expect(homeRules).not.toContain('#f5842c');
      expect(css).toMatch(/\.ssg-home-week\{[^}]*background:#536659/);
      expect(css).toMatch(/\.ssg-home-hero\{[^}]*background:#536659/);
    });

    // Desktop-заголовок книги — serif (editorialSerif из homeHeroStyles);
    // mobile остаётся sans (паритет с native). Подпись «Маршрут недели» лежит
    // на скриме поверх фото, а не на белой плашке.
    it('uses the serif book typography on desktop and a photo scrim caption', () => {
      const css = buildSkeletonCSS();
      expect(css).toMatch(/@media\(min-width:1280px\)\{[^\n]*\.ssg-home-title\{font-family:Baskerville,Georgia,'Times New Roman',serif/);
      expect(css).toContain('.ssg-home-hero::after');
      expect(css).toMatch(/\.ssg-home-hero::after\{[^}]*linear-gradient/);
      expect(css).not.toContain('.ssg-home-week-body{position:absolute;left:16px;right:16px;bottom:16px;z-index:2;display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:16px;background:rgba(255,255,255,.88)}');
      expect(css).toMatch(/\.ssg-home-week-body\{position:absolute;left:0;right:0;bottom:0/);
    });

    // Геометрия перепривязана к живому проду (замер 2026-08-12, #1409): шапка
    // 64/78 px вместо плоских 56, книга — бокс настоящей книги, левая страница и
    // слот фото — в тех же координатах. Прежние якоря считались от шапки 56 px и
    // aspect-ratio книги, из-за чего подмена шелла на React читалась как прыжок.
    it('mirrors the measured first screen: bar, book and left page', () => {
      const css = buildSkeletonCSS();

      // --- mobile 390: заголовок карточки на 108 px, как у React-hero ---
      const mobileBar = 64;
      const mobileTitleTop = mobileBar + 0 + 44; // шапка + padding шелла + padding карточки
      expect(mobileTitleTop).toBe(108);
      expect(css).toContain('.ssg-home-bar{height:64px');
      expect(css).toContain('.ssg-home-shell{width:100%;max-width:1200px;margin:0 auto;padding:0 16px}');
      // Высоты контролов равны реальным: поле поиска 46, mood-чип 50.
      expect(css).toMatch(/\.ssg-home-search\{[^}]*height:46px/);
      expect(css).toMatch(/\.ssg-home-mood\{height:50px/);

      // --- desktop 1350x940: книга 1200x760 в точке (68,130) ---
      const desktopBar = 78;
      const shellPaddingTop = 52;
      expect(desktopBar + shellPaddingTop).toBe(130);
      const bookWidth = Math.min(1350 - 15 - 80, 1200); // вьюпорт минус скроллбар и padding шелла
      const bookHeight = Math.min(940 - 180, (1350 - 80) / 1.3594771);
      expect(bookWidth).toBe(1200);
      expect(Math.round(bookHeight)).toBe(760);
      // #1541: слот фото — ландшафт 3:2. Замер React 2026-08-25 на этом же
      // вьюпорте: кадр 374.4x249.6 в точке (679.2, 352.2) при книге 1200x760
      // в точке (60,130). Ширина — 61,2% второй колонки, высота — из
      // пропорции набора, отступ сверху — 29,2% высоты книги.
      expect(Math.round(bookWidth * 0.51 * 0.612)).toBe(375);
      expect(Math.round((bookWidth * 0.51 * 0.612) / 1.5)).toBe(250);
      expect(Math.round(bookHeight * 0.292)).toBe(222);

      expect(css).toMatch(/@media\(min-width:1280px\)\{[^\n]*\.ssg-home-bar\{height:78px/);
      expect(css).toContain('.ssg-home-shell{max-width:none;padding:52px 40px 24px}');
      expect(css).toContain('grid-template-columns:49% 51%');
      expect(css).toContain('width:min(100%,1200px);height:min(calc(100svh - 180px),calc((100vw - 80px)/1.3594771))');
      // Прежняя привязка через aspect-ratio делала книгу на 167 px уже настоящей.
      expect(css).not.toContain('aspect-ratio:1040/765');
      expect(css).toContain('background-image:var(--image-homeHeroBook,none)');
      expect(css).toContain('.ssg-home-page{position:relative;top:11.0%;align-self:start;');
      expect(css).toContain('padding:0 18.4% 0 32.65%');
      expect(css).toContain(
        '.ssg-home-week{top:29.2%;align-self:start;width:61.2%;aspect-ratio:3/2;margin:0 0 0 5.1%',
      );
      expect(css).toContain('.ssg-home-cta{width:100%;height:46px');
      expect(css).toContain(
        '.ssg-home-moods{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:9px;border-top:1px solid',
      );
      expect(css).toContain('padding-top:34px');
      expect(css).toContain('.ssg-home-week-body{position:absolute');
    });

    // Шапка — самая заметная часть подмены: раньше вместо неё была полоса 56 px
    // с одним словом. Подписи меню обязаны совпадать с HEADER_NAV_ITEMS.
    it('replicates the real header: logo, nav labels, language and account pills', () => {
      const html = buildHomeSkeletonHtml();
      const css = buildSkeletonCSS();

      expect(html).toContain('src="/assets/icons/logo_yellow_60x60.png"');
      expect(html).toContain('<span class="ssg-home-bar-word">MeTravel</span>');
      ['Маршруты', 'Беларусь', 'Карта', 'Места', 'Случайный маршрут', 'Квесты'].forEach((label) => {
        expect(html).toContain(`<span class="ssg-home-bar-nav-ico"></span>${label}</span>`);
      });
      expect(html).toContain('RU</span>');
      expect(html).toContain('Войти</span>');
      expect(html).toContain('Гость</span>');
      // Слот под иконку пункта меню держит подписи на позициях настоящей шапки.
      expect(css).toContain('.ssg-home-bar-nav-ico{width:18px;height:18px;flex:0 0 18px}');
      expect(css).toMatch(/\.ssg-home-bar-nav\{display:flex;align-items:center;gap:22px;margin-left:41px/);
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

      it('keeps the photo in the week-route card after the search controls', () => {
        const html = buildHomeSkeletonHtml({ heroHref: HERO_HREF });
        expect(html.indexOf('ssg-home-hero-img')).toBeGreaterThan(html.indexOf('ssg-home-search'));
        expect(html.indexOf('ssg-home-hero-img')).toBeGreaterThan(html.indexOf('ssg-home-week'));
        expect(html.indexOf('ssg-home-hero-img')).toBeLessThan(html.indexOf('ssg-home-week-body'));
      });

      it('escapes the href instead of interpolating it raw', () => {
        const html = buildHomeSkeletonHtml({ heroHref: '/a.webp" onerror="x' });
        expect(html).not.toContain('onerror="x"');
        expect(html).toContain('&quot;');
      });

      it('keeps a neutral, sized hero slot when the asset is missing', () => {
        const html = buildHomeSkeletonHtml();
        expect(html).toContain('<div class="ssg-home-hero"></div>');
        expect(html).not.toContain('ssg-home-hero-img');
        expect(html).not.toContain('data-ssg-lcp');
        expect(html).toContain('ssg-home-title');
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
        const mobileSlotWidth = 390 - 16 * 2;
        const mobileCandidateArea = mobileSlotWidth * (mobileSlotWidth / (3 / 2));
        expect(mobileCandidateArea).toBeGreaterThanOrEqual(85438);
        expect(css).toContain('.ssg-home-hero{');
        expect(css).toContain('aspect-ratio:3/2');
        expect(css).toContain('.ssg-home-hero img.ssg-home-hero-img{');
        // Абсолютный бокс: aspect-ratio/min-height критического CSS не участвуют.
        expect(css).toMatch(/\.ssg-home-hero img\.ssg-home-hero-img\{[^}]*position:absolute/);
        expect(css).toMatch(/\.ssg-home-hero img\.ssg-home-hero-img\{[^}]*aspect-ratio:auto/);
        expect(css).toMatch(/\.ssg-home-hero img\.ssg-home-hero-img\{[^}]*object-fit:contain/);
        // Слабая форма (одиночный класс) проигрывает img[data-lcp] по специфичности.
        expect(css).not.toMatch(/(^|[\s,}])\.ssg-home-hero-img\{/);
      });
    });
  });

  describe('buildSearchSkeletonHtml', () => {
    const EXPECTED_H1 = 'Поиск путешествий и маршрутов';
    const EXPECTED_LEAD =
      'Ищите маршруты по странам, категориям и уровню сложности. ' +
      'Подбирайте идеи для поездок на выходные, сохраняйте путешествия ' +
      'с фото и заметками и собирайте личную книгу путешествий в PDF. ' +
      'Тысячи готовых маршрутов по Беларуси, Европе и миру — от однодневных ' +
      'прогулок рядом с домом до многодневных трипов с семьёй, друзьями ' +
      'или в одиночку. Фильтруйте поездки по сезону, бюджету, типу транспорта ' +
      'и уровню физической нагрузки: пешие маршруты, велопоходы, автопутешествия, ' +
      'поездки на общественном транспорте, водные и горные маршруты. ' +
      'Смотрите фотографии от путешественников, карты с точками интереса, ' +
      'трек-файлы GPX и подробные заметки — всё, что нужно, чтобы собраться и поехать.';

    it('returns div with id ssg-skeleton', () => {
      const html = buildSearchSkeletonHtml();
      expect(html).toContain('id="ssg-skeleton"');
    });

    it('keeps the catalogue before the exact raw SEO copy', () => {
      const html = buildSearchSkeletonHtml();
      const barIndex = html.indexOf('ssg-search-bar');
      const gridIndex = html.indexOf('ssg-search-grid');
      const seoIndex = html.indexOf('ssg-search-seo');
      expect(barIndex).toBeGreaterThan(-1);
      expect(gridIndex).toBeGreaterThan(barIndex);
      expect(seoIndex).toBeGreaterThan(gridIndex);
      expect(html).toContain(`<h1 class="ssg-search-h1">${EXPECTED_H1}</h1>`);
      expect(html).toContain(`<p class="ssg-search-lead">${EXPECTED_LEAD}</p>`);
      expect(html).not.toContain('ssg-search-intro');
    });

    it('keeps SEO copy in normal flow without hiding contracts', () => {
      const css = buildSkeletonCSS();
      const html = buildSearchSkeletonHtml();
      const match = css.match(/\.ssg-search-seo\{([^}]*)\}/);
      expect(match).not.toBeNull();
      const rule = (match as RegExpMatchArray)[1];
      expect(rule).toContain('position:relative');
      expect(rule).not.toContain('display:none');
      expect(rule).not.toContain('visibility:hidden');
      expect(rule).not.toContain('clip:');
      expect(rule).not.toContain('overflow:hidden');
      expect(html).not.toContain('class="ssg-search-seo" aria-hidden');
      expect(html).not.toContain('<template');
    });

    it('uses the catalog geometry producer instead of independent fixed media sizes', () => {
      const { buildCatalogSkeletonCSS } = require('../../scripts/ssg-skeletons');
      // Runtime/native consumers import the pure geometry CommonJS module;
      // Node-only CSS emission must not become part of that runtime payload.
      expect(require('../../components/listTravel/travelCatalogGeometry')).not.toHaveProperty('buildCatalogSkeletonCSS');
      const css = buildSkeletonCSS();
      expect(css).toContain(buildCatalogSkeletonCSS());
      expect(css).toContain('.ssg-search-card-media{width:100%;aspect-ratio:1}');
      expect(css).not.toContain('.ssg-search-card-media{height:270px}');
      expect(css).not.toContain('max-width:1214px');
      const html = buildSearchSkeletonHtml();
      expect(html.match(/class="ssg-search-card-title"/g)).toHaveLength(6);
      expect(html.match(/class="ssg-search-card-meta"/g)).toHaveLength(6);
      expect(css).toContain('@media(min-width:1440px){.ssg-search-aside');
    });

    it('does not invent a mock, cover, or invisible LCP image', () => {
      const html = buildSearchSkeletonHtml();
      const visibleShell = html.split('<script>')[0];
      expect(visibleShell.match(/class="ssg-search-card"/g)).toHaveLength(6);
      expect(visibleShell).not.toMatch(/<img[\s>]/i);
      expect(visibleShell).not.toContain('data-lcp');
      expect(visibleShell).not.toContain('cover');
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
      expect(result).toContain('ssg-home-book');
    });

    it('injects skeleton for /search route', () => {
      const result = injectSkeletonShell(baseHtml, '/search');
      expect(result).toContain('id="ssg-skeleton"');
      expect(result).toContain('ssg-search-aside');
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

    // #1356. Оба инжекта обязаны идти через replacer-функцию. В строке-замене
    // `$&`, `` $` ``, `$'` и `$1` — паттерны подстановки, а шелл легально их
    // содержит: `$'` есть в любом литерале вида `'…$'` внутри скрипта снятия, и
    // в теле статьи из БД. При строковой замене каждое вхождение разворачивалось
    // в остаток документа: 133 байта превращались в 22 324, `#root` дублировался
    // трижды вместе с entry-бандлом, а инлайн-скрипт обрывался на полуслове.
    // Проверки на toContain этого не видели — они оставались зелёными.
    it('does not expand $-substitution patterns while injecting', () => {
      const withScript =
        '<!DOCTYPE html><html><head><title>t</title></head><body>' +
        '<div id="root">prerender</div><script src="/entry.js"></script></body></html>';

      const out = injectSkeletonShell(withScript, '/');

      expect(out).toContain(buildRemovalScript());
      expect((out.match(/id="root"/g) || []).length).toBe(1);
      expect((out.match(/entry\.js/g) || []).length).toBe(1);
      expect(out.length).toBeLessThan(
        withScript.length + buildHomeSkeletonHtml().length + buildSkeletonCSS().length + 64,
      );
    });

    it('keeps a $-pattern that came from the article body as plain text', () => {
      const out = injectSkeletonShell(
        '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>',
        '/travels/x',
        { name: 'Маршрут', descriptionHtml: "<p>Цена 20$' за вход</p>" },
      );

      expect(out).toContain("Цена 20$' за вход");
      expect((out.match(/id="root"/g) || []).length).toBe(1);
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

    const setupSearchDom = ({ rootHtml = '<div>shell</div>' } = {}) => {
      document.head.innerHTML = '<style id="ssg-skeleton-css"></style>';
      document.body.innerHTML =
        '<div id="ssg-skeleton"><div class="ssg-search-shell"><div class="ssg-search-layout"></div></div></div>' +
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

    describe('first presented content gate (#2359)', () => {
      let observerDescriptor: PropertyDescriptor | undefined;
      let notifyPaint: (names: string[]) => void;
      let observe: jest.Mock;
      let disconnect: jest.Mock;

      beforeEach(() => {
        observerDescriptor = Object.getOwnPropertyDescriptor(window, 'PerformanceObserver');
        observe = jest.fn();
        disconnect = jest.fn();
        class PaintObserver {
          static supportedEntryTypes = ['paint'];
          observe = observe;
          disconnect = disconnect;
          constructor(callback: (list: { getEntries: () => { name: string }[] }) => void) {
            notifyPaint = (names) => callback({ getEntries: () => names.map((name) => ({ name })) });
          }
        }
        Object.defineProperty(window, 'PerformanceObserver', { configurable: true, value: PaintObserver });
      });

      afterEach(() => {
        if (observerDescriptor) Object.defineProperty(window, 'PerformanceObserver', observerDescriptor);
        else delete (window as any).PerformanceObserver;
      });

      it.each(['travel', 'map', 'catalog'] as const)('retains a ready %s shell until FCP is reported', (route) => {
        if (route === 'map') setupMapDom();
        else setupDom({ travel: route === 'travel' });
        const ready = route === 'map' ? 'data-map-route-ready'
          : route === 'travel' ? 'data-travel-details-ready' : 'data-first-screen-ready';
        document.getElementById('root')?.setAttribute(ready, 'true');

        runScript();
        expect(observe).toHaveBeenCalledWith({ type: 'paint', buffered: true });
        jest.advanceTimersByTime(500);
        expect(skeleton()).not.toBeNull();

        notifyPaint(['first-paint']);
        expect(skeleton()).not.toBeNull();
        notifyPaint(['first-contentful-paint']);
        expect(skeleton()).toBeNull();
        expect(document.getElementById('ssg-skeleton-css')).toBeNull();
        expect(disconnect).toHaveBeenCalledTimes(1);
      });

      it('keeps the shell after FCP when React has not declared readiness', () => {
        setupDom();
        runScript();
        notifyPaint(['first-contentful-paint']);
        expect(skeleton()).not.toBeNull();
        document.getElementById('root')?.setAttribute('data-travel-details-ready', 'true');
        jest.advanceTimersByTime(200);
        expect(skeleton()).toBeNull();
      });

      it('opens the gate when the browser rejects paint observation', () => {
        setupDom({ travel: false });
        document.getElementById('root')?.setAttribute('data-first-screen-ready', 'true');
        observe.mockImplementation(() => { throw new Error('Paint observation unavailable'); });
        runScript();
        expect(skeleton()).toBeNull();
      });

      it('preserves the late readiness fallback if no paint entry arrives', () => {
        setupDom({ travel: false });
        document.getElementById('root')?.setAttribute('data-first-screen-ready', 'true');
        runScript();
        jest.advanceTimersByTime(19999);
        expect(skeleton()).not.toBeNull();
        jest.advanceTimersByTime(1);
        expect(skeleton()).toBeNull();
      });
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

    // #1405: `app-hydrated` ставит ленивый чанк RootWebDeferredChrome, поэтому на
    // главной он приходил на 1,55 с позже реального первого экрана. Экран сам
    // сообщает о готовности атрибутом на #root.
    it('removes a non-travel shell as soon as the route marks its first screen ready', () => {
      setupDom({ travel: false });
      runScript();

      document.getElementById('root')?.setAttribute('data-first-screen-ready', 'true');
      jest.advanceTimersByTime(200);

      expect(document.documentElement.classList.contains('app-hydrated')).toBe(false);
      expect(skeleton()).toBeNull();
      expect(document.getElementById('ssg-skeleton-css')).toBeNull();
    });

    // У travel/map свои гейты, защищающие LCP-кадр: чужой сигнал их не снимает.
    it('ignores the first-screen attribute on travel and map shells', () => {
      setupDom();
      runScript();
      document.getElementById('root')?.setAttribute('data-first-screen-ready', 'true');
      jest.advanceTimersByTime(1000);
      expect(skeleton()).not.toBeNull();

      document.head.innerHTML = '';
      document.body.innerHTML = '';
      setupMapDom();
      runScript();
      document.getElementById('root')?.setAttribute('data-first-screen-ready', 'true');
      jest.advanceTimersByTime(1000);
      expect(skeleton()).not.toBeNull();
    });

    // #1406: на /search гидрация приходит РАНЬШЕ данных каталога (~1 с), и
    // app-hydrated снимал шелл на голый SearchPageSkeleton. Search-шелл ждёт
    // терминального состояния каталога (data-first-screen-ready от
    // ListTravelBase); гидрация остаётся только late-бэкстопом.
    it('keeps the search shell on app-hydrated until the catalog marks readiness (#1406)', () => {
      setupSearchDom();
      runScript();

      document.documentElement.classList.add('app-hydrated');
      jest.advanceTimersByTime(1000);
      expect(skeleton()).not.toBeNull();

      document.getElementById('root')?.setAttribute('data-first-screen-ready', 'true');
      jest.advanceTimersByTime(200);
      expect(skeleton()).toBeNull();
      expect(document.getElementById('ssg-skeleton-css')).toBeNull();
    });

    it('search shell still falls back to app-hydrated at the 20s backstop (#1406)', () => {
      setupSearchDom();
      runScript();

      document.documentElement.classList.add('app-hydrated');
      jest.advanceTimersByTime(19000);
      expect(skeleton()).not.toBeNull();

      jest.advanceTimersByTime(1200);
      expect(skeleton()).toBeNull();
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

    it('disconnects the root observer when the 20s timeout tears down the shell', () => {
      const disconnect = jest.spyOn(MutationObserver.prototype, 'disconnect');
      try {
        setupDom();
        runScript();
        document.documentElement.classList.add('app-hydrated');

        jest.advanceTimersByTime(20100);

        expect(skeleton()).toBeNull();
        expect(disconnect).toHaveBeenCalled();
      } finally {
        disconnect.mockRestore();
      }
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

    // #1356. Раньше глубокий fallback спрашивал «сколько текста в #root» и снимал
    // шелл при >200 символах. На `/` статический пререндер содержит 5 739 символов
    // (список квестов), на `/search` — сопоставимо, поэтому порог был пройден и при
    // мёртвом бандле: шелл снимался, оставляя пустой экран. Теперь fallback
    // спрашивает, жив ли React, а объём текста не имеет значения.
    it('45s deep fallback does not accept the pre-commit container key', () => {
      setupDom();
      runScript();
      jest.advanceTimersByTime(21000);
      const root = document.getElementById('root') as HTMLElement;
      // React ставит этот ключ до commit, а SSG-children уже есть. Оба
      // условия могут быть истинны после аварии первого render.
      (root as any).__reactContainer$k7d2 = {};
      jest.advanceTimersByTime(24000);
      jest.advanceTimersByTime(1000);
      expect(skeleton()).not.toBeNull();
    });

    it('45s deep fallback removes skeleton when only host nodes carry the React key', () => {
      setupDom();
      runScript();
      const root = document.getElementById('root') as HTMLElement;
      (root.firstElementChild as any).__reactFiber$k7d2 = {};
      jest.advanceTimersByTime(46000);
      jest.advanceTimersByTime(500);
      expect(skeleton()).toBeNull();
    });

    it('keeps polling the React host signal after the 45s fallback', () => {
      setupDom();
      runScript();
      jest.advanceTimersByTime(46000);
      expect(skeleton()).not.toBeNull();

      const root = document.getElementById('root') as HTMLElement;
      (root.firstElementChild as any).__reactFiber$k7d2 = {};
      jest.advanceTimersByTime(2100);

      expect(skeleton()).toBeNull();
    });

    // React пишет ключ контейнера внутри createRoot/hydrateRoot — ДО первого
    // коммита. Если рендер упал выше ErrorBoundary, ключ есть, а #root пуст:
    // снимать шелл в этом случае значит показать белый экран.
    it('45s deep fallback keeps skeleton when React crashed and emptied #root', () => {
      setupDom();
      runScript();
      const root = document.getElementById('root') as HTMLElement;
      (root as any).__reactContainer$k7d2 = {};
      root.innerHTML = '';
      jest.advanceTimersByTime(46000);
      jest.advanceTimersByTime(1000);
      expect(skeleton()).not.toBeNull();
    });

    // Backstop «любая мутация #root = приложение живо» отвергнут: переводчик
    // Chrome оборачивает текст в <font> прямо в #root и снял бы шелл с мёртвого
    // бандла — ровно баг #1356.
    it('does not treat a non-React DOM mutation inside #root as a live app', async () => {
      setupDom({ rootHtml: '<div>Статический пререндер страницы.</div>' });
      runScript();
      const root = document.getElementById('root') as HTMLElement;
      const font = document.createElement('font');
      font.textContent = 'translated';
      root.firstElementChild?.appendChild(font);
      await Promise.resolve();

      jest.advanceTimersByTime(46000);
      jest.advanceTimersByTime(1000);
      expect(skeleton()).not.toBeNull();
    });

    it('45s deep fallback keeps skeleton over a text-heavy prerender when React never mounted', () => {
      setupDom({ rootHtml: `<div>${'Квест по Кракову: Вавельский дракон. '.repeat(200)}</div>` });
      runScript();
      const rootText = (document.getElementById('root')?.textContent || '').trim();
      expect(rootText.length).toBeGreaterThan(5000); // как на живом `/`

      jest.advanceTimersByTime(46000);
      jest.advanceTimersByTime(1000);

      expect(skeleton()).not.toBeNull();
      expect(document.getElementById('ssg-skeleton-css')).not.toBeNull();
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

    // The default budget used to be 9 000 chars, which silently truncated 150 of
    // 306 published travels — the longest lost 83 % of its text, and what
    // disappeared was the tail ("Что рядом", FAQ, practical part). A real article
    // must reach the crawler whole; the clamp stays only as a runaway guard.
    it('keeps a full-length real article by default (no 9k truncation)', () => {
      const section = '<h2>Раздел</h2>' + '<p>' + 'слово '.repeat(120) + '</p>';
      const article = section.repeat(30); // ~27k chars — a Витебск-sized article
      expect(article.length).toBeGreaterThan(9000);

      const out = sanitizeArticleBodyHtml(article);

      expect(out.length).toBeGreaterThan(9000);
      const sectionsIn = (article.match(/<h2>/g) || []).length;
      const sectionsOut = (out.match(/<h2>/g) || []).length;
      expect(sectionsOut).toBe(sectionsIn);
    });

    it('still clamps a runaway record at the default budget', () => {
      const huge = ('<p>' + 'a'.repeat(500) + '</p>').repeat(500); // ~250k chars
      const out = sanitizeArticleBodyHtml(huge);
      expect(out.length).toBeLessThanOrEqual(SSG_ARTICLE_BODY_MAX_CHARS);
      expect(out.endsWith('</p>')).toBe(true);
    });

    it('exposes a budget that covers the longest published article', () => {
      // id 470 (Tour du Mont Blanc) sanitizes to 45 528 chars — the corpus maximum.
      expect(SSG_ARTICLE_BODY_MAX_CHARS).toBeGreaterThanOrEqual(50000);
    });
  });

  describe('buildTravelSkeletonHtml (FE-IDX-1)', () => {
    it('keeps the title and article as raw DOM after the first-screen shell', () => {
      const html = buildTravelSkeletonHtml({
        name: 'Тестовый маршрут',
        descriptionHtml: '<p>Подробное описание маршрута.</p><h2>Как добраться</h2><p>На машине.</p>',
      });
      expect(html.indexOf('ssg-travel-crawlable')).toBeGreaterThan(html.indexOf('ssg-travel-first-screen'));
      expect(html).toContain('<h1 class="ssg-travel-h1">Тестовый маршрут</h1>');
      expect(html).toContain('<div class="ssg-travel-article">');
      expect(html).toContain('Подробное описание маршрута.');
      expect(html).toContain('<h2>Как добраться</h2>');
      expect(html).not.toContain('<template');
      expect(html).not.toContain('class="ssg-travel-crawlable" aria-hidden');
    });

    it('keeps crawlable content in normal flow without clipping or hiding it', () => {
      const css = buildSkeletonCSS();
      const match = css.match(/\.ssg-travel-crawlable\{([^}]*)\}/);
      expect(match).not.toBeNull();
      const rule = (match as RegExpMatchArray)[1];
      expect(rule).toContain('position:relative');
      expect(rule).not.toContain('position:absolute');
      expect(rule).not.toContain('display:none');
      expect(rule).not.toContain('visibility:hidden');
      expect(rule).not.toContain('clip:');
      expect(rule).not.toContain('overflow:hidden');
    });

    it('places neutral author and fact geometry immediately after the hero', () => {
      const html = buildTravelSkeletonHtml({ name: 'Маршрут', descriptionHtml: '<p>x</p>' });
      expect(html).toContain('<div class="ssg-travel-hero ssg-pulse"></div>\n<div class="ssg-travel-author-skeleton"');
      expect(html.indexOf('ssg-travel-meta-row')).toBeGreaterThan(html.indexOf('ssg-travel-author-skeleton'));
      expect(html.indexOf('ssg-travel-crawlable')).toBeGreaterThan(html.indexOf('ssg-travel-meta-row'));
    });

    it('emits exactly one visible title H1 and removes article-authored H1 tags', () => {
      const html = buildTravelSkeletonHtml({
        name: 'Маршрут',
        descriptionHtml: '<p>текст</p><h2>раздел</h2><h1>лишний</h1>',
      });
      expect((html.match(/<h1\b/gi) || [])).toHaveLength(1);
      expect(html).toContain('<h1 class="ssg-travel-h1">Маршрут</h1>');
      expect(html).not.toContain('<h1>лишний</h1>');
    });

    it('keeps the title H1 in normal flow without hidden or clipped styles', () => {
      const html = injectSkeletonShell(
        '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>',
        '/travels/test',
        {
          name: 'Маршрут',
          descriptionHtml: '<p>текст</p>',
        },
      );
      const headingTag = html.match(/<h1\b[^>]*class="ssg-travel-h1"[^>]*>/i)?.[0] || '';
      const headingRule = html.match(/\.ssg-travel-h1\{([^}]*)\}/i)?.[1] || '';

      expect(headingTag).not.toContain('style=');
      expect(headingTag).not.toContain('hidden');
      expect(headingRule).not.toMatch(/position\s*:\s*absolute/i);
      expect(headingRule).not.toMatch(/display\s*:\s*none/i);
      expect(headingRule).not.toMatch(/visibility\s*:\s*hidden/i);
      expect(headingRule).not.toMatch(/clip(?:-path)?\s*:/i);
      expect(headingRule).not.toMatch(/(?:width|height)\s*:\s*1px/i);
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
