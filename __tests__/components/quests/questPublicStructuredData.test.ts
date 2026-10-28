import { buildQuestPublicStructuredData, questPublicAlternates } from '@/components/quests/runtime/questPublicStructuredData';
import { jsonLdScript } from '@/components/seo/jsonLdScript';
import type { QuestPublicProjection } from '@/utils/questPublicPage';
import { questPrivateSnapshot, questPublicLocales } from '../../fixtures/questPublicProjection';
const { buildQuestWebProjection } = require('@/scripts/lib/questWebProjection');
const { loadSsgCatalogs } = require('@/i18n/babel-inline-plugin');
const path = require('node:path');

jest.mock('@/components/quests/runtime/questRouteLoader', () => { throw new Error('Server loader imported by client presentation'); });
jest.mock('@/utils/seoRoutes/routeMetadata', () => { throw new Error('Server metadata imported by client presentation'); });

const source = buildQuestWebProjection(questPrivateSnapshot(), loadSsgCatalogs(path.resolve(__dirname, '../../..')).catalogs);
const details = source.pages.filter((entry: { kind: string }) => entry.kind === 'detail');
const detailFor = (locale: string): QuestPublicProjection => ({
  ...details.find((entry: { locale: string }) => entry.locale === locale),
  ru_source_path: '/quests/7/fixture-city-walk',
  versions: details.map((entry: { locale: string; canonical_path: string; content_revision: string }) => ({
    locale: entry.locale, path: entry.canonical_path, content_revision: entry.content_revision,
  })),
});

describe('client quest structured data', () => {
  it('keeps reciprocal alternates and the Russian default without inventing a second version', () => {
    const detail = detailFor('pl');
    expect(questPublicAlternates(detail)).toEqual(Object.fromEntries([
      ...detail.versions.map((entry) => [entry.locale, 'https://metravel.by' + entry.path]),
      ['x-default', 'https://metravel.by/quests/7/fixture-city-walk'],
    ]));
    expect(questPublicAlternates({ ...detail, versions: detail.versions.slice(0, 1) })).toEqual({});
    expect(questPublicAlternates({ ...detail, ru_source_path: null })).toEqual({});
  });

  it.each(questPublicLocales)('preserves the actual %s projection entity and breadcrumb', (locale) => {
    const detail = detailFor(locale);
    const data = buildQuestPublicStructuredData(detail);
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@graph'][0]).toMatchObject({
      '@type': 'TouristTrip', inLanguage: locale, name: detail.page.meta.title,
      description: detail.page.meta.description, url: detail.page.meta.canonical,
      mainEntityOfPage: detail.page.meta.canonical,
      touristType: detail.page.meta.tourist_type,
      location: { '@type': 'City', name: detail.page.meta.city_name },
      provider: { '@type': 'Organization', name: 'MeTravel', url: 'https://metravel.by' },
    });
    expect(data['@graph'][1]).toMatchObject({ '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, item: 'https://metravel.by/' },
      { '@type': 'ListItem', position: 2, item: 'https://metravel.by/quests' },
      { '@type': 'ListItem', position: 3, name: detail.page.heading, item: detail.page.meta.canonical },
    ] });
  });

  it.each(['city', 'country'] as const)('preserves the real %s projection list and breadcrumb', (kind) => {
    const landing: QuestPublicProjection = {
      ...source.pages.find((entry: { kind: string }) => entry.kind === kind),
      versions: [], ru_source_path: null,
    };
    expect(buildQuestPublicStructuredData(landing)).toEqual({
      '@context': 'https://schema.org', '@graph': [
        { '@type': 'ItemList', name: landing.page.heading, url: landing.page.meta.canonical, itemListElement: [
          { '@type': 'ListItem', position: 1, url: 'https://metravel.by/quests/7/fixture-city-walk', name: 'Квест по городу' },
        ] },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: 'https://metravel.by/' },
          { '@type': 'ListItem', position: 2, name: 'Квесты', item: 'https://metravel.by/quests' },
          { '@type': 'ListItem', position: 3, name: landing.page.heading, item: landing.page.meta.canonical },
        ] },
      ],
    });
    expect(questPublicAlternates(landing)).toEqual({});
  });

  it('normalizes the detail cover and omits absent image and city fields', () => {
    const detail = detailFor('ru');
    const meta = { ...detail.page.meta, image: 'http://example.org/cover.jpg' };
    expect(buildQuestPublicStructuredData({ ...detail, page: { ...detail.page, meta } })['@graph'][0])
      .toMatchObject({ image: ['https://example.org/cover.jpg'] });
    const withoutMediaOrCity = buildQuestPublicStructuredData({ ...detail,
      page: { ...detail.page, meta: { ...meta, image: null, city_name: null } },
    })['@graph'][0];
    expect(withoutMediaOrCity).toHaveProperty('image', []);
    expect(withoutMediaOrCity).not.toHaveProperty('location');
  });

  it('roundtrips hostile title text through the real JSON-LD script boundary', () => {
    const detail = detailFor('ru');
    const title = '</script><script>alert(1)</script>\u2028&';
    const structured = buildQuestPublicStructuredData({ ...detail,
      page: { ...detail.page, meta: { ...detail.page.meta, title } },
    });
    const script = jsonLdScript(structured);
    expect(script.props.type).toBe('application/ld+json');
    expect(script.props.children).not.toContain('</script>');
    expect(JSON.parse(script.props.children)['@graph'][0].name).toBe(title);
  });

  it('includes only quest detail links in landing lists and preserves their numbering', () => {
    const detail = detailFor('ru');
    const city: QuestPublicProjection = { ...detail, kind: 'city', page: { ...detail.page, sections: [{ heading: '', paragraphs: [], items: [
      { path: '/quests/7/first', title: 'First' }, { path: '/quests/country/BY', title: 'Country' },
      { path: '/search', title: 'Search' }, { path: '/quests/7/second', title: 'Second' },
    ].map((item) => ({ ...item, text: '', facts: '', lang: null })) }] } };
    expect(buildQuestPublicStructuredData(city)['@graph'][0]).toMatchObject({ '@type': 'ItemList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'First', url: 'https://metravel.by/quests/7/first' },
      { '@type': 'ListItem', position: 2, name: 'Second', url: 'https://metravel.by/quests/7/second' },
    ] });
  });
});
