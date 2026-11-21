/**
 * План по дням (#3298): проверка схемы ответа модели, доводка кодом и сборка кодом. Чистые функции — без
 * сети, модели и индекса.
 */
import {
  assemblePlan,
  factHours,
  isCollection,
  isWholeDay,
  itemHours,
  orderByNearest,
  PLAN_DAY_MAX_HOURS,
  PLAN_DAY_MAX_HOURS_KIDS,
  PLAN_MAX_ITEMS_PER_DAY,
  PLAN_MODEL_DEFAULT,
  PLAN_REGION_KM,
  type PlanCandidate,
  refinePlan,
  regionCandidates,
  regionCenter,
} from '@/scripts/ai-assist/planBuild'
import { parsePlanAnswer, PLAN_NOTE_MAX_CHARS, PLAN_SCHEMA_MAX_ITEMS, validateTripPlan } from '@/scripts/ai-assist/planSchema'

const card = (type: 'travel' | 'quest', id: number, lat: number | null, lng: number | null, facts: PlanCandidate['facts'] = null, title = `${type} ${id}`): PlanCandidate => ({
  type,
  source_id: id,
  title,
  url: `https://metravel.by/${type === 'quest' ? 'quests' : 'travels'}/${id}`,
  path: `/${type === 'quest' ? 'quests' : 'travels'}/${id}`,
  facts_line: '',
  lat,
  lng,
  cover: null,
  city: null,
  country: 'Польша',
  facts,
})

const KRAKOW: PlanCandidate[] = [
  card('travel', 568, 50.061, 19.937),
  card('quest', 246, 50.054, 19.935, { type: 'quest', source_id: 246, duration_min: 120 }),
  card('travel', 636, 50.2, 19.83, { type: 'travel', source_id: 636, number_days: 1 }),
  card('quest', 13, 50.062, 19.94, { type: 'quest', source_id: 13, duration_min: 90 }),
  card('travel', 297, 50.1, 19.58, { type: 'travel', source_id: 297, number_days: 3 }),
]
const ALLOWED = new Set(KRAKOW.map((item) => `${item.type}:${item.source_id}`))
const options = { allowed: ALLOWED, maxDays: 2 }
const item = (source: string, id: unknown, hours: unknown = 2) => ({ source, id, hours })
const plan = (days: unknown[][], note: unknown = 'Два дня в Кракове') => ({ days: days.map((items) => ({ items })), note })
const VALID = plan([[item('travel', 568, 4), item('quest', 246, 2)], [item('travel', 636, 5)]])

describe('схема плана по дням (#3298)', () => {
  it('годный план проходит: материалы только из подсказки, дней не больше запрошенного', () => {
    expect(validateTripPlan(VALID, options)).toEqual([])
    expect(parsePlanAnswer(JSON.stringify(VALID), options)).toEqual({
      plan: { days: [{ items: [{ source: 'travel', id: 568, hours: 4 }, { source: 'quest', id: 246, hours: 2 }] }, { items: [{ source: 'travel', id: 636, hours: 5 }] }], note: 'Два дня в Кракове' },
      errors: [],
    })
    // Поле note необязательно.
    expect(parsePlanAnswer(JSON.stringify({ days: VALID.days }), options).plan?.note).toBe('')
  })

  it('JSON с текстом вокруг и в ограде берётся из ответа', () => {
    const fenced = `Вот план на два дня:\n\`\`\`json\n${JSON.stringify(VALID, null, 2)}\n\`\`\`\nХорошей поездки!`
    expect(parsePlanAnswer(fenced, options).errors).toEqual([])
    expect(parsePlanAnswer(fenced, options).plan?.days).toHaveLength(2)
  })

  it('не-JSON — не план', () => {
    for (const text of ['День 1: Вавель и квест. День 2: окрестности.', '', '{"days": [', '[1, 2, 3]']) {
      expect(parsePlanAnswer(text, options)).toEqual({ plan: null, errors: ['no JSON object in answer'] })
    }
    expect(validateTripPlan('план', options)).toEqual(['not an object'])
    expect(validateTripPlan(null, options)).toEqual(['not an object'])
  })

  it('обход: материал, которого нет в подсказке, — не по схеме', () => {
    const foreign = plan([[item('travel', 568), item('travel', 999)]])
    expect(validateTripPlan(foreign, options)).toEqual(['days[0].items[1]: travel:999 is not among prompt cards'])
    // Тот же номер у другого вида материала — другой материал.
    expect(validateTripPlan(plan([[item('quest', 568)]]), options)).toEqual(['days[0].items[0]: quest:568 is not among prompt cards'])
    expect(parsePlanAnswer(JSON.stringify(foreign), options).plan).toBeNull()
  })

  it('обход: повтор материала — в том же дне и в другом', () => {
    expect(validateTripPlan(plan([[item('travel', 568), item('travel', 568)]]), options)).toEqual(['days[0].items[1]: travel:568 repeats'])
    expect(validateTripPlan(plan([[item('travel', 568)], [item('travel', 568)]]), options)).toEqual(['days[1].items[0]: travel:568 repeats'])
  })

  it('обход: дней больше запрошенного', () => {
    const three = plan([[item('travel', 568)], [item('quest', 246)], [item('travel', 636)]])
    expect(validateTripPlan(three, options)).toEqual(['days: 3 more than requested 2'])
    expect(validateTripPlan(three, { ...options, maxDays: 3 })).toEqual([])
  })

  it('обход: часы вне пределов — ноль, минуты вместо часов, не число', () => {
    for (const hours of [0, -1, 0.1, 13, 120, '2', null, Number.NaN, true]) {
      const errors = validateTripPlan(plan([[item('quest', 246, hours)]]), options)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatch(/^days\[0\]\.items\[0\]: hours .* out of 0\.25\.\.12$/)
    }
    expect(validateTripPlan(plan([[item('quest', 246, 0.25), item('travel', 568, 12)]]), options)).toEqual([])
  })

  it('обход: идентификатор не целое положительное, вид материала чужой', () => {
    for (const id of ['568', 5.5, 0, -3, null, true]) expect(validateTripPlan(plan([[item('travel', id)]]), options)[0]).toMatch(/id .* must be a positive integer/)
    expect(validateTripPlan(plan([[item('help', 1)]]), options)[0]).toMatch(/source "help" not in/)
    expect(validateTripPlan(plan([[item('trail', 1)]]), options)[0]).toMatch(/source "trail" not in/)
  })

  it('обход: лишние поля — на верхнем уровне, в дне и в материале; текст модели через них не проходит', () => {
    expect(validateTripPlan({ ...VALID, url: 'https://evil.example' }, options)).toEqual(['unknown key "url"'])
    expect(validateTripPlan({ days: [{ items: [item('travel', 568)], title: 'лишнее' }], note: '' }, options)).toEqual(['days[0]: unknown key "title"'])
    expect(validateTripPlan({ days: [{ items: [item('travel', 568)], day: 1 }], note: '' }, options)).toEqual(['days[0]: unknown key "day"'])
    expect(validateTripPlan(plan([[{ ...item('travel', 568), title: 'Выдуманное название' }]]), options)).toEqual(['days[0].items[0]: unknown key "title"'])
    expect(validateTripPlan(plan([[{ source: 'travel', id: 568 }]]), options)).toEqual(['days[0].items[0]: missing "hours"'])
  })

  it('поле note в дне принимается и отбрасывается: в разобранный план оно не попадает', () => {
    const withDayNotes = { days: [{ items: [item('travel', 568, 4)], note: 'Город' }, { items: [item('quest', 246, 2)], note: '' }], note: 'Два дня' }
    expect(validateTripPlan(withDayNotes, options)).toEqual([])
    const parsed = parsePlanAnswer(JSON.stringify(withDayNotes), options)
    expect(parsed.errors).toEqual([])
    expect(parsed.plan).toEqual({ days: [{ items: [{ source: 'travel', id: 568, hours: 4 }] }, { items: [{ source: 'quest', id: 246, hours: 2 }] }], note: 'Два дня' })
    expect(JSON.stringify(parsed.plan!.days)).not.toContain('Город')
    // Не строка и слишком длинная фраза в дне — не по схеме; остальная строгость дня прежняя.
    expect(validateTripPlan({ days: [{ items: [item('travel', 568)], note: { url: 'https://evil.example' } }] }, options)).toEqual([`days[0]: note must be a string up to ${PLAN_NOTE_MAX_CHARS} chars`])
    expect(validateTripPlan({ days: [{ items: [item('travel', 568)], note: 'я'.repeat(PLAN_NOTE_MAX_CHARS + 1) }] }, options)).toEqual([`days[0]: note must be a string up to ${PLAN_NOTE_MAX_CHARS} chars`])
    expect(validateTripPlan({ days: [{ items: [item('travel', 568)], note: '', url: 'x' }] }, options)).toEqual(['days[0]: unknown key "url"'])
    // Чужой материал и повтор рядом с note в дне по-прежнему отказ.
    expect(validateTripPlan({ days: [{ items: [item('travel', 999)], note: '' }] }, options)).toEqual(['days[0].items[0]: travel:999 is not among prompt cards'])
  })

  it('обход: пустые и кривые дни, слишком длинная фраза, слишком много материалов', () => {
    expect(validateTripPlan({ days: [], note: '' }, options)).toEqual(['days must be a non-empty list'])
    expect(validateTripPlan({ note: 'без дней' }, options)).toEqual(['days must be a non-empty list'])
    expect(validateTripPlan(plan([[]]), options)).toEqual(['days[0].items must be a non-empty list'])
    expect(validateTripPlan({ days: ['день'], note: '' }, options)).toEqual(['days[0] must be an object'])
    expect(validateTripPlan(plan([['материал']]), options)).toEqual(['days[0].items[0] must be an object'])
    expect(validateTripPlan(plan([[item('travel', 568)]], 'я'.repeat(PLAN_NOTE_MAX_CHARS + 1)), options)).toEqual([`note must be a string up to ${PLAN_NOTE_MAX_CHARS} chars`])
    expect(validateTripPlan(plan([[item('travel', 568)]], 5), options)).toEqual([`note must be a string up to ${PLAN_NOTE_MAX_CHARS} chars`])
    const many = Array.from({ length: PLAN_SCHEMA_MAX_ITEMS + 1 }, (_, index) => item('travel', 1000 + index))
    const allowed = new Set(many.map((entry) => `travel:${entry.id}`))
    expect(validateTripPlan(plan([many]), { allowed, maxDays: 1 })).toEqual([`days[0].items: ${PLAN_SCHEMA_MAX_ITEMS + 1} more than ${PLAN_SCHEMA_MAX_ITEMS}`])
  })
})

describe('часы и регион (#3298)', () => {
  it('часы — из фактов карточки: длительность квеста, целый день у статьи на несколько дней', () => {
    expect(factHours(KRAKOW[1])).toBe(2)
    expect(factHours(KRAKOW[3])).toBe(1.5)
    expect(factHours(KRAKOW[4])).toBe(8)
    // У однодневной статьи и карточки без фактов часов в фактах нет.
    expect(factHours(KRAKOW[2])).toBeNull()
    expect(factHours(KRAKOW[0])).toBeNull()
    expect(factHours(card('quest', 1, 0, 0, { type: 'quest', source_id: 1, duration_min: 480 }))).toBe(8)
    expect(factHours(card('quest', 1, 0, 0, { type: 'quest', source_id: 1, duration_min: 10 }))).toBe(0.5)
  })

  it('факт сильнее оценки модели; без факта — оценка в пределах, без оценки — значение по умолчанию', () => {
    expect(itemHours(KRAKOW[1], 6)).toBe(2)
    expect(itemHours(KRAKOW[0], 3.2)).toBe(3)
    expect(itemHours(KRAKOW[0], 11)).toBe(8)
    expect(itemHours(KRAKOW[0])).toBe(4)
    expect(itemHours(card('quest', 5, 0, 0))).toBe(2)
  })

  it('регион: карточка далеко от середины и карточка без координат в план не идут', () => {
    const warsaw = card('travel', 177, 52.23, 21.01)
    const noPoint = card('travel', 500, null, null)
    const zero = card('travel', 501, 0, 0)
    const region = regionCandidates([...KRAKOW, warsaw, noPoint, zero])
    expect(region.map((entry) => entry.source_id)).toEqual([568, 246, 636, 13, 297])
    const center = regionCenter(KRAKOW)!
    expect(center.lat).toBeCloseTo(50.062, 2)
    expect(PLAN_REGION_KM).toBe(50)
    expect(regionCandidates([noPoint, zero])).toEqual([])
    expect(regionCenter([noPoint])).toBeNull()
  })

  it('регион при двух далёких карточках — скопление вокруг квеста, а не пустая середина между городами', () => {
    // Польский вопрос о Гданьске: статья с точкой во Вроцлаве стоит первой, за ней — квест Гданьска.
    const wroclaw = card('travel', 816, 51.11, 17.03)
    const gdansk = card('quest', 18, 54.349, 18.653)
    expect(regionCandidates([wroclaw, gdansk]).map((entry) => entry.source_id)).toEqual([18])
    // Две статьи в разных городах — остаётся более близкая к вопросу (первая).
    expect(regionCandidates([wroclaw, card('travel', 700, 54.35, 18.66)]).map((entry) => entry.source_id)).toEqual([816])
    // Три города попарно далеко друг от друга, в одном — две карточки: скопление больше одиночной первой карточки.
    expect(regionCandidates([wroclaw, card('travel', 177, 52.23, 21.01), gdansk, card('travel', 700, 54.35, 18.66), card('travel', 900, 49.3, 19.95)]).map((entry) => entry.source_id)).toEqual([18, 700])
    // Плотный набор — прежний отбор по медиане.
    expect(regionCandidates([...KRAKOW, card('travel', 177, 52.23, 21.01)]).map((entry) => entry.source_id)).toEqual([568, 246, 636, 13, 297])
  })

  it('порядок внутри дня — от первого материала к ближайшему', () => {
    const points = [
      { lat: 50.0, lng: 19.0, name: 'a' },
      { lat: 50.0, lng: 19.9, name: 'c' },
      { lat: 50.0, lng: 19.1, name: 'b' },
      { lat: 50.0, lng: 20.5, name: 'd' },
    ]
    expect(orderByNearest(points).map((point) => point.name)).toEqual(['a', 'b', 'c', 'd'])
    expect(orderByNearest(points.slice(0, 2)).map((point) => point.name)).toEqual(['a', 'c'])
  })
})

describe('доводка плана модели (#3298)', () => {
  it('часы берутся из фактов, порядок — по карте, названия и координаты — из карточек', () => {
    const raw = parsePlanAnswer(JSON.stringify(plan([[item('travel', 636, 3), item('quest', 246, 9), item('travel', 568, 2), item('quest', 13, 0.5)]])), { allowed: ALLOWED, maxDays: 2 }).plan!
    const days = refinePlan(raw, KRAKOW, { days: 2 })
    expect(days).toHaveLength(1)
    // Первым остаётся материал модели, дальше — ближайшие: из пригорода (636) в центр.
    expect(days[0].items.map((entry) => entry.source_id)).toEqual([636, 13, 568, 246])
    expect(days[0].items.map((entry) => entry.hours)).toEqual([3, 1.5, 2, 2])
    expect(days[0].items[1]).toMatchObject({ type: 'quest', title: 'quest 13', url: 'https://metravel.by/quests/13', path: '/quests/13', lat: 50.062, lng: 19.94 })
  })

  it('день не длиннее предела по часам и числу материалов: лишнее уходит в день с местом либо в новый день', () => {
    // 4 + 2 + 5 + 1,5 = 12,5 часа в одном дне при пределе 10.
    const raw = { days: [{ items: [{ source: 'travel' as const, id: 568, hours: 4 }, { source: 'quest' as const, id: 246, hours: 2 }, { source: 'travel' as const, id: 636, hours: 5 }, { source: 'quest' as const, id: 13, hours: 3 }] }], note: '' }
    const days = refinePlan(raw, KRAKOW, { days: 2 })
    expect(days.map((day) => day.items.map((entry) => entry.source_id))).toEqual([[568, 13, 246], [636]])
    for (const day of days) {
      expect(day.items.reduce((sum, entry) => sum + entry.hours, 0)).toBeLessThanOrEqual(PLAN_DAY_MAX_HOURS)
      expect(day.items.length).toBeLessThanOrEqual(PLAN_MAX_ITEMS_PER_DAY)
    }
    // Запрошен один день — лишнее в план не попадает, новый день не появляется.
    expect(refinePlan(raw, KRAKOW, { days: 1 }).map((day) => day.items.map((entry) => entry.source_id))).toEqual([[568, 13, 246]])
  })

  it('материал на два дня и больше занимает день целиком: модель поставила рядом другие — они уходят в другой день', () => {
    expect(isWholeDay(KRAKOW[4])).toBe(true)
    expect(isWholeDay(KRAKOW[2])).toBe(false)
    expect(isWholeDay(KRAKOW[1])).toBe(false)
    const raw = { days: [{ items: [{ source: 'travel' as const, id: 297, hours: 2 }, { source: 'travel' as const, id: 568, hours: 4 }, { source: 'quest' as const, id: 246, hours: 2 }] }], note: '' }
    const days = refinePlan(raw, KRAKOW, { days: 2 })
    expect(days.map((day) => day.items.map((entry) => entry.source_id))).toEqual([[297], [568, 246]])
    expect(days[0].items[0].hours).toBe(8)
    // Материал на целый день стоит вторым — в день к другим он не добавляется, а встаёт отдельным днём.
    const second = { days: [{ items: [{ source: 'quest' as const, id: 246, hours: 2 }, { source: 'travel' as const, id: 297, hours: 2 }, { source: 'quest' as const, id: 13, hours: 2 }] }], note: '' }
    expect(refinePlan(second, KRAKOW, { days: 2 }).map((day) => day.items.map((entry) => entry.source_id))).toEqual([[246, 13], [297]])
    // Дней больше нет — материал на целый день в план не попадает, чужой день он не занимает.
    expect(refinePlan({ days: [{ items: [{ source: 'quest' as const, id: 246, hours: 2 }] }, { items: [{ source: 'quest' as const, id: 13, hours: 2 }, { source: 'travel' as const, id: 297, hours: 2 }] }], note: '' }, KRAKOW, { days: 2 }).map((day) => day.items.map((entry) => entry.source_id))).toEqual([[246], [13]])
  })

  it('план на один день: материал на несколько дней не берётся, пока есть другие кандидаты', () => {
    const raw = { days: [{ items: [{ source: 'travel' as const, id: 297, hours: 8 }, { source: 'quest' as const, id: 246, hours: 2 }] }], note: '' }
    expect(refinePlan(raw, KRAKOW, { days: 1 }).map((day) => day.items.map((entry) => entry.source_id))).toEqual([[246]])
    // Модель назвала только его — доводка возвращает пустой план, и служба собирает план кодом.
    expect(refinePlan({ days: [{ items: [{ source: 'travel' as const, id: 297, hours: 8 }] }], note: '' }, KRAKOW, { days: 1 })).toEqual([])
    // Других кандидатов нет — материал на несколько дней остаётся единственным.
    const only = [KRAKOW[4]]
    expect(refinePlan({ days: [{ items: [{ source: 'travel' as const, id: 297, hours: 8 }] }], note: '' }, only, { days: 1 }).map((day) => day.items.map((entry) => entry.source_id))).toEqual([[297]])
  })

  it('материал вне карточек в доводку не попадает, пустых дней нет', () => {
    const raw = { days: [{ items: [{ source: 'travel' as const, id: 999, hours: 2 }] }, { items: [{ source: 'quest' as const, id: 13, hours: 2 }] }], note: '' }
    expect(refinePlan(raw, KRAKOW, { days: 2 }).map((day) => day.items.map((entry) => entry.source_id))).toEqual([[13]])
  })
})

describe('сборка плана кодом (#3298)', () => {
  it('дни начинаются с самого близкого к вопросу материала, дальше — ближайшие по карте в пределах часов', () => {
    const days = assemblePlan(KRAKOW, { days: 2 })
    expect(days).toHaveLength(2)
    expect(days[0].items[0].source_id).toBe(568)
    const ids = days.flatMap((day) => day.items.map((entry) => entry.source_id))
    expect(new Set(ids).size).toBe(ids.length)
    for (const day of days) {
      expect(day.items.length).toBeGreaterThanOrEqual(1)
      expect(day.items.length).toBeLessThanOrEqual(PLAN_MAX_ITEMS_PER_DAY)
      expect(day.items.reduce((sum, entry) => sum + entry.hours, 0)).toBeLessThanOrEqual(PLAN_DAY_MAX_HOURS)
    }
    // Часы — из фактов либо значение по умолчанию.
    const hours = new Map(days.flatMap((day) => day.items.map((entry) => [entry.source_id, entry.hours] as const)))
    expect(hours.get(568)).toBe(4)
    if (hours.has(246)) expect(hours.get(246)).toBe(2)
  })

  // #3431 В2: предел часов дня — параметр сборки; для плана с детьми он ниже.
  it('план с детьми: день не длиннее детского предела — у сборки кодом и у доводки плана модели', () => {
    const hoursOfDay = (day: { items: Array<{ hours: number }> }) => day.items.reduce((sum, entry) => sum + entry.hours, 0)
    const quests = [1, 2, 3, 4, 5, 6].map((id) => card('quest', id, 50.06 + id / 1000, 19.94, { type: 'quest', source_id: id, duration_min: 180 }))
    const adult = assemblePlan(quests, { days: 2 })
    const kids = assemblePlan(quests, { days: 2, maxDayHours: PLAN_DAY_MAX_HOURS_KIDS })
    // Три квеста по три часа — девять часов: взрослому дню годится, детскому — нет.
    expect(adult.map(hoursOfDay)).toEqual([9, 9])
    expect(kids.map(hoursOfDay)).toEqual([6, 6])
    expect(PLAN_DAY_MAX_HOURS_KIDS).toBeLessThan(PLAN_DAY_MAX_HOURS)
    const crowded = plan([[item('quest', 1), item('quest', 2), item('quest', 3)], [item('quest', 4)]])
    const refined = refinePlan(parsePlanAnswer(JSON.stringify(crowded), { allowed: new Set(quests.map((entry) => `quest:${entry.source_id}`)), maxDays: 2 }).plan!, quests, { days: 2, maxDayHours: PLAN_DAY_MAX_HOURS_KIDS })
    expect(refined.map(hoursOfDay)).toEqual([6, 6])
    // Материал на целый день длиннее детского предела, но свой день по-прежнему занимает.
    const whole = [card('travel', 238, 53.68, 23.83, { type: 'travel', source_id: 238, number_days: 2 }), ...quests.slice(0, 2)]
    expect(assemblePlan(whole, { days: 2, maxDayHours: PLAN_DAY_MAX_HOURS_KIDS }).map((day) => day.items.map((entry) => entry.source_id))).toEqual([[238], [1, 2]])
  })

  // #3431 В2: статья-сборник — перечень поездок, а не пункт дня.
  it('статья-сборник в план не идёт, пока без неё остаётся из чего собирать', () => {
    for (const title of ['Замки и усадьбы Беларуси: 19 маршрутов из Минска', 'Что посмотреть вокруг Кракова: 18 маршрутов', 'Горы Польши: 19 пеших маршрутов', 'Отдых у воды в Беларуси: 33 проверенных места', 'Куда поехать в Беларуси на выходные: 4 маршрута', 'Маршруты выходного дня из Минска: 13 поездок', 'Заброшенные усадьбы и замки Беларуси: 38 мест']) {
      expect({ title, collection: isCollection(card('travel', 1, 50, 19, null, title)) }).toEqual({ title, collection: true })
    }
    // Не сборник: число — высота, километры и дни; квест; статья с числом дней в каталоге.
    for (const title of ['Лесковец (922 м): лёгкий маршрут в Бескидах', 'Mullerthal Trail: 112 км по Люксембургу за 6 дней', 'Краков: путеводитель по местам', 'Два маршрута по Гродно', 'Хельская коса: три маяка и неделя на Балтике', '78 парков - 78 печатей: как стать исследователем краковских парков', '12 местных блюд Кракова']) {
      expect({ title, collection: isCollection(card('travel', 1, 50, 19, null, title)) }).toEqual({ title, collection: false })
    }
    expect(isCollection(card('quest', 1, 50, 19, null, 'Квест: 12 мест Кракова'))).toBe(false)
    expect(isCollection(card('travel', 1, 50, 19, { type: 'travel', source_id: 1, number_days: 2 }, 'Татры: 5 маршрутов за два дня'))).toBe(false)

    const collection = card('travel', 636, 50.2, 19.83, null, 'Что посмотреть вокруг Кракова: 18 маршрутов')
    const cards = [collection, KRAKOW[0], KRAKOW[1], KRAKOW[3]]
    const ids = (days: Array<{ items: Array<{ source_id: number }> }>) => days.flatMap((day) => day.items.map((entry) => entry.source_id))
    expect(ids(assemblePlan(cards, { days: 2 }))).not.toContain(636)
    expect(ids(assemblePlan(cards, { days: 2 })).sort()).toEqual([13, 246, 568])
    // Модель поставила сборник в день — доводка его убирает.
    const withCollection = parsePlanAnswer(JSON.stringify(plan([[item('travel', 636, 4), item('quest', 246)], [item('travel', 568, 4)]])), { allowed: new Set(cards.map((entry) => `${entry.type}:${entry.source_id}`)), maxDays: 2 }).plan!
    expect(ids(refinePlan(withCollection, cards, { days: 2 }))).toEqual([246, 568])
    // Без сборника осталась бы одна карточка — плана из неё не собрать: сборник остаётся.
    expect(ids(assemblePlan([collection, KRAKOW[1]], { days: 1 })).sort()).toEqual([246, 636])
  })

  it('материалов меньше, чем дней: план короче запрошенного', () => {
    const lida = [card('quest', 11, 53.89, 25.3, { type: 'quest', source_id: 11, duration_min: 75 }), card('quest', 348, 53.892, 25.301, { type: 'quest', source_id: 348, duration_min: 90 })]
    const days = assemblePlan(lida, { days: 5 })
    expect(days).toHaveLength(1)
    expect(days[0].items.map((entry) => [entry.source_id, entry.hours])).toEqual([[11, 1.5], [348, 1.5]])
  })

  it('материал на два дня и больше занимает день целиком: других материалов в этот день код не ставит', () => {
    const grodno = [
      card('travel', 153, 53.68, 23.82, { type: 'travel', source_id: 153, number_days: 1 }),
      card('travel', 238, 53.68, 23.83, { type: 'travel', source_id: 238, number_days: 2 }),
      card('quest', 241, 53.679, 23.829, { type: 'quest', source_id: 241, duration_min: 120 }),
      card('quest', 7, 53.677, 23.83, { type: 'quest', source_id: 7, duration_min: 120 }),
      card('travel', 228, 53.63, 23.69, { type: 'travel', source_id: 228, number_days: 1 }),
    ]
    const days = assemblePlan(grodno, { days: 3 })
    const alone = days.find((day) => day.items.some((entry) => entry.source_id === 238))!
    expect(alone.items.map((entry) => [entry.source_id, entry.hours])).toEqual([[238, 8]])
    // Остальные дни собраны из обычных материалов и не пусты.
    expect(days).toHaveLength(3)
    expect(days.filter((day) => day !== alone).every((day) => day.items.length >= 1 && day.items.every((entry) => entry.source_id !== 238))).toBe(true)
    const ids = days.flatMap((day) => day.items.map((entry) => entry.source_id))
    expect([...ids].sort((x, y) => x - y)).toEqual([7, 153, 228, 238, 241])
  })

  it('план на один день: материал на несколько дней не берётся, если есть другие кандидаты', () => {
    const cards = [card('travel', 238, 53.68, 23.83, { type: 'travel', source_id: 238, number_days: 2 }), card('quest', 241, 53.679, 23.829, { type: 'quest', source_id: 241, duration_min: 120 }), card('quest', 7, 53.677, 23.83, { type: 'quest', source_id: 7, duration_min: 90 })]
    expect(assemblePlan(cards, { days: 1 }).map((day) => day.items.map((entry) => entry.source_id))).toEqual([[241, 7]])
    // Кроме него ничего нет — он и есть план.
    expect(assemblePlan([cards[0]], { days: 1 }).map((day) => day.items.map((entry) => entry.source_id))).toEqual([[238]])
  })

  it('дней не больше запрошенного и не больше числа материалов; пустой список — пустой план', () => {
    expect(assemblePlan(KRAKOW, { days: 1 })).toHaveLength(1)
    expect(assemblePlan(KRAKOW.slice(0, 2), { days: 7 }).length).toBeLessThanOrEqual(2)
    expect(assemblePlan([], { days: 3 })).toEqual([])
  })

  it('по умолчанию план собирает код: модель проходит схему, но её план беднее сборки кодом', () => {
    expect(PLAN_MODEL_DEFAULT).toBe(false)
  })
})
