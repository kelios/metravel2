import { SUPPORTED_LOCALES } from '@/i18n/config';
import { QUEST_LOCALES, buildQuestLocalePath, parseQuestLocaleRoute,
  validateQuestServingProjection, questServingAlternates, getQuestLocaleRouteParserScript } from '@/utils/questLocaleRouting';

const identity = { cityId: 1, questSlug: 'krakow-dragon', locale: 'pl' as const };
const projection = {
  schema_version: 1, release_id: 'fixture-release-1', city_id: 1, quest_slug: 'krakow-dragon',
  locale: 'pl', state: 'available', canonical_path: '/pl/quests/1/krakow-dragon',
  ru_source_path: '/quests/1/krakow-dragon', versions: [
    { locale: 'ru', path: '/quests/1/krakow-dragon' },
    { locale: 'pl', path: '/pl/quests/1/krakow-dragon' },
  ],
};

describe('quest-only language URL model', () => {
  it('keeps the accepted allowlist equal to the production registry', () => {
    expect(QUEST_LOCALES).toEqual(SUPPORTED_LOCALES);
  });
  it.each(['be', 'uk', 'pl', 'en'] as const)('parses %s before reading preferences and ignores query parameters', (locale) => {
    expect(parseQuestLocaleRoute(`/${locale}/quests/1/krakow-dragon/?print=1&utm_source=test`))
      .toEqual({ ...identity, locale, path: `/${locale}/quests/1/krakow-dragon` });
  });
  it.each(['/ru/quests/1/krakow-dragon', '/de/quests/1/krakow-dragon', '/pl/quests/krakow',
    '/pl/quests/krakow/krakow-dragon', '/pl/quests/0/quest', '/pl/quests/01/quest',
    '/pl/quests/9007199254740992/quest', '/pl/quests/1/../quest', '/pl/quests/1/%2fquest',
    '/quests/1/krakow-dragon', '/pl/travels/1'])('rejects unsupported or unsafe route %s', (path) => {
    expect(parseQuestLocaleRoute(path)).toBeNull();
  });
  it('preserves RU numeric canonical and emits the same parser for pre-bundle boot', () => {
    expect(buildQuestLocalePath(1, 'krakow-dragon', 'ru')).toBe('/quests/1/krakow-dragon');
    const inlineParser = Function(`return ${getQuestLocaleRouteParserScript()}`)();
    expect(inlineParser('/pl/quests/1/krakow-dragon')).toEqual(parseQuestLocaleRoute('/pl/quests/1/krakow-dragon'));
  });
});

describe('anonymous serving projection validation', () => {
  it('accepts E and builds reciprocal absolute alternates including RU x-default', () => {
    const parsed = validateQuestServingProjection(projection, identity);
    expect(parsed).toEqual(projection);
    expect(questServingAlternates(parsed)).toEqual([
      { locale: 'ru', href: 'https://metravel.by/quests/1/krakow-dragon' },
      { locale: 'pl', href: 'https://metravel.by/pl/quests/1/krakow-dragon' },
      { locale: 'x-default', href: 'https://metravel.by/quests/1/krakow-dragon' },
    ]);
  });
  it.each([
    { city_id: 2 }, { quest_slug: 'other' }, { locale: 'en' }, { schema_version: 2 },
    { canonical_path: '/quests/1/krakow-dragon' }, { release_id: null },
    { versions: [{ locale: 'pl', path: 'https://evil.test' }] },
    { versions: [...projection.versions, projection.versions[1]] },
    { versions: [...projection.versions].reverse() }, { versions: [] },
  ])('rejects identity/path/membership mismatch %j', (override) => {
    expect(validateQuestServingProjection({ ...projection, ...override }, identity)).toBeNull();
  });
  it.each(['unavailable', 'temporary_failure'])('accepts %s without reviving old membership', (state) => {
    const parsed = validateQuestServingProjection({ ...projection, state, canonical_path: null, versions: [] }, identity);
    expect(parsed?.state).toBe(state);
    expect(questServingAlternates(parsed)).toEqual([]);
    expect(validateQuestServingProjection({ ...projection, state }, identity)).toBeNull();
  });
  it('keeps RU-only canonical without translated alternates', () => {
    const parsed = validateQuestServingProjection({ ...projection, locale: 'ru',
      canonical_path: projection.ru_source_path, versions: [] }, { ...identity, locale: 'ru' });
    expect(parsed?.canonical_path).toBe(projection.ru_source_path);
    expect(questServingAlternates(parsed)).toEqual([]);
  });
});
