import { translate as i18nT } from '@/i18n'
export type QuestAgeCategoryId = 'age-5-7' | 'age-8-10' | 'age-11-14' | 'kids' | 'teens';

export type QuestAgeCategory = {
  id: QuestAgeCategoryId;
  label: string;
  searchTerms: string[];
};

const AGE_CATEGORIES: QuestAgeCategory[] = [
  {
    id: 'age-5-7',
    get label() { return i18nT('sharedStatic:utils.questAudience.5_7_let_f64c26fe') },
    searchTerms: ['5-7', '5–7', '5 лет', '6 лет', '7 лет', 'дошкольники', 'младшие дети'],
  },
  {
    id: 'age-8-10',
    get label() { return i18nT('sharedStatic:utils.questAudience.8_10_let_bdff38ff') },
    searchTerms: ['8-10', '8–10', '8 лет', '9 лет', '10 лет', 'школьники', 'дети 8'],
  },
  {
    id: 'age-11-14',
    get label() { return i18nT('sharedStatic:utils.questAudience.11_14_let_367abbcf') },
    searchTerms: ['11-14', '11–14', '11 лет', '12 лет', '13 лет', '14 лет', 'подростки'],
  },
  {
    id: 'teens',
    get label() { return i18nT('sharedStatic:utils.questAudience.podrostki_5d5fd81c') },
    searchTerms: ['подростки', 'тинейджеры', '11-14', '11–14'],
  },
  {
    id: 'kids',
    get label() { return i18nT('sharedStatic:utils.questAudience.dlya_detey_ea3191e9') },
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

// Тег велоквестов в meta.tags. Канонический тег — `bike`; `velo` принимаем
// как синоним на случай ручной разметки. Тег включает бейдж «Вело» на
// карточках и фильтр велоквестов в каталоге.
export const BIKE_QUEST_TAG = 'bike';
const BIKE_QUEST_TAGS = new Set<string>([BIKE_QUEST_TAG, 'velo']);

export function isBikeQuest(tags?: string[] | null): boolean {
  if (!tags?.length) return false;
  return tags.some((tag) => BIKE_QUEST_TAGS.has(normalizeQuestTag(tag)));
}

// Тег кольцевых маршрутов: последняя точка возвращается к старту, и маршрут на
// карте/в GPX должен замыкаться сегментом «финиш → старт». Ставится вручную в
// данных квеста (кольцевая геометрия — авторское намерение, не выводится из
// координат: линейный маршрут «туда» замыкать нельзя).
export const QUEST_LOOP_TAG = 'loop';
const QUEST_LOOP_TAGS = new Set<string>([QUEST_LOOP_TAG, 'circular']);

export function isLoopQuest(tags?: string[] | null): boolean {
  if (!tags?.length) return false;
  return tags.some((tag) => QUEST_LOOP_TAGS.has(normalizeQuestTag(tag)));
}

export function getQuestAgeCategory(tags?: string[] | null): QuestAgeCategory | null {
  if (!tags?.length) return null;
  const normalizedTags = new Set(tags.map(normalizeQuestTag).filter(Boolean));
  return AGE_CATEGORIES.find((category) => normalizedTags.has(category.id)) ?? null;
}

export function getQuestAgeBadgeLabel(category?: QuestAgeCategory | null): string | null {
  if (!category) return null;
  return category.id === 'kids' ? i18nT('shared:utils.questAudience.utochnit_vozrast_b9db14c6') : category.label;
}

export function getQuestAgeSearchTerms(tags?: string[] | null): string[] {
  const category = getQuestAgeCategory(tags);
  return category ? [category.label, ...category.searchTerms] : [];
}

export function isQuestForChildrenOrTeens(tags?: string[] | null): boolean {
  if (!tags?.length) return false;
  return tags.some((tag) => QUEST_AUDIENCE_TAGS.has(normalizeQuestTag(tag)));
}
