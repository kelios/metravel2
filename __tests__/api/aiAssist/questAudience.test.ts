import path from 'path'

import { asksAboutChildren, childrenRank, cityNamedIn, questAudience, questAudienceLead } from '@/api/aiAssist/questAudience'
import { questToSource } from '@/api/aiAssist/retrieval'
import { enabledQuestTags } from '@/utils/questTags'

import { runCli } from '../../scripts/cli-test-utils'

jest.mock('@/api/travelListQueries', () => ({ fetchTravels: jest.fn() }))
jest.mock('@/api/travelDetailsQueries', () => ({ fetchTravel: jest.fn() }))
jest.mock('@/api/quests', () => ({ fetchQuestsCompactCatalog: jest.fn() }))
jest.mock('@/api/activeQueryClient', () => ({ getActiveQueryClient: jest.fn(() => null) }))
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({ userId: null }) } }))

// #3276: признак детского квеста и возраст в карточке ассистента. Остаток v7 mt03#1: две карточки
// квестов Несвижа одного вида, модель отвечала «возраст не указан» и выбирала наугад.

/** Теги так, как их отдаёт каталог: карта после правки в админке и список у нетронутых строк. */
const TAG_FIXTURES: [string, unknown][] = [
  ['детский 8–10, со взрослым (карта)', { kids: true, family: true, 'age-8-10': true, 'adult-required': true, citywalk: true }],
  ['детский 5–7, взрослый желателен (список)', ['kids', 'park', 'family', 'age-5-7', 'adult-recommended']],
  ['детский без возраста', ['kids']],
  ['детский, два возраста', ['kids', 'age-5-7', 'age-8-10']],
  ['семейный (список)', ['family', 'citywalk']],
  ['семейный с возрастом (карта)', { family: true, 'age-11-14': true }],
  ['выключенный тег', { kids: false, family: true }],
  ['обычный', { legend: true, history: true }],
  ['пустой список', []],
  ['нет тегов', null],
  ['список не из строк', ['kids', 5]],
  ['не теги', 'kids'],
]

const quest = (tags: unknown, extra: Record<string, unknown> = {}) => ({
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
  tags,
  ...extra,
})

describe('аудитория квеста в карточке ассистента (#3276)', () => {
  it('аудитория читается из карты и из списка тегов; возраст — общий диапазон, «со взрослым» — только adult-required', () => {
    // Экран читает теги каталога через `enabledQuestTags`, служба получает список слагов из индекса.
    const read = (tags: unknown) => questAudience(enabledQuestTags(tags))
    expect(read({ kids: true, family: true, 'age-8-10': true, 'adult-required': true })).toEqual({ kind: 'kids', age: [8, 10], adult: true })
    expect(read(['kids', 'age-5-7', 'adult-recommended'])).toEqual({ kind: 'kids', age: [5, 7], adult: false })
    expect(read(['kids', 'age-5-7', 'age-8-10'])).toEqual({ kind: 'kids', age: [5, 10], adult: false })
    expect(read(['family', 'citywalk'])).toEqual({ kind: 'family', age: null, adult: false })
    expect(read({ kids: false, family: true })).toEqual({ kind: 'family', age: null, adult: false })
    for (const tags of [{ legend: true }, [], null, undefined, ['kids', 5], 'kids', 7]) expect(read(tags)).toBeNull()
  })

  it('начало карточки: вид квеста с городом и страной, возраст, «Со взрослым»', () => {
    expect(questAudienceLead(questAudience(['kids', 'age-8-10', 'adult-required']), 'Несвиж', 'Беларусь')).toEqual([
      'Детский городской квест по городу Несвиж (Беларусь)',
      'Возраст: 8–10 лет',
      'Со взрослым',
    ])
    expect(questAudienceLead(questAudience(['family']), 'Краков', 'Польша')).toEqual(['Семейный городской квест по городу Краков (Польша)'])
    expect(questAudienceLead(questAudience([]), ' ', null)).toEqual(['Городской квест'])
  })

  it('карточка экрана несёт признак и возраст; обычный квест выглядит как раньше', () => {
    expect(questToSource(quest(TAG_FIXTURES[0][1]) as never, [], 'quest')?.snippet).toBe(
      'Детский городской квест по городу Несвиж (Беларусь). Возраст: 8–10 лет. Со взрослым. Точек: 3. Длительность: 90 мин. Сложность: лёгкий',
    )
    expect(questToSource(quest(['family']) as never, [], 'quest')?.snippet).toBe(
      'Семейный городской квест по городу Несвиж (Беларусь). Точек: 3. Длительность: 90 мин. Сложность: лёгкий',
    )
    expect(questToSource(quest({ legend: true }) as never, [], 'quest')?.snippet).toBe(
      'Городской квест по городу Несвиж (Беларусь). Точек: 3. Длительность: 90 мин. Сложность: лёгкий',
    )
  })

  it('слепок обучения строит карточку той же строкой: quest_card(audience=True) в rag_answers.py', () => {
    const quests = [
      ...TAG_FIXTURES.map(([, tags]) => quest(tags)),
      // Карточка без города, страны, длительности и сложности.
      quest(['kids', 'age-8-10'], { city_name: '', country_name: '', duration_min: null, difficulty: '' }),
    ]
    const dir = path.resolve(process.cwd(), 'scripts/ai-train')
    const script = [
      'import json, sys',
      `sys.path.insert(0, ${JSON.stringify(dir)})`,
      'from sets.rag_answers import quest_card',
      'print(json.dumps([quest_card(q, audience=True)["snippet"] for q in json.load(sys.stdin)], ensure_ascii=False))',
    ].join('\n')
    const run = runCli('python3', ['-I', '-c', script], { input: JSON.stringify(quests) })
    expect(run.stderr).toBe('')
    expect(run.status).toBe(0)
    const fromApp = quests.map((item) => questToSource(item as never, [], 'quest')?.snippet)
    expect(JSON.parse(run.stdout)).toEqual(fromApp)
    // Сверка не пустая: в списке есть и детская, и семейная, и обычная карточка.
    expect(fromApp.filter((snippet) => snippet?.startsWith('Детский городской квест'))).toHaveLength(5)
    expect(fromApp.filter((snippet) => snippet?.startsWith('Семейный городской квест'))).toHaveLength(3)
    expect(fromApp.filter((snippet) => snippet?.startsWith('Городской квест'))).toHaveLength(5)
  })

  it.each([
    ['ru', 'Куда сходить с детьми в Гродно?'],
    ['ru', 'А какой из них подойдёт детям?'],
    ['ru', 'Есть детский квест для ребёнка восьми лет?'],
    ['be', 'Што выбраць для дзіцяці ў Мінску?'],
    ['be', 'Куды пайсці з дзецьмі?'],
    ['uk', 'Що обрати, якщо йдемо з дитиною?'],
    ['uk', 'Який квест підійде дітям?'],
    ['pl', 'Który quest jest dla dzieci?'],
    ['pl', 'Idziemy z dzieckiem. Co wybrać?'],
    ['en', 'Which one suits kids?'],
    ['en', 'Is it good for a child of eight?'],
  ])('[%s] «%s» — вопрос о детях', (_lang, question) => {
    expect(asksAboutChildren(question)).toBe(true)
  })

  it.each([
    'Какие детали маршрута важны?',
    'Детективный квест в Минске есть?',
    'Что посмотреть в Несвиже?',
    'Jeden dzień w Krakowie',
    'Адзін дзень у Мінску',
    'Childhood memories of Minsk',
  ])('«%s» — не вопрос о детях', (question) => {
    expect(asksAboutChildren(question)).toBe(false)
  })

  it('город карточки узнаётся в вопросе в падеже и в другом написании, «Городок» на слово «город» не откликается', () => {
    expect(cityNamedIn('Что посмотреть в Несвиже? А какой из них подойдёт детям?', ['Несвиж'])).toBe(true)
    expect(cityNamedIn('Квесты в Лиде', ['Лида'])).toBe(true)
    expect(cityNamedIn('Что есть по Барановичам?', ['Барановичи'])).toBe(true)
    expect(cityNamedIn('Co zobaczyć w Krakowie z dziećmi?', ['Kraków', 'Краков'])).toBe(true)
    expect(cityNamedIn('Што ёсць у Мінску?', ['Мінск'])).toBe(true)
    expect(cityNamedIn('What to do in Warsaw?', ['Warsaw'])).toBe(true)
    expect(cityNamedIn('В каком городе есть квест для детей?', ['Городок'])).toBe(false)
    expect(cityNamedIn('Квесты в Минске', ['Брест', null, undefined, ''])).toBe(false)
    expect(cityNamedIn('', ['Гродно'])).toBe(false)
  })

  // Порядок найденных карточек при вопросе о детях — общая цепочка `arrangeSources` (#3289): `sourceSelection.test.ts`.
  it('место квеста при вопросе о детях: детский квест города — 2, семейный — 1, чужой город и обычный квест — 0', () => {
    expect(childrenRank('С детьми в Несвиже', ['kids'], ['Несвиж'])).toBe(2)
    expect(childrenRank('С детьми в Несвиже', ['family'], ['Несвиж'])).toBe(1)
    expect(childrenRank('С детьми в Несвиже', ['kids'], ['Брест'])).toBe(0)
    expect(childrenRank('С детьми в Несвиже', ['legend'], ['Несвиж'])).toBe(0)
  })
})
