/** Квест в любой из форм, которые видит правило популярности. */
export type QuestPopularityInput = {
  id?: number | string | null;
  completions_count?: number | string | null;
  completionsCount?: number | string | null;
  views_count?: number | string | null;
  viewsCount?: number | string | null;
};

/** Значение параметра `sort`, которым бэкенд отдаёт этот же порядок. */
export const QUEST_POPULARITY_SORT: 'popular';

export function compareQuestPopularity(a: QuestPopularityInput, b: QuestPopularityInput): number;
export function sortQuestsByPopularity<T extends QuestPopularityInput>(quests: T[]): T[];
export function selectPopularQuests<T extends QuestPopularityInput>(
  quests: T[],
  limit?: number,
): T[];
