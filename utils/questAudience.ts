export type QuestAgeCategoryId = 'age-5-7' | 'age-8-10' | 'age-11-14' | 'kids' | 'teens';

export type QuestAgeCategory = {
  id: QuestAgeCategoryId;
  label: string;
  searchTerms: string[];
};

const AGE_CATEGORIES: QuestAgeCategory[] = [
  {
    id: 'age-5-7',
    label: '5-7 лет',
    searchTerms: ['5-7', '5–7', '5 лет', '6 лет', '7 лет', 'дошкольники', 'младшие дети'],
  },
  {
    id: 'age-8-10',
    label: '8-10 лет',
    searchTerms: ['8-10', '8–10', '8 лет', '9 лет', '10 лет', 'школьники', 'дети 8'],
  },
  {
    id: 'age-11-14',
    label: '11-14 лет',
    searchTerms: ['11-14', '11–14', '11 лет', '12 лет', '13 лет', '14 лет', 'подростки'],
  },
  {
    id: 'teens',
    label: 'Подростки',
    searchTerms: ['подростки', 'тинейджеры', '11-14', '11–14'],
  },
  {
    id: 'kids',
    label: 'Для детей',
    searchTerms: ['детский', 'для детей', 'дети', 'семейный'],
  },
];

export const QUEST_AUDIENCE_TAGS = new Set<string>([
  'kids',
  'teens',
  'age-5-7',
  'age-8-10',
  'age-11-14',
]);

export function normalizeQuestTag(tag: unknown): string {
  return typeof tag === 'string' ? tag.trim().toLowerCase() : '';
}

export function getQuestAgeCategory(tags?: string[] | null): QuestAgeCategory | null {
  if (!tags?.length) return null;
  const normalizedTags = new Set(tags.map(normalizeQuestTag).filter(Boolean));
  return AGE_CATEGORIES.find((category) => normalizedTags.has(category.id)) ?? null;
}

export function getQuestAgeSearchTerms(tags?: string[] | null): string[] {
  const category = getQuestAgeCategory(tags);
  return category ? [category.label, ...category.searchTerms] : [];
}

export function isQuestForChildrenOrTeens(tags?: string[] | null): boolean {
  if (!tags?.length) return false;
  return tags.some((tag) => QUEST_AUDIENCE_TAGS.has(normalizeQuestTag(tag)));
}
