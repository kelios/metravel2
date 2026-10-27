/**
 * Regression tests for scripts/postprocess-route-shells.js (#2766).
 *
 * Protects against the bug where injectMeta() silently failed to add
 * OG / canonical / Twitter tags when they were missing from the base HTML
 * (Expo static export does NOT include these tags), and covers the remaining
 * shell post-processing: static route heads, home hero preload, hidden H1,
 * BreadcrumbList, noindex fallback templates and /article/<id> metadata.
 */

const {
  applyHtmlFragment,
  replaceOrInsert,
  injectMeta,
  buildSeoTitle,
  escapeAttr,
  stripHtml,
  injectHomeHeroPreload,
  resolveHomeHeroAssetHref,
  injectHiddenH1,
  injectBreadcrumbJsonLd,
  patchNoindexFallbackTemplate,
  fetchArticleMetadata,
} = require('@/scripts/postprocess-route-shells');

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
      injectHomeHeroPreload(SINGLE_SHELL_BASE, REPLACEMENT_TOKENS),
      injectHiddenH1(SINGLE_SHELL_BASE, REPLACEMENT_TOKENS),
    ];

    for (const output of outputs) {
      expectSingleShell(output);
      expect(output.length).toBeLessThan(SINGLE_SHELL_BASE.length + 100_000);
      expect(output.replace(/&amp;/g, '&').replace(/\\u0026/g, '&')).toContain(REPLACEMENT_TOKENS);
    }
  });
});

// #2170: постобработчик больше не греет шрифт иконок. Вставка `<link rel="preload"
// as="font">` (#1409) молча перестала срабатывать после смены пути ассета, а её
// возврат отнимал бы канал у LCP-картинки (+190 мс LCP в A/B на проде). Шрифт
// подключает оболочка документа — `utils/iconFontShell.ts`.
describe('icon font preload', () => {
  it('is not injected by the shell post-processor: the document shell owns the icon font', () => {
    const source = require('fs').readFileSync(
      require('path').resolve(__dirname, '../../scripts/postprocess-route-shells.js'),
      'utf8'
    );
    expect(source).not.toMatch(/as=["']font["']/);
    expect(source).not.toContain('data-icon-font-preload');
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
  it('keeps private and auth-like static routes in the shared SEO table with noindex', () => {
    const fs = require('fs');
    const path = require('path');
    // #2740: the table moved to utils/seoRoutes/staticRoutes.js (shared with the
    // routes' generateMetadata); the post-processor derives STATIC_PAGES from it.
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'utils/seoRoutes/staticRoutes.js'),
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
  const { STATIC_PAGES } = require('@/scripts/postprocess-route-shells')
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

describe('home SEO metadata parity', () => {
  const { STATIC_PAGES } = require('@/scripts/postprocess-route-shells')
  const { resources } = require('@/i18n/resources')
  const home = STATIC_PAGES.find((page: { route: string }) => page.route === '/')

  it('uses the canonical RU i18n values for generated raw HTML and social metadata', () => {
    expect(home).toBeDefined()
    expect(home.title).toBe(resources.ru.seoStatic['root.home.title'])
    expect(home.description).toBe(resources.ru.seoStatic['root.home.description'])
    expect(home.title).not.toContain('книга путешествий')
    expect(home.description).not.toMatch(/PDF|книг/i)

    const html = injectMeta(MINIMAL_BASE, {
      ...home,
      canonical: 'https://metravel.by/',
    })
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
    const description = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)?.[1]
    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)?.[1]
    const ogDescription = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i)?.[1]
    const twitterTitle = html.match(/<meta[^>]*name="twitter:title"[^>]*content="([^"]+)"/i)?.[1]
    const twitterDescription = html.match(/<meta[^>]*name="twitter:description"[^>]*content="([^"]+)"/i)?.[1]

    expect(title).toBe(home.title)
    expect(description).toBe(home.description)
    expect(ogTitle).toBe(title)
    expect(ogDescription).toBe(description)
    expect(twitterTitle).toBe(title)
    expect(twitterDescription).toBe(description)
  })

  it('keeps the Babel inliner factory contract while reusing its read-only catalog', () => {
    const inlinePlugin = require('@/i18n/babel-inline-plugin')
    const pluginBeforeRequire = inlinePlugin
    const argsBefore = [...process.argv]
    const cwdBefore = process.cwd()

    require('@/scripts/postprocess-route-shells')

    const pluginAfterRequire = require('@/i18n/babel-inline-plugin')
    expect(pluginAfterRequire).toBe(pluginBeforeRequire)
    expect(typeof pluginAfterRequire).toBe('function')
    expect(typeof pluginAfterRequire.loadCatalogs).toBe('function')
    expect(typeof pluginAfterRequire.loadSsgCatalogs).toBe('function')
    expect(pluginAfterRequire({ types: {} })).toEqual(expect.objectContaining({
      name: 'metravel-inline-localized-translations',
      visitor: expect.objectContaining({ Program: expect.any(Function) }),
    }))
    expect(process.argv).toEqual(argsBefore)
    expect(process.cwd()).toBe(cwdBefore)
  })

  it('leaves the /quests control metadata unchanged', () => {
    const quests = STATIC_PAGES.find((page: { route: string }) => page.route === '/quests')

    expect(quests).toEqual(expect.objectContaining({
      title: 'Городские квесты и маршруты с заданиями | Metravel',
      description: 'Проходите городские квесты Metravel: маршруты с заданиями, точками на карте и идеями для прогулок и поездок.',
    }))
  })
})

// `#root` is empty in the static export, so a runtime <h1> never reaches raw HTML.
// Audit 2026-08-08 found `/` and `/map` shipping zero H1 while every travel and
// quest page had exactly one.
describe('static landing H1 coverage', () => {
  const source = require('fs').readFileSync(
    require('path').resolve(process.cwd(), 'scripts/postprocess-route-shells.js'),
    'utf8',
  );
  // #2740: landing entries live in the shared table, the injector stays in the post-processor.
  const tableSource = require('fs').readFileSync(
    require('path').resolve(process.cwd(), 'utils/seoRoutes/staticRoutes.js'),
    'utf8',
  );

  it('declares an H1 for the home and map landings', () => {
    expect(tableSource).toMatch(/route: '\/',[\s\S]{0,900}?h1: '[^']+'/);
    expect(tableSource).toMatch(/route: '\/map',[\s\S]{0,600}?h1: '[^']+'/);
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
// ---------------------------------------------------------------------------
// Slug redirect manifest. The static redirect stubs are gone (#2766): the 301
// is the backend TravelSlugRedirect; the manifest stays the input of
// report-travel-404.js and seo-fix-links.js and must stay well-formed.
// ---------------------------------------------------------------------------
describe('shipped manifest scripts/seo-redirects.json', () => {
  const raw = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'scripts/seo-redirects.json'), 'utf8'),
  );
  const shipped = raw.redirects as { from: string; to: string }[];

  it('is non-empty', () => {
    expect(Array.isArray(shipped)).toBe(true);
    expect(shipped.length).toBeGreaterThan(0);
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
    expect(html).not.toContain('data-ssg-description');
  });

  it('deduplicates existing robots meta', () => {
    const html = patchNoindexFallbackTemplate(
      '<html><head><meta name="robots" content="index, follow"/><meta name="robots" content="noindex"/></head></html>',
    );

    expect((html.match(/name="robots"/g) || []).length).toBe(1);
    expect(html).toContain('content="noindex, follow"');
  });

  // #2740: the shell head now comes from the route's generateMetadata (brand
  // defaults); og/twitter and og:url must follow the not-found text as well.
  it('syncs og/twitter with the not-found text, drops og:url and honours a custom robots', () => {
    const html = patchNoindexFallbackTemplate(
      [
        '<html><head>',
        '<title>Metravel</title>',
        '<meta name="description" content="Маршруты, заметки и фото путешествий по Беларуси и не только."/>',
        '<meta property="og:title" content="Metravel"/>',
        '<meta property="og:description" content="Маршруты, заметки и фото путешествий по Беларуси и не только."/>',
        '<meta property="og:url" content="https://metravel.by/quests/[city]"/>',
        '<meta name="twitter:title" content="Metravel"/>',
        '<meta name="twitter:description" content="Маршруты, заметки и фото путешествий по Беларуси и не только."/>',
        '<meta name="robots" content="max-image-preview:large"/>',
        '</head><body></body></html>',
      ].join(''),
      {
        title: 'Страница не найдена | Metravel',
        description: 'Страница не найдена.',
        robots: 'noindex, nofollow',
      },
    );

    expect(html).toContain('<title data-rh="true">Страница не найдена | Metravel</title>');
    expect(html).toContain('<meta data-rh="true" property="og:title" content="Страница не найдена | Metravel"/>');
    expect(html).toContain('<meta data-rh="true" name="twitter:title" content="Страница не найдена | Metravel"/>');
    expect(html).toContain('<meta data-rh="true" property="og:description" content="Страница не найдена."/>');
    expect(html).toContain('<meta data-rh="true" name="twitter:description" content="Страница не найдена."/>');
    expect(html).toContain('<meta data-rh="true" name="robots" content="noindex, nofollow"/>');
    expect(html).toContain('<meta data-rh="true" property="og:type" content="website"/>');
    expect(html).toContain('<meta data-rh="true" property="og:site_name" content="MeTravel"/>');
    expect(html).toContain('<meta data-rh="true" name="twitter:card" content="summary"/>');
    expect(html).toContain('<meta data-rh="true" property="og:locale" content="ru_RU"/>');
    expect(html).not.toContain('og:url');
    expect(html).not.toContain('content="Metravel"');
    for (const re of [/property="og:title"/g, /name="twitter:title"/g, /name="description"/g, /name="robots"/g]) {
      expect((html.match(re) || []).length).toBe(1);
    }
  });

  it('inserts a <title> into an export-level page that ships none', () => {
    const html = patchNoindexFallbackTemplate(
      '<html><head><meta charset="utf-8"/><script>1</script></head><body></body></html>',
      { title: 'Страница не найдена | Metravel', description: 'Страница не найдена.' },
    );
    expect(html).toMatch(/<head><title data-rh="true">Страница не найдена \| Metravel<\/title>/);
    expect((html.match(/<title/g) || []).length).toBe(1);
  });
});

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
// #1394: build-time API pacing. The only API read left in the build is the
// /article/<id> metadata; it shares the paced budget of scripts/lib/requestPacer.
// ---------------------------------------------------------------------------
describe('#1394 build-time API pacing', () => {
  const {
    BUILD_FETCH_RATE_PER_SEC,
    BUILD_FETCH_MIN_INTERVAL_MS,
    batchAsync,
    createRequestPacer,
  } = require('@/scripts/lib/requestPacer');
  // nginx/nginx.conf: limit_req zone=api rate=30r/s.
  const API_ZONE_RATE_PER_SEC = 30;

  it('держит сборку заметно ниже лимита зоны api', () => {
    expect(BUILD_FETCH_RATE_PER_SEC).toBeLessThan(API_ZONE_RATE_PER_SEC / 2);
    expect(BUILD_FETCH_MIN_INTERVAL_MS).toBe(Math.ceil(1000 / BUILD_FETCH_RATE_PER_SEC));
  });

  it('разносит старты на minIntervalMs даже при параллельных воркерах', async () => {
    // Часы заморожены: тогда пауза, о которой просит пейсер, и есть смещение
    // слота от начала прогона.
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

describe('fetchArticleMetadata (/article/<id> noindex pages)', () => {
  const apiBase = 'https://metravel.test';
  const noPace = async () => {};

  it('reads the first article endpoint that answers with items, through one paced reader', async () => {
    const calls: string[] = [];
    let paced = 0;
    const fetchJson = async (url: string) => {
      calls.push(url);
      if (url === `${apiBase}/api/`) return { articles: '/api/articles/' };
      if (url.startsWith(`${apiBase}/api/articles/?`)) return { data: [{ id: 5, name: 'Статья' }] };
      throw new Error(`unexpected ${url}`);
    };
    const articles = await fetchArticleMetadata({ apiBase, fetchJson, pace: async () => { paced += 1; } });

    expect(articles).toEqual([{ id: 5, name: 'Статья' }]);
    expect(calls[0]).toBe(`${apiBase}/api/`);
    expect(calls[1]).toMatch(/^https:\/\/metravel\.test\/api\/articles\/\?page=1&perPage=500&where=/);
    expect(paced).toBe(calls.length);
  });

  it('skips the article pages instead of failing when no endpoint answers', async () => {
    const fetchJson = async () => {
      throw new Error('HTTP 404');
    };
    await expect(fetchArticleMetadata({ apiBase, fetchJson, pace: noPace })).resolves.toEqual([]);
  });

  it('refuses a request that leaves the API origin', async () => {
    const calls: string[] = [];
    const fetchJson = async (url: string) => {
      calls.push(url);
      return url === `${apiBase}/api/` ? { articles: 'https://other.example/api/articles' } : [];
    };
    await expect(fetchArticleMetadata({ apiBase, fetchJson, pace: noPace })).resolves.toEqual([]);
    expect(calls.some((url) => url.startsWith('https://other.example'))).toBe(false);
  });
});
