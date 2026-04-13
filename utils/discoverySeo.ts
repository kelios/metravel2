const SITE_URL = 'https://metravel.by';
const WEBSITE_ID = `${SITE_URL}/#website`;
const ORGANIZATION_ID = `${SITE_URL}/#organization`;

type BreadcrumbItem = {
  name: string;
  item: string;
};

type MapEntry = {
  name: string;
  url?: string;
  lat?: number | string | null;
  lng?: number | string | null;
  categoryName?: string;
};

type QuestEntry = {
  id?: string | number | null;
  title: string;
  cityId?: string | null;
  cityName?: string | null;
  countryName?: string | null;
  lat?: number | null;
  lng?: number | null;
  cover?: string | null;
  durationMin?: number | null;
};

type QuestDetailInput = {
  canonical: string;
  title: string;
  description: string;
  questId: string;
  cityId?: string;
  cityName?: string | null;
  countryCode?: string | null;
  coverUrl?: string | null;
  stepsCount?: number;
  lat?: number | null;
  lng?: number | null;
};

function toAbsoluteUrl(pathOrUrl?: string | null): string | null {
  const value = String(pathOrUrl || '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value.replace(/^http:\/\//i, 'https://');
  if (value.startsWith('/')) return `${SITE_URL}${value}`;
  return `${SITE_URL}/${value.replace(/^\/+/, '')}`;
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildBreadcrumbList(items: BreadcrumbItem[], id?: string) {
  return {
    '@type': 'BreadcrumbList',
    ...(id ? { '@id': id } : null),
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.item,
    })),
  };
}

function buildBaseGraph() {
  return [
    {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: 'MeTravel',
      url: SITE_URL,
    },
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      url: SITE_URL,
      name: 'MeTravel',
      inLanguage: 'ru',
      publisher: { '@id': ORGANIZATION_ID },
    },
  ];
}

function buildItemList(items: Array<Record<string, unknown>>, id: string, name: string) {
  return {
    '@type': 'ItemList',
    '@id': id,
    name,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item,
    })),
  };
}

export function createMapStructuredData({
  canonical,
  title,
  description,
  entries,
}: {
  canonical: string;
  title: string;
  description: string;
  entries: MapEntry[];
}) {
  const breadcrumbId = `${canonical}#breadcrumb`;
  const itemListId = `${canonical}#items`;
  const breadcrumb = buildBreadcrumbList(
    [
      { name: 'Главная', item: `${SITE_URL}/` },
      { name: 'Карта', item: canonical },
    ],
    breadcrumbId
  );

  const itemListItems = entries.slice(0, 12).map((entry) => {
    const lat = toFiniteNumber(entry.lat);
    const lng = toFiniteNumber(entry.lng);
    return {
      '@type': 'Place',
      name: entry.name,
      ...(entry.url ? { url: toAbsoluteUrl(entry.url) } : null),
      ...(entry.categoryName ? { additionalType: entry.categoryName } : null),
      ...(lat != null && lng != null
        ? {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: lat,
              longitude: lng,
            },
          }
        : null),
    };
  });

  return {
    '@context': 'https://schema.org',
    '@graph': [
      ...buildBaseGraph(),
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        inLanguage: 'ru',
        isPartOf: { '@id': WEBSITE_ID },
        breadcrumb: { '@id': breadcrumbId },
        ...(itemListItems.length
          ? {
              mainEntity: { '@id': itemListId },
            }
          : null),
      },
      ...(itemListItems.length
        ? [buildItemList(itemListItems, itemListId, 'Маршруты и точки на карте')]
        : []),
      breadcrumb,
    ],
  };
}

export function createQuestCatalogStructuredData({
  canonical,
  title,
  description,
  quests,
}: {
  canonical: string;
  title: string;
  description: string;
  quests: QuestEntry[];
}) {
  const breadcrumbId = `${canonical}#breadcrumb`;
  const itemListId = `${canonical}#items`;
  const breadcrumb = buildBreadcrumbList(
    [
      { name: 'Главная', item: `${SITE_URL}/` },
      { name: 'Квесты', item: canonical },
    ],
    breadcrumbId
  );

  const items = quests.slice(0, 12).map((quest) => {
    const lat = toFiniteNumber(quest.lat);
    const lng = toFiniteNumber(quest.lng);
    const questUrl = quest.cityId && quest.id ? `${SITE_URL}/quests/${quest.cityId}/${quest.id}` : null;
    return {
      '@type': 'CreativeWork',
      name: quest.title,
      ...(questUrl ? { url: questUrl } : null),
      ...(quest.cover ? { image: [toAbsoluteUrl(quest.cover)] } : null),
      ...(quest.cityName || quest.countryName
        ? {
            contentLocation: {
              '@type': 'Place',
              ...(quest.cityName ? { name: quest.cityName } : null),
              ...(quest.countryName
                ? {
                    address: {
                      '@type': 'PostalAddress',
                      addressCountry: quest.countryName,
                    },
                  }
                : null),
              ...(lat != null && lng != null
                ? {
                    geo: {
                      '@type': 'GeoCoordinates',
                      latitude: lat,
                      longitude: lng,
                    },
                  }
                : null),
            },
          }
        : null),
      ...(quest.durationMin ? { timeRequired: `PT${Math.max(1, Math.round(quest.durationMin))}M` } : null),
    };
  });

  return {
    '@context': 'https://schema.org',
    '@graph': [
      ...buildBaseGraph(),
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        inLanguage: 'ru',
        isPartOf: { '@id': WEBSITE_ID },
        breadcrumb: { '@id': breadcrumbId },
        ...(items.length ? { mainEntity: { '@id': itemListId } } : null),
      },
      ...(items.length ? [buildItemList(items, itemListId, 'Каталог квестов')] : []),
      breadcrumb,
    ],
  };
}

export function createQuestDetailStructuredData(input: QuestDetailInput) {
  const breadcrumbId = `${input.canonical}#breadcrumb`;
  const creativeWorkId = `${input.canonical}#quest`;
  const breadcrumb = buildBreadcrumbList(
    [
      { name: 'Главная', item: `${SITE_URL}/` },
      { name: 'Квесты', item: `${SITE_URL}/quests` },
      { name: input.title, item: input.canonical },
    ],
    breadcrumbId
  );

  const lat = toFiniteNumber(input.lat);
  const lng = toFiniteNumber(input.lng);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      ...buildBaseGraph(),
      {
        '@type': 'WebPage',
        '@id': `${input.canonical}#webpage`,
        url: input.canonical,
        name: input.title,
        description: input.description,
        inLanguage: 'ru',
        isPartOf: { '@id': WEBSITE_ID },
        breadcrumb: { '@id': breadcrumbId },
        mainEntity: { '@id': creativeWorkId },
      },
      {
        '@type': 'CreativeWork',
        '@id': creativeWorkId,
        name: input.title,
        description: input.description,
        url: input.canonical,
        ...(input.coverUrl ? { image: [toAbsoluteUrl(input.coverUrl)] } : null),
        ...(input.stepsCount ? { numberOfItems: input.stepsCount } : null),
        ...(input.cityName || input.countryCode || lat != null || lng != null
          ? {
              contentLocation: {
                '@type': 'Place',
                ...(input.cityName ? { name: input.cityName } : null),
                ...(input.countryCode
                  ? {
                      address: {
                        '@type': 'PostalAddress',
                        addressCountry: input.countryCode,
                      },
                    }
                  : null),
                ...(lat != null && lng != null
                  ? {
                      geo: {
                        '@type': 'GeoCoordinates',
                        latitude: lat,
                        longitude: lng,
                      },
                    }
                  : null),
              },
            }
          : null),
        ...(input.cityId || input.questId
          ? {
              identifier: `${input.cityId || 'quest'}:${input.questId}`,
            }
          : null),
      },
      breadcrumb,
    ],
  };
}
