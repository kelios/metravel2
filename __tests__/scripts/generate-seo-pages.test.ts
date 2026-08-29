/**
 * Regression tests for scripts/generate-seo-pages.js
 *
 * Protects against the bug where injectMeta() silently failed to add
 * OG / canonical / Twitter tags when they were missing from the base HTML
 * (Expo static export does NOT include these tags).
 */

const {
  applyHtmlFragment,
  replaceOrInsert,
  injectMeta,
  buildSeoTitle,
  escapeAttr,
  stripHtml,
  buildQuestSeoDescription,
  buildTravelSeoDescription,
  pickTravelSeoImage,
  buildOptimizedTravelImageUrl,
  buildTravelHeroPreloadData,
  injectTravelHeroPreload,
  injectHomeHeroPreload,
  injectIconFontPreload,
  resolveIconFontHref,
  resolveHomeHeroAssetHref,
  injectTravelBootstrapData,
  gateAppScriptsBehindHero,
  injectHiddenH1,
  injectBreadcrumbJsonLd,
  disableExpoRouterHydration,
  injectQuestIntroSection,
  injectQuestLinksIndex,
  injectHomeQuestsSection,
  injectQuestScenarioContent,
  injectQuestCityLandingSection,
  injectQuestsListingContent,
  buildQuestsListingModel,
  buildQuestScenarioFaqJsonLd,
  buildQuestScenarioHowToJsonLd,
  buildQuestPromoCatalog,
  findTravelQuestPromoMatches,
  injectTravelQuestPromoSection,
  injectTravelRegisterCtaSection,
  injectJsonLd,
  buildTravelArticleJsonLd,
  extractFaqEntries,
  buildTravelFaqJsonLd,
  normalizeSlug,
  loadRedirectManifest,
  buildRedirectStubHtml,
  patchNoindexFallbackTemplate,
  buildQuestCityLandingHtml,
  buildQuestCityLandingModel,
  buildQuestCountryLandingHtml,
  buildQuestCountryLandingModel,
  injectQuestCountryLandingSection,
  readRequiredQuestCountryTemplate,
} = require('@/scripts/generate-seo-pages');

const fs = require('fs');
const path = require('path');
const { makeTempDir } = require('./cli-test-utils');

// ---------------------------------------------------------------------------
// Minimal base HTML that mimics Expo static export output (NO OG/canonical)
// ---------------------------------------------------------------------------
const MINIMAL_BASE = [
  '<!DOCTYPE html><html lang="ru"><head>',
  '<title data-rh="true">MeTravel</title>',
  '<meta data-rh="true" name="description" content="default desc"/>',
  '<meta charSet="utf-8"/>',
  '</head><body><div id="root"></div></body></html>',
].join('');

// Base HTML that already contains OG/canonical (future-proof if Expo adds them)
const FULL_BASE = [
  '<!DOCTYPE html><html lang="ru"><head>',
  '<title data-rh="true">MeTravel</title>',
  '<meta data-rh="true" name="description" content="old desc"/>',
  '<link data-rh="true" rel="canonical" href="https://metravel.by/old"/>',
  '<meta data-rh="true" property="og:type" content="website"/>',
  '<meta data-rh="true" property="og:title" content="Old Title"/>',
  '<meta data-rh="true" property="og:description" content="old og desc"/>',
  '<meta data-rh="true" property="og:url" content="https://metravel.by/old"/>',
  '<meta data-rh="true" property="og:image" content="https://metravel.by/old.jpg"/>',
  '<meta data-rh="true" property="og:image:secure_url" content="https://metravel.by/assets/icons/logo_yellow_512x512.png"/>',
  '<meta data-rh="true" property="og:image:alt" content="[param] | Metravel"/>',
  '<meta data-rh="true" name="twitter:image:alt" content="[param] | Metravel"/>',
  '<meta data-rh="true" property="og:site_name" content="MeTravel"/>',
  '<meta data-rh="true" name="twitter:card" content="summary"/>',
  '<meta data-rh="true" name="twitter:title" content="Old Title"/>',
  '<meta data-rh="true" name="twitter:description" content="old tw desc"/>',
  '<meta data-rh="true" name="twitter:image" content="https://metravel.by/old.jpg"/>',
  '</head><body><div id="root"></div></body></html>',
].join('');

const SAMPLE_META = {
  title: 'Албания. Влёра | MeTravel',
  description: 'Описание путешествия по Албании',
  canonical: 'https://metravel.by/travels/albaniya',
  image: 'https://metravel.by/gallery/123/photo-detail_hd.jpg',
  ogType: 'article',
};

/**
 * #1221: `injectMeta` сам добивает ширину ownership-URL. «Голый» адрес отдаёт мастер
 * с `no-store` — ownership-роуты идут мимо кэша nginx, и кэшируемым ответ делает
 * только ширина. Для семейства `gallery` ступень превью — 1280
 * (`socialPreviewWidthForRoute`, сверяется `socialPreviewWidthParity.test.ts`).
 */
const SAMPLE_META_IMAGE_RENDERED = `${SAMPLE_META.image}?w=1280`;

const REPLACEMENT_TOKENS = "literal $' $& $` $1";
const SINGLE_SHELL_BASE = MINIMAL_BASE.replace(
  '</body>',
  '<script src="/entry.js"></script></body>',
);

function expectSingleShell(html: string) {
  expect((html.match(/<div\s+id="root"/g) || [])).toHaveLength(1);
  expect((html.match(/src="\/entry\.js"/g) || [])).toHaveLength(1);
}

// ---------------------------------------------------------------------------
// Literal-safe HTML injection (#1367)
// ---------------------------------------------------------------------------
describe('literal-safe HTML injection', () => {
  it.each([
    ['replace', '<main>literal $\' $& $` $1</main>', '<main>literal $\' $& $` $1</main>'],
    ['before', 'literal $\' $& $` $1<main>before</main>', 'literal $\' $& $` $1'],
    ['after', '<main>before</main>literal $\' $& $` $1', 'literal $\' $& $` $1'],
  ] as const)('keeps replacement tokens literal in %s mode', (placement, expected, fragment) => {
    const base = '<main>before</main>';
    const result = applyHtmlFragment(base, /(<main>[\s\S]*?<\/main>)/, fragment, placement);

    expect(result).toBe(expected);
    expect(result.length).toBe(expected.length);
  });

  it('keeps one root and entry script across content-bearing injectors', () => {
    const outputs = [
      replaceOrInsert(
        SINGLE_SHELL_BASE,
        /<meta[^>]*data-literal-probe[^>]*>/i,
        `<meta data-literal-probe="${REPLACEMENT_TOKENS}">`,
      ),
      injectMeta(SINGLE_SHELL_BASE, {
        ...SAMPLE_META,
        title: REPLACEMENT_TOKENS,
        description: REPLACEMENT_TOKENS,
      }),
      patchNoindexFallbackTemplate(SINGLE_SHELL_BASE, {
        title: REPLACEMENT_TOKENS,
        description: REPLACEMENT_TOKENS,
      }),
      injectBreadcrumbJsonLd(SINGLE_SHELL_BASE, {
        itemListElement: [{ '@type': 'ListItem', position: 1, name: REPLACEMENT_TOKENS }],
      }),
      injectTravelHeroPreload(SINGLE_SHELL_BASE, {
        mobile: { href: REPLACEMENT_TOKENS },
      }),
      injectHomeHeroPreload(SINGLE_SHELL_BASE, REPLACEMENT_TOKENS),
      injectIconFontPreload(SINGLE_SHELL_BASE, REPLACEMENT_TOKENS),
      injectTravelBootstrapData(SINGLE_SHELL_BASE, { name: REPLACEMENT_TOKENS }, 'literal-probe'),
      injectHiddenH1(SINGLE_SHELL_BASE, REPLACEMENT_TOKENS),
      injectJsonLd(SINGLE_SHELL_BASE, { '@type': 'Article', headline: REPLACEMENT_TOKENS }, 'literal-probe'),
      injectTravelQuestPromoSection(SINGLE_SHELL_BASE, [
        {
          distanceKm: 1,
          quest: {
            route: { path: '/quests/1/literal-probe' },
            title: REPLACEMENT_TOKENS,
            cityName: 'Краков',
            points: 3,
            durationMin: 30,
            cover: '',
          },
        },
      ]),
      injectQuestIntroSection(SINGLE_SHELL_BASE, {
        title: REPLACEMENT_TOKENS,
        description: REPLACEMENT_TOKENS,
        quest: { title: REPLACEMENT_TOKENS, city_name: 'Краков' },
        bundle: {},
      }),
      injectQuestLinksIndex(SINGLE_SHELL_BASE, [
        { quest_id: 'literal-probe', city_id: '1', title: REPLACEMENT_TOKENS },
      ]),
      injectQuestsListingContent(
        SINGLE_SHELL_BASE,
        [{ quest_id: 'literal-probe', city_id: '1', city_name: 'Краков', title: REPLACEMENT_TOKENS }],
        new Map(),
      ),
      injectQuestCityLandingSection(
        SINGLE_SHELL_BASE,
        { cityId: '1', quests: [{ path: '/quests/1/literal-probe', title: REPLACEMENT_TOKENS }] },
        REPLACEMENT_TOKENS,
        REPLACEMENT_TOKENS,
      ),
      injectQuestScenarioContent(SINGLE_SHELL_BASE, [
        { cityId: '1', name: REPLACEMENT_TOKENS, landingPath: '/quests/literal-probe', quests: [{}] },
      ]),
      injectTravelRegisterCtaSection(SINGLE_SHELL_BASE),
    ];

    for (const output of outputs) {
      expectSingleShell(output);
      expect(output.length).toBeLessThan(SINGLE_SHELL_BASE.length + 100_000);
    }
    for (const output of outputs.slice(0, -1)) {
      expect(output.replace(/&amp;/g, '&').replace(/\\u0026/g, '&')).toContain(REPLACEMENT_TOKENS);
    }
  });
});

// ---------------------------------------------------------------------------
// replaceOrInsert
// ---------------------------------------------------------------------------
// #1409: шрифт иконок узнавался только из JS-бандла и догружался уже ПОСЛЕ
// снятия SSG-шелла (замер прода: старт 848/1038 мс, готов 959/1159 мс против
// снятия шелла на 901/1109 мс), поэтому сразу после подмены иконки в шапке,
// чипах и кнопке секунду рисовались пустыми квадратами.
describe('injectIconFontPreload', () => {
  const fs = require('fs');
  const path = require('path');

  it('preloads the icon font with crossorigin', () => {
    const html = injectIconFontPreload(SINGLE_SHELL_BASE, '/assets/Feather.abc123.ttf');
    expect(html).toContain('rel="preload"');
    expect(html).toContain('as="font"');
    expect(html).toContain('href="/assets/Feather.abc123.ttf"');
    // Без crossorigin браузер считает preload другим запросом и качает шрифт дважды.
    expect(html).toContain('crossorigin="anonymous"');
  });

  it('does nothing without a resolved font (fail-open)', () => {
    expect(injectIconFontPreload(SINGLE_SHELL_BASE, null)).toBe(SINGLE_SHELL_BASE);
  });

  it('resolves the hashed font file from dist and returns null when missing', () => {
    const dist = makeTempDir('ssg-font-');
    const fontsDir = path.join(
      dist,
      'assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts'
    );
    expect(resolveIconFontHref(dist)).toBeNull();

    fs.mkdirSync(fontsDir, { recursive: true });
    fs.writeFileSync(path.join(fontsDir, 'Feather.ca4b48e04dc1ce10bfbddb262c8b835f.ttf'), 'x');
    expect(resolveIconFontHref(dist)).toBe(
      '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ca4b48e04dc1ce10bfbddb262c8b835f.ttf'
    );
    fs.rmSync(dist, { recursive: true, force: true });
  });
});

describe('replaceOrInsert', () => {
  it('replaces existing tag when regex matches', () => {
    const html = '<head><meta property="og:title" content="old"/></head>';
    const result = replaceOrInsert(
      html,
      /<meta[^>]*property="og:title"[^>]*\/?>/i,
      '<meta property="og:title" content="new"/>',
    );
    expect(result).toContain('content="new"');
    expect(result).not.toContain('content="old"');
  });

  it('inserts tag before </head> when regex does NOT match', () => {
    const html = '<head><title>Test</title></head>';
    const result = replaceOrInsert(
      html,
      /<meta[^>]*property="og:title"[^>]*\/?>/i,
      '<meta property="og:title" content="inserted"/>',
    );
    expect(result).toContain('<meta property="og:title" content="inserted"/>');
    expect(result).toContain('</head>');
  });

  it('does not duplicate tag on replace', () => {
    const html = '<head><meta property="og:title" content="old"/></head>';
    const result = replaceOrInsert(
      html,
      /<meta[^>]*property="og:title"[^>]*\/?>/i,
      '<meta property="og:title" content="new"/>',
    );
    const count = (result.match(/og:title/g) || []).length;
    expect(count).toBe(1);
  });
});

describe('injectTravelBootstrapData', () => {
  it('injects travel preload data into the body before the app root', () => {
    const html = injectTravelBootstrapData(MINIMAL_BASE, { id: 42, name: 'Hexenstieg' }, 'hexenstieg');

    expect(html).toContain('data-travel-preload-bootstrap="true"');
    expect(html).toContain('"slug":"hexenstieg"');
    expect(html).toContain('"id":42');
    expect(html).toContain('window.__metravelTravelPreloadScriptLoaded=true');
    expect(html).toContain('window.__metravelTravelPreloadPending=false');
    expect(html).toContain('window.__metravelTravelPreloadPromise=Promise.resolve(window.__metravelTravelPreload.data)');
    expect(html.indexOf('data-travel-preload-bootstrap="true"')).toBeLessThan(html.indexOf('<div id="root">'));
  });

  it('trims below-the-fold media manifests from the inline preload and flags it partial (#1479)', () => {
    const bootstrapTravel = {
      id: 42,
      slug: 'hexenstieg',
      name: 'Hexenstieg',
      media: {
        cover: { id: 1, dominant_color: '#abc', srcset: '/c.webp 720w' },
        gallery: [{ id: 2, srcset: '/g.webp 720w' }],
        address_images: { '9': { id: 3, srcset: '/a.webp 720w' } },
        article_body: { images: [{ id: 4, srcset: '/b.webp 720w' }] },
      },
    };
    const html = injectTravelBootstrapData(MINIMAL_BASE, bootstrapTravel, 'hexenstieg');

    // Only the hero cover manifest is inlined; the heavy below-fold manifests drop.
    expect(html).toContain('"mediaPartial":true');
    expect(html).toContain('"cover":{"id":1');
    expect(html).not.toContain('"gallery":[{"id":2');
    expect(html).not.toContain('"address_images"');
    expect(html).not.toContain('"article_body"');
  });

  it('keeps mediaPartial false and does not touch data when media has no below-fold manifests', () => {
    const html = injectTravelBootstrapData(
      MINIMAL_BASE,
      { id: 42, name: 'Hexenstieg', media: { cover: { id: 1 } } },
      'hexenstieg',
    );

    expect(html).toContain('"mediaPartial":false');
    expect(html).toContain('"cover":{"id":1}');
  });

  it('marks a numeric fallback route as an id preload so the runtime can consume it', () => {
    const html = injectTravelBootstrapData(
      MINIMAL_BASE,
      { id: 42, name: 'Travel without a slug' },
      '42',
    );

    expect(html).toContain('"slug":"42"');
    expect(html).toContain('"isId":true');
  });

  it('replaces an existing bootstrap script instead of duplicating it', () => {
    const first = injectTravelBootstrapData(MINIMAL_BASE, { id: 1, name: 'Old' }, 'old');
    const second = injectTravelBootstrapData(first, { id: 2, name: 'New' }, 'new');

    expect((second.match(/data-travel-preload-bootstrap="true"/g) || []).length).toBe(1);
    expect(second).toContain('"slug":"new"');
    expect(second).toContain('"id":2');
    expect(second).not.toContain('"slug":"old"');
  });

  it('escapes embedded HTML so bootstrap data does not add raw markup to the page source', () => {
    const html = injectTravelBootstrapData(
      MINIMAL_BASE,
      { id: 42, description: '<h1>Nested heading</h1><p>Body</p>' },
      'hexenstieg',
    );

    expect(html).toContain('\\u003ch1\\u003eNested heading\\u003c/h1\\u003e');
    expect(html).not.toContain('<h1>Nested heading</h1>');
    expect((html.match(/<h1\b/gi) || []).length).toBe(0);
  });

  it('preserves title-critical travel fields when detail data is merged into bootstrap payload', () => {
    const bootstrapTravel = {
      id: 42,
      slug: 'hexenstieg',
      name: 'Тропа ведьм (Harzer Hexenstieg)',
      countryName: 'Германия',
      description: 'Полный текст маршрута',
      gallery: [{ url: 'https://metravel.by/gallery/42/detail_hd.jpg' }],
    };
    const html = injectTravelBootstrapData(MINIMAL_BASE, bootstrapTravel, 'hexenstieg');

    expect(html).toContain('"name":"Тропа ведьм (Harzer Hexenstieg)"');
    expect(html).toContain('"countryName":"Германия"');
    expect(html).toContain('"description":"Полный текст маршрута"');
    expect(html).toContain('"url":"https://metravel.by/gallery/42/detail_hd.jpg"');
  });

  it('preserves travel map and excursions fields in bootstrap payload', () => {
    const bootstrapTravel = {
      id: 362,
      slug: 'morskoe-oko-v-mae',
      name: 'Морское око в мае.',
      countryCode: 'pl',
      travelAddress: [{ id: 1, coord: '49.2557252,20.1030021', address: 'Palenica Białczańska' }],
      coordsMeTravel: [{ id: 1, lat: 49.2557252, lng: 20.1030021 }],
      gallery: [],
      description: '',
    };
    const html = injectTravelBootstrapData(MINIMAL_BASE, bootstrapTravel, 'morskoe-oko-v-mae');

    expect(html).toContain('"countryCode":"pl"');
    expect(html).toContain('"travelAddress":[{"id":1,"coord":"49.2557252,20.1030021","address":"Palenica Białczańska"}]');
    expect(html).toContain('"coordsMeTravel":[{"id":1,"lat":49.2557252,"lng":20.1030021}]');
  });

  it('preserves author identity fields in bootstrap payload', () => {
    const bootstrapTravel = {
      id: 362,
      slug: 'morskoe-oko-v-mae',
      name: 'Морское око в мае.',
      userName: 'Julia',
      userIds: '42',
      userTravelsCount: 7,
      user: {
        id: 42,
        first_name: 'Julia',
        avatar: 'https://metravel.by/media/avatar.jpg',
      },
    };
    const html = injectTravelBootstrapData(MINIMAL_BASE, bootstrapTravel, 'morskoe-oko-v-mae');

    expect(html).toContain('"userName":"Julia"');
    expect(html).toContain('"userIds":"42"');
    expect(html).toContain('"userTravelsCount":7');
    expect(html).toContain('"user":{"id":42,"first_name":"Julia","avatar":"https://metravel.by/media/avatar.jpg"}');
  });
});

// ---------------------------------------------------------------------------
// injectMeta — INSERT mode (minimal base without OG tags)
// ---------------------------------------------------------------------------
describe('injectMeta (insert mode — tags missing from base HTML)', () => {
  let result: string;

  beforeAll(() => {
    result = injectMeta(MINIMAL_BASE, SAMPLE_META);
  });

  it('replaces <title>', () => {
    expect(result).toContain(`>${SAMPLE_META.title}</title>`);
    expect(result).not.toContain('>MeTravel</title>');
  });

  it('replaces meta description', () => {
    expect(result).toContain(`content="${escapeAttr(SAMPLE_META.description)}"`);
    expect(result).not.toContain('content="default desc"');
  });

  it('inserts canonical link', () => {
    expect(result).toMatch(/<link[^>]*rel="canonical"[^>]*href="https:\/\/metravel\.by\/travels\/albaniya"/);
  });

  it('inserts og:type', () => {
    expect(result).toMatch(/<meta[^>]*property="og:type"[^>]*content="article"/);
  });

  it('inserts og:title', () => {
    expect(result).toMatch(/<meta[^>]*property="og:title"/);
  });

  it('inserts og:description', () => {
    expect(result).toMatch(/<meta[^>]*property="og:description"/);
  });

  it('inserts og:url', () => {
    expect(result).toMatch(/<meta[^>]*property="og:url"[^>]*content="https:\/\/metravel\.by\/travels\/albaniya"/);
  });

  // #1221: ширина обязательна. Без неё ownership-роут отдаёт мастер с `no-store`
  // (ownership-роуты идут мимо кэша nginx), и каждый обход краулера стоит 0.4–1 МБ.
  it('inserts og:image with HD URL pinned to a stored-derivative width', () => {
    expect(result).toMatch(/<meta[^>]*property="og:image"[^>]*content="https:\/\/metravel\.by\/gallery\/123\/photo-detail_hd\.jpg\?w=1280"/);
  });

  it('inserts og:site_name', () => {
    expect(result).toMatch(/<meta[^>]*property="og:site_name"[^>]*content="MeTravel"/);
  });

  it('inserts twitter:card as summary_large_image', () => {
    expect(result).toMatch(/<meta[^>]*name="twitter:card"[^>]*content="summary_large_image"/);
  });

  it('inserts twitter:title', () => {
    expect(result).toMatch(/<meta[^>]*name="twitter:title"/);
  });

  it('inserts twitter:description', () => {
    expect(result).toMatch(/<meta[^>]*name="twitter:description"/);
  });

  it('inserts twitter:image', () => {
    expect(result).toMatch(/<meta[^>]*name="twitter:image"/);
  });

  it('produces valid HTML (all tags inside <head>)', () => {
    const headMatch = result.match(/<head>([\s\S]*?)<\/head>/);
    expect(headMatch).toBeTruthy();
    const head = headMatch![1];
    expect(head).toContain('og:title');
    expect(head).toContain('og:description');
    expect(head).toContain('og:image');
    expect(head).toContain('og:url');
    expect(head).toContain('og:type');
    expect(head).toContain('twitter:card');
    expect(head).toContain('rel="canonical"');
  });

  it('does not produce duplicate tags', () => {
    const ogTitleCount = (result.match(/property="og:title"/g) || []).length;
    const ogDescCount = (result.match(/property="og:description"/g) || []).length;
    const ogImageCount = (result.match(/property="og:image"/g) || []).length;
    const canonicalCount = (result.match(/rel="canonical"/g) || []).length;
    const twCardCount = (result.match(/name="twitter:card"/g) || []).length;

    expect(ogTitleCount).toBe(1);
    expect(ogDescCount).toBe(1);
    expect(ogImageCount).toBe(1);
    expect(canonicalCount).toBe(1);
    expect(twCardCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// injectMeta — REPLACE mode (base already has OG tags)
// ---------------------------------------------------------------------------
describe('injectMeta (replace mode — tags exist in base HTML)', () => {
  let result: string;

  beforeAll(() => {
    result = injectMeta(FULL_BASE, SAMPLE_META);
  });

  it('replaces og:title with new value', () => {
    expect(result).toContain(`property="og:title" content="${escapeAttr(SAMPLE_META.title)}"`);
    expect(result).not.toContain('content="Old Title"');
  });

  it('replaces canonical with new URL', () => {
    expect(result).toContain(`href="${SAMPLE_META.canonical}"`);
    expect(result).not.toContain('href="https://metravel.by/old"');
  });

  it('replaces og:image with new image', () => {
    expect(result).toContain(`content="${SAMPLE_META_IMAGE_RENDERED}"`);
    expect(result).not.toContain('content="https://metravel.by/old.jpg"');
  });

  it('replaces twitter:card to summary_large_image', () => {
    expect(result).toContain('content="summary_large_image"');
    expect(result).not.toContain('content="summary"');
  });

  it('does not produce duplicate tags after replace', () => {
    const ogTitleCount = (result.match(/property="og:title"/g) || []).length;
    const canonicalCount = (result.match(/rel="canonical"/g) || []).length;
    expect(ogTitleCount).toBe(1);
    expect(canonicalCount).toBe(1);
  });

  it('syncs og:image:secure_url with the per-page image (not the shell logo)', () => {
    expect(result).toContain(
      `property="og:image:secure_url" content="${SAMPLE_META_IMAGE_RENDERED}"`
    );
    expect(result).not.toMatch(
      /property="og:image:secure_url" content="[^"]*logo_yellow/
    );
  });

  it('replaces placeholder og:image:alt and twitter:image:alt with the page title', () => {
    expect(result).toContain(
      `property="og:image:alt" content="${escapeAttr(SAMPLE_META.title)}"`
    );
    expect(result).toContain(
      `name="twitter:image:alt" content="${escapeAttr(SAMPLE_META.title)}"`
    );
    expect(result).not.toContain('[param]');
  });
});

// ---------------------------------------------------------------------------
// injectMeta — edge cases
// ---------------------------------------------------------------------------
describe('injectMeta edge cases', () => {
  it('deduplicates duplicate og:image tags from base HTML', () => {
    const baseWithDuplicateOgImage = [
      '<!DOCTYPE html><html lang="ru"><head>',
      '<title data-rh="true">MeTravel</title>',
      '<meta data-rh="true" name="description" content="default desc"/>',
      '<meta property="og:image" content="https://metravel.by/assets/icons/logo_yellow_60x60.png"/>',
      '<meta property="og:image" content="https://metravel.by/old-duplicate.jpg"/>',
      '</head><body><div id="root"></div></body></html>',
    ].join('');

    const result = injectMeta(baseWithDuplicateOgImage, SAMPLE_META);
    const ogImageCount = (result.match(/property="og:image"/g) || []).length;

    expect(ogImageCount).toBe(1);
    expect(result).toContain(`property="og:image" content="${SAMPLE_META_IMAGE_RENDERED}"`);
    expect(result).not.toContain('old-duplicate.jpg');
  });

  it('skips og:image and twitter:image when image is undefined', () => {
    const result = injectMeta(MINIMAL_BASE, {
      title: 'No Image Page',
      description: 'desc',
      canonical: 'https://metravel.by/test',
    });
    expect(result).not.toMatch(/property="og:image"/);
    expect(result).not.toMatch(/name="twitter:image"/);
  });

  it('inserts robots meta when provided', () => {
    const result = injectMeta(MINIMAL_BASE, {
      title: 'Login',
      description: 'desc',
      canonical: 'https://metravel.by/login',
      robots: 'noindex, nofollow',
    });
    expect(result).toMatch(/<meta[^>]*name="robots"[^>]*content="noindex, nofollow"/);
  });

  it('does not insert robots meta when not provided', () => {
    const result = injectMeta(MINIMAL_BASE, {
      title: 'Public',
      description: 'desc',
      canonical: 'https://metravel.by/public',
    });
    expect(result).not.toMatch(/name="robots"/);
  });

  it('defaults ogType to website', () => {
    const result = injectMeta(MINIMAL_BASE, {
      title: 'Home',
      description: 'desc',
      canonical: 'https://metravel.by/',
    });
    expect(result).toMatch(/property="og:type"[^>]*content="website"/);
  });

  it('escapes special characters in title', () => {
    const result = injectMeta(MINIMAL_BASE, {
      title: 'Test "quotes" & <tags>',
      description: 'desc',
      canonical: 'https://metravel.by/',
    });
    expect(result).toContain('&amp;');
    expect(result).toContain('&quot;');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
    expect(result).not.toMatch(/<tags>/);
  });
});

// ---------------------------------------------------------------------------
// escapeAttr
// ---------------------------------------------------------------------------
describe('escapeAttr', () => {
  it('escapes ampersand', () => {
    expect(escapeAttr('a & b')).toBe('a &amp; b');
  });

  it('escapes double quotes', () => {
    expect(escapeAttr('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes angle brackets', () => {
    expect(escapeAttr('<script>')).toBe('&lt;script&gt;');
  });

  it('handles null/undefined', () => {
    expect(escapeAttr(null)).toBe('');
    expect(escapeAttr(undefined)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// stripHtml
// ---------------------------------------------------------------------------
describe('stripHtml', () => {
  it('strips HTML tags', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
    expect(stripHtml('<p>Жемыславле</p><p>Дворец Умястовских</p>')).toBe(
      'Жемыславле Дворец Умястовских',
    );
    expect(stripHtml('<strong>Проверьте вы.</strong><strong>Ищите маршрут</strong>')).toBe(
      'Проверьте вы. Ищите маршрут',
    );
  });

  it('strips style and script blocks', () => {
    expect(stripHtml('<style>body{}</style><script>alert(1)</script>text')).toBe('text');
  });

  it('decodes HTML entities', () => {
    expect(stripHtml('&amp; &lt; &gt; &quot; &#039;')).toBe("& < > \" '");
  });

  it('collapses whitespace', () => {
    expect(stripHtml('  hello   world  ')).toBe('hello world');
  });

  it('truncates a single long token by hard cut (no word boundary available)', () => {
    const long = 'a'.repeat(200);
    expect(stripHtml(long, 100).length).toBe(100);
  });

  it('truncates on a word boundary, drops the dangling preposition and appends an ellipsis', () => {
    const text = 'Прогулка по старому городу с чистыми улицами и уютными кафе повсюду';
    const out = stripHtml(text, 30);
    expect(out.length).toBeLessThanOrEqual(30);
    // Ends on a meaningful word — no dangling "с" and no mid-word cut
    expect(out).toBe('Прогулка по старому городу…');
  });

  it('drops trailing punctuation/dashes after the word cut and appends an ellipsis', () => {
    const text = 'Озеро глубиной 11,5 м — оно самое глубокое в регионе бесспорно';
    const out = stripHtml(text, 24);
    expect(out).toBe('Озеро глубиной 11,5 м…');
    expect(/[\s,;:–—-]$/.test(out)).toBe(false);
  });

  it('prefers a complete sentence over an ellipsis when one ends late in the window', () => {
    const text =
      'Закшувек — бирюзовый карьер в Кракове с пляжем и понтонами. Вода прозрачная почти весь сезон, вход бесплатный, но народу много.';
    const out = stripHtml(text, 80);
    expect(out).toBe('Закшувек — бирюзовый карьер в Кракове с пляжем и понтонами.');
    expect(out.endsWith('.')).toBe(true);
    expect(out.includes('…')).toBe(false);
  });

  it('never ends a truncated snippet on a connective', () => {
    const text = 'Пляж с золотым песком и шезлонгами и зонтиками и кабинками для переодевания везде';
    const out = stripHtml(text, 30);
    expect(/\s(?:и|с|в|на)…$/.test(out)).toBe(false);
    expect(out.endsWith('…')).toBe(true);
  });

  it('returns full text unchanged when shorter than maxLength', () => {
    expect(stripHtml('Короткий текст', 160)).toBe('Короткий текст');
  });

  it('returns empty string for falsy input', () => {
    expect(stripHtml('')).toBe('');
    expect(stripHtml(null as any)).toBe('');
    expect(stripHtml(undefined as any)).toBe('');
  });
});

describe('travel SEO fallback helpers', () => {
  it('buildTravelSeoDescription keeps detailed description first when available', () => {
    const result = buildTravelSeoDescription(
      {
        name: 'Испания',
        countryName: 'Испания',
      },
      '<p>Подробный гид по маршруту в Андалусии</p>'
    );

    expect(result).toContain('Подробный гид по маршруту в Андалусии');
    expect(result.length).toBeGreaterThanOrEqual(80);
    expect(result.length).toBeLessThanOrEqual(160);
  });

  // Сниппет собирается из тела статьи, поэтому декоративный мусор в начале
  // (эмодзи-иконки, служебная строка «откуда — куда») съедал бюджет 160 символов
  // и выталкивал за границу то, ради чего страницу открывают.
  it('buildTravelSeoDescription cleans decorative lead noise before clamping', () => {
    const result = buildTravelSeoDescription(
      { name: 'Каспровый Верх', countryName: 'Польша' },
      '<p>Краков - Каспровый Верх (107км 1 час 40 минут) 🏔 Каспровый Верх (Kasprowy Wierch, 1987 м): '
        + 'маршрут, парковка и советы по подъёму на канатной дороге из Кузниц.</p>'
    );

    expect(result.startsWith('Каспровый Верх (Kasprowy Wierch, 1987 м)')).toBe(true);
    expect(result).not.toMatch(/107км/);
    expect(result).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(result.length).toBeLessThanOrEqual(160);
  });

  it('buildTravelSeoDescription uses contextual fallback from travel name/country instead of generic text', () => {
    const result = buildTravelSeoDescription(
      {
        name: 'Ронда и Малага',
        countryName: 'Испания',
      },
      ''
    );

    expect(result).toContain('Ронда и Малага');
    expect(result).toContain('Испания');
    expect(result).not.toBe('Найди место для путешествия и поделись своим опытом.');
  });

  it('pickTravelSeoImage upgrades thumb_200 URL to detail_hd', () => {
    const result = pickTravelSeoImage(
      {
        travel_image_thumb_url: 'https://metravel.by/travel-image/679/conversions/hash-thumb_200.jpg',
      },
      { gallery: [] }
    );

    expect(result).toBe('https://metravel.by/travel-image/679/conversions/hash-detail_hd.jpg');
  });

  it('pickTravelSeoImage falls back to site OG image when only media endpoint root is provided', () => {
    const result = pickTravelSeoImage(
      {
        travel_image_thumb_url: '/travel-image/',
      },
      { gallery: [] }
    );

    expect(result).toBe('https://metravel.by/assets/icons/logo_yellow_512x512.png');
  });
});

describe('travel hero preload helpers', () => {
  it('buildOptimizedTravelImageUrl builds responsive variant for own origin', () => {
    const url = buildOptimizedTravelImageUrl('http://metravel.by/travel-image/123/conversions/pic-thumb_200.jpg', {
      width: 400,
      quality: 35,
      updatedAt: '2025-01-01T00:00:00.000Z',
      id: 123,
    });

    // #1195: family-роут стал `source_passthrough`, поэтому conversion-ключ
    // адресуется transform-роутом. Клиент делает ровно тот же rewrite
    // (`toLegacyResizePath`), паритет закреплён travelHeroPreloadParity.
    expect(url).toContain(
      'https://metravel.by/media-resize/legacy/123/conversions/pic-thumb_200.jpg',
    );
    // #1146: ширина и качество округляются по той же лестнице, что и на клиенте
    // (utils/imageProxy.ts: DIMENSION_LADDER + snapQuality). Иначе preload грел бы
    // `?w=400&q=35`, а `<img>` просил `?w=480&q=40` — тот же файл вторым запросом.
    expect(url).toContain('w=480');
    expect(url).toContain('q=40');
    expect(url).toContain('fit=contain');
    expect(url).toContain('v=1735689600000');
  });

  it('buildTravelHeroPreloadData prefers the first gallery image and matches runtime URL params', () => {
    const preload = buildTravelHeroPreloadData(
      {
        id: 77,
        updated_at: '2025-01-02T00:00:00.000Z',
        travel_image_thumb_url: 'https://metravel.by/travel-image/77/conversions/photo-thumb_200.jpg',
      },
      {
        gallery: [
          {
            id: 991,
            url: 'https://metravel.by/gallery/77/gallery/photo.JPG',
          },
        ],
      }
    );

    expect(preload).toBeTruthy();
    // #1146: значения снэпятся по лестнице прокси, ровно как на клиенте.
    // #1170: ступени 720/960 вернули в лестницу, поэтому 720 → 720 и 960 → 960 —
    // округления вверх больше нет. Клиентская лестница и это зеркало обновлены одним
    // коммитом; расхождение ловит __tests__/utils/imageProxy.ladder.test.ts, а
    // совпадение с клиентом — __tests__/scripts/travelHeroPreloadParity.test.ts.
    // Hero сразу использует канонические q70/q80 из storage-policy.
    expect(preload.mobile.href).toContain('https://metravel.by/gallery/77/gallery/photo.JPG');
    expect(preload.mobile.href).toContain('w=720');
    expect(preload.mobile.href).toContain('q=70');
    expect(preload.mobile.href).toContain('v=991');
    expect(preload.mobile.href).not.toContain('dpr=');
    expect(preload.mobile.srcSet).toContain('w=320');
    expect(preload.mobile.srcSet).toContain('w=640');
    expect(preload.mobile.srcSet).toContain('w=720');
    expect(preload.mobile.srcSet).toContain('q=70');
    expect(preload.mobile.sizes).toBe('100vw');
    expect(preload.desktop.href).toContain('w=1280');
    expect(preload.desktop.href).toContain('q=80');
    expect(preload.desktop.href).not.toContain('dpr=');
    expect(preload.desktop.srcSet).toContain('w=720');
    expect(preload.desktop.srcSet).toContain('w=960');
    expect(preload.desktop.srcSet).toContain('w=1280');
    expect(preload.desktop.srcSet).toContain('q=80');
    expect(preload.desktop.sizes).toBe('(max-width: 1024px) 92vw, 720px');
  });

  // #1116: клиент (`TravelDetailsOptimizedLCPHero` и `sliderParts/buildUriWeb`) начинает с
  // backend-манифеста. Пока SSG строил собственный URL с `v=` и `q=82`, preload грел один
  // файл, а LCP-`<img>` запрашивал другой — hero приезжал дважды по ~92 КБ, и preload не
  // ускорял LCP. Descriptors обязаны совпадать с тем, что реально просит клиент.
  it('buildTravelHeroPreloadData reuses backend manifest variants so preload matches the LCP image', () => {
    const variants = {
      thumb_160: '/gallery/abc.webp?w=160&q=70&fit=cover',
      thumb_320: '/gallery/abc.webp?w=320&q=72&fit=cover',
      card_640: '/gallery/abc.webp?w=640&q=75&fit=cover',
      hero_1280: '/gallery/abc.webp?w=1280&q=80&fit=contain',
      hero_1920: '/gallery/abc.webp?w=1920&q=80&fit=contain',
      original: '/gallery/abc.webp',
    };

    const preload = buildTravelHeroPreloadData(
      { id: 682, updated_at: '2026-07-11T14:19:29.000Z' },
      {
        gallery: [{ id: 5051, url: 'https://metravel.by/gallery/abc.webp', updated_at: '2026-07-11T14:19:29.000Z' }],
        media: { gallery: [{ id: 5051, variants }] },
      }
    );

    // Desktop-слот (1280) манифест закрывает точно — берём канонический вариант.
    expect(preload.desktop.href).toBe('https://metravel.by/gallery/abc.webp?w=1280&q=80&fit=contain');
    // никакого клиентского `v=`/`q=82` поверх канонического manifest-URL
    expect(preload.desktop.href).not.toMatch(/[?&]v=/);
    expect(preload.desktop.href).not.toContain('q=82');
    expect(preload.desktop.srcSet).toContain('w=1280&q=80&fit=contain 1280w');

    // #1146: мобильный слот — 720. Contain-вариантов уже 1280 в манифесте нет, а
    // подставлять cover-варианты 320/640 нельзя: они кадрируют фото иначе, и браузер,
    // выбирая кандидата по DPR, показывал бы разную композицию. Поэтому мобильный hero
    // строится через прокси нужной ширины (210 858 B → 95 182 B на реальной обложке).
    expect(preload.mobile.href).not.toContain('w=1280');
    expect(preload.mobile.href).toContain('w=720');
    expect(preload.mobile.href).toContain('fit=contain');
    expect(preload.mobile.srcSet).not.toContain('fit=cover');
  });

  it('buildTravelHeroPreloadData falls back to the client-side builder without a manifest', () => {
    const preload = buildTravelHeroPreloadData(
      { id: 77 },
      { gallery: [{ id: 991, url: 'https://metravel.by/gallery/77/gallery/photo.JPG' }] }
    );

    expect(preload.desktop.href).toContain('w=1280');
    expect(preload.desktop.href).toContain('q=80'); // #1146: канонический desktop hero profile
    expect(preload.desktop.href).toContain('v=991');
  });

  it('injectTravelHeroPreload inserts and replaces viewport-specific travel preload tags', () => {
    const preload = {
      mobile: {
        href: 'https://metravel.by/travel-image/77/conversions/photo-thumb_200.jpg?w=720&q=35&fit=contain',
        srcSet: 'https://metravel.by/travel-image/77/conversions/photo-thumb_200.jpg?w=320&q=35&fit=contain 320w, https://metravel.by/travel-image/77/conversions/photo-thumb_200.jpg?w=480&q=35&fit=contain 480w, https://metravel.by/travel-image/77/conversions/photo-thumb_200.jpg?w=640&q=35&fit=contain 640w, https://metravel.by/travel-image/77/conversions/photo-thumb_200.jpg?w=720&q=35&fit=contain 720w',
        sizes: '100vw',
      },
      desktop: {
        href: 'https://metravel.by/travel-image/77/conversions/photo-thumb_200.jpg?w=720&q=45&fit=contain',
        srcSet: 'https://metravel.by/travel-image/77/conversions/photo-thumb_200.jpg?w=480&q=45&fit=contain 480w, https://metravel.by/travel-image/77/conversions/photo-thumb_200.jpg?w=720&q=45&fit=contain 720w',
        sizes: '(max-width: 1024px) 92vw, 720px',
      },
    };

    const first = injectTravelHeroPreload(MINIMAL_BASE, preload);
    const second = injectTravelHeroPreload(first, {
      ...preload,
      desktop: {
        ...preload.desktop,
        href: 'https://metravel.by/travel-image/77/conversions/photo-thumb_200.jpg?w=720&q=40&fit=contain',
      },
    });

    const preloadTagCount = (second.match(/data-travel-hero-preload="true"/g) || []).length;
    expect(preloadTagCount).toBe(2);
    expect(second).toContain('rel="preload" as="image"');
    expect(second).toContain('data-hero-variant="mobile"');
    expect(second).toContain('data-hero-variant="desktop"');
    expect(second).toContain('q=40');
    expect(second).toContain('imagesrcset=');
    expect(second).toContain('imagesizes=');
    expect(second).not.toContain('crossorigin="anonymous"');
  });
});

describe('travel SSR SEO helpers', () => {
  it('injectHiddenH1 adds exactly one hidden H1 before the React root', () => {
    const result = injectHiddenH1(MINIMAL_BASE, 'Тропа ведьм')

    expect(result).toMatch(/<h1[^>]*data-ssg-travel-h1="true"[^>]*>Тропа ведьм<\/h1>/)
    expect((result.match(/<h1\b/gi) || []).length).toBe(1)
    expect(result).toContain('position:absolute')
    expect(result).toContain('clip-path:inset(50%)')
    expect(result).toMatch(/<\/head><body><h1[^>]*data-ssg-travel-h1="true"[^>]*>Тропа ведьм<\/h1><div id="root">/)
    expect(result).not.toMatch(/<div id="root"><h1[^>]*data-ssg-travel-h1="true"/)
  })

  it('disableExpoRouterHydration disables React hydration for generated travel pages', () => {
    const base = '<html><body><script type="module">globalThis.__EXPO_ROUTER_HYDRATE__=true;</script><div id="root"></div></body></html>'
    const result = disableExpoRouterHydration(base)

    expect(result).toContain('globalThis.__EXPO_ROUTER_HYDRATE__=false;')
    expect(result).not.toContain('globalThis.__EXPO_ROUTER_HYDRATE__=true;')
    expect(result).toContain('<div id="root"></div>')
  })

  it('buildTravelSeoDescription expands too-short content with contextual fallback', () => {
    const description = buildTravelSeoDescription(
      { name: 'Гришаны', countryName: 'Беларусь' },
      '<p>Короткий анонс.</p>',
    )

    expect(description.length).toBeGreaterThanOrEqual(80)
    expect(description.length).toBeLessThanOrEqual(160)
    expect(description).toContain('Гришаны')
  })

  it('buildTravelArticleJsonLd builds page-level Article schema for travel pages', () => {
    const payload = buildTravelArticleJsonLd({
      title: 'Тропа ведьм | Metravel',
      description: 'Подробный маршрут по Harzer Hexenstieg',
      canonical: 'https://metravel.by/travels/tropa-vedm',
      image: 'https://metravel.by/travel-image/1/conversions/pic-detail_hd.jpg',
      travel: {
        updated_at: '2026-03-05T10:00:00.000Z',
        created_at: '2026-03-01T09:00:00.000Z',
        userName: 'Julia',
      },
    })

    expect(payload['@type']).toBe('Article')
    expect(payload.headline).toBe('Тропа ведьм | Metravel')
    expect(payload.author.name).toBe('Julia')
    // #1221: JSON-LD тоже читают краулеры (в том числе Google Images), поэтому ширина
    // производной обязательна и здесь — «голый» адрес отдаёт мастер с `no-store`.
    expect(payload.image).toEqual([
      'https://metravel.by/travel-image/1/conversions/pic-detail_hd.jpg?w=1280',
    ])
  })

  // The SSG body sanitizer keeps a small tag allowlist and drops every
  // attribute, so the editor's FAQ microdata never reaches the crawler-visible
  // HTML — 291 of 306 published articles shipped FAQ text with no FAQPage at
  // all. These pairs must be recovered from the stored body and emitted as
  // JSON-LD instead.
  describe('FAQ structured data', () => {
    const FAQ_BODY = `
      <p>Вступление автора.</p>
      <section class="seo-faq" data-faq="metravel-seo" itemscope itemtype="https://schema.org/FAQPage">
      <h2>Частые вопросы: Замок</h2>
      <details itemprop="mainEntity" itemscope itemtype="https://schema.org/Question">
      <summary itemprop="name"><strong>Можно ли попасть внутрь?</strong></summary>
      <div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer"><div itemprop="text">
      <p>Пока нет: идёт реставрация, замок осматривают <strong>снаружи</strong>.</p>
      </div></div>
      </details>
      <details itemprop="mainEntity" itemscope itemtype="https://schema.org/Question">
      <summary itemprop="name"><strong>Сколько стоит вход?</strong></summary>
      <div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer"><div itemprop="text">
      <p>Билет&nbsp;— 17&nbsp;злотых, парковка отдельно.</p>
      </div></div>
      </details>
      </section>`

    it('extracts every question and answer, decoding entities and inner tags', () => {
      const entries = extractFaqEntries(FAQ_BODY)

      expect(entries).toHaveLength(2)
      expect(entries[0].question).toBe('Можно ли попасть внутрь?')
      expect(entries[0].answer).toBe('Пока нет: идёт реставрация, замок осматривают снаружи.')
      expect(entries[1].answer).toBe('Билет — 17 злотых, парковка отдельно.')
    })

    it('reads the older markup that has no itemprop attributes', () => {
      const entries = extractFaqEntries(
        '<section class="seo-faq"><details><summary>Как добраться?</summary><p>Автобусом из Новогрудка.</p></details></section>',
      )

      expect(entries).toEqual([{ question: 'Как добраться?', answer: 'Автобусом из Новогрудка.' }])
    })

    it('ignores a <details> that is not part of an FAQ block', () => {
      expect(extractFaqEntries('<details><summary>Спойлер</summary><p>Просто текст</p></details>')).toEqual([])
    })

    it('skips entries with an empty question or answer', () => {
      const entries = extractFaqEntries(
        '<section class="seo-faq"><details><summary>Вопрос?</summary></details>' +
          '<details><summary>   </summary><p>Ответ</p></details></section>',
      )

      expect(entries).toEqual([])
    })

    it('builds FAQPage JSON-LD from the recovered pairs', () => {
      const payload = buildTravelFaqJsonLd(FAQ_BODY)

      expect(payload['@context']).toBe('https://schema.org')
      expect(payload['@type']).toBe('FAQPage')
      expect(payload.mainEntity).toHaveLength(2)
      expect(payload.mainEntity[0]).toEqual({
        '@type': 'Question',
        name: 'Можно ли попасть внутрь?',
        acceptedAnswer: { '@type': 'Answer', text: 'Пока нет: идёт реставрация, замок осматривают снаружи.' },
      })
    })

    it('emits nothing for a body without an FAQ so no empty FAQPage ships', () => {
      expect(buildTravelFaqJsonLd('<p>Обычная статья без FAQ.</p>')).toBeNull()
      expect(buildTravelFaqJsonLd('')).toBeNull()
      expect(buildTravelFaqJsonLd(null)).toBeNull()
    })

    it('injects the FAQ payload under its own marker, next to the Article one', () => {
      const withArticle = injectJsonLd(MINIMAL_BASE, { '@context': 'https://schema.org', '@type': 'Article' }, 'travel-article')
      const withFaq = injectJsonLd(withArticle, buildTravelFaqJsonLd(FAQ_BODY), 'travel-faq')

      expect(withFaq).toContain('data-seo-jsonld="travel-article"')
      expect(withFaq).toContain('data-seo-jsonld="travel-faq"')
      expect(withFaq).toContain('"@type":"FAQPage"')
    })

    it('leaves the page untouched when there is no FAQ payload to inject', () => {
      const withArticle = injectJsonLd(MINIMAL_BASE, { '@context': 'https://schema.org', '@type': 'Article' }, 'travel-article')

      expect(injectJsonLd(withArticle, buildTravelFaqJsonLd('<p>Нет FAQ.</p>'), 'travel-faq')).toBe(withArticle)
    })
  })

  it('injectJsonLd inserts a marked JSON-LD block and replaces it on the next pass', () => {
    const first = injectJsonLd(MINIMAL_BASE, { '@context': 'https://schema.org', '@type': 'Article', headline: 'One' }, 'travel-article')
    const second = injectJsonLd(first, { '@context': 'https://schema.org', '@type': 'Article', headline: 'Two' }, 'travel-article')

    expect((second.match(/data-seo-jsonld="travel-article"/g) || []).length).toBe(1)
    expect(second).toContain('"headline":"Two"')
    expect(second).not.toContain('"headline":"One"')
  })

  it('matches nearby quests from travel coordinates and injects a crawlable travel promo', () => {
    const catalog = buildQuestPromoCatalog(
      [
        {
          quest_id: 'krakow-dragon',
          city_id: '1',
          title: 'Тайна Краковского дракона',
          city_name: 'Краков',
          cover_url: '/media/quests/krakow/cover.png',
          points: 9,
          duration_min: 120,
        },
      ],
      new Map([
        [
          'krakow-dragon',
          {
            city: { id: 1, name: 'Краков', lat: 50.0614, lng: 19.9366, country_code: 'pl' },
            steps: [{ location: 'Rynek Główny' }],
          },
        ],
      ]),
    )

    const matches = findTravelQuestPromoMatches(
      {
        name: 'Краков на выходные',
        countryName: 'Польша',
        countryCode: 'pl',
        travelAddress: [{ coord: '50.0615,19.9370' }],
      },
      catalog,
      6,
    )
    const first = injectTravelQuestPromoSection(MINIMAL_BASE, matches)
    const second = injectTravelQuestPromoSection(first, matches)

    expect(matches).toHaveLength(1)
    expect(matches[0].quest.route.path).toBe('/quests/1/krakow-dragon')
    expect((second.match(/<section[^>]*data-ssg-travel-quest-promo="true"/g) || []).length).toBe(1)
    expect((second.match(/<style[^>]*data-ssg-travel-quest-promo-style="true"/g) || []).length).toBe(1)
    expect(second).toContain('Квест по этому городу')
    expect(second).toContain('href="/quests/1/krakow-dragon"')
    expect(second).toContain('Тайна Краковского дракона')
    // #1115: обложка обязана уйти в SSG уменьшенным вариантом. Раньше в
    // `background-image` подставлялся голый URL, и плитка 88×88 качала оригинал ДО
    // гидратации — шесть обложек рельса весили 216 КБ – 3 003 КБ (замер прода
    // 2026-07-28), клиентский фикс `QuestForCityCard` их уже не догонял.
    // 320 — проверенная ступень прокси: 372 218 B → 12 376 B.
    // `&` внутри inline-style экранируется через escapeAttr — браузер декодирует его при
    // разборе атрибута, так что запрос уходит с реальными w/q/fit.
    expect(second).toContain(
      "background-image:url('https://metravel.by/media/quests/krakow/cover.png?w=320&amp;q=70&amp;fit=cover')",
    )
    expect(second).not.toContain("url('https://metravel.by/media/quests/krakow/cover.png')")
    expect(second).toContain('9 точек')
    expect(second).toContain('примерно 2 ч')
    expect(second).toContain('html.rnw-styles-ready [data-ssg-travel-quest-promo="true"]')
  })

  it('does not inject a travel quest promo when no city or nearby match exists', () => {
    const catalog = buildQuestPromoCatalog(
      [{ quest_id: 'krakow-dragon', city_id: '1', title: 'Квест', city_name: 'Краков' }],
      new Map([['krakow-dragon', { city: { id: 1, name: 'Краков', lat: 50.0614, lng: 19.9366, country_code: 'pl' } }]]),
    )
    const matches = findTravelQuestPromoMatches(
      { countryName: 'Франция', countryCode: 'fr', travelAddress: [{ coord: '48.8582,2.2945' }] },
      catalog,
    )
    const html = injectTravelQuestPromoSection(MINIMAL_BASE, matches)

    expect(matches).toHaveLength(0)
    expect(html).not.toContain('data-ssg-travel-quest-promo="true"')
    expect(html).not.toContain('/quests/1/krakow-dragon')
  })

  it('injectQuestIntroSection adds crawlable visible quest intro and replaces it on repeat', () => {
    const quest = {
      title: 'Краковский дракон',
      city_name: 'Краков',
      points: '7',
      duration_min: 90,
    }
    const bundle = {
      intro: JSON.stringify({
        location: 'Вавельский холм',
        story: 'Первая часть существующего вступления.\n\nВторая часть существующего вступления.',
      }),
      steps: JSON.stringify([{ location: 'Вавельский холм' }]),
    }

    const first = injectQuestIntroSection(MINIMAL_BASE, {
      title: quest.title,
      description: 'Пеший квест по Кракову с легендами и заданиями.',
      quest,
      bundle,
    })
    const second = injectQuestIntroSection(first, {
      title: quest.title,
      description: 'Обновлённое описание квеста.',
      quest,
      bundle,
    })

    expect((second.match(/<section[^>]*data-ssg-quest-intro="true"/g) || []).length).toBe(1)
    expect((second.match(/<style[^>]*data-ssg-quest-intro-style="true"/g) || []).length).toBe(1)
    expect(second).toContain('<h1 style=')
    expect(second).toContain('Краковский дракон')
    expect(second).toContain('Город: Краков')
    expect(second).toContain('Маршрут: 7 точек')
    expect(second).toContain('Время: примерно 1 ч 30 мин')
    expect(second).toContain('Старт: Вавельский холм')
    expect(second).toContain('Первая часть существующего вступления.')
    expect(second).toContain('Вторая часть существующего вступления.')
    expect(second).toContain('Обновлённое описание квеста.')
    expect(second).not.toContain('Пеший квест по Кракову с легендами и заданиями.')
    expect(second).toContain('html.rnw-styles-ready [data-ssg-quest-intro="true"]')
    expect(second).toContain("'Segoe UI'")
    expect(second).not.toContain('system-ui,-apple-system,"Segoe UI"')
  })
})

describe('injectQuestLinksIndex', () => {
  it('keeps crawlable quest links out of the accessibility and keyboard trees', () => {
    const html = injectQuestLinksIndex(MINIMAL_BASE, [
      { quest_id: 'krakow-dragon', city_id: '1', title: 'Краковский дракон' },
      { quest_id: 'minsk-old-town', city_id: '2', title: 'Старый Минск' },
    ])

    expect(html).toContain('data-ssg-quest-index="true"')
    expect(html).toContain('aria-hidden="true" inert')
    expect(html).toContain('href="/quests/1/krakow-dragon" tabindex="-1"')
    expect(html).toContain('href="/quests/2/minsk-old-town" tabindex="-1"')
    expect(html).not.toContain('aria-label="Все квесты"')
  })
})

describe('injectHomeQuestsSection', () => {
  const QUESTS = [
    { quest_id: 'krakow-dragon', city_id: '1', title: 'Краковский дракон', city_name: 'Краков' },
    { quest_id: 'minsk-old-town', city_id: '2', title: 'Старый Минск', city_name: 'Минск' },
  ]

  it('renders a visible, headed quests section present in static HTML', () => {
    const html = injectHomeQuestsSection(MINIMAL_BASE, QUESTS)

    expect(html).toContain('data-ssg-home-quests="true"')
    // A crawlable <section>, not the hidden aria-hidden/inert nav.
    expect(html).not.toMatch(/data-ssg-home-quests="true"[^>]*aria-hidden/i)
    expect(html).toMatch(/<section[^>]*data-ssg-home-quests="true"/i)
    expect(html).toContain('Городские квесты')
    // Featured quests link out with a city-qualified label.
    expect(html).toContain('href="/quests/1/krakow-dragon"')
    expect(html).toContain('Краковский дракон — Краков')
    // CTAs into the catalog and the DIY gift scenario.
    expect(html).toContain('href="/quests/scenario"')
    expect(html).toContain('href="/quests">Все городские квесты')
    // ItemList JSON-LD for the featured set.
    expect(html).toContain('"@type":"ItemList"')
  })

  it('adds an h2 rather than a second h1 (home already ships one h1)', () => {
    const html = injectHomeQuestsSection(MINIMAL_BASE, QUESTS)
    expect((html.match(/<h1/g) || []).length).toBe(0)
    expect(html).toMatch(/<h2[^>]*>Городские квесты<\/h2>/i)
  })

  it('hides the block once RNW styles are ready, like the sibling quest blocks', () => {
    const html = injectHomeQuestsSection(MINIMAL_BASE, QUESTS)
    expect(html).toContain('html.rnw-styles-ready [data-ssg-home-quests="true"]{display:none!important}')
  })

  it('is idempotent — re-running replaces rather than duplicates', () => {
    const once = injectHomeQuestsSection(MINIMAL_BASE, QUESTS)
    const twice = injectHomeQuestsSection(once, QUESTS)
    expect((twice.match(/<section data-ssg-home-quests="true"/g) || []).length).toBe(1)
    expect((twice.match(/data-ssg-home-quests-style="true"/g) || []).length).toBe(1)
    expect((twice.match(/home-quests-itemlist/g) || []).length).toBe(1)
  })

  it('leaves HTML untouched when no routable quests exist', () => {
    expect(injectHomeQuestsSection(MINIMAL_BASE, [])).toBe(MINIMAL_BASE)
    expect(injectHomeQuestsSection(MINIMAL_BASE, [{ title: 'no route' }])).toBe(MINIMAL_BASE)
  })
})

describe('injectQuestScenarioContent', () => {
  const CITIES = [
    { cityId: '1', name: 'Минск', landingPath: '/quests/minsk', quests: [] },
    { cityId: '2', name: 'Краков', landingPath: '/quests/krakow', quests: [] },
  ]

  // The section used to render its own <h1>. Unlike quest details, this route
  // ships a prerendered #root that already carries the screen's H1, so the page
  // shipped two of them (audit 2026-08-08). The pre-hydration title is a <div>.
  it('renders the crawlable DIY body without adding an h1, and links into the catalog', () => {
    const html = injectQuestScenarioContent(MINIMAL_BASE, CITIES)

    expect(html).toContain('data-ssg-quest-scenario="true"')
    expect((html.match(/<h1/g) || []).length).toBe(0)
    expect(html).toContain('data-ssg-scenario-title="true"')
    expect(html).toContain('Готовый сценарий квеста по городу')
    expect(html).toContain('href="/quests"')
    expect(html).toContain('href="/quests/minsk"')
    expect(html).toContain('href="/quests/krakow"')
    // HowTo anchors must resolve against the step ids in the body.
    expect(html).toContain('id="step-1"')
  })

  it('does not add a second h1 to a page that already has one', () => {
    const withRootH1 = MINIMAL_BASE.replace(
      '<div id="root">',
      '<div id="root"><h1>Готовый сценарий квеста по городу — бесплатно распечатать</h1>',
    )
    const html = injectQuestScenarioContent(withRootH1, CITIES)

    expect((html.match(/<h1/g) || []).length).toBe(1)
  })

  it('is idempotent — a rerun does not stack sections or styles', () => {
    const once = injectQuestScenarioContent(MINIMAL_BASE, CITIES)
    const twice = injectQuestScenarioContent(once, CITIES)

    expect((twice.match(/data-ssg-quest-scenario="true"/g) || []).length).toBe(
      (once.match(/data-ssg-quest-scenario="true"/g) || []).length,
    )
    // The marker appears twice by design — once on the title <div>, once in the
    // mobile CSS rule that targets it. Count the element, not the string.
    expect((twice.match(/<div data-ssg-scenario-title="true"/g) || []).length).toBe(1)
    expect((twice.match(/<h1/g) || []).length).toBe(0)
  })

  it('still renders without cities (empty API payload)', () => {
    const html = injectQuestScenarioContent(MINIMAL_BASE, [])

    expect(html).toContain('data-ssg-quest-scenario="true"')
    expect(html).not.toContain('Города с готовыми сценариями')
    expect(html).toContain('href="/quests"')
  })

  it('dedupes cities sharing a name and caps the list', () => {
    const dupes = [
      { cityId: '1', name: 'Гомель', landingPath: '/quests/gomel', quests: [{}, {}] },
      { cityId: '9', name: 'Гомель', landingPath: '/quests/9', quests: [{}] },
    ]
    const html = injectQuestScenarioContent(MINIMAL_BASE, dupes)

    expect((html.match(/>Гомель</g) || []).length).toBe(1)
    expect(html).toContain('href="/quests/gomel"')
    expect(html).not.toContain('href="/quests/9"')
  })

  it('caps the city list so the landing does not mirror the whole catalog', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      cityId: String(i),
      name: `Город${i}`,
      landingPath: `/quests/city-${i}`,
      quests: [{}],
    }))
    const html = injectQuestScenarioContent(MINIMAL_BASE, many)

    expect((html.match(/href="\/quests\/city-/g) || []).length).toBe(12)
  })

  it('builds FAQPage and HowTo JSON-LD that match the visible copy', () => {
    const faq = buildQuestScenarioFaqJsonLd()
    const howTo = buildQuestScenarioHowToJsonLd()
    const html = injectQuestScenarioContent(MINIMAL_BASE, CITIES)

    expect(faq['@type']).toBe('FAQPage')
    expect(faq.mainEntity.length).toBeGreaterThan(0)
    for (const entry of faq.mainEntity) {
      expect(html).toContain(escapeAttr(entry.name))
    }

    expect(howTo['@type']).toBe('HowTo')
    expect(howTo.url).toBe('https://metravel.by/quests/scenario')
    expect(howTo.step.map((s: { position: number }) => s.position)).toEqual([1, 2, 3, 4])
    expect(howTo.step[0].url).toBe('https://metravel.by/quests/scenario#step-1')
  })
})

// ---------------------------------------------------------------------------
// Fallback template canonical stripping (regression: [param].html had homepage canonical)
// ---------------------------------------------------------------------------
describe('fallback template canonical stripping', () => {
  it('replaceOrInsert removes all existing canonical tags before inserting new one', () => {
    // Simulate [param].html that has canonical = https://metravel.by/ (homepage)
    const paramHtml = [
      '<!DOCTYPE html><html lang="ru"><head>',
      '<title data-rh="true">MeTravel</title>',
      '<link data-rh="true" rel="canonical" href="https://metravel.by/"/>',
      '</head><body><div id="root"></div></body></html>',
    ].join('');

    // Stripping canonical (as done in the fallback template patch step)
    const stripped = paramHtml.replace(/<link[^>]*rel="canonical"[^>]*\/?>\n?/gi, '');
    expect(stripped).not.toMatch(/rel="canonical"/);
    expect(stripped).not.toContain('https://metravel.by/');
  });

  it('injectMeta on a [param].html with homepage canonical produces correct travel canonical', () => {
    const paramHtml = [
      '<!DOCTYPE html><html lang="ru"><head>',
      '<title data-rh="true">MeTravel</title>',
      '<link data-rh="true" rel="canonical" href="https://metravel.by/"/>',
      '</head><body><div id="root"></div></body></html>',
    ].join('');

    const result = injectMeta(paramHtml, {
      title: 'Литва Швеция Норвегия | MeTravel',
      description: 'Маршрут по Европе',
      canonical: 'https://metravel.by/travels/litva-shveciya-norvegiya-daniya-germaniya-polsha',
    });

    // Must have exactly one canonical pointing to the travel URL, not the homepage
    const canonicalMatches = result.match(/<link[^>]*rel="canonical"[^>]*/gi) || [];
    expect(canonicalMatches).toHaveLength(1);
    expect(result).toContain('href="https://metravel.by/travels/litva-shveciya-norvegiya-daniya-germaniya-polsha"');
    expect(result).not.toMatch(/href="https:\/\/metravel\.by\/"/);
  });
});

describe('static noindex route coverage', () => {
  it('keeps private and auth-like static routes in SEO generator with noindex', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'scripts/generate-seo-pages.js'),
      'utf8',
    );

    expect(source).toContain("route: '/accountconfirmation'");
    expect(source).toContain("route: '/articles'");
    expect(source).toMatch(/route: '\/articles'[\s\S]*?robots: 'noindex, nofollow'/);
    // `/article` has no screen of its own; without an entry nginx served the
    // home page there, canonical included.
    expect(source).toContain("route: '/article',");
    expect(source).toMatch(/route: '\/article',[\s\S]*?robots: 'noindex, nofollow'/);
    // `/places` is a filterable catalog with no crawlable body and no per-place
    // URLs — it must not sit open to indexing while empty.
    expect(source).toContain("route: '/places',");
    expect(source).toMatch(/route: '\/places',[\s\S]*?robots: 'noindex, follow'/);
    expect(source).toContain("route: '/set-password'");
    expect(source).toContain("route: '/messages'");
    expect(source).toContain("route: '/export'");
    expect(source).toContain("route: '/metravel'");
    expect(source).toContain("route: '/profile'");
    expect(source).toContain("route: '/settings'");
    expect(source).toContain("route: '/subscriptions'");
    expect(source).toContain("route: '/quests/map'");
    expect(source).toContain("robots: 'noindex, nofollow'");
  });
});

// /quests/scenario shipped a 68-char title and a 165-char description — the only
// two static pages out of the SERP budget when the 2026-08-08 audit measured prod.
describe('static page meta budgets', () => {
  const { STATIC_PAGES } = require('@/scripts/generate-seo-pages')
  const { SEO_TITLE_MAX_LENGTH } = require('@/utils/seoText')

  it('keeps every static page title within the SERP budget', () => {
    const tooLong = STATIC_PAGES.filter(
      (page: { route: string; title: string }) => page.title.length > SEO_TITLE_MAX_LENGTH,
    ).map((page: { route: string; title: string }) => `${page.route} (${page.title.length})`)

    expect(tooLong).toEqual([])
  })

  it('keeps every static page description within 160 chars', () => {
    const tooLong = STATIC_PAGES.filter(
      (page: { route: string; description: string }) => page.description.length > 160,
    ).map((page: { route: string; description: string }) => `${page.route} (${page.description.length})`)

    expect(tooLong).toEqual([])
  })
})

// `#root` is empty in the static export, so a runtime <h1> never reaches raw HTML.
// Audit 2026-08-08 found `/` and `/map` shipping zero H1 while every travel and
// quest page had exactly one.
describe('static landing H1 coverage', () => {
  const source = require('fs').readFileSync(
    require('path').resolve(process.cwd(), 'scripts/generate-seo-pages.js'),
    'utf8',
  );

  it('declares an H1 for the home and map landings', () => {
    expect(source).toMatch(/route: '\/',[\s\S]{0,900}?h1: '[^']+'/);
    expect(source).toMatch(/route: '\/map',[\s\S]{0,600}?h1: '[^']+'/);
  });

  it('injects the declared H1 into the generated page', () => {
    expect(source).toMatch(/if \(page\.h1\) \{\s*html = injectHiddenH1\(html, page\.h1\);/);
  });

  it('produces exactly one H1 for a landing that declares one', () => {
    const result = injectHiddenH1(MINIMAL_BASE, 'Карта маршрутов и достопримечательностей Беларуси');
    expect((result.match(/<h1\b/gi) || []).length).toBe(1);
    expect(result).toContain('Карта маршрутов и достопримечательностей Беларуси');
    // Out of flow and before #root — hydration must not see it inside the tree.
    expect(result.indexOf('<h1')).toBeLessThan(result.indexOf('id="root"'));
  });
});

// ---------------------------------------------------------------------------
// Full SEO tag count contract (the exact regression that was fixed)
// ---------------------------------------------------------------------------
describe('SEO tag count contract (regression guard)', () => {
  const REQUIRED_TAGS = [
    { name: 'title', pattern: /<title[^>]*>[^<]+<\/title>/i },
    { name: 'meta description', pattern: /<meta[^>]*name="description"[^>]*content="[^"]+"/i },
    { name: 'canonical', pattern: /<link[^>]*rel="canonical"[^>]*href="[^"]+"/i },
    { name: 'og:type', pattern: /<meta[^>]*property="og:type"[^>]*content="[^"]+"/i },
    { name: 'og:title', pattern: /<meta[^>]*property="og:title"[^>]*content="[^"]+"/i },
    { name: 'og:description', pattern: /<meta[^>]*property="og:description"[^>]*content="[^"]+"/i },
    { name: 'og:url', pattern: /<meta[^>]*property="og:url"[^>]*content="[^"]+"/i },
    { name: 'og:image', pattern: /<meta[^>]*property="og:image"[^>]*content="[^"]+"/i },
    { name: 'og:site_name', pattern: /<meta[^>]*property="og:site_name"[^>]*content="[^"]+"/i },
    { name: 'twitter:card', pattern: /<meta[^>]*name="twitter:card"[^>]*content="[^"]+"/i },
    { name: 'twitter:title', pattern: /<meta[^>]*name="twitter:title"[^>]*content="[^"]+"/i },
    { name: 'twitter:description', pattern: /<meta[^>]*name="twitter:description"[^>]*content="[^"]+"/i },
    { name: 'twitter:image', pattern: /<meta[^>]*name="twitter:image"[^>]*content="[^"]+"/i },
  ];

  it.each(REQUIRED_TAGS)(
    'travel page HTML contains $name after injectMeta (even when base has no OG tags)',
    ({ pattern }) => {
      const result = injectMeta(MINIMAL_BASE, SAMPLE_META);
      expect(result).toMatch(pattern);
    },
  );

  it('all 13 required SEO tags are present in a single pass', () => {
    const result = injectMeta(MINIMAL_BASE, SAMPLE_META);
    const missing = REQUIRED_TAGS.filter(({ pattern }) => !pattern.test(result));
    expect(missing.map((t) => t.name)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildSeoTitle — SERP <title> must stay <= 60 chars and clip on a word
// boundary (FE-4). A mid-word clip like "…Нитосл…" reads as broken in search.
// ---------------------------------------------------------------------------
describe('buildSeoTitle', () => {
  const SUFFIX = ' | Metravel';

  it('appends the brand suffix to a short title untouched', () => {
    expect(buildSeoTitle('Албания. Влёра')).toBe(`Албания. Влёра${SUFFIX}`);
  });

  it('returns the bare brand for an empty title', () => {
    expect(buildSeoTitle('')).toBe('Metravel');
    expect(buildSeoTitle(null)).toBe('Metravel');
  });

  it('keeps the full title at the 60-char boundary without clipping', () => {
    // 49 visible chars + 11 suffix = 60 exactly.
    const name = 'a'.repeat(49);
    const out = buildSeoTitle(name);
    expect(out).toBe(`${name}${SUFFIX}`);
    expect(out.length).toBe(60);
    expect(out).not.toContain('…');
  });

  // Бренд-суффикс не участвует в ранжировании, ключевые слова — участвуют.
  // Поэтому при нехватке бюджета отбрасывается он, а не хвост заголовка.
  it('drops the brand suffix instead of clipping a title that fits in 60 chars', () => {
    const name = 'Смолевуд: натурная площадка Беларусьфильма под Минском'; // 53 chars
    const out = buildSeoTitle(name);
    expect(out).toBe(name);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out).not.toContain('…');
    expect(out).not.toContain(SUFFIX);
  });

  it('clips an over-long title to <= 60 chars without the suffix', () => {
    const name = 'Маршрут на 1 день: экотропа Ельня и усадьбы Нитославичи и Бенюличи';
    const out = buildSeoTitle(name);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toContain(SUFFIX);
  });

  it('clips on a word boundary, not mid-word', () => {
    const name = 'Маршрут на 1 день: экотропа Ельня и усадьбы Нитославичи и Бенюличи';
    const out = buildSeoTitle(name);
    expect(out.endsWith('…')).toBe(true);
    const beforeEllipsis = out.slice(0, -1);
    // The clipped stem is a prefix of the source words — no half-word fragment.
    expect(name.startsWith(beforeEllipsis)).toBe(true);
    expect(beforeEllipsis.endsWith(' ')).toBe(false);
    // The kept text ends at a real word from the source.
    const lastWord = beforeEllipsis.split(' ').pop();
    expect(name.split(' ')).toContain(lastWord);
  });

  it('strips trailing punctuation before the ellipsis', () => {
    const name = 'Что посмотреть в Ошмянах: Костел францисканцев, ратуша и старый центр';
    const out = buildSeoTitle(name);
    expect(out).not.toMatch(/[\s.,;:!?–—-]…$/u);
  });

  it('hard-clips when the leading word alone exceeds the budget', () => {
    const name = `${'a'.repeat(80)} bcd`;
    const out = buildSeoTitle(name);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith('…')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Slug redirects (static noindex redirect stubs)
// ---------------------------------------------------------------------------
describe('slug redirects', () => {
  describe('normalizeSlug', () => {
    it('strips leading slash, travels/ prefix and trailing slash', () => {
      expect(normalizeSlug('/travels/foo-bar/')).toBe('foo-bar');
      expect(normalizeSlug('  baz  ')).toBe('baz');
      expect(normalizeSlug(undefined)).toBe('');
    });
  });

  describe('buildRedirectStubHtml', () => {
    const html = buildRedirectStubHtml('new-slug');
    it('points canonical, meta refresh and JS at the new absolute URL', () => {
      expect(html).toContain('<link rel="canonical" href="https://metravel.by/travels/new-slug"/>');
      expect(html).toContain('content="0; url=https://metravel.by/travels/new-slug"');
      expect(html).toContain('location.replace("https://metravel.by/travels/new-slug")');
    });
    it('noindexes the old URL while keeping links followable', () => {
      expect(html).toContain('<meta name="robots" content="noindex, follow"/>');
    });
    it('normalizes a slug passed with prefix/slashes', () => {
      expect(buildRedirectStubHtml('/travels/x/')).toContain('/travels/x"');
    });
  });

  describe('loadRedirectManifest', () => {
    let dir: string;
    beforeAll(() => {
      dir = makeTempDir('seo-redir-');
    });
    const write = (name: string, data: unknown) => {
      const p = path.join(dir, name);
      fs.writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data), 'utf8');
      return p;
    };

    it('returns [] for a missing file', () => {
      expect(loadRedirectManifest(path.join(dir, 'nope.json'))).toEqual([]);
    });
    it('returns [] and warns on invalid JSON', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      expect(loadRedirectManifest(write('bad.json', '{not json'))).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not parse redirect manifest'));
      warnSpy.mockRestore();
    });
    it('reads the { redirects: [...] } shape and normalizes slugs', () => {
      const p = write('ok.json', { redirects: [{ from: '/travels/old/', to: 'new' }] });
      expect(loadRedirectManifest(p)).toEqual([{ from: 'old', to: 'new' }]);
    });
    it('drops self-referential, empty and duplicate `from` entries', () => {
      const p = write('dirty.json', {
        redirects: [
          { from: 'a', to: 'a' },
          { from: '', to: 'b' },
          { from: 'c', to: '' },
          { from: 'd', to: 'd2' },
          { from: 'd', to: 'd3' },
        ],
      });
      expect(loadRedirectManifest(p)).toEqual([{ from: 'd', to: 'd2' }]);
    });
    it('accepts a bare-array manifest too', () => {
      const p = write('arr.json', [{ from: 'x', to: 'y' }]);
      expect(loadRedirectManifest(p)).toEqual([{ from: 'x', to: 'y' }]);
    });
  });

  // #1186: манифест разросся до нескольких десятков пар, и цена ошибки в нём
  // высокая — stub кладётся по пути `dist/prod/travels/{from}.html`, поэтому
  // живой slug в поле `from` затрёт настоящую страницу статьи.
  describe('shipped manifest scripts/seo-redirects.json', () => {
    const shipped = loadRedirectManifest(
      path.resolve(process.cwd(), 'scripts/seo-redirects.json'),
    ) as { from: string; to: string }[];

    it('is non-empty and survives the loader unchanged', () => {
      const raw = JSON.parse(
        fs.readFileSync(path.resolve(process.cwd(), 'scripts/seo-redirects.json'), 'utf8'),
      );
      expect(shipped.length).toBeGreaterThan(0);
      // Loader молча выбрасывает мусорные записи — расхождение означает, что в
      // файле есть пара, которая никогда не станет stub-страницей.
      expect(shipped.length).toBe(raw.redirects.length);
    });

    it('holds bare slugs only', () => {
      for (const { from, to } of shipped) {
        expect(from).toMatch(/^[a-z0-9][a-z0-9-]*$/);
        expect(to).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      }
    });

    it('never redirects a slug onto itself and never chains', () => {
      const sources = new Set(shipped.map((r) => r.from));
      expect(sources.size).toBe(shipped.length);
      for (const { from, to } of shipped) {
        expect(to).not.toBe(from);
        // `to` в роли `from` дал бы редирект на редирект: пользователь и краулер
        // прошли бы два прыжка, а канонический адрес размылся бы.
        expect(sources.has(to)).toBe(false);
      }
    });
  });
});

describe('patchNoindexFallbackTemplate', () => {
  it('removes literal template canonical and adds noindex fallback meta', () => {
    const html = patchNoindexFallbackTemplate(
      [
        '<html><head>',
        '<title data-rh="true">Путешествие | Metravel</title>',
        '<meta data-rh="true" name="description" content="Найди место для путешествия и поделись своим опытом."/>',
        '<link data-rh="true" rel="canonical" href="https://metravel.by/quests/[city]/[questId]"/>',
        '</head><body><div id="root"></div></body></html>',
      ].join(''),
      {
        title: 'Квест не найден | Metravel',
        description: 'Этот квест не найден или больше недоступен.',
      },
    );

    expect(html).toContain('<title data-rh="true">Квест не найден | Metravel</title>');
    expect(html).toContain('content="Этот квест не найден или больше недоступен."');
    expect(html).toContain('<meta data-rh="true" name="robots" content="noindex, follow"/>');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('[city]');
    expect(html).not.toContain('[questId]');
  });

  it('deduplicates existing robots meta', () => {
    const html = patchNoindexFallbackTemplate(
      '<html><head><meta name="robots" content="index, follow"/><meta name="robots" content="noindex"/></head></html>',
    );

    expect((html.match(/name="robots"/g) || []).length).toBe(1);
    expect(html).toContain('content="noindex, follow"');
  });
});

describe('quests listing location headings', () => {
  const quests = [
    { quest_id: 'gomel-palace', city_id: '19', city_name: 'Гомель', title: 'Дворец' },
    { quest_id: 'gomel-river', city_id: '92', city_name: 'Гомель', title: 'Набережная' },
    { quest_id: 'grodno-castle', city_id: '11', city_name: 'Гродно', title: 'Замок' },
    { quest_id: 'grodno-center', city_id: '91', city_name: 'Гродно', title: 'Центр' },
    { quest_id: 'mogilev-stars', city_id: '14', city_name: 'Могилёв', title: 'Звёзды' },
    { quest_id: 'mogilev-square', city_id: '93', city_name: 'Могилёв', title: 'Площадь' },
    {
      quest_id: 'yelnya-bog',
      city_id: '201',
      city_name: 'болото Ельня (Миорский район)',
      title: 'Тропа по Ельне',
    },
  ];

  it('merges duplicate backend city ids behind one canonical catalog group', () => {
    const model = buildQuestsListingModel(quests);

    expect(model.map((city: { name: string }) => city.name)).toEqual([
      'болото Ельня (Миорский район)',
      'Гомель',
      'Гродно',
      'Могилёв',
    ]);
    expect(model.find((city: { name: string }) => city.name === 'Гомель')).toMatchObject({
      landingPath: '/quests/gomel',
      quests: expect.arrayContaining([
        expect.objectContaining({ path: '/quests/19/gomel-palace' }),
        expect.objectContaining({ path: '/quests/92/gomel-river' }),
      ]),
    });
  });

  it('renders one neutral heading per city or non-city location', () => {
    const html = injectQuestsListingContent(MINIMAL_BASE, quests);
    const headings = [...html.matchAll(/<h2[^>]*>(Квесты: [^<]+)<\/h2>/g)].map((match) => match[1]);

    expect(headings).toEqual([
      'Квесты: болото Ельня (Миорский район)',
      'Квесты: Гомель',
      'Квесты: Гродно',
      'Квесты: Могилёв',
    ]);
    expect(new Set(headings).size).toBe(headings.length);
    expect(html).not.toContain('Квесты в городе');
    expect(html).toContain('Все квесты: болото Ельня (Миорский район)');
  });
});

describe('one-quest city landing value', () => {
  it('builds independent SSG sections, city links, travel links and self metadata from catalogs', () => {
    const quests = [
      {
        quest_id: 'rome-forum',
        city_id: '121',
        city_name: 'Рим',
        country_name: 'Италия',
        country_code: 'it',
        title: 'Квест по Риму: Форум',
        points: 8,
        duration_min: 120,
        lat: 41.89,
        lng: 12.49,
      },
      {
        quest_id: 'naples-castles',
        city_id: '122',
        city_name: 'Неаполь',
        country_name: 'Италия',
        country_code: 'it',
        title: 'Квест по Неаполю',
        lat: 40.85,
        lng: 14.27,
      },
    ]
    const travels = [
      {
        slug: 'rim-na-vyhodnye',
        name: 'Рим на выходные',
        cityName: 'Рим',
        countryName: 'Италия',
        countryCode: 'it',
      },
    ]
    const rome = buildQuestCityLandingModel(quests, undefined, travels).find(
      (city: { segment: string }) => city.segment === 'rome',
    )

    expect(rome.quests).toHaveLength(1)
    expect(rome.nearbyCities.map((city: { segment: string }) => city.segment)).toEqual(['naples'])
    expect(rome.travelLinks).toEqual([
      expect.objectContaining({ path: '/travels/rim-na-vyhodnye', title: 'Рим на выходные' }),
    ])

    const html = buildQuestCityLandingHtml(MINIMAL_BASE, rome)
    const cityDescription = html.match(
      /<meta[^>]*name="description"[^>]*content="([^"]*)"/i,
    )?.[1]
    expect(html).toContain('data-ssg-quest-city="true"')
    expect(html).toContain('data-ssg-quest-city-overview="true"')
    expect(html).toContain('data-ssg-quest-city-practical="true"')
    expect(html).toContain('data-ssg-quest-city-nearby="true"')
    expect(html).toContain('data-ssg-quest-city-travels="true"')
    expect(html).toContain('href="/quests/naples"')
    expect(html).toContain('href="/travels/rim-na-vyhodnye"')
    expect(html).toContain(
      '<link data-rh="true" rel="canonical" href="https://metravel.by/quests/rome"/>',
    )
    expect(html).toContain('<title data-rh="true">Городские квесты: Рим — прогулки с заданиями | Metravel</title>')
    expect(cityDescription).toContain('Рим: что посмотреть на прогулке')
    expect(cityDescription).not.toBe(buildQuestSeoDescription(quests[0]))
    expect(html).toContain('Страна маршрута — Италия')
    expect(html).not.toContain('в Италия')
  })
})

describe('catalog-derived quest country landings', () => {
  const quests = [
    {
      quest_id: 'minsk-center',
      city_id: '4',
      city_name: 'Минск',
      country_code: 'by',
      country_name: 'Беларусь',
      title: 'Минский центр',
      points: 8,
      duration_min: 90,
    },
    {
      quest_id: 'gomel-park',
      city_id: '19',
      city_name: 'Гомель',
      country_code: 'BY',
      country_name: 'Беларусь',
      title: 'Гомельский парк',
    },
    {
      quest_id: 'krakow-wawel',
      city_id: '12',
      city_name: 'Краков',
      country_code: 'pl',
      country_name: 'Польша',
      title: 'Вавель',
    },
    {
      quest_id: 'unknown-place',
      city_id: '900',
      city_name: 'Неизвестно',
      country_code: 'ZZ',
      title: 'Неизвестная страна',
    },
  ]

  it('builds independent Belarus and Poland pages with city and quest links', () => {
    const countries = buildQuestCountryLandingModel(quests)
    const belarus = countries.find((country: { countryAlias: string }) => country.countryAlias === 'belarus')
    const poland = countries.find((country: { countryAlias: string }) => country.countryAlias === 'poland')

    expect(countries).toHaveLength(2)
    expect(belarus.cities.map((city: { cityAlias: string }) => city.cityAlias)).toEqual(['gomel', 'minsk'])
    expect(belarus.quests).toHaveLength(2)
    expect(poland.quests).toHaveLength(1)

    const belarusHtml = buildQuestCountryLandingHtml(MINIMAL_BASE, belarus)
    const polandHtml = buildQuestCountryLandingHtml(MINIMAL_BASE, poland)
    const belarusDescription = belarusHtml.match(
      /<meta[^>]*name="description"[^>]*content="([^"]*)"/i,
    )?.[1]
    const polandDescription = polandHtml.match(
      /<meta[^>]*name="description"[^>]*content="([^"]*)"/i,
    )?.[1]
    expect(belarusHtml).toContain('data-ssg-quest-country="true"')
    expect(belarusHtml).toContain('data-ssg-quest-country-overview="true"')
    expect(belarusHtml).toContain('data-ssg-quest-country-cities="true"')
    expect(belarusHtml).toContain('data-ssg-quest-country-practical="true"')
    expect(belarusHtml).toContain('href="/quests/minsk"')
    expect(belarusHtml).toContain('href="/quests/4/minsk-center"')
    expect(belarusHtml).toContain(
      '<link data-rh="true" rel="canonical" href="https://metravel.by/quests/country/belarus"/>',
    )
    expect(belarusHtml).toContain(
      '<meta data-rh="true" property="og:url" content="https://metravel.by/quests/country/belarus"/>',
    )
    expect(belarusHtml).toContain('Квесты страны: Беларусь — города и маршруты | Metravel')
    expect(belarusDescription).toContain('Беларусь')
    expect(polandHtml).toContain(
      '<link data-rh="true" rel="canonical" href="https://metravel.by/quests/country/poland"/>',
    )
    expect(polandHtml).toContain(
      '<meta data-rh="true" property="og:url" content="https://metravel.by/quests/country/poland"/>',
    )
    expect(polandDescription).toContain('Польша')
    expect(polandDescription).not.toBe(belarusDescription)
    expect(polandHtml).not.toContain('Квесты страны: Беларусь')
  })

  it('replaces a previous country body instead of duplicating it', () => {
    const country = buildQuestCountryLandingModel(quests)[0]
    const once = injectQuestCountryLandingSection(MINIMAL_BASE, country, 'Первый lead')
    const twice = injectQuestCountryLandingSection(once, country, 'Второй lead')

    expect((twice.match(/<section data-ssg-quest-country="true"/g) || [])).toHaveLength(1)
    expect((twice.match(/<style data-ssg-quest-country-style="true">/g) || [])).toHaveLength(1)
    expect(twice).toContain('Второй lead')
    expect(twice).not.toContain('Первый lead')
  })

  it('requires the country Expo route template instead of hydrating a city bundle', () => {
    const missingFileSystem = {
      existsSync: jest.fn(() => false),
      readFileSync: jest.fn(),
    }
    expect(() => readRequiredQuestCountryTemplate(
      '/dist/quests/country/[country].html',
      missingFileSystem,
    )).toThrow('Missing Expo country route template')
    expect(missingFileSystem.readFileSync).not.toHaveBeenCalled()

    const routeHtml = '<html><body>country route bundle</body></html>'
    const presentFileSystem = {
      existsSync: jest.fn(() => true),
      readFileSync: jest.fn(() => routeHtml),
    }
    expect(readRequiredQuestCountryTemplate(
      '/dist/quests/country/[country].html',
      presentFileSystem,
    )).toBe(routeHtml)
    expect(presentFileSystem.readFileSync).toHaveBeenCalledWith(
      '/dist/quests/country/[country].html',
      'utf8',
    )
  })
})

// Регресс: URL hero-картинки главной известен только из JS-бандла, поэтому запрос
// стартовал после гидрации. Замер прода 2026-08-02, 412×823, slow-4G + CPU 4×:
// LCP-кадр `cover_sorapiso` начинался на 9 292 мс. Preload в HTML переносит
// загрузку в начало документа, параллельно бандлу.
describe('home hero LCP preload', () => {
  const HEAD_HTML = '<html><head><title>t</title></head><body></body></html>';

  describe('resolveHomeHeroAssetHref', () => {
    it('находит content-hashed файл первого слайда в dist', () => {
      const dist = makeTempDir('seo-home-hero-');
      const imagesDir = path.join(dist, 'assets', 'assets', 'images');
      fs.mkdirSync(imagesDir, { recursive: true });
      fs.writeFileSync(path.join(imagesDir, 'cover_trecime.aaaaaaaa.jpg'), 'x');
      fs.writeFileSync(path.join(imagesDir, 'cover_sorapiso.b3cc246bbe4c02d2783aa25055fedf54.jpg'), 'x');

      expect(resolveHomeHeroAssetHref(dist)).toBe(
        '/assets/assets/images/cover_sorapiso.b3cc246bbe4c02d2783aa25055fedf54.jpg',
      );
    });

    it('возвращает null, когда каталога или файла нет (fail-open, деплой не падает)', () => {
      const emptyDist = makeTempDir('seo-home-hero-empty-');
      expect(resolveHomeHeroAssetHref(emptyDist)).toBeNull();
      expect(resolveHomeHeroAssetHref(path.join(emptyDist, 'nope'))).toBeNull();
    });

    it('не принимает файл без content-hash: такой путь не кешируется immutable', () => {
      const dist = makeTempDir('seo-home-hero-nohash-');
      const imagesDir = path.join(dist, 'assets', 'assets', 'images');
      fs.mkdirSync(imagesDir, { recursive: true });
      fs.writeFileSync(path.join(imagesDir, 'cover_sorapiso.jpg'), 'x');

      expect(resolveHomeHeroAssetHref(dist)).toBeNull();
    });
  });

  describe('injectHomeHeroPreload', () => {
    it('ставит preload с высоким приоритетом в <head>', () => {
      const html = injectHomeHeroPreload(HEAD_HTML, '/assets/assets/images/cover_sorapiso.abc123.jpg');

      expect(html).toContain('rel="preload"');
      expect(html).toContain('as="image"');
      expect(html).toContain('fetchpriority="high"');
      expect(html).toContain('href="/assets/assets/images/cover_sorapiso.abc123.jpg"');
      expect(html.indexOf('data-home-hero-preload')).toBeLessThan(html.indexOf('</head>'));
    });

    it('оставляет HTML нетронутым без href', () => {
      expect(injectHomeHeroPreload(HEAD_HTML, null)).toBe(HEAD_HTML);
      expect(injectHomeHeroPreload(HEAD_HTML, '')).toBe(HEAD_HTML);
    });

    it('идемпотентен: повторный прогон не плодит дубли preload', () => {
      const href = '/assets/assets/images/cover_sorapiso.abc123.jpg';
      const once = injectHomeHeroPreload(HEAD_HTML, href);
      const twice = injectHomeHeroPreload(once, href);
      const thrice = injectHomeHeroPreload(twice, href);

      // `replaceOrInsert` вырезает прежний тег и вставляет канонический, поэтому
      // между прогонами меняются только переводы строк — важно, что тег ровно один.
      expect(once.match(/data-home-hero-preload/g)).toHaveLength(1);
      expect(twice.match(/data-home-hero-preload/g)).toHaveLength(1);
      expect(thrice.match(/data-home-hero-preload/g)).toHaveLength(1);
    });

    it('экранирует href в атрибуте', () => {
      const html = injectHomeHeroPreload(HEAD_HTML, '/a"onload="alert(1)');
      expect(html).not.toContain('"onload="');
    });
  });
});

// ---------------------------------------------------------------------------
// #1394: build-time API pacing и громкий отказ вместо пустой заглушки
// ---------------------------------------------------------------------------
describe('#1394 build-time fetch of travel details', () => {
  const {
    API_ZONE_RATE_PER_SEC,
    BUILD_FETCH_RATE_PER_SEC,
    BUILD_FETCH_MIN_INTERVAL_MS,
    TRAVEL_DETAIL_CONCURRENCY,
    QUEST_DETAIL_CONCURRENCY,
    MAX_DETAIL_FAILURES_BEFORE_ABORT,
    assertTravelDetailsComplete,
    batchAsync,
    createRequestPacer,
    fetchTravelDetail,
  } = require('@/scripts/generate-seo-pages');

  const apiBase = 'https://metravel.test';
  const httpError = (statusCode: number, url: string) =>
    Object.assign(new Error(`HTTP ${statusCode} for ${url}`), { statusCode });

  describe('темп запросов', () => {
    it('держит сборку заметно ниже лимита зоны api', () => {
      // nginx/nginx.conf: limit_req zone=api rate=30r/s. Прогон в 10 потоков без
      // паузы уходил за порог и закрывал лимитер на всю сборку.
      expect(API_ZONE_RATE_PER_SEC).toBe(30);
      expect(BUILD_FETCH_RATE_PER_SEC).toBeLessThan(API_ZONE_RATE_PER_SEC / 2);
      expect(BUILD_FETCH_MIN_INTERVAL_MS).toBe(Math.ceil(1000 / BUILD_FETCH_RATE_PER_SEC));
      expect(TRAVEL_DETAIL_CONCURRENCY).toBeLessThanOrEqual(4);
      expect(QUEST_DETAIL_CONCURRENCY).toBeLessThanOrEqual(4);
    });

    it('разносит старты на minIntervalMs даже при параллельных воркерах', async () => {
      // Часы заморожены: тогда пауза, о которой просит пейсер, и есть смещение
      // слота от начала прогона. Три воркера не стартуют одновременно — каждый
      // следующий занимает слот на 125 мс позже предыдущего.
      const waits: number[] = [];
      const handled: number[] = [];

      await batchAsync(
        [1, 2, 3, 4, 5],
        3,
        async (item: number) => {
          handled.push(item);
        },
        {
          minIntervalMs: 125,
          now: () => 1_000,
          wait: async (ms: number) => {
            waits.push(ms);
          },
        },
      );

      expect(handled).toHaveLength(5);
      // Первый запрос уходит сразу, остальные четыре — по одному слоту на 125 мс.
      expect(waits).toEqual([125, 250, 375, 500]);
    });

    it('без minIntervalMs не платит ни одной паузы', async () => {
      const waits: number[] = [];
      const pace = createRequestPacer(0, { now: () => 0, wait: async (ms: number) => void waits.push(ms) });

      await pace();
      await pace();

      expect(waits).toEqual([]);
    });
  });

  describe('fetchTravelDetail', () => {
    it('нормализует ответ by-id', async () => {
      const detail = await fetchTravelDetail(641, 'usadba-bohvicev-podorosk', {
        apiBase,
        fetchJson: async (url: string) => {
          expect(url).toBe(`${apiBase}/api/travels/641/`);
          return {
            description: '<p>тело</p>',
            media: { sizes: [] },
            gallery: [{ url: 'a.jpg' }],
            travelAddress: [{ id: 1 }],
            coordsMeTravel: ['53.9,27.5'],
            countryCode: 'BY',
            userName: 'kelios',
          };
        },
      });

      expect(detail.description).toBe('<p>тело</p>');
      expect(detail.gallery).toHaveLength(1);
      expect(detail.coordsMeTravel).toEqual(['53.9,27.5']);
      expect(detail.userName).toBe('kelios');
    });

    it('падает на by-slug, когда by-id отдал 503', async () => {
      const calls: string[] = [];
      const detail = await fetchTravelDetail(641, 'usadba-bohvicev-podorosk', {
        apiBase,
        fetchJson: async (url: string) => {
          calls.push(url);
          if (url.includes('/api/travels/641/')) throw httpError(503, url);
          return { description: '<p>из by-slug</p>' };
        },
      });

      expect(calls).toEqual([
        `${apiBase}/api/travels/641/`,
        `${apiBase}/api/travels/by-slug/usadba-bohvicev-podorosk/`,
      ]);
      expect(detail.description).toBe('<p>из by-slug</p>');
    });

    it('бросает, а не отдаёт пустую заглушку, когда оба пути упали', async () => {
      // Прежнее поведение: тихий `{ description: '', gallery: [] }` → страница
      // без тела, галереи и точек уезжала на прод как «успешная».
      await expect(
        fetchTravelDetail(641, 'usadba-bohvicev-podorosk', {
          apiBase,
          fetchJson: async (url: string) => {
            throw httpError(503, url);
          },
        }),
      ).rejects.toThrow(/travel 641 \(usadba-bohvicev-podorosk\).*HTTP 503.*by-slug fallback: HTTP 503/s);
    });

    it('бросает, когда by-id упал и слага для fallback нет', async () => {
      await expect(
        fetchTravelDetail(641, '', {
          apiBase,
          fetchJson: async (url: string) => {
            throw httpError(503, url);
          },
        }),
      ).rejects.toThrow(/travel 641: HTTP 503.*no slug/s);
    });

    it('сохраняет статусы, чтобы 404 и 503 различались без чтения ста строк', async () => {
      const failure = await fetchTravelDetail(641, 'usadba-bohvicev-podorosk', {
        apiBase,
        fetchJson: async (url: string) => {
          throw httpError(url.includes('by-slug') ? 404 : 503, url);
        },
      }).catch((err: any) => err);

      expect(failure.statusCode).toBe(404);
      expect(failure.idStatusCode).toBe(503);
      expect(failure.cause).toBeDefined();
    });

    it('бросает на 200 с неожиданным телом вместо пустой статьи', async () => {
      // Ответ-конверт `{ data: {...} }` раньше растекался в страницу без тела,
      // проходил все проверки и уезжал на прод как «успешная» сборка.
      for (const payload of [null, 'ok', [{ description: '<p>тело</p>' }]]) {
        await expect(
          fetchTravelDetail(641, '', { apiBase, fetchJson: async () => payload }),
        ).rejects.toThrow(/unexpected detail payload/);
      }
    });
  });

  describe('гейт сборки при недобранных деталях', () => {
    const logged: string[] = [];
    const log = (line: string) => void logged.push(line);

    beforeEach(() => {
      logged.length = 0;
    });

    it('пропускает сборку, когда провалов нет', () => {
      expect(() => assertTravelDetailsComplete([], 397, { log })).not.toThrow();
      expect(logged).toEqual([]);
    });

    it('валит сборку и печатает id/slug каждой непрошедшей статьи', () => {
      const failures = [
        { id: 641, slug: 'usadba-bohvicev-podorosk', statusCode: 503, message: 'travel 641: HTTP 503' },
        { id: 642, slug: '', statusCode: 503, message: 'travel 642: HTTP 503' },
      ];

      expect(() => assertTravelDetailsComplete(failures, 397, { log })).toThrow(
        /Travel details unavailable for 2\/397 travels/,
      );
      expect(logged[0]).toContain('2/397');
      expect(logged.join('\n')).toContain('id=641 slug=usadba-bohvicev-podorosk');
      expect(logged.join('\n')).toContain('id=642 slug=—');
    });

    it('после раннего обрыва не выдаёт непопробованные статьи за успешные', () => {
      // «20/397» читалось бы как «377 добрались нормально» — ровно наоборот.
      const failures = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        slug: `s${i}`,
        statusCode: 503,
        message: 'm',
      }));

      expect(() => assertTravelDetailsComplete(failures, 397, { attempted: 120, log })).toThrow(
        /20\/120 attempted travels \(277 of 397 never tried\)/,
      );
      expect(logged[0]).not.toContain('20/397');
    });

    it('первой строкой даёт гистограмму статусов: 503-лимитер против удалённой статьи', () => {
      const failures = [
        ...Array.from({ length: 108 }, (_, i) => ({ id: i, slug: `s${i}`, statusCode: 503, message: 'm' })),
        { id: 999, slug: 'deleted', statusCode: 404, message: 'm' },
        { id: 1000, slug: 'socket', statusCode: undefined, message: 'm' },
      ];

      expect(() => assertTravelDetailsComplete(failures, 397, { log })).toThrow(/HTTP 503 ×108/);
      expect(logged[0]).toContain('HTTP 503 ×108, HTTP 404 ×1, transport error ×1');
    });
  });

  describe('ранний обрыв обречённого прогона', () => {
    it('перестаёт добирать статьи, когда провалов накопилось выше порога', async () => {
      const attempted: number[] = [];
      const failures: number[] = [];
      const items = Array.from({ length: 200 }, (_, i) => i);

      await batchAsync(
        items,
        4,
        async (item: number) => {
          attempted.push(item);
          failures.push(item);
          return null;
        },
        { shouldStop: () => failures.length >= MAX_DETAIL_FAILURES_BEFORE_ABORT },
      );

      // Порог + до (concurrency - 1) задач, уже взятых воркерами в этот момент.
      expect(attempted.length).toBeGreaterThanOrEqual(MAX_DETAIL_FAILURES_BEFORE_ABORT);
      expect(attempted.length).toBeLessThan(MAX_DETAIL_FAILURES_BEFORE_ABORT + 4);
      expect(attempted.length).toBeLessThan(items.length);
    });

    it('без shouldStop проходит весь список', async () => {
      const seen: number[] = [];
      await batchAsync([1, 2, 3, 4, 5], 2, async (item: number) => void seen.push(item));
      expect(seen).toHaveLength(5);
    });
  });
});

describe('gateAppScriptsBehindHero (#1479)', () => {
  const HERO_IMG =
    '<div id="ssg-skeleton"><div class="ssg-travel-hero"><picture>' +
    '<img class="ssg-travel-hero-img" data-ssg-lcp="true" src="/hero.webp?w=720" alt="x"></picture></div></div>';
  const APP_SCRIPTS =
    '<script src="/_expo/static/js/web/__expo-metro-runtime-a.js" defer></script>' +
    '<script src="/_expo/static/js/web/__shared-1-b.js" defer></script>' +
    '<script src="/_expo/static/js/web/entry-c.js" defer></script>';
  const INLINE_KEEP =
    '<script data-travel-preload-bootstrap="true">window.__x=1;</script>' +
    '<script type="application/ld+json">{"@type":"Article"}</script>';
  const BASE = `<html><body>${HERO_IMG}<div id="root"></div>${INLINE_KEEP}${APP_SCRIPTS}</body></html>`;

  const controllerSource = (html: string) => {
    const m = html.match(/<script data-app-script-gate="true">([\s\S]*?)<\/script>/);
    return m ? m[1] : null;
  };

  it('strips only /_expo app <script> tags and keeps inline/jsonld scripts', () => {
    const out = gateAppScriptsBehindHero(BASE);
    expect(out).not.toMatch(/<script src="\/_expo\/static\/js\/web\/[^"]+"[^>]*><\/script>/);
    expect(out).toContain('data-travel-preload-bootstrap="true"');
    expect(out).toContain('application/ld+json');
    expect(out).toContain('data-app-script-gate="true"');
  });

  it('preserves original script order in the injected list', () => {
    const src = controllerSource(gateAppScriptsBehindHero(BASE))!;
    const listMatch = src.match(/var S=(\[[^\]]*\])/)!;
    const list = JSON.parse(listMatch[1].replace(/\\u003c/g, '<').replace(/\\u003e/g, '>'));
    expect(list).toEqual([
      '/_expo/static/js/web/__expo-metro-runtime-a.js',
      '/_expo/static/js/web/__shared-1-b.js',
      '/_expo/static/js/web/entry-c.js',
    ]);
  });

  it('returns HTML unchanged when there are no /_expo app scripts', () => {
    const noApp = `<html><body>${HERO_IMG}${INLINE_KEEP}</body></html>`;
    expect(gateAppScriptsBehindHero(noApp)).toBe(noApp);
  });

  it('SAFETY: never strips scripts if the controller cannot be placed (no </body>)', () => {
    const noBody = `<html>${HERO_IMG}${APP_SCRIPTS}</html>`;
    const out = gateAppScriptsBehindHero(noBody);
    // scripts must still be present — we never leave a page with no loader
    expect(out).toBe(noBody);
    expect(out).toContain('/_expo/static/js/web/entry-c.js');
  });

  it('SAFETY: ignores a stale controller marker when this call cannot place its controller', () => {
    const staleController = '<script data-app-script-gate="true">window.__stale=1;</script>';
    const noBody = `<html>${HERO_IMG}${staleController}${APP_SCRIPTS}</html>`;

    expect(gateAppScriptsBehindHero(noBody)).toBe(noBody);
  });

  // ---- runtime behaviour of the injected controller (mock DOM, no jsdom) ----
  function runController(src: string, opts: { hero?: any; readyState?: string } = {}) {
    const injected: string[] = [];
    const asyncFlags: boolean[] = [];
    const timeouts: Array<() => void> = [];
    const timeoutDelays: number[] = [];
    const docListeners: Record<string, Array<() => void>> = {};
    const body = { appendChild: (el: any) => { injected.push(el.src); asyncFlags.push(el.async); } };
    const document: any = {
      readyState: opts.readyState || 'complete',
      body,
      createElement: () => ({ src: '', async: undefined }),
      querySelector: (sel: string) => (sel === 'img[data-ssg-lcp]' ? (opts.hero ?? null) : null),
      addEventListener: (ev: string, cb: () => void) => {
        (docListeners[ev] = docListeners[ev] || []).push(cb);
      },
    };
    const sandbox: any = {
      document,
      setTimeout: (cb: () => void, delay: number) => {
        timeouts.push(cb);
        timeoutDelays.push(delay);
        return 0 as any;
      },
    };
    new Function('document', 'setTimeout', src)(sandbox.document, sandbox.setTimeout);
    return { injected, asyncFlags, timeouts, timeoutDelays, docListeners };
  }

  it('injects all scripts in order, async=false, once the hero image loads', () => {
    const src = controllerSource(gateAppScriptsBehindHero(BASE))!;
    const heroListeners: Record<string, () => void> = {};
    const hero = {
      complete: false,
      naturalWidth: 0,
      addEventListener: (ev: string, cb: () => void) => { heroListeners[ev] = cb; },
    };
    const r = runController(src, { hero });
    expect(r.injected).toEqual([]); // gated: nothing yet
    heroListeners.load(); // hero finishes downloading
    expect(r.injected).toEqual([
      '/_expo/static/js/web/__expo-metro-runtime-a.js',
      '/_expo/static/js/web/__shared-1-b.js',
      '/_expo/static/js/web/entry-c.js',
    ]);
    expect(r.asyncFlags).toEqual([false, false, false]);
  });

  it('injects immediately when the hero image is already complete', () => {
    const src = controllerSource(gateAppScriptsBehindHero(BASE))!;
    const hero = { complete: true, naturalWidth: 720, addEventListener: () => {} };
    const r = runController(src, { hero });
    expect(r.injected).toHaveLength(3);
  });

  it('injects immediately when the hero image already completed with an error', () => {
    const src = controllerSource(gateAppScriptsBehindHero(BASE))!;
    // A failed <img> is complete with naturalWidth=0. Its error event may have
    // fired before DOMContentLoaded arms the gate, so waiting for another event
    // would leave the app blocked until the timeout.
    const hero = { complete: true, naturalWidth: 0, addEventListener: jest.fn() };
    const r = runController(src, { hero });

    expect(r.injected).toHaveLength(3);
    expect(hero.addEventListener).not.toHaveBeenCalled();
  });

  it('injects when an in-flight hero emits error', () => {
    const src = controllerSource(gateAppScriptsBehindHero(BASE))!;
    const heroListeners: Record<string, () => void> = {};
    const hero = {
      complete: false,
      naturalWidth: 0,
      addEventListener: (ev: string, cb: () => void) => { heroListeners[ev] = cb; },
    };
    const r = runController(src, { hero });

    heroListeners.error();
    expect(r.injected).toHaveLength(3);
  });

  it('injects immediately when there is no hero image (non-hero page safety)', () => {
    const src = controllerSource(gateAppScriptsBehindHero(BASE))!;
    const r = runController(src, { hero: null });
    expect(r.injected).toHaveLength(3);
  });

  it('the hard timeout is a guaranteed fallback that boots the app', () => {
    const src = controllerSource(gateAppScriptsBehindHero(BASE))!;
    const hero = { complete: false, naturalWidth: 0, addEventListener: () => {} };
    const r = runController(src, { hero });
    expect(r.injected).toEqual([]); // still gated
    expect(r.timeoutDelays).toEqual([2500]);
    r.timeouts.forEach((cb) => cb()); // fire the timeout
    expect(r.injected).toHaveLength(3); // app booted
  });

  it('releases the app on the first user input before the hero settles', () => {
    const src = controllerSource(gateAppScriptsBehindHero(BASE))!;
    const hero = { complete: false, naturalWidth: 0, addEventListener: () => {} };
    const r = runController(src, { hero });

    expect(r.injected).toEqual([]);
    r.docListeners.pointerdown[0]();
    expect(r.injected).toHaveLength(3);
  });

  it('does not double-inject when multiple triggers fire', () => {
    const src = controllerSource(gateAppScriptsBehindHero(BASE))!;
    const heroListeners: Record<string, () => void> = {};
    const hero = {
      complete: false,
      naturalWidth: 0,
      addEventListener: (ev: string, cb: () => void) => { heroListeners[ev] = cb; },
    };
    const r = runController(src, { hero });
    heroListeners.load();
    r.timeouts.forEach((cb) => cb()); // late timeout must be a no-op
    (r.docListeners.pointerdown || []).forEach((cb) => cb());
    expect(r.injected).toHaveLength(3); // exactly once
  });
});
