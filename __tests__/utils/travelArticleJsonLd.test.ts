import { buildTravelArticleStructuredData, buildTravelBreadcrumbStructuredData } from '@/utils/travelArticleJsonLd'

describe('shared travel SSR/static structured data', () => {
  it('preserves the static Article author, publisher, dates, canonical and normalized image', () => {
    expect(buildTravelArticleStructuredData({
      headline: 'Название', description: 'Описание', canonical: 'https://metravel.by/travels/demo',
      image: 'https://metravel.by/gallery/1?w=1280',
      language: 'pl',
      travel: {
        userName: 'Автор',
        date_create: '2010-01-01',
        date_update: '2026-01-01',
        created_at: '2010-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        published_at: '2025-01-01T00:00:00Z',
        published_at_estimated: false,
      },
    })).toMatchObject({
      '@type': 'Article', headline: 'Название', description: 'Описание',
      inLanguage: 'pl',
      mainEntityOfPage: 'https://metravel.by/travels/demo', url: 'https://metravel.by/travels/demo',
      author: { name: 'Автор' }, publisher: { logo: { url: 'https://metravel.by/assets/icons/logo_yellow_60x60.png' } },
      // #3365: точный published_at. date_create и date_update сюда не идут.
      datePublished: '2025-01-01T00:00:00.000Z', dateModified: '2025-01-01T00:00:00.000Z', image: ['https://metravel.by/gallery/1?w=1280'],
    })
    expect(buildTravelArticleStructuredData({ headline: '', canonical: '/demo' })).toBeNull()
  })

  it('keeps the published discovery breadcrumb rather than switching it to search', () => {
    const breadcrumb = buildTravelBreadcrumbStructuredData({ headline: 'Название', canonical: 'https://metravel.by/travels/demo' })
    expect(breadcrumb).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, name: 'Главная', item: 'https://metravel.by/' },
        { position: 2, name: 'Путешествия', item: 'https://metravel.by/travelsby' },
        { position: 3, name: 'Название', item: 'https://metravel.by/travels/demo' },
      ],
    })
  })

  it.each([
    ['present', { content_updated_at: '2026-10-05T09:00:00Z' }, '2026-10-05T09:00:00.000Z'],
    ['null', { content_updated_at: null }, '2017-02-01T12:00:00.000Z'],
    ['absent', {}, '2017-02-01T12:00:00.000Z'],
  ])('dateModified follows content_updated_at when %s, never updated_at (#3237)', (_label, extra, expected) => {
    const data = buildTravelArticleStructuredData({
      headline: 'Тиволи', canonical: 'https://metravel.by/travels/tivoli',
      travel: { created_at: '2017-02-01T12:00:00Z', updated_at: '2026-09-23T07:54:00Z', ...extra },
    })
    expect(data).toMatchObject({ dateModified: expected })
    expect(data).not.toHaveProperty('datePublished')
  })

  it('uses the exact published_at and skips an estimated one (#3365)', () => {
    const exact = buildTravelArticleStructuredData({
      headline: 'Тиволи', canonical: 'https://metravel.by/travels/tivoli',
      travel: {
        created_at: '2017-02-01T12:00:00Z',
        published_at: '2026-11-02T21:37:00.883Z',
        published_at_estimated: false,
        content_updated_at: '2026-10-05T09:00:00Z',
      },
    })
    expect(exact).toMatchObject({
      datePublished: '2026-11-02T21:37:00.883Z',
      dateModified: '2026-11-02T21:37:00.883Z',
    })

    const estimated = buildTravelArticleStructuredData({
      headline: 'Тиволи', canonical: 'https://metravel.by/travels/tivoli',
      travel: {
        created_at: '2017-02-01T12:00:00Z',
        published_at: '2026-10-18T00:00:00Z',
        published_at_estimated: true,
      },
    })
    expect(estimated).not.toHaveProperty('datePublished')
    expect(estimated).toMatchObject({ dateModified: '2017-02-01T12:00:00.000Z' })
  })
})
