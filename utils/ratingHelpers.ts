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
