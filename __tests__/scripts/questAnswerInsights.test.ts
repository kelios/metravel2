// #1278: классификатор кандидатов в `answer_pattern`.
//
// Главный риск инструмента — тихая деградация в «добавь всё частое». На
// quest 32 шаг `3-pobeda` самый частый отклонённый ввод это `33` (сумма цифр
// без свёртки при правильном ответе `6`), и по одной только частоте он выглядит
// как отличный кандидат в словарь. Добавить его = засчитывать нерешённую
// задачу. Эти тесты падают, если классификатор начнёт метить промежуточные
// вычисления как синонимы.
const {
  CATEGORY,
  acceptedVariantsFromPattern,
  buildInsights,
  classifyRejectedValue,
  computeFriction,
  levenshtein,
  parseArgs,
  typoThreshold,
} = require('@/scripts/quest-answer-insights')

describe('levenshtein', () => {
  it('считает расстояние редактирования', () => {
    expect(levenshtein('мизинец', 'мезинец')).toBe(1)
    expect(levenshtein('33', '6')).toBe(2)
    expect(levenshtein('кот', 'кот')).toBe(0)
  })
})

describe('typoThreshold — порог опечатки зависит от длины эталона', () => {
  it('короткий ответ не имеет права на правки', () => {
    expect(typoThreshold(1)).toBe(0)
    expect(typoThreshold(2)).toBe(0)
  })

  it('длинный ответ терпит до двух правок', () => {
    expect(typoThreshold(7)).toBe(2)
    expect(typoThreshold(12)).toBe(2)
  })
})

describe('classifyRejectedValue', () => {
  it('опечатка в длинном слове — синоним', () => {
    expect(classifyRejectedValue('мезинец', ['мизинец'])).toBe(CATEGORY.SYNONYM)
  })

  it('другая словоформа с общим корнем — синоним', () => {
    expect(classifyRejectedValue('папоротника', ['папоротник'])).toBe(CATEGORY.SYNONYM)
  })

  it('регистр и «ё» не делают ответ новым', () => {
    expect(classifyRejectedValue('Архангел Михаил', ['архангел міхаіл', 'архангел михаил'])).toBe(
      CATEGORY.SYNONYM,
    )
  })

  it('РЕГРЕССИЯ: 33 при правильном 6 — не синоним, а другой ответ', () => {
    // Levenshtein('33','6') = 2, то есть плоский порог «≤2» пометил бы это
    // синонимом и предложил бы засчитывать неверный ответ.
    expect(levenshtein('33', '6')).toBe(2)
    expect(classifyRejectedValue('33', ['6', 'шесть'])).toBe(CATEGORY.OTHER_ANSWER)
  })

  it('РЕГРЕССИЯ: соседнее число — всегда другой ответ, а не опечатка', () => {
    expect(classifyRejectedValue('1944', ['1945'])).toBe(CATEGORY.OTHER_ANSWER)
    expect(classifyRejectedValue('11', ['12'])).toBe(CATEGORY.OTHER_ANSWER)
  })

  it('заглушки и односимвольный шум — мусор', () => {
    expect(classifyRejectedValue('хз', ['михаил'])).toBe(CATEGORY.GARBAGE)
    expect(classifyRejectedValue('ааааа', ['михаил'])).toBe(CATEGORY.GARBAGE)
    expect(classifyRejectedValue('я', ['михаил'])).toBe(CATEGORY.GARBAGE)
    expect(classifyRejectedValue('', ['михаил'])).toBe(CATEGORY.GARBAGE)
  })

  it('осмысленный, но чужой ответ — другой ответ', () => {
    expect(classifyRejectedValue('георгий', ['михаил'])).toBe(CATEGORY.OTHER_ANSWER)
  })
})

describe('acceptedVariantsFromPattern', () => {
  it('exact_any разворачивается в список вариантов', () => {
    expect(acceptedVariantsFromPattern({ type: 'exact_any', value: '["6","шесть"]' })).toEqual(['6', 'шесть'])
  })

  it('короткий range разворачивается в числа', () => {
    expect(acceptedVariantsFromPattern({ type: 'range', value: '{"min":10,"max":12}' })).toEqual([
      '10',
      '11',
      '12',
    ])
  })

  it('широкий range не превращается в словарь из тысячи чисел', () => {
    expect(acceptedVariantsFromPattern({ type: 'range', value: '{"min":1,"max":5000}' })).toEqual(['1', '5000'])
  })

  it('свободные типы словаря не имеют', () => {
    expect(acceptedVariantsFromPattern({ type: 'any_text', value: '{"min_length":3}' })).toEqual([])
    expect(acceptedVariantsFromPattern({ type: 'any', value: '' })).toEqual([])
  })

  it('повреждённое значение не роняет отчёт', () => {
    expect(acceptedVariantsFromPattern({ type: 'exact_any', value: 'not json' })).toEqual([])
  })
})

describe('computeFriction — веса зафиксированы', () => {
  it('бросивший дороже подсказки, подсказка дороже лишней попытки', () => {
    const base = { rejected_per_solver: 0, hint_open_rate: 0, abandon_rate: 0 }
    expect(computeFriction({ ...base, rejected_per_solver: 1 })).toBe(1)
    expect(computeFriction({ ...base, hint_open_rate: 1 })).toBe(2)
    expect(computeFriction({ ...base, abandon_rate: 1 })).toBe(3)
  })
})

describe('buildInsights', () => {
  const STATS = {
    quest_id: 32,
    steps: [
      {
        step_key: '1-vorota',
        answer_type: 'range',
        players_reached: 14,
        players_solved: 13,
        rejected_total: 3,
        rejected_per_solver: 0.2,
        hint_open_rate: 0.1,
        abandon_rate: 0.07,
        top_rejected: [{ value: '13', count: 3, players: 3 }],
      },
      {
        step_key: '3-pobeda',
        answer_type: 'exact_any',
        players_reached: 12,
        players_solved: 9,
        rejected_total: 41,
        rejected_per_solver: 3.4,
        hint_open_rate: 0.66,
        abandon_rate: 0.25,
        top_rejected: [
          { value: '33', count: 9, players: 7 },
          { value: 'шест', count: 4, players: 3 },
          { value: '9', count: 1, players: 1 },
        ],
      },
      {
        step_key: '7-naberezhnaya',
        answer_type: 'any_text',
        players_reached: 8,
        players_solved: 8,
        rejected_total: 2,
        rejected_per_solver: 0.25,
        hint_open_rate: 0,
        abandon_rate: 0,
        top_rejected: [],
      },
    ],
  }

  const PATTERNS = {
    '1-vorota': { type: 'range', value: '{"min":10,"max":12}' },
    '3-pobeda': { type: 'exact_any', value: '["6","шесть"]' },
    '7-naberezhnaya': { type: 'any_text', value: '{"min_length":3}' },
  }

  it('шаг с наибольшим трением стоит первым', () => {
    const report = buildInsights({ stats: STATS, patternsByStepKey: PATTERNS })
    expect(report.steps[0].stepKey).toBe('3-pobeda')
    expect(report.steps[0].friction).toBeCloseTo(3.4 + 2 * 0.66 + 3 * 0.25, 5)
  })

  it('«33» попадает в кандидаты, но помечен как не синоним', () => {
    const report = buildInsights({ stats: STATS, patternsByStepKey: PATTERNS })
    const pobeda = report.steps.find((step) => step.stepKey === '3-pobeda')
    const candidate = pobeda.candidates.find((entry) => entry.value === '33')
    expect(candidate.category).toBe(CATEGORY.OTHER_ANSWER)
    expect(candidate.players).toBe(7)
  })

  it('опечатка «шест» предлагается как синоним', () => {
    const report = buildInsights({ stats: STATS, patternsByStepKey: PATTERNS })
    const pobeda = report.steps.find((step) => step.stepKey === '3-pobeda')
    expect(pobeda.candidates.find((entry) => entry.value === 'шест').category).toBe(CATEGORY.SYNONYM)
  })

  it('редкий ввод от одного игрока отсекается порогом --min-count', () => {
    const report = buildInsights({ stats: STATS, patternsByStepKey: PATTERNS, minCount: 2 })
    const pobeda = report.steps.find((step) => step.stepKey === '3-pobeda')
    expect(pobeda.candidates.map((entry) => entry.value)).not.toContain('9')
  })

  it('свободный шаг считает трение, но не показывает вводов', () => {
    const report = buildInsights({ stats: STATS, patternsByStepKey: PATTERNS })
    const free = report.steps.find((step) => step.stepKey === '7-naberezhnaya')
    expect(free.isFreeText).toBe(true)
    expect(free.candidates).toEqual([])
    expect(free.friction).toBeCloseTo(0.25, 5)
  })

  it('пустое окно не выдаёт себя за результат', () => {
    expect(buildInsights({ stats: { quest_id: 99, steps: [] } }).hasData).toBe(false)
  })
})

describe('parseArgs', () => {
  it('дефолты окна и порога', () => {
    const args = parseArgs(['--quest', '32'])
    expect(args).toMatchObject({ quest: '32', since: '90d', minCount: 2, all: false, json: false })
  })

  it('флаги переопределяют дефолты', () => {
    const args = parseArgs(['--quest', 'minsk-cipher', '--since', '365d', '--min-count', '3', '--json', '--all'])
    expect(args).toMatchObject({ quest: 'minsk-cipher', since: '365d', minCount: 3, json: true, all: true })
  })
})
