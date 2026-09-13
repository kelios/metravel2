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
  findStepTextEcho,
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

  it('неизвестный флаг — ошибка, а не тихий дефолт (#1934)', () => {
    expect(() => parseArgs(['--quest', '32', '--quest-id=32'])).toThrow('Unknown argument: --quest-id=32')
  })
})

// #1923: ловушка обратного знака к #1908 — текст шага печатает ОТКЛОНЯЕМЫЙ
// ответ. Все восемь случаев ниже взяты из замера по всей телеметрии прода
// 13.09.2026 (176 отклонённых попыток с сырым вводом → 10 кандидатов → 3
// настоящих). Тест держит ровно эту разделительную линию: три дефекта видны,
// пять ложных срабатываний отсеяны.
describe('findStepTextEcho — отклонённый ввод стоит в тексте своего шага', () => {
  it('видит слово заголовка, которое чекер отвергает (шаг 537 brest-lantern)', () => {
    expect(
      findStepTextEcho('закат', {
        title: 'Часы, которые считают закат',
        task: 'Подойди к часам и прочитай надпись на циферблате. Время ЧЕГО они показывают?',
        hint: 'Смотри на надпись под циферблатом',
      }),
    ).toEqual({ field: 'title' })
  })

  it('видит слово задания (шаг 176 gomel-palace/chapel)', () => {
    expect(
      findStepTextEcho('плитка', {
        title: 'Часовня-усыпальница',
        task: 'Чем облицован фасад? Яркая глянцевая плитка с цветочным узором по-особому блестит на солнце.',
        hint: 'обожжённая глазурованная облицовка',
      }),
    ).toEqual({ field: 'task' })
  })

  it('молчит, когда текст сам отрекается от названного значения (шаг 325 minsk-cipher/3-pobeda)', () => {
    // Реальный текст подсказки с прода: промежуточная сумма названа и тут же
    // объявлена неответом. Это обучающий шаг, а не ловушка, и `33` в словарь
    // добавлять нельзя — иначе засчитывается нерешённая задача (шапка скрипта).
    expect(
      findStepTextEcho('33', {
        title: 'Загадка четвёртая: дата на бронзе',
        task: 'Обойди постамент: мастер выбил дату Победы. Найди её и сверни в одну цифру.',
        hint: 'Сложив все восемь цифр, ты получишь 33 — и это ещё не ответ: осталось сложить две цифры этого числа.',
      }),
    ).toBeNull()
  })

  it('РЕГРЕССИЯ: отречение «ещё не» ловится и без слова «ответ» (ё уже сведена к е)', () => {
    // Ветка `ещё не` жила рядом с `не ответ` и была мертва: `normalizeValue`
    // сводит `ё` к `е` ДО сравнения, поэтому слово `ещё` в тексте шага не
    // встречается никогда. Прежний тест этого не показывал — реальная подсказка
    // шага 325 содержит и «не ответ», и правило срабатывало по первой ветке.
    expect(
      findStepTextEcho('33', {
        title: 'Победа',
        task: 'Сложи цифры и сверни до одной',
        hint: 'Сложив все восемь цифр, ты получишь 33 — и это ещё не финал: сложи две цифры этого числа.',
      }),
    ).toBeNull()
  })

  it('РЕГРЕССИЯ: «ещё не раз» — обычная речь, а не отречение', () => {
    // Правило отречения сначала срабатывало на любом «ещё не», и подсказка
    // khiva-ichan-kala/2-kalta-minor «Такие здания встретятся тебе в Хиве ещё
    // не раз» глушила совпадения, от которых текст ничего не объявлял.
    // Отречение узнаётся по «не <чем именно>»: ответ, финал, итог, конец.
    expect(
      findStepTextEcho('здания', {
        title: 'Кальта-Минор',
        task: 'Что это за постройка?',
        hint: 'Такие здания встретятся тебе в Хиве ещё не раз.',
      }),
    ).toEqual({ field: 'hint' })
  })

  it('видит число подсказки, если текст от него не отрекается', () => {
    expect(
      findStepTextEcho('33', { title: 'Победа', task: 'Сложи цифры и сверни до одной', hint: 'Сумма равна 33' }),
    ).toEqual({ field: 'hint' })
  })

  it('молчит, когда подсказка называет слово, чтобы его исключить', () => {
    // «не флягу и не котелок» — отказ по такому вводу правильный (шаг 135).
    expect(
      findStepTextEcho('котелок', { title: 'Жажда', task: 'Что держит солдат?', hint: 'Это не флягу и не котелок' }),
    ).toBeNull()
    expect(
      findStepTextEcho('камень', {
        title: 'Часовня',
        task: 'Чем облицован фасад?',
        hint: 'Это не штукатурка и не камень, а обожжённая облицовка',
      }),
    ).toBeNull()
  })

  it('молчит на намеренном перечислении вариантов в задании', () => {
    // Задание само предлагает выбор из трёх — назвать неверный можно (шаг 961).
    expect(
      findStepTextEcho('дубовый лист', {
        title: 'Девочка с совой',
        task: 'Что у неё в руке: дубовый лист, кленовый или липовый?',
        hint: '',
      }),
    ).toBeNull()
  })

  it('молчит на номере точки в заголовке', () => {
    // «1. Экипаж» — цифра нумерует точку, а не печатает ответ (шаг 957).
    expect(findStepTextEcho('1', { title: '1. Экипаж', task: 'Сколько лошадей?', hint: '' })).toBeNull()
  })

  it('молчит, когда игрок вставил в поле ответа текст шага', () => {
    // Шаг 166: совпадение длиной в предложение — это не ответ игрока.
    const hint = 'Подойди ближе к стене — это не штукатурка и не камень, а обожжённая облицовка'
    expect(findStepTextEcho(hint, { title: 'Ворота', task: 'Что это?', hint })).toBeNull()
  })

  it('молчит на пустом вводе и на шаге без текста', () => {
    expect(findStepTextEcho('', { title: 'Часы', task: '', hint: '' })).toBeNull()
    expect(findStepTextEcho('закат', {})).toBeNull()
  })
})

describe('buildInsights — эхо текста шага попадает в отчёт', () => {
  const statsWithTrap = {
    quest_id: 'brest-lantern',
    steps: [
      {
        step_key: '1-chasy-fonarey',
        answer_type: 'exact_any',
        players_reached: 3,
        players_solved: 3,
        rejected_total: 4,
        rejected_per_solver: 1.3,
        hint_open_rate: 0,
        abandon_rate: 0,
        median_time_ms: 30000,
        top_rejected: [
          { value: 'закат', count: 3, players: 3 },
          { value: 'восход', count: 1, players: 1 },
        ],
      },
    ],
  }

  const texts = {
    '1-chasy-fonarey': {
      title: 'Часы, которые считают закат',
      task: 'Время ЧЕГО они показывают?',
      hint: 'Читай надпись на циферблате',
    },
  }

  it('помечает кандидата, который шаг сам печатает, и собирает список ловушек', () => {
    const report = buildInsights({
      stats: statsWithTrap,
      patternsByStepKey: { '1-chasy-fonarey': { type: 'exact_any', value: JSON.stringify(['время зажжения']) } },
      textsByStepKey: texts,
      minCount: 1,
    })

    const step = report.steps[0]
    const sunset = step.candidates.find((candidate: { value: string }) => candidate.value === 'закат')
    const sunrise = step.candidates.find((candidate: { value: string }) => candidate.value === 'восход')

    expect(sunset.textEcho).toEqual({ field: 'title' })
    expect(sunrise.textEcho).toBeNull()
    expect(step.textEchoes).toHaveLength(1)
  })

  it('без текстов шагов ловушек не выдумывает', () => {
    const report = buildInsights({ stats: statsWithTrap, minCount: 1 })
    expect(report.steps[0].textEchoes).toHaveLength(0)
  })
})
