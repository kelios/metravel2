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
      expect(html).toContain(`<p class="ssg-home-sub">${sub}</p>`);
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
      expect(css).toContain('.ssg-home-cta{width:fit-content;min-width:190px');
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
      expect(css).toMatch(/\.ssg-home-week\{[^}]*background:#687e72/);
      expect(css).toMatch(/\.ssg-home-hero\{[^}]*background:#687e72/);
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

    it('uses the desktop open-book geometry and the compact mobile composition', () => {
      const css = buildSkeletonCSS();
      const mobileTitleTop = 56 + 8 + 44;
      const mobileCtaTop = mobileTitleTop + 80 + 16 + 48 + 16 + 4 + 48 + 16 + 8;
      // Белая карточка hero заканчивается на CTA + padding 20; дальше gap 14,
      // margin 9 до hairline-разделителя, border 1 и padding 34 до грида чипов.
      const mobileHeroCardBottom = mobileCtaTop + 46 + 20;
      const mobileMoodsTop = mobileHeroCardBottom + 14 + 9 + 1 + 34;
      const mobileMoodsHeight = 46 * 3 + 12 * 2;
      const mobileWeekTop = mobileMoodsTop + mobileMoodsHeight + 14 + 20;
      const mobileWeekHeight = (390 - 16 * 2) / (3 / 2);
      const mobilePopularTop = mobileWeekTop + mobileWeekHeight + 14 + 28;
      const desktopBookWidth = Math.min(1280 - 80, ((940 - 180) * 1040) / 765, 1200);
      const desktopBookHeight = desktopBookWidth / (1040 / 765);
      const desktopBookTop = 56 + 20;
      const desktopPageTop = desktopBookTop + desktopBookHeight * 0.216;
      const desktopHeroTop = desktopBookTop + desktopBookHeight * 0.216;
      const desktopHeroWidth = desktopBookWidth * 0.51 * 0.688;
      const desktopHeroHeight = desktopBookHeight * 0.397;

      expect(mobileTitleTop).toBe(108);
      expect(mobileCtaTop).toBe(344);
      expect(mobileMoodsTop).toBe(468);
      expect(mobileWeekTop).toBe(664);
      expect(mobilePopularTop).toBeCloseTo(945, 0);
      expect(desktopBookWidth).toBeCloseTo(1033, 0);
      expect(desktopPageTop).toBeGreaterThanOrEqual(241 - 24);
      expect(desktopPageTop).toBeLessThanOrEqual(241 + 24);
      expect(desktopHeroTop).toBeGreaterThanOrEqual(240 - 24);
      expect(desktopHeroTop).toBeLessThanOrEqual(240 + 24);
      expect(desktopHeroWidth).toBeGreaterThanOrEqual(363 - 24);
      expect(desktopHeroWidth).toBeLessThanOrEqual(363 + 24);
      expect(desktopHeroHeight).toBeGreaterThanOrEqual(302 - 24);
      expect(desktopHeroHeight).toBeLessThanOrEqual(302 + 24);
      expect(css).toContain('.ssg-home-shell{width:100%;max-width:1200px;margin:0 auto;padding:8px 16px}');
      expect(css).toContain('@media(min-width:1280px){.ssg-home-shell{');
      expect(css).toContain('grid-template-columns:49% 51%');
      expect(css).toContain('width:min(calc(100vw - 80px),calc(135.9477svh - 244.7059px),1200px)');
      expect(css).toContain('aspect-ratio:1040/765');
      expect(css).toContain('background-image:var(--image-homeHeroBook,none)');
      expect(css).toContain('.ssg-home-page{position:relative;top:21.6%;align-self:start;');
      expect(css).toContain('padding:0 9% 0 16%');
      expect(css).toContain(
        '.ssg-home-week{top:21.6%;align-self:start;width:68.8%;height:39.7%;margin:0 0 0 2.6%',
      );
      expect(css).toContain('.ssg-home-cta{width:100%;height:46px');
      expect(css).toContain(
        '.ssg-home-moods{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:9px;border-top:1px solid',
      );
      expect(css).toContain('padding-top:34px');
      expect(css).toContain('.ssg-home-week-body{position:absolute');
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

    it('matches mobile and 1280px catalogue geometry', () => {
      const css = buildSkeletonCSS();
      const mobileSearchTop = 56 + 10 + 14;
      const mobileFirstCardTop = mobileSearchTop + 48 + 8 + 32 + 8;
      const desktopSearchTop = 56 + 14 + 59;
      const desktopFirstCardTop = desktopSearchTop + 48 + 14 + 32 + 14;
      const desktopCardWidth = (1214 - 14 * 2 - 14 * 2) / 3;

      expect(mobileSearchTop).toBe(80);
      expect(mobileFirstCardTop).toBe(176);
      expect(desktopFirstCardTop).toBe(237);
      expect(desktopCardWidth).toBe(386);
      expect(css).toContain('.ssg-search-shell{width:100%;max-width:1214px;margin:0 auto;padding:10px}');
      expect(css).toContain('.ssg-search-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;margin-top:8px}');
      expect(css).toContain('.ssg-search-card-media{width:100%;height:220px}');
      expect(css).toContain('grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:14px');
      expect(css).toContain('.ssg-search-card-media{height:270px}');
    });

    it('shows the 300px aside only from 1440px', () => {
      const css = buildSkeletonCSS();
      const html = buildSearchSkeletonHtml();
      expect(html).toContain('ssg-search-aside');
      expect(css).toContain('@media(min-width:1440px){.ssg-search-shell{');
      expect(css).toContain('grid-template-columns:300px minmax(0,1fr);gap:16px');
      expect(css).not.toContain('@media(min-width:1024px){.ssg-search-aside');
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
      expect(html).toContain('<div class="ssg-travel-h1">Тестовый маршрут</div>');
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
