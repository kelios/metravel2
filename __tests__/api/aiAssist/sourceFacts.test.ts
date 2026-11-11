import path from 'path'

import { questToSource, travelToSource } from '@/api/aiAssist/retrieval'
import {
  detectSuperlative,
  factsKey,
  questFactsLine,
  questFactsOf,
  rankBySuperlative,
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

  it('строка фактов статьи: страна и город, число дней, месяцы', () => {
    const place = { city: 'Краков', country: 'Польша' }
    expect(travelFactsLine({ number_days: 3, months: [11, 12] }, place)).toBe('Польша, Краков. Дней: 3. Месяцы: ноябрь, декабрь')
    expect(travelFactsLine({ number_days: 1, months: [5] }, place)).toBe('Польша, Краков. Дней: 1. Месяц: май')
    expect(travelFactsLine({ months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }, place)).toBe('Польша, Краков. Месяцы: круглый год')
    // Без фактов — то же место, с которого начиналась карточка статьи в обучении.
    expect(travelFactsLine(null, place)).toBe('Польша, Краков')
    // Транспорт и категории в строку не идут: список статей экрана их не отдаёт.
    expect(travelFactsLine({ number_days: 2, transports: ['Машина'], categories: ['Замки'] }, { country: 'Беларусь' })).toBe('Беларусь. Дней: 2')
    expect(travelFactsLine(null)).toBe('')
  })

  it('карточка экрана строится тем же построителем: квест — строка фактов, статья — строка фактов и начало описания', () => {
    expect(questToSource(QUESTS[0] as never, [], 'quest')?.snippet).toBe(
      'Детский городской квест по городу Несвиж (Беларусь). Возраст: 8–10 лет. Со взрослым. Точек: 3. Длительность: 90 мин. Сложность: лёгкий. Можно с собакой',
    )
    expect(travelToSource(TRAVELS[0] as never, [])?.snippet).toBe(
      'Польша, Краков. Дней: 3. Месяцы: ноябрь, декабрь. Каждый год в конце ноября в польских городах открываются ярмарки.',
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
    const travelLines = TRAVELS.map((item, index) => travelFactsLine(travelFacts[index], { city: item.cityName as string, country: item.countryName as string }))
    expect(snapshot.travels).toEqual(travelLines)
    expect(snapshot.travel_cards).toEqual(TRAVELS.map((item) => travelToSource(item as never, [])?.snippet))

    // Сверка не пустая: есть карточки с новым полем и без него, со днями, месяцами и «круглый год».
    expect(questLines.filter((line) => line?.endsWith('Можно с собакой'))).toHaveLength(3)
    expect(questLines.filter((line) => line && !line.includes('собакой'))).toHaveLength(2)
    expect(travelLines).toEqual([
      'Польша, Краков. Дней: 3. Месяцы: ноябрь, декабрь',
      'Польша, Краков. Дней: 1. Месяц: май',
      'Польша, Краков',
      'Польша, Краков. Дней: 2. Месяцы: июнь, июль',
      'Польша. Дней: 3. Месяцы: круглый год',
      '',
    ])
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
