import { buildRouteMetadata } from '@/utils/seoRoutes/metadata';

describe('utils/seoRoutes/metadata buildRouteMetadata (#2740)', () => {
  it('emits the full LazyInstantSEO tag set', () => {
    expect(
      buildRouteMetadata({
        title: 'Квесты | Metravel',
        description: 'Описание',
        canonical: 'https://metravel.by/quests',
        image: 'https://metravel.by/og/quests.jpg',
        imageAlt: 'Квесты',
        imageWidth: 1200,
        imageHeight: 630,
        ogType: 'website',
        robots: 'noindex, follow',
        ogLocale: 'ru_RU',
        alternates: { ru: 'https://metravel.by/quests', 'x-default': 'https://metravel.by/quests' },
      }),
    ).toEqual({
      title: 'Квесты | Metravel',
      description: 'Описание',
      robots: 'noindex, follow',
      alternates: {
        canonical: 'https://metravel.by/quests',
        languages: { ru: 'https://metravel.by/quests', 'x-default': 'https://metravel.by/quests' },
      },
      openGraph: {
        type: 'website',
        title: 'Квесты | Metravel',
        siteName: 'MeTravel',
        description: 'Описание',
        url: 'https://metravel.by/quests',
        images: [{ url: 'https://metravel.by/og/quests.jpg', secureUrl: 'https://metravel.by/og/quests.jpg', width: 1200, height: 630, alt: 'Квесты' }],
        locale: 'ru_RU',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Квесты | Metravel',
        description: 'Описание',
        images: [{ url: 'https://metravel.by/og/quests.jpg', alt: 'Квесты' }],
      },
    });
  });

  it('falls back to summary card and omits empty optionals', () => {
    const metadata = buildRouteMetadata({ title: ' Metravel ', description: '  ', robots: '', canonical: null });
    expect(metadata).toEqual({
      title: 'Metravel',
      openGraph: { type: 'website', title: 'Metravel', siteName: 'MeTravel' },
      twitter: { card: 'summary', title: 'Metravel' },
    });
  });

  it('requires a title', () => {
    expect(() => buildRouteMetadata({ title: '' })).toThrow(/title is required/);
  });
});
