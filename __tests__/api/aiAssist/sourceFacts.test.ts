import path from 'path'

import { questToSource, travelToSource } from '@/api/aiAssist/retrieval'
import {
  detectSuperlative,
  factsKey,
  formatKm,
  questFactsLine,
  questFactsOf,
  rankBySuperlative,
  routeKindOf,
  routeLengthKm,
  superlativeReason,
  travelFactsLine,
  travelFactsOf,
  type QuestFacts,
} from '@/api/aiAssist/sourceFacts'
import { enabledQuestTags } from '@/utils/questTags'

import { runCli } from '../../scripts/cli-test-utils'

jest.mock('@/api/travelListQueries', () => ({ fetchTravels: jest.fn() }))
jest.mock('@/api/travelDetailsQueries', () => ({ fetchTravel: jest.fn() }))
jest.mock('@/api/quests', () => ({ fetchQuestsCompactCatalog: jest.fn() }))
jest.mock('@/api/activeQueryClient', () => ({ getActiveQueryClient: jest.fn(() => null) }))
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({ userId: null }) } }))

// #3287: карточка службы `/ai/ask` не несла длительность, число точек и сложность квеста, число дней
// статьи. Один построитель строки фактов для экрана, службы и слепка обучения.

const quest = (extra: Record<string, unknown> = {}) => ({
  id: 7,
  quest_id: 'nesvizh-kids-park-page',
  title: 'Паж Стась и тайна парка',
  city_id: '12',
  city_alias: 'nesvizh',
  city_name: 'Несвиж',
  country_name: 'Беларусь',
  points: 3,
  // Число точек слепок обучения считает по шагам квеста.
  steps: [{ step_id: 'a' }, { step_id: 'b' }, { step_id: 'c' }],
  duration_min: 90,
  difficulty: 'easy',
  pet_friendly: true,
  tags: { kids: true, 'age-8-10': true, 'adult-required': true },
  ...extra,
})

const travel = (extra: Record<string, unknown> = {}) => ({
  id: 816,
  slug: 'iarmarki-polshi',
  name: 'Рождественские ярмарки Польши',
  countryName: 'Польша',
  cityName: 'Краков',
  description: '<p>Каждый год в конце ноября в польских городах открываются ярмарки.</p>',
  number_days: 3,
  month: [11, 12],
  ...extra,
})

/** Карточки, на которых сверяются экран и слепок обучения: полная, пустая и с кривыми значениями. */
const QUESTS = [
  quest(),
  quest({ pet_friendly: false, tags: ['family'] }),
  quest({ pet_friendly: null, tags: { legend: true }, difficulty: 'hard' }),
  quest({ tags: null, duration_min: null, difficulty: '', points: 0, steps: [], city_name: '', country_name: '' }),
  quest({ tags: ['kids', 'age-5-7', 'age-8-10'], difficulty: 'medium', duration_min: 45 }),
]
const TRAVELS = [
  travel(),
  travel({ number_days: 1, month: [5] }),
  travel({ number_days: null, month: [] }),
  travel({ number_days: '2', month: ['7', 6, 6, 13, 0] }),
  travel({ month: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], cityName: '' }),
  travel({ number_days: 0, month: null, countryName: '', cityName: '', description: '' }),
]

describe('факты источника в карточке ассистента (#3287)', () => {
  it('запись фактов квеста: числа из каталога, аудитория по тегам; пустое и кривое в запись не попадает', () => {
    expect(questFactsOf(7, { points: '9', duration_min: 90, difficulty: 'easy', pet_friendly: true, tags: ['kids', 'age-8-10', 'adult-required'] })).toEqual({
      type: 'quest',
      source_id: 7,
      points: 9,
      duration_min: 90,
      difficulty: 'easy',
      pet_friendly: true,
      audience: 'kids',
      age: [8, 10],
      adult: true,
    })
    expect(questFactsOf(8, { points: 0, duration_min: null, difficulty: 'extreme', pet_friendly: 'yes', tags: ['legend'] })).toEqual({ type: 'quest', source_id: 8 })
    expect(questFactsOf(9, { pet_friendly: false, tags: ['family'] })).toEqual({ type: 'quest', source_id: 9, pet_friendly: false, audience: 'family' })
    expect(factsKey({ type: 'quest', source_id: 9 })).toBe('quest:9')
  })

  it('запись фактов статьи: число дней, месяцы по возрастанию без повторов, названия транспорта и категорий', () => {
    expect(travelFactsOf(816, { number_days: '3', month: [12, '11', 11, 0, 13], transports: ['Машина', ' ', 'Машина', 'Поезд'], categories: ['Замки'] })).toEqual({
      type: 'travel',
      source_id: 816,
      number_days: 3,
      months: [11, 12],
      transports: ['Машина', 'Поезд'],
      categories: ['Замки'],
    })
    expect(travelFactsOf(1, { number_days: null, month: 'май', transports: [], categories: null })).toEqual({ type: 'travel', source_id: 1 })
  })

  it('строка фактов квеста: поля, на которых модель обучена, — прежними словами и в прежнем порядке; новое дописано в конец', () => {
    const place = { city: 'Несвиж', country: 'Беларусь' }
    expect(questFactsLine({ points: 9, duration_min: 90, difficulty: 'easy', audience: 'kids', age: [8, 10], adult: true, pet_friendly: true }, place)).toBe(
      'Детский городской квест по городу Несвиж (Беларусь). Возраст: 8–10 лет. Со взрослым. Точек: 9. Длительность: 90 мин. Сложность: лёгкий. Можно с собакой',
    )
    // Строка круга v7/v9: без нового поля она не меняется ни на знак.
    expect(questFactsLine({ points: 9, duration_min: 90, difficulty: 'easy' }, place)).toBe('Городской квест по городу Несвиж (Беларусь). Точек: 9. Длительность: 90 мин. Сложность: лёгкий')
    expect(questFactsLine({ points: 9, duration_min: 90, difficulty: 'medium', audience: 'family', pet_friendly: false }, place)).toBe(
      'Семейный городской квест по городу Несвиж (Беларусь). Точек: 9. Длительность: 90 мин. Сложность: средний',
    )
    expect(questFactsLine(null, { city: ' ', country: null })).toBe('Городской квест')
  })

  it('строка фактов статьи: страна, число дней, месяцы', () => {
    const place = { country: 'Польша' }
    expect(travelFactsLine({ number_days: 3, months: [11, 12] }, place)).toBe('Польша. Дней: 3. Месяцы: ноябрь, декабрь')
    expect(travelFactsLine({ number_days: 1, months: [5] }, place)).toBe('Польша. Дней: 1. Месяц: май')
    expect(travelFactsLine({ months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }, place)).toBe('Польша. Месяцы: круглый год')
    expect(travelFactsLine(null, place)).toBe('Польша')
    // Транспорт и категории в строку не идут: список статей экрана их не отдаёт.
    expect(travelFactsLine({ number_days: 2, transports: ['Машина'], categories: ['Замки'] }, { country: 'Беларусь' })).toBe('Беларусь. Дней: 2')
    expect(travelFactsLine(null)).toBe('')
  })

  // #3347: `cityName` статьи в каталоге — подпись первой точки маршрута (бэкенд `get_city_name`), а не город.
  // Четыре статьи приёмки 12.11.2026 — значения из слепка индекса `.codex-temp/ai-index/raw/travels`.
  it.each([
    [168, 'Испания. Барселона - Мадрид - Рондо - Толедо - Браселона', 'Испания', 'Madrid', 'Испания'],
    [362, 'Морское око в мае: озеро в Татрах, Польша', 'Польша', 'Palenica Białczańska', 'Польша. Дней: 1. Месяц: май'],
    [null, 'Зелёное озеро в Высоких Татрах', 'Словакия', 'Chata pri Zelenom plese', 'Словакия. Дней: 1. Месяц: май'],
    [672, 'Маршруты выходного дня из Минска: 13 поездок', 'Беларусь', 'Лысая гора (342 м)', 'Беларусь'],
  ])('место статьи в строке фактов — страна, точка маршрута в неё не идёт: статья %s «%s»', (id, name, countryName, cityName, expected) => {
    const withFacts = expected.includes('Дней')
    const item = travel({ id: id ?? 1, name, countryName, cityName, number_days: withFacts ? 1 : null, month: withFacts ? [5] : [] })
    const card = travelToSource(item as never, [])
    const line = String(card?.snippet).split('. Каждый год')[0]
    expect(line).toBe(expected)
    expect(card?.snippet).not.toContain(cityName)
    // Место карточки для отбора подсказки (#3315) — тоже только страна.
    expect(card?.place).toEqual({ countries: [countryName] })
  })

  it('карточка экрана строится тем же построителем: квест — строка фактов, статья — строка фактов и начало описания', () => {
    expect(questToSource(QUESTS[0] as never, [], 'quest')?.snippet).toBe(
      'Детский городской квест по городу Несвиж (Беларусь). Возраст: 8–10 лет. Со взрослым. Точек: 3. Длительность: 90 мин. Сложность: лёгкий. Можно с собакой',
    )
    expect(travelToSource(TRAVELS[0] as never, [])?.snippet).toBe(
      'Польша. Дней: 3. Месяцы: ноябрь, декабрь. Каждый год в конце ноября в польских городах открываются ярмарки.',
    )
    // Балл статьи считается по месту и описанию: слова фактов её под вопрос не выбирают.
    expect(travelToSource(TRAVELS[0] as never, ['ноябрь', 'декабрь'])?.score).toBe(travelToSource(travel({ month: [] }) as never, ['ноябрь', 'декабрь'])?.score)
  })

  it('слепок обучения строит ту же строку фактов для квеста и для статьи: quest_card(facts=True) и travel_facts_line(facts=True)', () => {
    const dir = path.resolve(process.cwd(), 'scripts/ai-train')
    const script = [
      'import json, sys',
      `sys.path.insert(0, ${JSON.stringify(dir)})`,
      'from sets.rag_answers import quest_card, travel_card, travel_facts_line',
      'data = json.load(sys.stdin)',
      'print(json.dumps({',
      '  "quests": [quest_card(q, audience=True, facts=True)["snippet"] for q in data["quests"]],',
      '  "travels": [travel_facts_line(t, facts=True) for t in data["travels"]],',
      '  "travel_cards": [travel_card(t, facts=True)["snippet"] for t in data["travels"]],',
      // Без `facts` карточка — та, на которой собраны наборы кругов 1–9.
      '  "quests_trained": [quest_card(q, audience=True)["snippet"] for q in data["quests"]],',
      '  "travel_cards_trained": [travel_card(t)["snippet"] for t in data["travels"]],',
      '}, ensure_ascii=False))',
    ].join('\n')
    const run = runCli('python3', ['-I', '-c', script], { input: JSON.stringify({ quests: QUESTS, travels: TRAVELS }) })
    expect(run.stderr).toBe('')
    expect(run.status).toBe(0)
    const snapshot = JSON.parse(run.stdout)

    const questLines = QUESTS.map((item) => questToSource(item as never, [], 'quest')?.snippet)
    expect(snapshot.quests).toEqual(questLines)
    const travelFacts = TRAVELS.map((item) => travelFactsOf(Number(item.id), { number_days: item.number_days, month: item.month }))
    const travelLines = TRAVELS.map((item, index) => travelFactsLine(travelFacts[index], { country: item.countryName as string }))
    expect(snapshot.travels).toEqual(travelLines)
    expect(snapshot.travel_cards).toEqual(TRAVELS.map((item) => travelToSource(item as never, [])?.snippet))

    // Сверка не пустая: есть карточки с новым полем и без него, со днями, месяцами и «круглый год».
    expect(questLines.filter((line) => line?.endsWith('Можно с собакой'))).toHaveLength(3)
    expect(questLines.filter((line) => line && !line.includes('собакой'))).toHaveLength(2)
    expect(travelLines).toEqual([
      'Польша. Дней: 3. Месяцы: ноябрь, декабрь',
      'Польша. Дней: 1. Месяц: май',
      'Польша',
      'Польша. Дней: 2. Месяцы: июнь, июль',
      'Польша. Дней: 3. Месяцы: круглый год',
      '',
    ])
    // Подпись первой точки маршрута (`cityName`) в строку фактов не идёт ни в построителе, ни в слепке (#3347).
    expect(snapshot.travels.some((line: string) => line.includes('Краков'))).toBe(false)
    // Прежняя строка — начало новой: существующие поля не сдвинулись, новое только добавлено.
    QUESTS.forEach((item, index) => {
      const withoutPet = questFactsLine({ ...questFactsOf(item.id, { ...item, tags: enabledQuestTags(item.tags) }), pet_friendly: undefined }, { city: item.city_name as string, country: item.country_name as string })
      expect(snapshot.quests_trained[index]).toBe(withoutPet)
      expect(String(questLines[index]).startsWith(snapshot.quests_trained[index])).toBe(true)
    })
    expect(snapshot.travel_cards_trained[0]).toBe('Польша, Краков. Каждый год в конце ноября в польских городах открываются ярмарки.')
  })

  it.each([
    ['ru', 'Самый короткий квест в Минске', { field: 'duration_min', order: 'asc' }],
    ['ru', 'Какие квесты есть в Гродно? А какой из них самый короткий?', { field: 'duration_min', order: 'asc' }],
    ['ru', 'Какой квест в Бресте покороче?', { field: 'duration_min', order: 'asc' }],
    ['ru', 'Самый длинный квест Кракова', { field: 'duration_min', order: 'desc' }],
    ['ru', 'В каком квесте Гродно меньше точек?', { field: 'points', order: 'asc' }],
    ['ru', 'Где меньше всего точек?', { field: 'points', order: 'asc' }],
    ['ru', 'Где больше точек — в Минске или в Бресте?', { field: 'points', order: 'desc' }],
    ['ru', 'Самый лёгкий квест в Гродно', { field: 'difficulty', order: 'asc' }],
    ['ru', 'Какой квест в Минске самый сложный?', { field: 'difficulty', order: 'desc' }],
    ['be', 'Які квэст у Гродне самы кароткі?', { field: 'duration_min', order: 'asc' }],
    ['be', 'Дзе менш кропак?', { field: 'points', order: 'asc' }],
    ['be', 'У якім квэсце Мінска менш за ўсё кропак?', { field: 'points', order: 'asc' }],
    ['uk', 'У якому квесті менше за все точок?', { field: 'points', order: 'asc' }],
    ['uk', 'Який квест у Львові найкоротший?', { field: 'duration_min', order: 'asc' }],
    ['uk', 'Де менше точок?', { field: 'points', order: 'asc' }],
    ['pl', 'Który quest w Krakowie jest najkrótszy?', { field: 'duration_min', order: 'asc' }],
    ['pl', 'Ktory quest w Krakowie jest najkrotszy?', { field: 'duration_min', order: 'asc' }],
    ['pl', 'Gdzie jest najmniej punktów?', { field: 'points', order: 'asc' }],
    ['pl', 'Najdłuższy quest w Gdańsku', { field: 'duration_min', order: 'desc' }],
    ['en', 'What is the shortest quest in Vilnius?', { field: 'duration_min', order: 'asc' }],
    ['en', 'Which quest has the fewest stops?', { field: 'points', order: 'asc' }],
    ['en', 'The easiest quest in Minsk', { field: 'difficulty', order: 'asc' }],
  ])('[%s] «%s» — превосходная степень', (_lang, question, expected) => {
    expect(detectSuperlative(question)).toEqual(expected)
  })

  it.each([
    'Какие квесты есть в Минске?',
    // Не о квесте: карточки не переставляются.
    'Самый короткий путь из Минска в Гродно',
    'Самая длинная улица Кракова',
    'What is the shortest way to the castle?',
    // Условие, а не превосходная степень — это отбор по условиям (#3289).
    'Квест не больше пяти точек в Минске',
    'Квест не меньше 10 точек',
    'Квест в Гродно: больше 8 точек есть?',
    'Короче, что посмотреть в Бресте?',
    '',
  ])('«%s» — не превосходная степень', (question) => {
    expect(detectSuperlative(question)).toBeNull()
  })

  // #3353: длина маршрута статьи — факт карточки и строка «Длина: N км» после числа дней.
  describe('длина маршрута статьи (#3353)', () => {
    it('вид маршрута — по категориям и транспорту каталога; статья не о маршруте вида не имеет', () => {
      expect(routeKindOf({ categories: ['Поход', 'Самостоятельное путешествие'] })).toBe('foot')
      expect(routeKindOf({ categories: ['Хайкинг'] })).toBe('foot')
      expect(routeKindOf({ categories: ['Веломаршрут'] })).toBe('bike')
      expect(routeKindOf({ categories: ['Автопутешествие'], transports: ['Велосипед'] })).toBe('bike')
      // Обе категории — пешая: пеший маршрут в статье есть.
      expect(routeKindOf({ categories: ['Велопоход', 'Треккинг'] })).toBe('foot')
      expect(routeKindOf({ categories: ['Автопутешествие'], transports: ['Машина'] })).toBeNull()
      expect(routeKindOf({})).toBeNull()
      expect(routeKindOf(null)).toBeNull()
    })

    it('длина: число километров в названии либо единственный файл маршрута; ненадёжное число — не длина', () => {
      // Слова автора в названии — раньше файла (значения — из слепка индекса 12.11.2026).
      expect(routeLengthKm({ title: 'Mullerthal Trail: 112 км по Люксембургу за 6 дней', kind: 'foot', number_days: 6, routeFilesKm: [37.4, 39.3, 36.5] })).toBe(112)
      expect(routeLengthKm({ title: 'Tour du Mont Blanc - Вокруг Монблана 170км за 10 дней', kind: 'foot', number_days: 10, routeFilesKm: [174.9] })).toBe(170)
      expect(routeLengthKm({ title: 'Поход на лесное озеро Гремячее (~10км) и родник Кипячка.', kind: 'foot' })).toBe(10)
      expect(routeLengthKm({ title: 'Веломаршрут на 1 день ~30 км вдоль реки Вилия.', kind: 'bike' })).toBe(30)
      // Один файл маршрута — его длина, до десятых.
      expect(routeLengthKm({ title: 'Долина Мниковская', kind: 'foot', number_days: 1, routeFilesKm: [9.64] })).toBe(9.6)
      expect(routeLengthKm({ title: 'GR21: пешком по Алебастровому берегу Нормандии', kind: 'foot', number_days: 9, routeFilesKm: [186.3] })).toBe(186.3)
      // Несколько файлов без числа в названии — отрезки или варианты: длины нет.
      expect(routeLengthKm({ title: 'Ойцовский парк на велосипеде', kind: 'bike', number_days: 1, routeFilesKm: [46.7, 18] })).toBeUndefined()
      // Файл длиннее дневного предела — не маршрут статьи: вся трасса на 235 км у однодневного веломаршрута, трек с переездами.
      expect(routeLengthKm({ title: 'Веломаршрут вдоль Вислы: Wiślana Trasa Rowerowa', kind: 'bike', number_days: 1, routeFilesKm: [234.6] })).toBeUndefined()
      expect(routeLengthKm({ title: 'Португальский путь вдоль побережья: наш опыт', kind: 'foot', number_days: 14, routeFilesKm: [4893] })).toBeUndefined()
      // Два разных числа в названии, статья не о маршруте, файла и числа нет.
      expect(routeLengthKm({ title: 'Кольцо 8 км или 15 км на выбор', kind: 'foot' })).toBeUndefined()
      expect(routeLengthKm({ title: '78 парков - 78 печатей: 250 км по Кракову', kind: null, routeFilesKm: [250.4] })).toBeUndefined()
      expect(routeLengthKm({ title: 'Гора Турбач (1310 м): поход в Горце, Польша', kind: 'foot', routeFilesKm: [] })).toBeUndefined()
      // Высота в метрах и «км/ч» длиной не читаются.
      expect(routeLengthKm({ title: 'Спуск 2000 м со скоростью 5 км/ч', kind: 'foot' })).toBe(5)
    })

    it('запись фактов и строка карточки: «Длина: N км» после числа дней, прежние поля на месте', () => {
      expect(travelFactsOf(761, { number_days: 6, month: [5], distance_km: 112 })).toEqual({ type: 'travel', source_id: 761, number_days: 6, months: [5], distance_km: 112 })
      // Кривое значение в запись не попадает.
      for (const bad of [0, -3, Number.NaN, '12', null, undefined]) expect(travelFactsOf(1, { distance_km: bad })).toEqual({ type: 'travel', source_id: 1 })
      expect(formatKm(112)).toBe('112')
      expect(formatKm(96.6)).toBe('97')
      expect(formatKm(9.6)).toBe('9,6')
      expect(formatKm(8)).toBe('8')
      expect(formatKm(19.95)).toBe('20')
      const place = { country: 'Люксембург' }
      expect(travelFactsLine({ number_days: 6, months: [5], distance_km: 112 }, place)).toBe('Люксембург. Дней: 6. Длина: 112 км. Месяц: май')
      expect(travelFactsLine({ distance_km: 9.6 }, { country: 'Польша' })).toBe('Польша. Длина: 9,6 км')
      // Без длины строка прежняя — ни знака.
      expect(travelFactsLine({ number_days: 6, months: [5] }, place)).toBe('Люксембург. Дней: 6. Месяц: май')
    })

    it('слепок обучения строит ту же строку с длиной: travel_facts_line(facts=True)', () => {
      const dir = path.resolve(process.cwd(), 'scripts/ai-train')
      const items = [
        { countryName: 'Люксембург', number_days: 6, month: [5], distance_km: 112 },
        { countryName: 'Польша', number_days: 1, month: [], distance_km: 9.6 },
        { countryName: 'Германия', number_days: 6, month: [9, 10], distance_km: 96.6 },
        { countryName: 'Польша', number_days: 1, month: [8], distance_km: 19.95 },
        { countryName: 'Польша', number_days: 1, month: [8], distance_km: 8 },
        { countryName: 'Польша', number_days: 2, month: [7], distance_km: 0 },
        { countryName: 'Польша', number_days: 2, month: [7], distance_km: '12' },
        { countryName: 'Польша', number_days: 2, month: [7] },
      ]
      const script = [
        'import json, sys',
        `sys.path.insert(0, ${JSON.stringify(dir)})`,
        'from sets.rag_answers import travel_facts_line',
        'print(json.dumps([travel_facts_line(t, facts=True) for t in json.load(sys.stdin)], ensure_ascii=False))',
      ].join('\n')
      const run = runCli('python3', ['-I', '-c', script], { input: JSON.stringify(items) })
      expect(run.stderr).toBe('')
      const lines = items.map((item) => travelFactsLine(travelFactsOf(1, { number_days: item.number_days, month: item.month, distance_km: item.distance_km }), { country: item.countryName }))
      expect(JSON.parse(run.stdout)).toEqual(lines)
      expect(lines).toEqual([
        'Люксембург. Дней: 6. Длина: 112 км. Месяц: май',
        'Польша. Дней: 1. Длина: 9,6 км',
        'Германия. Дней: 6. Длина: 97 км. Месяцы: сентябрь, октябрь',
        'Польша. Дней: 1. Длина: 20 км. Месяц: август',
        'Польша. Дней: 1. Длина: 8 км. Месяц: август',
        'Польша. Дней: 2. Месяц: июль',
        'Польша. Дней: 2. Месяц: июль',
        'Польша. Дней: 2. Месяц: июль',
      ])
    })
  })

  // #3369, f23: карточка-ответ несёт саму превосходную степень строкой «почему подходит».
  it('строка «почему подходит» карточки-ответа: превосходная степень и её факт; без факта строки нет', () => {
    const facts: QuestFacts = { type: 'quest', source_id: 1, duration_min: 300, points: 9, difficulty: 'easy' }
    expect(superlativeReason({ field: 'duration_min', order: 'desc' }, facts)).toBe('самый длинный: 300 мин')
    expect(superlativeReason({ field: 'duration_min', order: 'asc' }, facts)).toBe('самый короткий: 300 мин')
    expect(superlativeReason({ field: 'points', order: 'asc' }, facts)).toBe('меньше всего точек: 9')
    expect(superlativeReason({ field: 'points', order: 'desc' }, facts)).toBe('больше всего точек: 9')
    expect(superlativeReason({ field: 'difficulty', order: 'asc' }, facts)).toBe('самый лёгкий')
    expect(superlativeReason({ field: 'difficulty', order: 'desc' }, { ...facts, difficulty: 'hard' })).toBe('самый сложный')
    expect(superlativeReason({ field: 'duration_min', order: 'desc' }, { type: 'quest', source_id: 2, points: 5 })).toBeNull()
    expect(superlativeReason({ field: 'difficulty', order: 'asc' }, { type: 'quest', source_id: 2, points: 5 })).toBeNull()
  })

  it('сортировка по факту: первым — ответ; квест без факта ответом не становится; равные сохраняют порядок', () => {
    const facts: Record<string, QuestFacts> = {
      a: { type: 'quest', source_id: 1, duration_min: 120, points: 9, difficulty: 'easy' },
      b: { type: 'quest', source_id: 2, duration_min: 45, points: 12, difficulty: 'medium' },
      c: { type: 'quest', source_id: 3, points: 5 },
      d: { type: 'quest', source_id: 4, duration_min: 45, points: 9, difficulty: 'easy' },
      e: { type: 'quest', source_id: 5, duration_min: 300, difficulty: 'hard' },
    }
    const ids = ['a', 'b', 'c', 'd', 'e', 'статья']
    const rank = (field: 'duration_min' | 'points' | 'difficulty', order: 'asc' | 'desc') => rankBySuperlative({ field, order }, ids, (id) => facts[id] ?? null)
    expect(rank('duration_min', 'asc')).toEqual(['b', 'd', 'a', 'e'])
    expect(rank('duration_min', 'desc')).toEqual(['e', 'a', 'b', 'd'])
    expect(rank('points', 'asc')).toEqual(['c', 'a', 'd', 'b'])
    expect(rank('points', 'desc')).toEqual(['b', 'a', 'd', 'c'])
    // Равная сложность: «самый лёгкий» — впереди более короткий, «самый сложный» — более длинный.
    expect(rank('difficulty', 'asc')).toEqual(['d', 'a', 'b', 'e'])
    expect(rank('difficulty', 'desc')).toEqual(['e', 'b', 'a', 'd'])
    expect(rankBySuperlative({ field: 'points', order: 'asc' }, ['статья'], () => null)).toEqual([])
  })
})
