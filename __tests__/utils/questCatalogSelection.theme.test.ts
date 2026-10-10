import {
  THEME_FILTER_PREFIX,
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
