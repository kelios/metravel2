import {
  questCompletionThreshold,
  questStepsMissingForCompletion,
} from '@/utils/questCompletionPolicy'

describe('questCompletionThreshold', () => {
  it('требует две трети обязательных точек с округлением вверх', () => {
    // Реальные квесты — от 6 до 12 обязательных точек. Порог должен оставлять
    // место штатным пропускам (далёкая точка #1432, протухшее задание #1430) и
    // при этом не пропускать «прохождение из одного ответа» (#1443).
    expect(questCompletionThreshold(6)).toBe(4)
    expect(questCompletionThreshold(7)).toBe(5)
    expect(questCompletionThreshold(9)).toBe(6)
    expect(questCompletionThreshold(11)).toBe(8)
    expect(questCompletionThreshold(12)).toBe(8)
  })

  it('не съезжает на двоичной дроби: порог считается целыми', () => {
    // `Math.ceil(n * 0.6666666666666666)` для части n даёт на единицу больше.
    for (let n = 1; n <= 40; n += 1) {
      expect(questCompletionThreshold(n)).toBe(Math.ceil((n * 2) / 3))
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
