import {
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
});
