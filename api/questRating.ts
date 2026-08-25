// Доменные правила оценки городского квеста.
// Сама оценка сохраняется только как часть QuestReview через
// POST /api/quest-reviews/; отдельного rating transport у квестов нет (#1578).

export type QuestRating = 1 | 2 | 3 | 4 | 5

/**
 * Минимальная выборка, при которой публичный агрегат квеста имеет смысл (#1486).
 *
 * Ниже порога усреднение врёт: один отзыв на пятёрку рисует в каталоге
 * «рейтинг 5.0», хотя за ним стоит один человек. Порог касается только
 * выведенной оценки — количество отзывов (вход в читалку) показывается с
 * первого, потому что это факт, а не вывод из выборки.
 */
export const QUEST_RATING_MIN_REVIEWS = 3

/** Показывать ли агрегированную оценку квеста при таком числе отзывов. */
export const hasPublicQuestRating = (ratingCount: number | null | undefined): boolean =>
  typeof ratingCount === 'number' &&
  Number.isFinite(ratingCount) &&
  ratingCount >= QUEST_RATING_MIN_REVIEWS
