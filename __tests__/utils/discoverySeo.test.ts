import {
  createMapStructuredData,
  createQuestCatalogStructuredData,
  createQuestDetailStructuredData,
} from '@/utils/discoverySeo';

const WEBSITE_ID = 'https://metravel.by/#website';

type GraphNode = Record<string, unknown>;

function expectPageScopedGraph(
  jsonLd: { '@graph': GraphNode[] },
  expectedTypes: string[],
) {
  const graph = jsonLd['@graph'];

  // #1639: app/+html.tsx is the single owner of the global WebSite and
  // Organization nodes; hydrated discovery payloads retain only @id links.
  expect(graph.map((node) => node['@type'])).toEqual(expectedTypes);
  expect(
    graph.filter((node) => node['@type'] === 'Organization' || node['@type'] === 'WebSite'),
  ).toEqual([]);
  expect(graph[0]).toEqual(
    expect.objectContaining({
      isPartOf: { '@id': WEBSITE_ID },
    }),
  );
}

describe('discoverySeo', () => {
  it('creates structured data for the map page', () => {
    const jsonLd = createMapStructuredData({
      canonical: 'https://metravel.by/map',
      title: 'Карта маршрутов и достопримечательностей Беларуси | Metravel',
      description: 'Интерактивная карта путешествий.',
      entries: [
        {
          name: 'Мирский замок',
          url: '/travels/mirskii-zamok',
          lat: 53.4529,
          lng: 26.4722,
          categoryName: 'Замок',
        },
      ],
    });

    expect(jsonLd['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          '@type': 'CollectionPage',
          '@id': 'https://metravel.by/map#webpage',
        }),
        expect.objectContaining({
          '@type': 'ItemList',
          '@id': 'https://metravel.by/map#items',
        }),
        expect.objectContaining({
          '@type': 'BreadcrumbList',
          '@id': 'https://metravel.by/map#breadcrumb',
        }),
      ])
    );
    expectPageScopedGraph(jsonLd, ['CollectionPage', 'ItemList', 'BreadcrumbList']);
  });

  it('creates page-scoped structured data for the quest map', () => {
    const jsonLd = createMapStructuredData({
      canonical: 'https://metravel.by/quests/map',
      title: 'Карта квестов | MeTravel',
      description: 'Городские квесты на карте.',
      entries: [
        {
          name: 'Минский цмок',
          url: '/quests/minsk/minsk-cmok',
          lat: 53.9,
          lng: 27.56,
          categoryName: 'Квест',
        },
      ],
    });

    expect(jsonLd['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          '@type': 'CollectionPage',
          '@id': 'https://metravel.by/quests/map#webpage',
        }),
        expect.objectContaining({
          '@type': 'ItemList',
          '@id': 'https://metravel.by/quests/map#items',
        }),
        expect.objectContaining({
          '@type': 'BreadcrumbList',
          '@id': 'https://metravel.by/quests/map#breadcrumb',
        }),
      ]),
    );
    expectPageScopedGraph(jsonLd, ['CollectionPage', 'ItemList', 'BreadcrumbList']);
  });

  it('creates structured data for quests catalog', () => {
    const jsonLd = createQuestCatalogStructuredData({
      canonical: 'https://metravel.by/quests',
      title: 'Квесты | MeTravel',
      description: 'Каталог квестов.',
      quests: [
        {
          id: 'minsk-cmok',
          cityId: 'minsk',
          title: 'Минский цмок',
          cityName: 'Минск',
          countryName: 'Беларусь',
          lat: 53.9,
          lng: 27.56,
          durationMin: 90,
          cover: 'https://cdn.metravel.by/quests/minsk.jpg',
        },
      ],
    });

    expect(jsonLd['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          '@type': 'CollectionPage',
          '@id': 'https://metravel.by/quests#webpage',
        }),
        expect.objectContaining({
          '@type': 'ItemList',
          '@id': 'https://metravel.by/quests#items',
        }),
      ])
    );
    expectPageScopedGraph(jsonLd, ['CollectionPage', 'ItemList', 'BreadcrumbList']);
  });

  it('creates structured data for a quest detail page', () => {
    const jsonLd = createQuestDetailStructuredData({
      canonical: 'https://metravel.by/quests/minsk/minsk-cmok',
      title: 'Минский цмок | MeTravel',
      description: 'Маршрут и задания городского квеста.',
      questId: 'minsk-cmok',
      cityId: 'minsk',
      cityName: 'Минск',
      countryCode: 'BY',
      coverUrl: 'https://cdn.metravel.by/quests/minsk.jpg',
      stepsCount: 7,
      lat: 53.9,
      lng: 27.56,
    });

    expect(jsonLd['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          '@type': 'WebPage',
          '@id': 'https://metravel.by/quests/minsk/minsk-cmok#webpage',
        }),
        expect.objectContaining({
          '@type': 'CreativeWork',
          '@id': 'https://metravel.by/quests/minsk/minsk-cmok#quest',
          identifier: 'minsk:minsk-cmok',
        }),
        expect.objectContaining({
          '@type': 'BreadcrumbList',
          '@id': 'https://metravel.by/quests/minsk/minsk-cmok#breadcrumb',
        }),
      ])
    );
    expectPageScopedGraph(jsonLd, ['WebPage', 'CreativeWork', 'BreadcrumbList']);
  });
});
