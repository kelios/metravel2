const path = require('node:path');
const { buildQuestWebProjection, publicPageText } = require('@/scripts/lib/questWebProjection');
const { loadSsgCatalogs } = require('@/i18n/babel-inline-plugin');
const { createSsgTranslator } = require('@/scripts/lib/questLocalePackage');
const { questPageFromHtml, scoreQuestPageLevel } = require('@/scripts/lib/questPageDepth');
const { questRouteKey } = require('@/utils/questCityAlias');
const generator = require('@/scripts/generate-seo-pages');
const { parseDocument, DomUtils } = require('htmlparser2');
import { questPrivateSnapshot, questPublicLocales } from '../fixtures/questPublicProjection';

const catalogs = loadSsgCatalogs(path.resolve(__dirname, '../..')).catalogs;
const BASE = '<html lang="ru"><head><title>Shell</title></head><body><div id="root"></div></body></html>';

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

  it.each(questPublicLocales)('retains the old %s detail prose and cohort measurement', (locale) => {
    const source = questPrivateSnapshot();
    const quest = source.catalog[0], route = questRouteKey(quest);
    const page = buildQuestWebProjection(source, catalogs).pages.find((entry: { kind: string; locale: string }) => entry.kind === 'detail' && entry.locale === locale);
    const html = generator.buildQuestDetailPageHtml({ baseHtml: BASE, quest,
      bundle: source.bundles[locale]['7/fixture-city-walk'], route, ssg: createSsgTranslator(catalogs, locale) });
    const old = questPageFromHtml(html, page.canonical_path);
    const withoutLinks = { ...page.page, sections: page.page.sections.filter((part: { heading: string }) =>
      part.heading === createSsgTranslator(catalogs, locale).t('seoSsg:questDetail.routeHeading')) };
    expect(publicPageText(withoutLinks)).toBe(old.text);
    expect(scoreQuestPageLevel([{ ...old, text: publicPageText(withoutLinks) }])[0].words)
      .toBe(scoreQuestPageLevel([old])[0].words);
    const titleNode = DomUtils.findOne((node: { name?: string }) => node.name === 'title', parseDocument(html).children, true);
    expect(DomUtils.textContent(titleNode)).toBe(page.page.meta.title);
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
});
