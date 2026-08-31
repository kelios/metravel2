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
 */
import {
  QUEST_MORPHOLOGY_BOUNDARY_PAIRS,
  type MorphologyBoundaryPair,
} from '@/__tests__/fixtures/questMorphologyBoundaryPairs'
import { isSameWordForm } from '@/utils/questAnswerMorphology'
import { buildAnswerChecker } from '@/utils/questAdapters'

const describePair = (pair: MorphologyBoundaryPair): string =>
  `${pair.guards}: «${pair.input}» против словаря «${pair.variant}» (${pair.why})`

/**
 * Ослабленная копия правила. Держать её здесь, а не править продуктовый модуль,
 * — единственный способ показать красный результат в обычном прогоне: тест,
 * который «упал бы, если бы кто-то поменял константу», сам ничего не доказывает.
 */
const ENDINGS_FOR_PROBE = new Set([
  'а', 'я', 'ы', 'и', 'у', 'ю', 'е', 'о', 'ой', 'ей', 'ом', 'ем', 'ах', 'ях',
  'ам', 'ям', 'ами', 'ями', 'ов', 'ев', 'ь', 'й',
  'ый', 'ий', 'ая', 'яя', 'ое', 'ее', 'ые', 'ым', 'им', 'ых', 'их',
  'ую', 'юю', 'ому', 'ему', 'ого', 'его', 'ыми', 'ими',
  'і', 'ў', 'аў', 'еў', 'ай', 'яй', 'амі', 'ямі',
  'ае', 'яе', 'ыя', 'ія', 'ага', 'яга', 'аму', 'яму', 'ім', 'іх',
])

const commonPrefixLength = (a: string, b: string): number => {
  const limit = Math.min(a.length, b.length)
  let i = 0
  while (i < limit && a[i] === b[i]) i += 1
  return i
}

/** Правило с подменёнными порогами — чтобы измерить, что именно их держит. */
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
  return ENDINGS_FOR_PROBE.has(inputEnding) && ENDINGS_FOR_PROBE.has(variantEnding)
}

const CURRENT = { minWordLength: 4, minCommonPrefix: 3, maxEndingLength: 3 }

const WEAKENED: Record<MorphologyBoundaryPair['guards'], typeof CURRENT> = {
  MIN_COMMON_PREFIX: { ...CURRENT, minCommonPrefix: 2 },
}

describe('пороги морфологического прохода охраняются доказательными парами', () => {
  it('фикстура не выродилась', () => {
    expect(QUEST_MORPHOLOGY_BOUNDARY_PAIRS.length).toBeGreaterThanOrEqual(3)
    expect(new Set(QUEST_MORPHOLOGY_BOUNDARY_PAIRS.map((pair) => pair.guards)))
      .toEqual(new Set(['MIN_COMMON_PREFIX']))
  })

  it('пороги, которые держит состав ENDINGS, отдельными записями не сторожатся', () => {
    // Замер 2026-08-30: снижение MIN_WORD_LENGTH 4 → 3 и рост MAX_ENDING_LENGTH
    // 3 → 4 в одиночку не склеивают ничего, потому что правило требует валидное
    // окончание с обеих сторон: у трёхбуквенного слова хвост пустой, а
    // четырёхбуквенных окончаний в списке нет вовсе.
    expect(matchesWithThresholds('рота', 'рот', { ...CURRENT, minWordLength: 3 })).toBe(false)
    expect(matchesWithThresholds('пола', 'пол', { ...CURRENT, minWordLength: 3 })).toBe(false)
    expect(ENDINGS_FOR_PROBE.has('')).toBe(false)
    expect([...ENDINGS_FOR_PROBE].every((ending) => ending.length <= 3)).toBe(true)
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
