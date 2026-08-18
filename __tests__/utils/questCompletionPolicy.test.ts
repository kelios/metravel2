import {
  questCompletionThreshold,
  questStepsMissingForCompletion,
} from '@/utils/questCompletionPolicy'

describe('questCompletionThreshold', () => {
  it('требует две трети обязательных точек с округлением вверх', () => {
    // Реальные квесты — от 6 до 12 обязательных точек. Порог должен оставлять
    // место штатным пропускам (далёкая точка #1432, протухшее задание #1430) и
    // при этом не пропускать «прохождение из одного ответа» (#1443).
    // Пары зафиксированы значениями, а не формулой: тест проверяет продуктовое
    // правило, а не повторяет реализацию.
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(questCompletionThreshold))
      .toEqual([1, 2, 2, 3, 4, 4, 5, 6, 6, 7, 8, 8])
  })

  it('порог не убывает при росте маршрута', () => {
    let previous = 0
    for (let n = 1; n <= 40; n += 1) {
      const threshold = questCompletionThreshold(n)
      expect(threshold).toBeGreaterThanOrEqual(previous)
      // Пропустить можно только меньшую часть маршрута.
      expect(threshold * 3).toBeGreaterThanOrEqual(n * 2)
      previous = threshold
    }
  })

  it('на квесте без обязательных точек порога нет', () => {
    expect(questCompletionThreshold(0)).toBe(0)
    expect(questCompletionThreshold(-3)).toBe(0)
    expect(questCompletionThreshold(Number.NaN)).toBe(0)
  })
})

describe('questStepsMissingForCompletion', () => {
  it('считает недобор до зачёта и не уходит в минус', () => {
    expect(questStepsMissingForCompletion(9, 1)).toBe(5)
    expect(questStepsMissingForCompletion(9, 6)).toBe(0)
    expect(questStepsMissingForCompletion(9, 9)).toBe(0)
    expect(questStepsMissingForCompletion(0, 0)).toBe(0)
  })
})
