import {
  THEME_FILTER_PREFIX,
  ALL_QUESTS_ID,
  resolveQuestThemeQuery,
  getQuestThemeQueryFromNavigationUrl,
  isNarrowingStoredQuestCatalogSelection,
  parseCountrySelectionId,
  parseThemeSelectionId,
  toThemeSelectionId,
} from '@/utils/questCatalogSelection';

describe('questCatalogSelection theme slice', () => {
  it('builds and parses a theme selection id in the shared selection slot', () => {
    expect(toThemeSelectionId('Halloween ')).toBe(`${THEME_FILTER_PREFIX}halloween`);
    expect(parseThemeSelectionId('__theme__:legends')).toBe('legends');
    expect(parseThemeSelectionId('__theme__:')).toBeNull();
    expect(parseThemeSelectionId('__country__:BY')).toBeNull();
    expect(parseThemeSelectionId('minsk')).toBeNull();
    expect(parseThemeSelectionId(null)).toBeNull();
  });

  it('does not collide with the country slice', () => {
    expect(parseCountrySelectionId(toThemeSelectionId('halloween'))).toBeNull();
  });

  it('counts a stored theme as a narrowing selection (#2320)', () => {
    expect(isNarrowingStoredQuestCatalogSelection(toThemeSelectionId('halloween'))).toBe(true);
  });
});


describe('explicit theme query authority (#2403)', () => {
  const halloween = new Date(2026, 9, 15, 12);
  const offSeason = new Date(2026, 9, 11, 12);
  it.each(['HALLOWEEN', ' halloween '])('normalizes active %s', (value) => {
    expect(resolveQuestThemeQuery(value, halloween)).toBe('__theme__:halloween');
  });
  it.each(['', 'unknown', ['halloween', 'detective']])('explicit invalid %s selects All', (value) => {
    expect(resolveQuestThemeQuery(value, halloween)).toBe(ALL_QUESTS_ID);
  });
  it('distinguishes missing parameter and inactive season; evergreen remains active', () => {
    expect(resolveQuestThemeQuery(undefined, offSeason)).toBeNull();
    expect(resolveQuestThemeQuery('halloween', offSeason)).toBe(ALL_QUESTS_ID);
    expect(resolveQuestThemeQuery('detective', offSeason)).toBe('__theme__:detective');
    expect(resolveQuestThemeQuery('christmas', new Date(2027, 0, 14))).toBe('__theme__:christmas');
    expect(resolveQuestThemeQuery('christmas', new Date(2027, 0, 15))).toBe(ALL_QUESTS_ID);
  });
});


it('parses only catalog native/hosted links, preserving duplicate and empty query presence', () => {
  expect(getQuestThemeQueryFromNavigationUrl('metravel://quests?theme=detective')).toBe('detective');
  expect(getQuestThemeQueryFromNavigationUrl('metravel:///quests?theme=')).toBe('');
  expect(getQuestThemeQueryFromNavigationUrl('metravel://quests/theme/legends')).toBe('legends');
  expect(getQuestThemeQueryFromNavigationUrl('https://metravel.by/quests?theme=a&theme=b')).toEqual(['a', 'b']);
  expect(getQuestThemeQueryFromNavigationUrl('https://outside.example/quests?theme=detective')).toBeUndefined();
  expect(getQuestThemeQueryFromNavigationUrl('metravel://quests/minsk/quest?theme=detective')).toBeUndefined();
  expect(getQuestThemeQueryFromNavigationUrl('metravel://quests')).toBeUndefined();
});
