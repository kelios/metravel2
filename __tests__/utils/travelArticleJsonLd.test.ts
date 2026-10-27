import { buildTravelArticleStructuredData, buildTravelBreadcrumbStructuredData } from '@/utils/travelArticleJsonLd'

describe('shared travel SSR/static structured data', () => {
  it('preserves the static Article author, publisher, dates, canonical and normalized image', () => {
    expect(buildTravelArticleStructuredData({
      headline: 'Название', description: 'Описание', canonical: 'https://metravel.by/travels/demo',
      image: 'https://metravel.by/gallery/1?w=1280',
      language: 'pl',
      travel: { userName: 'Автор', date_create: '2025-01-01', date_update: '2026-01-01' },
    })).toMatchObject({
      '@type': 'Article', headline: 'Название', description: 'Описание',
      inLanguage: 'pl',
      mainEntityOfPage: 'https://metravel.by/travels/demo', url: 'https://metravel.by/travels/demo',
      author: { name: 'Автор' }, publisher: { logo: { url: 'https://metravel.by/assets/icons/logo_yellow_60x60.png' } },
      datePublished: '2025-01-01', dateModified: '2026-01-01', image: ['https://metravel.by/gallery/1?w=1280'],
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
})
