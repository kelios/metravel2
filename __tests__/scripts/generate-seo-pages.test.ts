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
  escapeAttr,
  stripHtml,
  buildTravelSeoDescription,
  pickTravelSeoImage,
} = require('@/scripts/generate-seo-pages');

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
      '<meta property="og:image" content="https://metravel.by/assets/icons/logo_yellow.png"/>',
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

  it('truncates to maxLength', () => {
    const long = 'a'.repeat(200);
    expect(stripHtml(long, 100).length).toBe(100);
  });

  it('returns empty string for falsy input', () => {
    expect(stripHtml('')).toBe('');
    expect(stripHtml(null as any)).toBe('');
    expect(stripHtml(undefined as any)).toBe('');
  });
});

describe('travel SEO fallback helpers', () => {
  it('buildTravelSeoDescription prefers detailed description when available', () => {
    const result = buildTravelSeoDescription(
      {
        name: 'Испания',
        countryName: 'Испания',
      },
      '<p>Подробный гид по маршруту в Андалусии</p>'
    );

    expect(result).toBe('Подробный гид по маршруту в Андалусии');
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
