import {
  getQuestAgeBadgeLabel,
  getQuestAgeCategory,
  getQuestAgeSearchTerms,
  isQuestForChildrenOrTeens,
} from '@/utils/questAudience';

describe('questAudience', () => {
  it('resolves explicit age tags before generic audience tags', () => {
    expect(getQuestAgeCategory(['kids', 'age-8-10'])?.label).toBe('8-10 лет');
    expect(getQuestAgeCategory(['teens', 'age-11-14'])?.label).toBe('11-14 лет');
  });

  it('falls back to generic kids and teens labels', () => {
    expect(getQuestAgeCategory([' Kids '])?.label).toBe('Для детей');
    expect(getQuestAgeCategory(['TEENS'])?.label).toBe('Подростки');
  });

  it('asks editors to clarify age for generic kids tags in UI badges', () => {
    expect(getQuestAgeBadgeLabel(getQuestAgeCategory(['kids']))).toBe('Уточнить возраст');
    expect(getQuestAgeBadgeLabel(getQuestAgeCategory(['kids', 'age-8-10']))).toBe('8-10 лет');
  });

  it('detects child and teen quest tags without treating family alone as age-specific', () => {
    expect(isQuestForChildrenOrTeens(['age-5-7'])).toBe(true);
    expect(isQuestForChildrenOrTeens(['teens'])).toBe(true);
    expect(isQuestForChildrenOrTeens(['family'])).toBe(false);
  });

  it('adds Russian search terms for age categories', () => {
    expect(getQuestAgeSearchTerms(['age-11-14'])).toEqual(
      expect.arrayContaining(['11-14 лет', 'подростки']),
    );
  });
});
