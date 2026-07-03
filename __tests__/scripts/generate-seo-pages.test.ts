/**
 * Regression tests for scripts/generate-seo-pages.js
 *
 * Protects against the bug where injectMeta() silently failed to add
 * OG / canonical / Twitter tags when they were missing from the base HTML
 * (Expo static export does NOT include these tags).
 */

const {
  replaceOrInsert,
  injectMeta,
  buildSeoTitle,
  escapeAttr,
  stripHtml,
  buildTravelSeoDescription,
  pickTravelSeoImage,
  buildOptimizedTravelImageUrl,
  buildTravelHeroPreloadData,
  injectTravelHeroPreload,
  injectTravelBootstrapData,
  injectHiddenH1,
  injectQuestIntroSection,
  buildQuestPromoCatalog,
  findTravelQuestPromoMatches,
  injectTravelQuestPromoSection,
  injectJsonLd,
  buildTravelArticleJsonLd,
  normalizeSlug,
  loadRedirectManifest,
  buildRedirectStubHtml,
  patchNoindexFallbackTemplate,
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

// ---------------------------------------------------------------------------
// replaceOrInsert
// ---------------------------------------------------------------------------
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

  it('inserts og:image with HD URL', () => {
    expect(result).toMatch(/<meta[^>]*property="og:image"[^>]*content="https:\/\/metravel\.by\/gallery\/123\/photo-detail_hd\.jpg"/);
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
    expect(result).toContain(`content="${SAMPLE_META.image}"`);
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
    expect(result).toContain(`property="og:image" content="${SAMPLE_META.image}"`);
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

  it('truncates on a word boundary without cutting mid-word', () => {
    const text = 'Прогулка по старому городу с чистыми улицами и уютными кафе повсюду';
    const out = stripHtml(text, 30);
    expect(out.length).toBeLessThanOrEqual(30);
    // Ends on a whole word — no dangling partial token like "с чист"
    expect(text.startsWith(out)).toBe(true);
    expect(out.endsWith(' ')).toBe(false);
    expect(out).toBe('Прогулка по старому городу с');
  });

  it('drops trailing punctuation/dashes after the word cut', () => {
    const text = 'Озеро глубиной 11,5 м — оно самое глубокое в регионе бесспорно';
    const out = stripHtml(text, 24);
    expect(out).toBe('Озеро глубиной 11,5 м');
    expect(/[\s,;:–—-]$/.test(out)).toBe(false);
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

    expect(url).toContain('https://metravel.by/travel-image/123/conversions/pic-thumb_200.jpg');
    expect(url).toContain('w=400');
    expect(url).toContain('q=35');
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
    expect(preload.mobile.href).toContain('https://metravel.by/gallery/77/gallery/photo.JPG');
    expect(preload.mobile.href).toContain('w=720');
    expect(preload.mobile.href).toContain('q=72');
    expect(preload.mobile.href).toContain('v=991');
    expect(preload.mobile.href).not.toContain('dpr=');
    expect(preload.mobile.srcSet).toContain('w=320');
    expect(preload.mobile.srcSet).toContain('w=640');
    expect(preload.mobile.srcSet).toContain('w=720');
    expect(preload.mobile.srcSet).toContain('q=72');
    expect(preload.mobile.sizes).toBe('100vw');
    expect(preload.desktop.href).toContain('w=1280');
    expect(preload.desktop.href).toContain('q=82');
    expect(preload.desktop.href).not.toContain('dpr=');
    expect(preload.desktop.srcSet).toContain('w=960');
    expect(preload.desktop.srcSet).toContain('w=1280');
    expect(preload.desktop.srcSet).toContain('q=82');
    expect(preload.desktop.sizes).toBe('(max-width: 1024px) 92vw, 720px');
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
  it('injectHiddenH1 adds exactly one hidden H1 into body', () => {
    const result = injectHiddenH1(MINIMAL_BASE, 'Тропа ведьм')

    expect(result).toMatch(/<h1[^>]*data-ssg-travel-h1="true"[^>]*>Тропа ведьм<\/h1>/)
    expect((result.match(/<h1\b/gi) || []).length).toBe(1)
    expect(result).toContain('position:absolute')
    expect(result).toContain('clip-path:inset(50%)')
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
    expect(payload.image).toEqual(['https://metravel.by/travel-image/1/conversions/pic-detail_hd.jpg'])
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
    expect(second).toContain('https://metravel.by/media/quests/krakow/cover.png')
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
      intro: JSON.stringify({ location: 'Вавельский холм' }),
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
    expect(second).toContain('Обновлённое описание квеста.')
    expect(second).not.toContain('Пеший квест по Кракову с легендами и заданиями.')
    expect(second).toContain('html.rnw-styles-ready [data-ssg-quest-intro="true"]')
    expect(second).toContain("'Segoe UI'")
    expect(second).not.toContain('system-ui,-apple-system,"Segoe UI"')
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

  it('clips an over-long title to <= 60 chars', () => {
    const name = 'Маршрут на 1 день: экотропа Ельня и усадьбы Нитославичи и Бенюличи';
    const out = buildSeoTitle(name);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith(SUFFIX)).toBe(true);
  });

  it('clips on a word boundary, not mid-word', () => {
    const name = 'Маршрут на 1 день: экотропа Ельня и усадьбы Нитославичи и Бенюличи';
    const out = buildSeoTitle(name);
    const visible = out.slice(0, out.length - SUFFIX.length); // drop suffix
    expect(visible.endsWith('…')).toBe(true);
    const beforeEllipsis = visible.slice(0, -1);
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
    const visible = out.slice(0, out.length - SUFFIX.length);
    expect(visible).not.toMatch(/[\s.,;:!?–—-]…$/u);
  });

  it('hard-clips when the leading word alone exceeds the budget', () => {
    const name = `${'a'.repeat(80)} bcd`;
    const out = buildSeoTitle(name);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith(`…${SUFFIX}`)).toBe(true);
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
