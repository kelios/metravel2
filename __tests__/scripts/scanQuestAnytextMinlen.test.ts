// #1979: скан свободного шага, чей порог `min_length` выше слов, которые шаг
// сам перечисляет (QUEST-FREE-TEXT-MIN-LENGTH-001). Кейсы — из телеметрии
// 19.09.2026: «Нос» при пороге 4 (двое игроков), «фон» при пороге 6,
// «симметрия» при пороге 10 с открытой подсказкой.
const {
  ASK_RE,
  MULTI_RE,
  freeTextMinLength,
  enumeratedItems,
  hasBareEnumeration,
  inspectStep,
  scanQuests,
  findingKeys,
} = require('@/scripts/scan-quest-anytext-minlen')
const { splitByBaseline } = require('@/scripts/lib/scanBaseline')

const anyText = (minLength: number) => ({ type: 'any_text', value: JSON.stringify({ min_length: minLength }) })
const step = (over: Record<string, unknown>) => ({
  id: 540,
  step_id: '4-alleya-fonarey',
  is_intro: false,
  task: '',
  hint: '',
  ...over,
})
const texts = (items: Array<{ text: string }>) => items.map((item) => item.text)

const BREST_TASK =
  'Пройди всю аллею и выбери кованый фонарь, который понравился тебе больше всего — Дон Кихот, Нос, тройка или другой. Опиши его в паре слов.'
const BREST_HINT = 'У каждого фонаря — свой сюжет и характер. Ищи детали: кого или что изобразил кузнец в металле.'

describe('scan-quest-anytext-minlen: критерий', () => {
  it('порог читается как в рантайме: any_text без числа — 1, не any_text — null', () => {
    expect(freeTextMinLength(anyText(4))).toBe(4)
    expect(freeTextMinLength({ type: 'any_text', value: '{}' })).toBe(1)
    expect(freeTextMinLength({ type: 'any_text', value: 'not json' })).toBe(1)
    expect(freeTextMinLength({ type: 'exact_any', value: '["нос"]' })).toBeNull()
  })

  it('«Нос» из перечисления задания короче порога 4 — находка (brest-lantern/4-alleya-fonarey)', () => {
    const verdict = inspectStep(step({ task: BREST_TASK, hint: BREST_HINT, answer_pattern: anyText(4) }))
    expect(verdict).toMatchObject({ min_length: 4, scope: 'task-asks-short' })
    expect(verdict.items).toEqual([{ text: 'Нос', length: 3 }])
  })

  it('порог, опущенный до самого короткого варианта, находкой не является', () => {
    expect(inspectStep(step({ task: BREST_TASK, hint: BREST_HINT, answer_pattern: anyText(3) }))).toBeNull()
  })

  it('вводная с императивом даёт вариант хвостом без предлога', () => {
    expect(texts(enumeratedItems('Обрати внимание на позу, взгляд, одежду и предметы.'))).toEqual([
      'позу',
      'взгляд',
      'одежду',
      'предметы',
    ])
    expect(texts(enumeratedItems('Смотри на форму окон, кладку и крыльцо.'))).toEqual(['форму окон', 'кладку', 'крыльцо'])
    // «в паре слов» — про длину ответа, обломок «слов» вариантом не считается.
    expect(texts(enumeratedItems('Опиши её в паре слов: цвет, украшения, что зацепило.'))).toEqual(['паре слов', 'цвет', 'украшения'])
    // Одна запятая или только союз — перечисление лишь при двух коротких элементах.
    expect(texts(enumeratedItems('Подумай про свет, горы и расстояние от больших городов.'))).toEqual(['свет', 'горы'])
    expect(enumeratedItems('Пройди по саду и найди дерево, которое точно не растёт в наших лесах.')).toEqual([])
  })

  it('служебное слово узнаётся после нормализации: «этот лес» — обломок, а не вариант', () => {
    // Словари спрашиваются нормализованным словом, а `normalizeRuntime`
    // схлопывает «э»→«е»: запись «этот» в исходном написании недостижима, и
    // указательное местоимение уезжало в варианты ответа целиком
    // («этот лес» из `sasino-stilo / 5-bukowy-las`, порог 10).
    expect(texts(enumeratedItems('Опиши в паре слов этот лес: какие стволы, что под ногами, как падает свет.'))).toEqual([
      'лес',
    ])
    expect(texts(enumeratedItems('Назови главное: это цвет, форма, узор.'))).toEqual(['цвет', 'форма', 'узор'])
  })

  it('голое перечисление в подсказке попадает в scope и без «назови» в задании (minsk-cinema/2-artmuseum)', () => {
    const hint = 'Колонны, скульптура наверху, симметрия.'
    expect(hasBareEnumeration(hint)).toBe(true)
    expect(hasBareEnumeration('Обрати внимание на позу, взгляд, одежду и предметы.')).toBe(false)
    const verdict = inspectStep(
      step({ task: 'Опиши, чем фасад музея выдаёт «парадную» архитектуру.', hint, answer_pattern: anyText(10) }),
    )
    expect(verdict).toMatchObject({ scope: 'hint-bare-enumeration' })
    expect(texts(verdict.items)).toEqual(['Колонны', 'симметрия'])
    expect(inspectStep(step({ task: 'Опиши, чем фасад музея выдаёт «парадную» архитектуру.', hint, answer_pattern: anyText(7) }))).toBeNull()
  })

  it('задание про несколько элементов вне scope: «назови два отличия — цвет, башни, украшения»', () => {
    expect(MULTI_RE.test('Назови два отличия между ними — цвет, башни, украшения.')).toBe(true)
    expect(MULTI_RE.test('Опиши его в паре слов.')).toBe(false)
    expect(MULTI_RE.test('Опиши в нескольких словах.')).toBe(false)
    expect(inspectStep(step({ task: 'Назови два отличия между ними — цвет, башни, украшения.', answer_pattern: anyText(10) }))).toBeNull()
    expect(
      inspectStep(step({ task: 'Назови одну деталь «из прошлого» и одну «из настоящего»: одежда, вывески.', answer_pattern: anyText(15) })),
    ).toBeNull()
  })

  it('вне класса: закрытый словарь, интро, порог ≤ 2, задание-эссе без просьбы о коротком ответе', () => {
    expect(inspectStep(step({ task: BREST_TASK, answer_pattern: { type: 'exact_any', value: '["нос"]' } }))).toBeNull()
    expect(inspectStep(step({ is_intro: true, task: BREST_TASK, answer_pattern: anyText(4) }))).toBeNull()
    expect(inspectStep(step({ task: BREST_TASK, answer_pattern: anyText(2) }))).toBeNull()
    expect(ASK_RE.test('Сформулируй, чем река отличалась от шоссе.')).toBe(false)
    expect(
      inspectStep(step({ task: 'Сформулируй, чем дорога-река отличалась от шоссе: скорость, груз, сезон.', answer_pattern: anyText(15) })),
    ).toBeNull()
  })
})

describe('scan-quest-anytext-minlen: allow-файл', () => {
  it('ключ — quest_id|step_id, allow-файл вычитает известные шаги', () => {
    const quests = [
      { id: 51, quest_id: 'brest-lantern', steps: [step({ task: BREST_TASK, hint: BREST_HINT, answer_pattern: anyText(4) })] },
    ]
    const { findings, scannedSteps } = scanQuests(quests)
    expect(scannedSteps).toBe(1)
    expect(findings).toHaveLength(1)
    expect(findingKeys(findings[0])).toEqual(['brest-lantern|4-alleya-fonarey'])
    const split = splitByBaseline(findings, ['brest-lantern|4-alleya-fonarey'], findingKeys)
    expect(split.fresh).toHaveLength(0)
    expect(split.known).toHaveLength(1)
  })
})
