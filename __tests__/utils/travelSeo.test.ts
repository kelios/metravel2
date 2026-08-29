import {
  buildTravelPath,
  buildTravelSeoFallbackDescription,
  buildTravelSeoFallbackTitle,
  buildTravelSeoTitle,
  createTravelArticleJsonLd,
  createTravelBreadcrumbJsonLd,
  createTravelStructuredData,
  getTravelSeoDescription,
  stripHtmlForSeo,
} from '@/utils/travelSeo';

describe('travelSeo', () => {
  it('strips html for seo descriptions', () => {
    expect(stripHtmlForSeo('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
    expect(stripHtmlForSeo('<p>Жемыславле</p><p>Дворец Умястовских</p>')).toBe(
      'Жемыславле Дворец Умястовских',
    );
  });

  it('builds stable travel seo title and description fallbacks', () => {
    // Длинный заголовок держится в бюджете SERP за счёт бренд-суффикса, а не ключевых слов.
    const long = buildTravelSeoTitle('  Очень длинный   заголовок маршрута   '.repeat(4));
    expect(long).toMatch(/…$/);
    expect(long).not.toContain(' | Metravel');
    expect(long.length).toBeLessThanOrEqual(60);
    expect(buildTravelSeoTitle('Смолевуд: натурная площадка Беларусьфильма под Минском')).toBe(
      'Смолевуд: натурная площадка Беларусьфильма под Минском',
    );
    expect(buildTravelSeoTitle('')).toBe('Metravel');
    expect(getTravelSeoDescription('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
    expect(getTravelSeoDescription('')).toBe('Найди место для путешествия и поделись своим опытом.');
  });

  // Сниппет чистится от декора, а название — нет: правило служебной строки
  // не должно резать осмысленный заголовок.
  it('cleans the snippet lead but leaves names untouched', () => {
    expect(getTravelSeoDescription('<p>🏰 Форты Первой мировой 📍 Местоположение</p>')).toBe(
      'Форты Первой мировой Местоположение',
    );
    expect(getTravelSeoDescription('<p>Краков - Каспровый Верх (107км 1 час 40 минут) Каспровый Верх (1987 м)</p>')).toBe(
      'Каспровый Верх (1987 м)',
    );
    expect(stripHtmlForSeo('Маршрут Краков - Закопане (107 км) за день')).toBe(
      'Маршрут Краков - Закопане (107 км) за день',
    );
  });

  it('builds unique slug/id fallbacks for incomplete travel SEO data', () => {
    expect(buildTravelSeoFallbackTitle('park-grudek-v-iavozhno-polskie-maldivy')).toBe(
      'Park grudek iavozhno polskie maldivy | Metravel',
    );
    expect(buildTravelSeoFallbackTitle(628)).toBe('Путешествие 628 | Metravel');
    expect(buildTravelSeoFallbackDescription('vitebsk-chto-mozhno-posmotret')).toContain(
      'Маршрут Vitebsk chto mozhno posmotret на Metravel',
    );
  });

  it('creates article json-ld for travel pages', () => {
    const jsonLd = createTravelArticleJsonLd({
      id: 42,
      slug: 'demo-travel',
      name: 'Demo <b>travel</b>',
      description: '<p>Long <strong>description</strong></p>',
      gallery: [{ url: 'https://cdn.example.com/photo.jpg' }],
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-02T00:00:00.000Z',
      user: { name: 'Author <i>Name</i>' },
    } as any);

    expect(jsonLd).toMatchObject({
      '@type': 'Article',
      headline: 'Demo travel',
      description: 'Long description',
      url: 'https://metravel.by/travels/demo-travel',
    });
    expect(jsonLd?.image).toEqual(['https://cdn.example.com/photo.jpg']);
    expect(jsonLd?.author).toEqual({
      '@type': 'Person',
      name: 'Author Name',
    });
  });

  // #1620: headline is the editorial title only. The branded/truncated
  // "<title>… | Metravel" document title is a separate contract (buildSeoTitle)
  // and must never leak into Article.headline.
  it('never appends the branded document-title suffix to Article.headline', () => {
    const jsonLd = createTravelArticleJsonLd({
      id: 7,
      slug: 'озеро-хотомле',
      name: 'Озеро Хотомле',
    } as any);

    expect(jsonLd?.headline).toBe('Озеро Хотомле');
    expect(jsonLd?.headline).not.toContain('Metravel');
    expect(jsonLd?.headline).not.toMatch(/…$/);
  });

  // #1620: datePublished must come from a real source field. When the API
  // payload has no created_at (current production contract — see
  // travels/serializers.py, the column exists but is not exposed), the
  // fallback is to omit the field, never to fabricate today's date.
  it('omits datePublished when the source has no created_at (fails closed)', () => {
    const jsonLd = createTravelArticleJsonLd({
      id: 8,
      slug: 'demo-no-date',
      name: 'Demo no date',
      updated_at: '2025-01-02T00:00:00.000Z',
    } as any);

    expect(jsonLd).not.toHaveProperty('datePublished');
    expect(jsonLd?.dateModified).toBe('2025-01-02T00:00:00.000Z');
  });

  it('publishes datePublished verbatim when created_at is a valid source date', () => {
    const jsonLd = createTravelArticleJsonLd({
      id: 9,
      slug: 'demo-with-date',
      name: 'Demo with date',
      created_at: '2024-03-15T10:00:00.000Z',
    } as any);

    expect(jsonLd?.datePublished).toBe('2024-03-15T10:00:00.000Z');
  });

  it('creates breadcrumb json-ld for travel pages', () => {
    const breadcrumb = createTravelBreadcrumbJsonLd({
      id: 42,
      slug: 'demo-travel',
      name: 'Demo <b>travel</b>',
    } as any);

    expect(breadcrumb).toEqual({
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Главная',
          item: 'https://metravel.by/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Поиск',
          item: 'https://metravel.by/search',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Demo travel',
          item: 'https://metravel.by/travels/demo-travel',
        },
      ],
    });
  });

  // #1438: пригодность слага проверялась как `/^[a-z0-9-]+$/`, а литерал 'null'
  // состоит ровно из таких символов — структурированные данные ссылались на
  // `https://metravel.by/travels/null`, тот же адрес в 404, что и canonical.
  it('never publishes the literal emptiness marker as the page address', () => {
    const jsonLd = createTravelStructuredData({
      id: 228,
      slug: 'null',
      name: 'Гродненские форты',
      description: '<p>Описание</p>',
      gallery: [],
    } as any);

    expect(JSON.stringify(jsonLd)).not.toContain('/travels/null');
    // #1512: числовой адрес отдаёт пустой 404 при прямом заходе, поэтому и он
    // краулерам не объявляется — страница просто остаётся без собственного @id.
    expect(JSON.stringify(jsonLd)).not.toContain('/travels/228');
  });

  it('uses the address the page already declared in canonical', () => {
    const canonicalUrl =
      'https://metravel.by/travels/grodnenskie-forty-no4-i-no6-peshchery-i-skaly';
    const jsonLd = createTravelStructuredData(
      {
        id: 228,
        slug: 'null',
        name: 'Гродненские форты',
        description: '<p>Описание</p>',
        gallery: [],
      } as any,
      { canonicalUrl }
    );

    expect(jsonLd?.['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ '@type': 'WebPage', url: canonicalUrl }),
        expect.objectContaining({
          '@type': 'Article',
          mainEntityOfPage: { '@id': `${canonicalUrl}#webpage` },
        }),
      ])
    );
  });

  it('creates a structured data graph for travel pages', () => {
    const jsonLd = createTravelStructuredData({
      id: 42,
      slug: 'demo-travel',
      name: 'Demo <b>travel</b>',
      description: '<p>Long <strong>description</strong></p>',
      gallery: [{ url: 'https://cdn.example.com/photo.jpg' }],
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-02T00:00:00.000Z',
      user: { name: 'Author <i>Name</i>' },
    } as any);

    expect(jsonLd?.['@context']).toBe('https://schema.org');
    expect(Array.isArray(jsonLd?.['@graph'])).toBe(true);
    expect(jsonLd?.['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          '@type': 'WebPage',
          '@id': 'https://metravel.by/travels/demo-travel#webpage',
          url: 'https://metravel.by/travels/demo-travel',
        }),
        expect.objectContaining({
          '@type': 'Article',
          '@id': 'https://metravel.by/travels/demo-travel#article',
          headline: 'Demo travel',
          mainEntityOfPage: { '@id': 'https://metravel.by/travels/demo-travel#webpage' },
        }),
        expect.objectContaining({
          '@type': 'BreadcrumbList',
          '@id': 'https://metravel.by/travels/demo-travel#breadcrumb',
        }),
      ])
    );
  });

  // #1622: the global Organization identity (name/url/logo/sameAs) is already
  // published once per page by the static HTML shell (app/+html.tsx, same
  // `https://metravel.by/#organization` id). A second top-level Organization
  // node here left the hydrated DOM with two Organization JSON-LD payloads for
  // one entity — this graph must stay a single owner and not re-declare it.
  it('does not re-declare a top-level Organization node (single owner, #1622)', () => {
    const jsonLd = createTravelStructuredData({
      id: 42,
      slug: 'demo-travel',
      name: 'Demo travel',
      description: '<p>Long description</p>',
      gallery: [],
    } as any);

    const graph = (jsonLd?.['@graph'] ?? []) as Array<Record<string, unknown>>;
    expect(graph.some((node) => node['@type'] === 'Organization')).toBe(false);
    expect(graph.map((node) => node['@type'])).toEqual(['WebPage', 'Article', 'BreadcrumbList']);
  });

  // #1438: эта функция — второй, «слабый» `buildTravelPath` рядом с
  // `utils/routePaths`. Собственная проверка `key !== ''` пропускала литералы
  // пустоты, и share-ссылка с записью избранного получали адрес в 404.
  describe('buildTravelPath', () => {
    it('builds the path from a slug or a numeric id', () => {
      expect(buildTravelPath({ slug: 'grodno', id: 7 } as any)).toBe('/travels/grodno');
      expect(buildTravelPath({ slug: '', id: 7 } as any)).toBe('/travels/7');
      // Испорченный слаг не должен «съедать» здоровый id.
      expect(buildTravelPath({ slug: 'null', id: 7 } as any)).toBe('/travels/7');
    });

    it.each([
      [{ slug: null, id: null }],
      [{ slug: '', id: undefined }],
      [{ slug: 'null', id: null }],
      [{ slug: '', id: 'undefined' }],
      [{ slug: '', id: Number.NaN }],
    ])('returns null for an unusable identity %p', (travel) => {
      expect(buildTravelPath(travel as any)).toBeNull();
    });

    it('returns null without a travel', () => {
      expect(buildTravelPath(null)).toBeNull();
      expect(buildTravelPath(undefined)).toBeNull();
    });
  });
});
