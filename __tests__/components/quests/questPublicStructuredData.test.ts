import { buildQuestPublicStructuredData, questPublicAlternates } from '@/components/quests/runtime/questPublicStructuredData';
import { jsonLdScript } from '@/components/seo/jsonLdScript';
import type { QuestPublicProjection } from '@/utils/questPublicPage';
import { createQuestDetailStructuredData } from '@/utils/discoverySeo';
import { Platform } from 'react-native';
import { questPrivateSnapshot, questPublicApiResponse, questPublicLocales } from '../../fixtures/questPublicProjection';
import { expectQuestEntityInSchemaDomain } from '../../fixtures/questEntitySchemaDomain';
const { buildQuestWebProjection } = require('@/scripts/lib/questWebProjection');
const { loadSsgCatalogs } = require('@/i18n/babel-inline-plugin');
const path = require('node:path');

jest.mock('@/components/quests/runtime/questRouteLoader', () => { throw new Error('Server loader imported by client presentation'); });
jest.mock('@/utils/seoRoutes/routeMetadata', () => { throw new Error('Server metadata imported by client presentation'); });

const snapshot = questPrivateSnapshot();
const source = buildQuestWebProjection(snapshot, loadSsgCatalogs(path.resolve(__dirname, '../../..')).catalogs);
const detailFor = (locale: (typeof questPublicLocales)[number]): QuestPublicProjection =>
  questPublicApiResponse(source.pages, snapshot, locale);

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
      '@type': ['TouristTrip', 'CreativeWork'], inLanguage: locale, name: detail.page.heading,
      description: detail.page.meta.description, url: detail.page.meta.canonical,
      mainEntityOfPage: detail.page.meta.canonical,
      touristType: detail.page.meta.tourist_type,
      contentLocation: { '@type': 'City', name: detail.page.meta.city_name },
      provider: { '@type': 'Organization', name: 'MeTravel', url: 'https://metravel.by' },
    });
    // #3238: the quest name, never the branded `<title>`.
    expect(data['@graph'][0].name).not.toMatch(/\|\s*Metravel/i);
    expect(data['@graph'][1]).toMatchObject({ '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, item: 'https://metravel.by/' },
      { '@type': 'ListItem', position: 2, item: 'https://metravel.by/quests' },
      { '@type': 'ListItem', position: 3, name: detail.page.heading, item: detail.page.meta.canonical },
    ] });
  });

  // #3217: the «Quests» crumb follows the visible navigation rule — the locale hub
  // only while the hubs are published, `/quests` for ru and with hubs off.
  describe('catalogue crumb of a translated page', () => {
    const originalFlag = process.env.EXPO_PUBLIC_QUEST_LOCALE_HUBS;
    const originalOs = Platform.OS;
    afterEach(() => {
      if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_QUEST_LOCALE_HUBS;
      else process.env.EXPO_PUBLIC_QUEST_LOCALE_HUBS = originalFlag;
      Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOs });
    });
    const crumbs = (published: boolean, locale: string) => {
      Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'web' });
      process.env.EXPO_PUBLIC_QUEST_LOCALE_HUBS = published ? 'true' : 'false';
      const ssr = buildQuestPublicStructuredData(detailFor(locale))['@graph'][1].itemListElement[1].item;
      const runtime = createQuestDetailStructuredData({
        canonical: `https://metravel.by/${locale}/quests/7/fixture-city-walk`, title: 'T | Metravel',
        description: 'D', inLanguage: locale,
      })['@graph'].find((node: { '@type'?: string }) => node['@type'] === 'BreadcrumbList') as { itemListElement: Array<{ item: string }> };
      return [ssr, runtime.itemListElement[1].item];
    };

    it('points to the locale hub when the hubs are published', () => {
      expect(crumbs(true, 'pl')).toEqual(['https://metravel.by/pl/quests', 'https://metravel.by/pl/quests']);
      expect(crumbs(true, 'ru')).toEqual(['https://metravel.by/quests', 'https://metravel.by/quests']);
    });

    it('keeps /quests while the hubs are off', () => {
      expect(crumbs(false, 'en')).toEqual(['https://metravel.by/quests', 'https://metravel.by/quests']);
    });
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
    expect(withoutMediaOrCity).not.toHaveProperty('contentLocation');
  });

  // #3321: the backend's trip_facts (#3317) become route facts of the one quest node.
  it('carries duration, distance, start and free access of the published route into the one quest node', () => {
    const detail = detailFor('ru');
    // The fixture answers the facts the backend derives from its snapshot: 90 minutes,
    // ten points 0.001° of latitude apart (nine legs of ~111 m), the first point as start.
    expect(detail.trip_facts).toEqual({ duration_min: 90, distance_m: 1001, start: { lat: 53.9, lng: 27.5 }, is_free: true });
    const graph = buildQuestPublicStructuredData(detail)['@graph'];
    expect(graph.map((node) => node['@type'])).toEqual([['TouristTrip', 'CreativeWork'], 'BreadcrumbList']);
    expect(graph[0]).toMatchObject({
      timeRequired: 'PT90M', isAccessibleForFree: true,
      potentialAction: { '@type': 'TravelAction', distance: '1001 m' },
      tripOrigin: { '@type': 'Place', geo: { '@type': 'GeoCoordinates', latitude: 53.9, longitude: 27.5 } },
    });
    expect(graph[0]).not.toHaveProperty('distance');
    expect(graph[0]).not.toHaveProperty('location');
    expect(buildQuestPublicStructuredData({ ...detail,
      trip_facts: { duration_min: null, distance_m: null, start: null, is_free: false } })['@graph'][0]).toMatchObject({ isAccessibleForFree: false });
  });

  it('omits every route fact the backend does not know instead of inventing one', () => {
    const detail = detailFor('ru');
    const partial = buildQuestPublicStructuredData({ ...detail,
      trip_facts: { duration_min: null, distance_m: null, start: null, is_free: false } })['@graph'][0];
    for (const key of ['timeRequired', 'potentialAction', 'tripOrigin']) expect(partial).not.toHaveProperty(key);
    const unknown = buildQuestPublicStructuredData({ ...detail, trip_facts: null })['@graph'][0];
    for (const key of ['timeRequired', 'potentialAction', 'tripOrigin', 'isAccessibleForFree']) expect(unknown).not.toHaveProperty(key);
  });

  it.each(questPublicLocales)('keeps every %s quest node property in the TouristTrip+CreativeWork domain', (locale) => {
    const detail = detailFor(locale);
    for (const trip_facts of [null, detail.trip_facts]) {
      expectQuestEntityInSchemaDomain(buildQuestPublicStructuredData({ ...detail, trip_facts })['@graph'][0] as Record<string, unknown>);
    }
  });

  it('roundtrips hostile title text through the real JSON-LD script boundary', () => {
    const detail = detailFor('ru');
    const title = '</script><script>alert(1)</script>\u2028&';
    const structured = buildQuestPublicStructuredData({ ...detail,
      page: { ...detail.page, heading: title },
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
