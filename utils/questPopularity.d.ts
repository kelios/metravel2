/** Квест в любой из форм, которые видит правило популярности. */
export type QuestPopularityInput = {
  id?: number | string | null;
  completions_count?: number | string | null;
  completionsCount?: number | string | null;
  views_count?: number | string | null;
  viewsCount?: number | string | null;
  /** Числовой id адаптированной меты, где `id` — слаг квеста. */
  numericId?: number | string | null;
};

/** Значение параметра `sort`, которым бэкенд отдаёт этот же порядок. */
export const QUEST_POPULARITY_SORT: 'popular';

/** Сколько прохождений делают квест «популярным» для витрины каталога. */
export const POPULAR_QUEST_MIN_COMPLETIONS: number;

/** Минимум таких квестов, ниже которого сортировать нечего. */
export const POPULAR_QUEST_MIN_MATCHES: number;

export function compareQuestPopularity(a: QuestPopularityInput, b: QuestPopularityInput): number;
export function sortQuestsByPopularity<T extends QuestPopularityInput>(quests: T[]): T[];
export function selectPopularQuests<T extends QuestPopularityInput>(
  quests: T[],
  limit?: number,
): T[];

export function countPopularQuests(quests: QuestPopularityInput[]): number;
export function canRankQuestsByPopularity(quests: QuestPopularityInput[]): boolean;
