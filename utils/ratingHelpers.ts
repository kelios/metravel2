import { formatNumber } from '@/i18n/format'

/**
 * Канонический вывод оценки (#1459): дробную часть печатает локаль — русскому
 * пользователю «4,6», а не «4.6». Новое место, где показывается рейтинг, зовёт
 * этот форматтер, а не собирает строку через `toFixed`.
 */
export function formatRatingValue(value: number): string {
  return formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

/**
 * Вычисляет приблизительный новый рейтинг при добавлении/изменении оценки
 */
export function calculateNewRating(
  currentRating: number,
  count: number,
  newValue: number,
  previousUserRating: number | null,
): number {
  if (count === 0) return newValue

  if (previousUserRating !== null && previousUserRating !== 0) {
    const totalSum = currentRating * count
    const newSum = totalSum - previousUserRating + newValue
    return Number((newSum / count).toFixed(1))
  }

  const totalSum = currentRating * count
  const newSum = totalSum + newValue
  return Number((newSum / (count + 1)).toFixed(1))
}
