// #1926: CJS-копия морфологии для сканов должна совпадать с рантаймом.
const {
  isSameWordForm: scanIsSameWordForm,
  matchesAnyWordForm: scanMatchesAnyWordForm,
  ENDINGS,
  MIN_WORD_LENGTH,
  MIN_COMMON_PREFIX,
  MAX_ENDING_LENGTH,
} = require('@/scripts/lib/questAnswerMorphology')

import {
  isSameWordForm,
  matchesAnyWordForm,
  ENDINGS as runtimeEndings,
  MIN_WORD_LENGTH as runtimeMinWord,
  MIN_COMMON_PREFIX as runtimeMinPrefix,
  MAX_ENDING_LENGTH as runtimeMaxEnding,
} from '@/utils/questAnswerMorphology'

const pairs: Array<[string, string, boolean]> = [
  ['пуля', 'пули', true],
  ['от пули', 'от пулі', true],
  ['он сидит', 'он сидить', true],
  ['пять', 'пятый', false],
  ['от снега', 'от пули', false],
  ['якорная цеп', 'якорная цепь', false],
  ['кафе и магазины', 'квартиры', false],
]

describe('паритет CJS-морфологии со средой выполнения', () => {
  it('держит те же пороги и окончания, что utils/questAnswerMorphology', () => {
    expect(MIN_WORD_LENGTH).toBe(runtimeMinWord)
    expect(MIN_COMMON_PREFIX).toBe(runtimeMinPrefix)
    expect(MAX_ENDING_LENGTH).toBe(runtimeMaxEnding)
    expect([...ENDINGS].sort()).toEqual([...runtimeEndings].sort())
  })

  it.each(pairs)('%s ↔ %s → %s', (a, b, expected) => {
    expect(scanIsSameWordForm(a, b)).toBe(expected)
    expect(isSameWordForm(a, b)).toBe(expected)
  })

  it('matchesAnyWordForm совпадает с рантаймом на словаре holmskie', () => {
    const dict = ['пуля', 'пули', 'от пули', 'куль']
    expect(scanMatchesAnyWordForm('от пулі', dict)).toBe(matchesAnyWordForm('от пулі', dict))
    expect(scanMatchesAnyWordForm('от снега', dict)).toBe(matchesAnyWordForm('от снега', dict))
  })
})
