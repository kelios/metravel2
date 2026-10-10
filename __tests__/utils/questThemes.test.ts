import {
  filterQuestsByTheme,
  getActiveQuestThemes,
  getPrimaryQuestTheme,
  getQuestThemeById,
  getQuestThemes,
  isQuestInTheme,
  isQuestThemeActive,
} from '@/utils/questThemes';

const halloween = getQuestThemeById('halloween')!;
const christmas = getQuestThemeById('christmas')!;
const legends = getQuestThemeById('legends')!;

describe('questThemes', () => {
  it('keeps seasonal themes ahead of evergreen ones in the registry', () => {
    const ids = getQuestThemes().map((theme) => theme.id);
    expect(ids.indexOf('halloween')).toBeLessThan(ids.indexOf('legends'));
    expect(ids.indexOf('christmas')).toBeLessThan(ids.indexOf('legends'));
  });

  it('activates a seasonal theme only inside its window (inclusive)', () => {
    expect(isQuestThemeActive(halloween, new Date(2026, 9, 15))).toBe(true);
    expect(isQuestThemeActive(halloween, new Date(2026, 9, 31))).toBe(true);
    expect(isQuestThemeActive(halloween, new Date(2026, 10, 1))).toBe(true);
    expect(isQuestThemeActive(halloween, new Date(2026, 9, 14))).toBe(false);
    expect(isQuestThemeActive(halloween, new Date(2026, 10, 2))).toBe(false);
  });

  it('handles a season window that wraps over New Year', () => {
    expect(isQuestThemeActive(christmas, new Date(2026, 11, 1))).toBe(true);
    expect(isQuestThemeActive(christmas, new Date(2026, 11, 31))).toBe(true);
    expect(isQuestThemeActive(christmas, new Date(2027, 0, 14))).toBe(true);
    expect(isQuestThemeActive(christmas, new Date(2027, 0, 15))).toBe(false);
    expect(isQuestThemeActive(christmas, new Date(2026, 6, 15))).toBe(false);
  });

  it('always activates evergreen themes and lists seasonal ones first', () => {
    expect(isQuestThemeActive(legends, new Date(2026, 6, 15))).toBe(true);
    expect(getActiveQuestThemes(new Date(2026, 6, 15)).map((t) => t.id)).toEqual(['legends', 'detective', 'fairytale']);
    expect(getActiveQuestThemes(new Date(2026, 9, 20)).map((t) => t.id)).toEqual(['halloween', 'legends', 'detective', 'fairytale']);
  });

  it('matches quests by any canonical tag, case- and whitespace-insensitive', () => {
    expect(isQuestInTheme(legends, ['history', ' Mystic '])).toBe(true);
    expect(isQuestInTheme(legends, ['myth'])).toBe(true);
    expect(isQuestInTheme(legends, ['legend', 'history'])).toBe(false);
    expect(isQuestInTheme(halloween, [])).toBe(false);
    expect(isQuestInTheme(halloween, null)).toBe(false);
  });

  it('filters a catalog slice by theme', () => {
    const quests = [
      { id: 'a', tags: ['halloween', 'mystic'] },
      { id: 'b', tags: ['citywalk'] },
      { id: 'c', tags: ['ghost'] },
    ];
    expect(filterQuestsByTheme(quests, legends).map((q) => q.id)).toEqual(['a', 'c']);
    expect(filterQuestsByTheme(quests, halloween).map((q) => q.id)).toEqual(['a']);
  });

  it('prefers the active seasonal theme for the card badge and falls back to evergreen', () => {
    const tags = ['halloween', 'mystic'];
    expect(getPrimaryQuestTheme(tags, new Date(2026, 9, 20))?.id).toBe('halloween');
    expect(getPrimaryQuestTheme(tags, new Date(2026, 6, 15))?.id).toBe('legends');
    expect(getPrimaryQuestTheme(['halloween'], new Date(2026, 6, 15))).toBeNull();
    expect(getPrimaryQuestTheme(['citywalk'], new Date(2026, 9, 20))).toBeNull();
  });

  it('resolves theme labels through i18n', () => {
    expect(halloween.label).toBe('Хэллоуин');
    expect(legends.label).toBe('Легенды и призраки');
    expect(getQuestThemeById('nope')).toBeNull();
  });
});
