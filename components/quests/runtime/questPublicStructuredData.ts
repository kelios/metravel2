import type { QuestPublicProjection } from '@/utils/questPublicPage';
import { normalizeOgImageUrl } from '@/utils/seo';
import { translate } from '@/i18n';

export function questPublicAlternates(data: QuestPublicProjection): Record<string, string> {
  if (data.versions.length < 2 || !data.ru_source_path) return {};
  return Object.fromEntries([...data.versions.map((version) => [version.locale, 'https://metravel.by' + version.path]),
    ['x-default', 'https://metravel.by' + data.ru_source_path]]);
}

export function buildQuestPublicStructuredData(data: QuestPublicProjection) {
  const { page } = data;
  const breadcrumb = { '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: translate('seoStatic:structuredData.home'), item: 'https://metravel.by/' },
    { '@type': 'ListItem', position: 2, name: translate('seoStatic:structuredData.quests'), item: 'https://metravel.by/quests' },
    { '@type': 'ListItem', position: 3, name: page.heading, item: page.meta.canonical },
  ] };
  const entity = data.kind === 'detail' ? {
    '@type': 'TouristTrip', name: page.meta.title, description: page.meta.description,
    url: page.meta.canonical, mainEntityOfPage: page.meta.canonical, inLanguage: data.locale,
    touristType: page.meta.tourist_type,
    provider: { '@type': 'Organization', name: 'MeTravel', url: 'https://metravel.by' },
    image: [normalizeOgImageUrl(page.meta.image)].filter(Boolean),
    ...(page.meta.city_name ? { location: { '@type': 'City', name: page.meta.city_name } } : {}),
  } : {
    '@type': 'ItemList', name: page.heading, url: page.meta.canonical,
    itemListElement: page.sections.flatMap((section) => section.items)
      .filter((item) => item.path && /^\/quests\/[^/]+\/[^/]+$/.test(item.path) && !item.path.startsWith('/quests/country/'))
      .map((item, index) => ({ '@type': 'ListItem', position: index + 1, url: 'https://metravel.by' + item.path, name: item.title })),
  };
  return { '@context': 'https://schema.org', '@graph': [entity, breadcrumb] };
}

