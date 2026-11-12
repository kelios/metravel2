import { translate as i18nT } from '@/i18n'
import { getActiveLocaleDefinition } from '@/i18n/format'
import { questCatalogPathForLocale } from '@/utils/questLocaleHubs'
import { buildQuestTouristTrip } from '@/utils/questTouristTrip'
const SITE_URL = 'https://metravel.by';
// The static HTML shell owns the WebSite/Organization declarations. Discovery
// payloads only link to that shared identity and must not re-declare it.
const WEBSITE_ID = `${SITE_URL}/#website`;

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
  /** Plain quest name for the last crumb and the quest entity; `title` carries the « | Metravel» suffix. */
  crumbName?: string;
  description: string;
  inLanguage?: string;
  cityName?: string | null;
  coverUrl?: string | null;
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

function buildItemList(items: Array<Record<string, unknown>>, id: string, name: string, total?: number) {
  return {
    '@type': 'ItemList',
    '@id': id,
    name,
    // #3218: список может перечислять только начало каталога — размер всего
    // каталога называется явно, иначе разметка расходится со страницей.
    ...(total != null && total >= items.length ? { numberOfItems: total } : null),
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
      { name: i18nT('seoStatic:structuredData.home'), item: `${SITE_URL}/` },
      { name: i18nT('seoStatic:structuredData.map'), item: canonical },
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
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        inLanguage: getActiveLocaleDefinition().htmlLang,
        isPartOf: { '@id': WEBSITE_ID },
        breadcrumb: { '@id': breadcrumbId },
        ...(itemListItems.length
          ? {
              mainEntity: { '@id': itemListId },
            }
          : null),
      },
      ...(itemListItems.length
        ? [buildItemList(itemListItems, itemListId, i18nT('seo:utils.discoverySeo.marshruty_i_tochki_na_karte_66b1e613'))]
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
      { name: i18nT('seoStatic:structuredData.home'), item: `${SITE_URL}/` },
      { name: i18nT('seoStatic:structuredData.quests'), item: canonical },
    ],
    breadcrumbId
  );

  const items = quests.slice(0, 50).map((quest) => {
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
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        inLanguage: getActiveLocaleDefinition().htmlLang,
        isPartOf: { '@id': WEBSITE_ID },
        breadcrumb: { '@id': breadcrumbId },
        ...(items.length ? { mainEntity: { '@id': itemListId } } : null),
      },
      ...(items.length ? [buildItemList(items, itemListId, i18nT('seo:utils.discoverySeo.katalog_kvestov_ffeb5cb5'), quests.length)] : []),
      breadcrumb,
    ],
  };
}

/** Gameplay-screen graph when no published projection is at hand (dev, offline): the same entity, no route facts. */
export function createQuestDetailStructuredData(input: QuestDetailInput) {
  const breadcrumbId = `${input.canonical}#breadcrumb`;
  const questEntityId = `${input.canonical}#quest`;
  const breadcrumb = buildBreadcrumbList(
    [
      { name: i18nT('seoStatic:structuredData.home'), item: `${SITE_URL}/` },
      { name: i18nT('seoStatic:structuredData.quests'), item: `${SITE_URL}${questCatalogPathForLocale(input.inLanguage)}` },
      { name: input.crumbName || input.title, item: input.canonical },
    ],
    breadcrumbId
  );
  const inLanguage = input.inLanguage ?? getActiveLocaleDefinition().htmlLang;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${input.canonical}#webpage`,
        url: input.canonical,
        name: input.title,
        description: input.description,
        inLanguage,
        isPartOf: { '@id': WEBSITE_ID },
        breadcrumb: { '@id': breadcrumbId },
        mainEntity: { '@id': questEntityId },
      },
      {
        ...buildQuestTouristTrip({
          // #3238: the quest is named by itself; the branded `<title>` names the page.
          name: input.crumbName || input.title,
          description: input.description,
          url: input.canonical,
          inLanguage,
          image: toAbsoluteUrl(input.coverUrl),
          cityName: input.cityName,
        }),
        '@id': questEntityId,
      },
      breadcrumb,
    ],
  };
}
