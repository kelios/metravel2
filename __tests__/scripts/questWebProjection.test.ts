const path = require('node:path');
const { buildQuestWebProjection, publicPageText } = require('@/scripts/lib/questWebProjection');
const { loadSsgCatalogs } = require('@/i18n/babel-inline-plugin');
const { scoreQuestPageLevel } = require('@/scripts/lib/questPageDepth');
import { questPrivateSnapshot, questPublicLocales } from '../fixtures/questPublicProjection';

const catalogs = loadSsgCatalogs(path.resolve(__dirname, '../..')).catalogs;

describe('immutable public quest projection', () => {
  it('publishes five detail locales plus RU landings without any private gameplay fields', () => {
    const source = questPrivateSnapshot();
    const result = buildQuestWebProjection(source, catalogs);
    expect(result.pages.filter((page: { kind: string }) => page.kind === 'detail').map((page: { locale: string }) => page.locale)).toEqual(questPublicLocales);
    expect(result.pages.filter((page: { kind: string }) => page.kind !== 'detail').map((page: { locale: string }) => page.locale)).toEqual(['ru', 'ru']);
    const serialized = JSON.stringify(result);
    for (const field of ['"task"', '"hint"', '"answer_pattern"', '"progress"', 'секретная последовательность', source.bundles.ru['7/fixture-city-walk'].steps[0].task]) {
      expect(serialized).not.toContain(field);
    }
    expect(result.pages.find((page: { kind: string }) => page.kind === 'country').quality.indexable).toBe(false);
  });

  it.each(questPublicLocales)('measures the %s detail prose with the shared cohort contract', (locale) => {
    const source = questPrivateSnapshot();
    const page = buildQuestWebProjection(source, catalogs).pages.find((entry: { kind: string; locale: string }) => entry.kind === 'detail' && entry.locale === locale);
    const text = publicPageText(page.page);
    expect(page.quality.word_count).toBe(scoreQuestPageLevel([{ path: page.canonical_path, kind: 'quest-detail', text }])[0].words);
    expect(page.source_revision).toBe(source.source_snapshot.quests[0].source_revision);
  });

  it('rejects an incomplete snapshot rather than withdrawing translations or classifying missing bodies as thin', () => {
    const source = questPrivateSnapshot();
    delete source.bundles.pl['7/fixture-city-walk'];
    expect(() => buildQuestWebProjection(source, catalogs)).toThrow('Missing exact-locale');
    const mismatched = questPrivateSnapshot();
    mismatched.bundles.pl['7/fixture-city-walk'].content_locale = 'ru';
    expect(() => buildQuestWebProjection(mismatched, catalogs)).toThrow('fell back');
    const duplicate = questPrivateSnapshot();
    duplicate.catalog.push(duplicate.catalog[0]);
    expect(() => buildQuestWebProjection(duplicate, catalogs)).toThrow('Duplicate');
  });

  it('fails closed if final public text copies an authored task', () => {
    const source = questPrivateSnapshot();
    source.bundles.ru['7/fixture-city-walk'].intro.story = source.bundles.ru['7/fixture-city-walk'].steps[0].task;
    expect(() => buildQuestWebProjection(source, catalogs)).toThrow('spoiler');
  });

  it('updates a landing source identity when its selected quest source changes', () => {
    const source = questPrivateSnapshot();
    const first = buildQuestWebProjection(source, catalogs).pages;
    source.source_snapshot.quests[0].source_revision = 'f'.repeat(64);
    const second = buildQuestWebProjection(source, catalogs).pages;
    for (const kind of ['city', 'country']) {
      expect(second.find((page: { kind: string }) => page.kind === kind).source_revision)
        .not.toBe(first.find((page: { kind: string }) => page.kind === kind).source_revision);
    }
  });

  it('publishes only bounded selected travel graph metadata without private bundle fields', () => {
    const source = { ...questPrivateSnapshot(), travel_links: Array.from({ length: 9 }, (_, index) => ({
      id: index + 1, name: `Travel ${index + 1}`, slug: `travel-${index + 1}`,
      cityName: 'Город', countryName: 'Беларусь', countryCode: 'by',
    })) };
    const result = buildQuestWebProjection(source, catalogs);
    const selected = result.discovery.travel_graph['1'];
    expect(selected.quests).toHaveLength(1);
    expect(selected.quests[0].quest.quest_id).toBe(source.catalog[0].quest_id);
    expect(selected.quests[0].distance_km).toBeNull();
    expect(selected.related).toHaveLength(6);
    expect(selected.related.map((travel: { path: string }) => travel.path)).not.toContain('/travels/travel-1');
    expect(JSON.stringify(result.discovery.travel_graph)).not.toContain('answer_pattern');
    expect(JSON.stringify(result.discovery.travel_graph)).not.toContain(source.bundles.ru['7/fixture-city-walk'].steps[0].task);
  });
  it('links the country, lists a city in title order and picks travels by their first point (#2817)', () => {
    const source = questPrivateSnapshot();
    const base = source.catalog[0], ruBundle = source.bundles.ru['7/fixture-city-walk'];
    const addQuest = (questId: string, cityId: string, title: string) => {
      source.catalog.push({ ...base, id: source.catalog.length + 100, quest_id: questId, city_id: cityId, title,
        lat: cityId === '7' ? base.lat : 52.1, lng: cityId === '7' ? base.lng : 23.7 });
      source.source_snapshot.quests.push({ ...source.source_snapshot.quests[0], quest_pk: source.catalog.length + 100,
        city_id: Number(cityId), quest_slug: questId, locales: { ru: source.source_snapshot.quests[0].locales.ru } });
      // Own prose per quest: copies of one story would fail the cohort's own-text floor.
      const shift = source.catalog.length;
      const steps = ruBundle.steps.map((step) => ({ ...step, story: step.story.replace(/[a-z]/g,
        (letter) => String.fromCharCode(97 + (letter.charCodeAt(0) - 97 + shift) % 26)) }));
      (source.bundles.ru as Record<string, unknown>)[`${cityId}/${questId}`] = { ...ruBundle, quest_id: questId, title, steps };
    };
    addQuest('alpha-walk', '7', 'Альфа: прогулка');
    addQuest('other-city', '8', 'Квест в другом городе');
    source.travel_links = [
      { id: 1, name: 'Road trip', slug: 'road-trip', cityName: 'Далеко', countryName: 'Беларусь', countryCode: 'by',
        travelAddress: [{ coord: '55.0,30.0' }, { coord: '53.9,27.5' }] },
      { id: 2, name: 'Local walk', slug: 'local-walk', cityName: 'Далеко', countryName: 'Беларусь', countryCode: 'by',
        travelAddress: [{ coord: '53.9,27.5' }] },
    ] as never;
    const pages = buildQuestWebProjection(source, catalogs).pages;
    const links = (page: { page: { sections: { items: { path: string | null }[] }[] } }) =>
      page.page.sections.flatMap((part) => part.items).map((entry) => entry.path).filter(Boolean);
    const city = links(pages.find((page: { canonical_path: string }) => page.canonical_path === '/quests/alpha'));
    expect(city).toContain('/quests/country/belarus');
    expect(city.filter((path: string) => /^\/quests\/7\//.test(path))).toEqual(['/quests/7/alpha-walk', '/quests/7/fixture-city-walk']);
    expect(city.filter((path: string) => path.startsWith('/travels/'))).toEqual(['/travels/local-walk']);
    const detail = links(pages.find((page: { kind: string; locale: string; canonical_path: string }) =>
      page.kind === 'detail' && page.locale === 'ru' && page.canonical_path === '/quests/7/fixture-city-walk'));
    expect(detail).toContain('/quests/7/alpha-walk');
    expect(detail.filter((path: string) => path.startsWith('/travels/'))).toEqual(['/travels/local-walk']);
  });
});
