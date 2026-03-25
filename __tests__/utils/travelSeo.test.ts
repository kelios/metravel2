import {
  buildTravelSeoTitle,
  createTravelArticleJsonLd,
  getTravelSeoDescription,
  stripHtmlForSeo,
} from '@/utils/travelSeo';

describe('travelSeo', () => {
  it('strips html for seo descriptions', () => {
    expect(stripHtmlForSeo('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('builds stable travel seo title and description fallbacks', () => {
    expect(buildTravelSeoTitle('  Очень длинный   заголовок маршрута   '.repeat(4))).toMatch(/ \| Metravel$/);
    expect(buildTravelSeoTitle('')).toBe('Metravel');
    expect(getTravelSeoDescription('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
    expect(getTravelSeoDescription('')).toBe('Найди место для путешествия и поделись своим опытом.');
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
});
