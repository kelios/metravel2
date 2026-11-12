import { isBikeQuest, isLoopQuest } from '@/utils/questAudience';
import { enabledQuestTags, normalizeQuestTags, questTagNames } from '@/utils/questTags';

// Quest.tags is JSONField(default=list) on the backend: untouched rows keep a slug
// list, admin-edited rows a boolean map. Both shapes must read the same (#2814).
describe('normalizeQuestTags', () => {
  it('turns a list of slugs into a true-map', () => {
    expect(normalizeQuestTags(['kids', 'age-8-10'])).toEqual({ kids: true, 'age-8-10': true });
    expect(normalizeQuestTags([])).toEqual({});
  });

  it('keeps a map and coerces its values to booleans', () => {
    expect(normalizeQuestTags({ kids: true, bike: false, loop: 1 })).toEqual({ kids: true, bike: false, loop: true });
  });

  it('reads an absent value as no tags', () => {
    expect(normalizeQuestTags(null)).toEqual({});
    expect(normalizeQuestTags(undefined)).toEqual({});
  });

  it('rejects a mixed list and non-object shapes', () => {
    expect(normalizeQuestTags(['kids', 5])).toBeNull();
    expect(normalizeQuestTags('kids')).toBeNull();
    expect(normalizeQuestTags(5)).toBeNull();
    expect(normalizeQuestTags(false)).toBeNull();
  });
});

describe('questTagNames', () => {
  it('returns tag names for both shapes and keeps absent distinct from empty', () => {
    expect(questTagNames(['kids', 'family'])).toEqual(['kids', 'family']);
    expect(questTagNames({ kids: true, family: true })).toEqual(['kids', 'family']);
    expect(questTagNames([])).toEqual([]);
    expect(questTagNames(null)).toBeUndefined();
    expect(questTagNames(undefined)).toBeUndefined();
    expect(questTagNames(['kids', 5])).toEqual([]);
  });

  // #3341: a switched-off `{loop: false}` must not close the player route — the
  // backend's trip_facts.distance_m reads the same tag as an open route (#3317).
  it('drops switched-off map entries, so a rule over tags never sees them', () => {
    expect(questTagNames({ kids: true, loop: false, bike: false })).toEqual(['kids']);
    expect(isLoopQuest(questTagNames({ loop: false }))).toBe(false);
    expect(isBikeQuest(questTagNames({ bike: false }))).toBe(false);
    expect(isLoopQuest(questTagNames({ loop: true }))).toBe(true);
    expect(isLoopQuest(questTagNames(['loop']))).toBe(true);
  });
});

describe('enabledQuestTags', () => {
  it('returns only enabled slugs for both shapes; absent and unknown shapes give none', () => {
    expect(enabledQuestTags(['kids', 'age-8-10'])).toEqual(['kids', 'age-8-10']);
    expect(enabledQuestTags({ kids: true, family: false, 'adult-required': 1 })).toEqual(['kids', 'adult-required']);
    expect(enabledQuestTags(null)).toEqual([]);
    expect(enabledQuestTags(['kids', 5])).toEqual([]);
    expect(enabledQuestTags('kids')).toEqual([]);
  });
});
