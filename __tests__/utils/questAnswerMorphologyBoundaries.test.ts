/**
 * #1631: страж числовых порогов морфологического прохода.
 *
 * Корпус реальных отказов (`questRejectedAnswerCorpus.test.ts`) сторожит состав
 * списка `ENDINGS`, но пороги длины он не удерживает: замер 2026-08-30 по живой
 * базе показал, что подходящих пар в данных просто нет — ни среди 97 отклонённых
 * попыток, ни среди 2451 варианта из 703 словарей (там нашлись только три пары,
 * и все родственные: `змей`/`змий`/`змія`). Подробности замера — в шапке
 * фикстуры `questMorphologyBoundaryPairs`.
 *
 * Поэтому границы охраняются прямым контрактом: настоящие слова, которые не
 * являются формами друг друга и склеились бы ровно при ослаблении одного
 * порога. Тест проверяет обе стороны — что сейчас пара отклоняется и что
 * ослабление её действительно ловит.
 *
 * Имя файла начинается с имени модуля намеренно. Приёмка 31.08.2026 опустила
 * `MIN_COMMON_PREFIX` с 3 до 2, запустила `npx jest
 * __tests__/utils/questAnswerMorphology` и получила зелёное — прежнее имя
 * (`questMorphologyBoundaries`) под этот шаблон не попадало, и единственный
 * чувствительный страж в прогон не входил.
 */
import {
  QUEST_MORPHOLOGY_BOUNDARY_PAIRS,
  type MorphologyBoundaryPair,
} from '@/__tests__/fixtures/questMorphologyBoundaryPairs'
import {
  ENDINGS,
  MAX_ENDING_LENGTH,
  MIN_COMMON_PREFIX,
  MIN_WORD_LENGTH,
  isSameWordForm,
} from '@/utils/questAnswerMorphology'
import { buildAnswerChecker } from '@/utils/questAdapters'

const describePair = (pair: MorphologyBoundaryPair): string =>
  `${pair.guards}: «${pair.input}» против словаря «${pair.variant}» (${pair.why})`

const commonPrefixLength = (a: string, b: string): number => {
  const limit = Math.min(a.length, b.length)
  let i = 0
  while (i < limit && a[i] === b[i]) i += 1
  return i
}

/**
 * Правило с подменёнными порогами — чтобы измерить, что именно их держит.
 *
 * Список окончаний берётся настоящий, а не копия. Первая редакция этого теста
 * держала свою копию `ENDINGS` без нулевого окончания и на ней «доказала», что
 * `MIN_WORD_LENGTH` не держит ничего. На настоящем списке вывод обратный, и он
 * закреплён проверкой ниже: копия охраняет копию, а не правило.
 */
const matchesWithThresholds = (
  input: string,
  variant: string,
  { minWordLength, minCommonPrefix, maxEndingLength }: {
    minWordLength: number
    minCommonPrefix: number
    maxEndingLength: number
  },
): boolean => {
  if (input === variant) return true
  if (input.length < minWordLength || variant.length < minWordLength) return false
  const common = commonPrefixLength(input, variant)
  if (common < minCommonPrefix) return false
  const inputEnding = input.slice(common)
  const variantEnding = variant.slice(common)
  if (inputEnding.length > maxEndingLength || variantEnding.length > maxEndingLength) return false
  return ENDINGS.has(inputEnding) && ENDINGS.has(variantEnding)
}

const CURRENT = {
  minWordLength: MIN_WORD_LENGTH,
  minCommonPrefix: MIN_COMMON_PREFIX,
  maxEndingLength: MAX_ENDING_LENGTH,
}

const WEAKENED: Record<MorphologyBoundaryPair['guards'], typeof CURRENT> = {
  MIN_COMMON_PREFIX: { ...CURRENT, minCommonPrefix: MIN_COMMON_PREFIX - 1 },
}

describe('пороги морфологического прохода охраняются доказательными парами', () => {
  it('подменённое правило совпадает с настоящим на текущих порогах', () => {
    // Иначе весь замер ниже относился бы к другому правилу.
    const probe = QUEST_MORPHOLOGY_BOUNDARY_PAIRS.map((pair) =>
      matchesWithThresholds(pair.input, pair.variant, CURRENT),
    )
    const real = QUEST_MORPHOLOGY_BOUNDARY_PAIRS.map((pair) =>
      isSameWordForm(pair.input, pair.variant),
    )
    expect(probe).toEqual(real)
  })

  it('фикстура не выродилась', () => {
    expect(QUEST_MORPHOLOGY_BOUNDARY_PAIRS.length).toBeGreaterThanOrEqual(3)
    expect(new Set(QUEST_MORPHOLOGY_BOUNDARY_PAIRS.map((pair) => pair.guards)))
      .toEqual(new Set(['MIN_COMMON_PREFIX']))
  })

  it('MIN_WORD_LENGTH держит собственное значение и сторожится парой рот/рота', () => {
    // Замер 2026-08-31, поправка к прежнему выводу этого теста: снижение
    // MIN_WORD_LENGTH 4 → 3 РЕАЛЬНО склеивает `рот` и `рота` — хвосты «» и «а»
    // оба валидны, потому что нулевое окончание в `ENDINGS` есть. Отдельной
    // записи в фикстуре порогу не нужно: пара уже стоит в
    // `questAnswerMorphology.test.ts` («не роднит короткие пары разных слов») и
    // краснеет там при ослаблении.
    expect(matchesWithThresholds('рота', 'рот', { ...CURRENT, minWordLength: 3 })).toBe(true)
    expect(matchesWithThresholds('рота', 'рот', CURRENT)).toBe(false)
    expect(ENDINGS.has('')).toBe(true)
  })

  it('на текущем правиле ни одна пара не принимается', () => {
    const accepted = QUEST_MORPHOLOGY_BOUNDARY_PAIRS.filter((pair) =>
      isSameWordForm(pair.input, pair.variant),
    )
    expect(accepted.map(describePair)).toEqual([])
  })

  it('тот же вердикт даёт полная двухпроходная проверка шага', () => {
    const accepted = QUEST_MORPHOLOGY_BOUNDARY_PAIRS.filter((pair) =>
      buildAnswerChecker('exact_any', JSON.stringify([pair.variant]))(pair.input),
    )
    expect(accepted.map(describePair)).toEqual([])
  })

  it('каждая пара РЕАЛЬНО ловит ослабление своего порога', () => {
    // Обратная сторона стража: если ослабление порога пару не склеивает,
    // запись ничего не охраняет и её присутствие создаёт ложное спокойствие.
    const blind = QUEST_MORPHOLOGY_BOUNDARY_PAIRS.filter(
      (pair) => !matchesWithThresholds(pair.input, pair.variant, WEAKENED[pair.guards]),
    )
    expect(blind.map((pair) => `${describePair(pair)} — ${pair.brokenBy}`)).toEqual([])
  })

  it('ослабление ловится именно тем порогом, который заявлен, а не соседним', () => {
    // Пара, которая склеивается уже на текущих порогах чужого класса, сторожила
    // бы не то, что написано в `guards`.
    const misattributed = QUEST_MORPHOLOGY_BOUNDARY_PAIRS.filter((pair) =>
      matchesWithThresholds(pair.input, pair.variant, CURRENT),
    )
    expect(misattributed.map(describePair)).toEqual([])
  })
})
