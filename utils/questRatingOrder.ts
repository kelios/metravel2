/**
 * Правило порядка каталога квестов «По рейтингу» (#1988).
 *
 * Отдельный модуль, а не ветка внутри `utils/questPopularity.js`: у
 * популярности своя причина жить в CommonJS без зависимостей — её требует
 * node-генератор `scripts/generate-seo-pages.js`. Рейтинговый порядок нужен
 * только каталогу, поэтому он написан на TypeScript и берёт порог из
 * единственного источника правды `@/api/questRating`, вместо того чтобы
 * заводить третью копию числа 3.
 *
 * Сортируем по ПУБЛИЧНОМУ рейтингу, а не по сырому `rating_avg`: агрегат из
 * одного отзыва — вымысел (#1486), и поднимать им квест наверх каталога значит
 * врать читателю тем же способом, каким запрещено рисовать «5.0» на карточке.
 *
 * Данные на 19.09.2026 (прод, все 207 квестов): отзывы есть у трёх квестов, по
 * одному у каждого, публичный рейтинг — НИ У ОДНОГО. То есть вариант «По
 * рейтингу» сегодня недоступен по порогу и появится сам, как только два квеста
 * наберут по три отзыва. Это осознанно: пустая сортировка хуже отсутствующей.
 */

import { hasPublicQuestRating } from '@/api/questRating'
import { questNumericId, type QuestPopularityInput } from '@/utils/questPopularity'

/** Квест в любой из форм, которые видит правило рейтинга. */
export type QuestRatingInput = QuestPopularityInput & {
  rating_avg?: number | string | null
  ratingAvg?: number | string | null
  rating_count?: number | string | null
  ratingCount?: number | string | null
}

/**
 * Ниже двух публично оценённых квестов сортировать нечего: каталог показал бы
 * тот же список в другом порядке. Порог тот же, что у популярности, и по той
 * же причине — см. `POPULAR_QUEST_MIN_MATCHES`.
 */
export const RATED_QUEST_MIN_MATCHES = 2

const numericField = (
  quest: QuestRatingInput,
  snakeKey: 'rating_avg' | 'rating_count',
  camelKey: 'ratingAvg' | 'ratingCount',
): number => {
  const raw = quest?.[snakeKey] != null ? quest[snakeKey] : quest?.[camelKey]
  const value = Number(raw)
  return Number.isFinite(value) ? value : 0
}

/** Есть ли у квеста агрегат, который вообще разрешено показывать. */
export const hasRankableRating = (quest: QuestRatingInput): boolean =>
  hasPublicQuestRating(numericField(quest, 'rating_count', 'ratingCount'))

/**
 * Компаратор рейтинга. Квесты без публичного рейтинга уходят в хвост и там
 * сохраняют порядок каталога по id — иначе 204 нуля перемешались бы между
 * собой и «сортировка» выглядела бы случайной перестановкой.
 */
export function compareQuestRating(a: QuestRatingInput, b: QuestRatingInput): number {
  const aRanked = hasRankableRating(a)
  const bRanked = hasRankableRating(b)
  if (aRanked !== bRanked) return aRanked ? -1 : 1

  if (aRanked && bRanked) {
    const byAvg =
      numericField(b, 'rating_avg', 'ratingAvg') - numericField(a, 'rating_avg', 'ratingAvg')
    if (byAvg !== 0) return byAvg

    const byCount =
      numericField(b, 'rating_count', 'ratingCount') -
      numericField(a, 'rating_count', 'ratingCount')
    if (byCount !== 0) return byCount
  }

  return questNumericId(a) - questNumericId(b)
}

/** Копия списка, отсортированная по рейтингу (исходный массив не трогаем). */
export function sortQuestsByRating<T extends QuestRatingInput>(quests: T[]): T[] {
  return (Array.isArray(quests) ? quests.slice() : []).sort(compareQuestRating)
}

/** Сколько квестов набора имеют публичный рейтинг. */
export function countRatedQuests(quests: QuestRatingInput[]): number {
  if (!Array.isArray(quests)) return 0
  let count = 0
  for (const quest of quests) {
    if (hasRankableRating(quest)) count += 1
  }
  return count
}

/** Есть ли в наборе достаточно оценок, чтобы сортировка что-то значила. */
export const canRankQuestsByRating = (quests: QuestRatingInput[]): boolean =>
  countRatedQuests(quests) >= RATED_QUEST_MIN_MATCHES
