import { QueryClient } from '@tanstack/react-query'

import { getActiveQueryClient } from '@/api/activeQueryClient'
import { fetchQuestsCompactCatalog } from '@/api/quests'
import { fetchTravels } from '@/api/travelListQueries'
import {
  detectIntent,
  htmlToSnippet,
  mergeSources,
  QUEST_RESERVED_SLOTS,
  buildRetrievalQuery,
  buildTravelsSearchQuery,
  isFollowUpQuestion,
  scoreText,
  searchSiteMaterials,
  searchStem,
  tokenizeQuery,
} from '@/api/aiAssist/retrieval'
import type { AiSource } from '@/api/aiAssist/types'

jest.mock('@/api/travelListQueries', () => ({ fetchTravels: jest.fn() }))
jest.mock('@/api/quests', () => ({ fetchQuestsCompactCatalog: jest.fn() }))
jest.mock('@/api/activeQueryClient', () => ({ getActiveQueryClient: jest.fn(() => null) }))
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({ userId: null }) } }))

const mockedFetchTravels = fetchTravels as jest.MockedFunction<typeof fetchTravels>
const mockedQuests = fetchQuestsCompactCatalog as jest.MockedFunction<typeof fetchQuestsCompactCatalog>
const mockedQueryClient = getActiveQueryClient as jest.MockedFunction<typeof getActiveQueryClient>

const travel = (id: number, name: string, slug: string, description = '') =>
  ({ id, name, slug, description, countryName: 'Беларусь', cityName: 'Гродно' }) as never

const quest = (quest_id: string, title: string, city_id: string, city_name: string, extra: Record<string, unknown> = {}) =>
  ({ id: 1, quest_id, title, city_id, city_name, points: 8, duration_min: 90, difficulty: 'easy', ...extra }) as never

describe('aiAssist retrieval (#2460)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedQueryClient.mockReturnValue(null)
  })

  it('токены: от трёх знаков, без пунктуации и повторов; стем ловит окончания', () => {
    expect(tokenizeQuery('Куда поехать на выходные под Гродно? Гродно!')).toEqual(['выходные', 'гродно'])
    // Общие слова («квесты», «есть», «какие») карточку не выбирают.
    expect(tokenizeQuery('Какие квесты есть в Минске?')).toEqual(['минске'])
    expect(scoreText('Квест по Гродне и выходной', ['гродно', 'выходные', 'минск'])).toBe(2)
    expect(scoreText('что угодно', [])).toBe(0)
    // Стем сверяется с началом слова: «детьми» → «деть» не ловит «увидеть».
    expect(scoreText('Хайфа — «Восемь способов увидеть город»', ['детьми'])).toBe(0)
    // Падежная замена согласной («детьми»/«детей») грубому стему не по силам — считается только «гродно».
    expect(scoreText('Квест для детей по Гродно', ['детьми', 'гродно'])).toBe(1)
    expect(scoreText('Детский квест по Минску', ['детский', 'минске'])).toBe(2)
  })

  it('намерение вопроса: «квесты» поднимают квесты над статьями, «статья/маршрут» — наоборот', async () => {
    expect(detectIntent('Какие квесты есть в Минске?')).toBe('quest')
    expect(detectIntent('Jakie questy są w Mińsku?')).toBe('quest')
    expect(detectIntent('Есть ли статья про Нарочь?')).toBe('travel')
    expect(detectIntent('Куда поехать на выходные?')).toBeNull()
    expect(detectIntent('квест или маршрут по Гродно')).toBeNull()
    // Латинские формы — только целым словом: «question»/«kwestia» — не про квесты.
    expect(detectIntent('I have a question about Grodno')).toBeNull()
    expect(detectIntent('Mam kwestię: co zobaczyć w Grodnie?')).toBeNull()
    expect(detectIntent('Which quests are in Minsk?')).toBe('quest')

    mockedFetchTravels.mockResolvedValue({ data: [travel(1, 'Минск за выходные', 'minsk-weekend')], total: 1 } as never)
    mockedQuests.mockResolvedValue([
      quest('kvest-po-minsku', 'Квест по Минску', 'minsk', 'Минск'),
      quest('kvest-po-brestu', 'Квест по Бресту', 'brest', 'Брест'),
    ])
    const sources = await searchSiteMaterials({ query: 'Какие квесты есть в Минске?', locale: 'ru' })
    // Квест с совпадением по словам выше статьи; квест другого города на одном
    // бонусе намерения в список не попадает — совпадения есть.
    expect(sources.map((s) => s.source_id)).toEqual(['kvest-po-minsku', '1'])

    // Вопрос про квесты без топонима: бонус намерения спасает каталог целиком,
    // статьи не запрашиваются (полная фраза у бэкенда даёт ноль).
    mockedFetchTravels.mockClear()
    const catalogOnly = await searchSiteMaterials({ query: 'Какие квесты есть на сайте?', locale: 'ru' })
    expect(catalogOnly.map((s) => s.source_id)).toEqual(['kvest-po-minsku', 'kvest-po-brestu'])
    expect(mockedFetchTravels).not.toHaveBeenCalled()

    // Топоним есть, совпадений нет: спасённых квестов не больше трёх.
    mockedQuests.mockResolvedValue(['a', 'b', 'c', 'd', 'e'].map((id) => quest(`q-${id}`, `Квест ${id}`, 'minsk', 'Минск')))
    const iceland = await searchSiteMaterials({ query: 'Какие квесты есть в Исландии?', locale: 'ru' })
    expect(iceland.filter((s) => s.type === 'quest')).toHaveLength(3)
  })

  it('запрос бэкенду — основы слов без местоимений; «посмотреть» остаётся (#2709)', () => {
    const tokens = tokenizeQuery('я в кракове у меня 2 дня что мне посмотреть ?')
    expect(tokens).toEqual(['кракове', 'посмотреть'])
    // «посмотреть» поднимает путеводители при ранжировании, но в запрос бэкенду не идёт:
    // там оно сужает выдачу («несвиж посмотр»: 13 статей → 4).
    expect(buildTravelsSearchQuery('я в кракове у меня 2 дня что мне посмотреть ?', tokens)).toBe('краков')
    expect(buildTravelsSearchQuery('что посмотреть?', ['посмотреть'])).toBe('посмотреть')
    expect(scoreText('Краков: путеводитель — что посмотреть в городе', tokens)).toBe(2)
    expect(searchStem('польше')).toBe('польш')
    expect(searchStem('беларуси')).toBe('беларус')
    expect(searchStem('выходные')).toBe('выходн')
    // Короткая основа не режется, латиница не трогается.
    expect(searchStem('минск')).toBe('минск')
    expect(searchStem('озеро')).toBe('озер')
    expect(searchStem('гора')).toBe('гора')
    expect(searchStem('krakowie')).toBe('krakowie')
  })

  it('без намерения квесты города не вытесняются статьями (#2709)', async () => {
    const krakow = Array.from({ length: 8 }, (_, i) => travel(100 + i, `Краков: статья ${i}`, `krakow-${i}`))
    mockedFetchTravels.mockResolvedValue({ data: krakow, total: 8 } as never)
    mockedQuests.mockResolvedValue([
      quest('wawel', 'Квест по Кракову: Вавельский дракон', 'krakow', 'Краков'),
      quest('kazimierz', 'Квест по Казимежу: еврейский квартал Кракова', 'krakow', 'Краков'),
      quest('nowa-huta', 'Квест по Нова-Хуте: соцгород Кракова', 'krakow', 'Краков'),
      quest('podgorze', 'Квест по Подгуже', 'krakow', 'Краков'),
      quest('grodno', 'Квест по Гродно', 'grodno', 'Гродно'),
    ])
    const sources = await searchSiteMaterials({ query: 'я в кракове у меня 2 дня что мне посмотреть ?', locale: 'ru' })
    expect(sources).toHaveLength(8)
    const quests = sources.filter((s) => s.type === 'quest').map((s) => s.source_id)
    expect(quests).toEqual(['wawel', 'kazimierz', 'nowa-huta'].slice(0, QUEST_RESERVED_SLOTS))
    // Статьи с бо́льшим баллом остаются первыми.
    expect(sources[0].type).toBe('travel')

    // Квесты, совпавшие только по стране, места в резерве не получают.
    mockedFetchTravels.mockResolvedValue({ data: Array.from({ length: 8 }, (_, i) => travel(200 + i, `Замки Беларуси ${i}`, `zamki-${i}`)), total: 8 } as never)
    mockedQuests.mockResolvedValue([
      quest('mir', 'Квест по Миру: замок Ильиничей', 'mir', 'Мир', { country_name: 'Беларусь' }),
      quest('lida', 'Квест по Лиде', 'lida', 'Лида', { country_name: 'Беларусь' }),
    ])
    const castles = await searchSiteMaterials({ query: 'замки беларуси', locale: 'ru' })
    expect(castles).toHaveLength(8)
    expect(castles.filter((s) => s.type === 'quest')).toHaveLength(0)

    // С намерением «статья» места за квестами не держатся.
    const travelsOnly = await searchSiteMaterials({ query: 'статьи про Краков', locale: 'ru' })
    expect(travelsOnly.filter((s) => s.type === 'quest')).toHaveLength(0)
  })

  it('уточнение в диалоге ищется вместе с прошлым запросом, своё место — само по себе (#2719)', () => {
    const previous = 'Какие квесты есть в Гродно?'
    expect(isFollowUpQuestion('А какой из них подойдёт детям?')).toBe(true)
    expect(isFollowUpQuestion('Што там паглядзець?')).toBe(true)
    expect(isFollowUpQuestion('And which of them is for kids?')).toBe(true)
    expect(isFollowUpQuestion('Какие квесты есть в Минске?')).toBe(false)
    // Код-ревью #2719: английский артикль и «этой зимой» — не уточнения.
    expect(isFollowUpQuestion('A good castle for kids?')).toBe(false)
    expect(isFollowUpQuestion('A weekend with kids — where to go?')).toBe(false)
    expect(isFollowUpQuestion('Куда поехать этой зимой с детьми?')).toBe(false)
    expect(isFollowUpQuestion('A co w Gdańsku?')).toBe(true)
    expect(tokenizeQuery('Что посмотреть в Несвиже? А какой из них подойдёт детям?')).not.toContain('них')
    expect(buildRetrievalQuery('А какой из них подойдёт детям?', previous)).toBe('Какие квесты есть в Гродно? А какой из них подойдёт детям?')
    expect(buildRetrievalQuery('А в Бресте?', previous)).toBe('А в Бресте?')
    expect(buildRetrievalQuery('Что посмотреть в Риге?', previous)).toBe('Что посмотреть в Риге?')
    expect(buildRetrievalQuery('А какой из них подойдёт детям?', null)).toBe('А какой из них подойдёт детям?')
    // Своё место после «про/на» — тоже самостоятельный вопрос.
    expect(buildRetrievalQuery('А про Брест?', previous)).toBe('А про Брест?')
    expect(buildRetrievalQuery('А на Нарочи что есть?', previous)).toBe('А на Нарочи что есть?')
    // Английское «I …» и оборот «is there / there are» — не уточнение; польское «A co…» и «there» как «там» — уточнение.
    expect(isFollowUpQuestion('I want to see castles with kids')).toBe(false)
    expect(isFollowUpQuestion("I'm looking for a quest")).toBe(false)
    expect(isFollowUpQuestion('Is there a quest for kids?')).toBe(false)
    expect(isFollowUpQuestion('There are castles nearby?')).toBe(false)
    expect(isFollowUpQuestion('Are there cafes there?')).toBe(true)
    expect(isFollowUpQuestion('A co z dziećmi?')).toBe(true)
    expect(isFollowUpQuestion('I gdzie zaparkować?')).toBe(true)
  })

  it('HTML описания превращается в короткий абзац', () => {
    const snippet = htmlToSnippet('<p>Два дня <b>по замкам</b>&nbsp;и озёрам.</p><script>alert(1)</script>', 40)
    expect(snippet).toBe('Два дня по замкам и озёрам.')
    expect(htmlToSnippet('слово '.repeat(100), 50).endsWith('…')).toBe(true)
  })

  it('статьи из поиска бэкенда и квесты каталога сливаются по баллу, статьи первыми при равенстве', async () => {
    mockedFetchTravels.mockResolvedValue({ data: [travel(1, 'Выходные под Гродно', 'vyhodnye-pod-grodno', '<p>Замки</p>'), travel(2, 'Нарочь летом', 'naroch')], total: 2 } as never)
    mockedQuests.mockResolvedValue([
      quest('kvest-po-grodno', 'Квест по Гродно', 'grodno', 'Гродно', { city_alias: 'grodno' }),
      quest('kvest-po-minsku', 'Квест по Минску', 'minsk', 'Минск'),
    ])

    const sources = await searchSiteMaterials({ query: 'Куда поехать на выходные под Гродно', locale: 'ru' })

    // Страницы fetchTravels нумеруются с нуля: 0 → `page=1` в запросе.
    // …и запрос к бэкенду идёт основами значимых слов, а не полной фразой.
    expect(mockedFetchTravels).toHaveBeenCalledWith(0, 16, 'выходн гродн', {}, undefined)
    expect(sources.map((s) => s.source_id)).toEqual(['1', '2', 'kvest-po-grodno'])
    expect(sources[0]).toMatchObject({ type: 'travel', path: '/travels/vyhodnye-pod-grodno', url: expect.stringContaining('/travels/vyhodnye-pod-grodno') })
    expect(sources[0].snippet).toContain('Замки')
    expect(sources[2]).toMatchObject({ type: 'quest', path: '/quests/grodno/kvest-po-grodno' })
    expect(sources[2].snippet).toContain('Городской квест по городу Гродно')
    // Квест без совпадений по словам не попадает в карточки.
    expect(sources.find((s) => s.source_id === 'kvest-po-minsku')).toBeUndefined()
  })

  it('сбой одного источника не роняет подбор; каталог квестов идёт через общий кэш React Query', async () => {
    mockedFetchTravels.mockRejectedValue(new Error('500'))
    mockedQuests.mockResolvedValue([quest('kvest-po-minsku', 'Квест по Минску', 'minsk', 'Минск')])
    const client = new QueryClient()
    mockedQueryClient.mockReturnValue(client)

    const first = await searchSiteMaterials({ query: 'квесты в Минске', locale: 'ru' })
    const second = await searchSiteMaterials({ query: 'что есть в Минске', locale: 'ru' })

    expect(first.map((s) => s.source_id)).toEqual(['kvest-po-minsku'])
    expect(second).toHaveLength(1)
    expect(mockedQuests).toHaveBeenCalledTimes(1)
    expect(client.getQueryData(['quests', 'compact-catalog', null, 'ru'])).toHaveLength(1)
    client.clear()
  })

  it('пустой подбор при отсутствии совпадений и карточек без пути', async () => {
    mockedFetchTravels.mockResolvedValue({ data: [{ id: 0, name: 'без слага' }], total: 1 } as never)
    mockedQuests.mockResolvedValue([quest('x', 'Квест', '', 'Город')])
    expect(await searchSiteMaterials({ query: 'Исландия зимой', locale: 'ru' })).toEqual([])
  })

  it('mergeSources убирает дубли URL и режет по лимиту', () => {
    const make = (id: string, score: number, type: AiSource['type'] = 'travel'): AiSource => ({
      type,
      source_id: id,
      title: id,
      url: `https://metravel.by/${type}/${id}`,
      path: `/${type}/${id}`,
      snippet: '',
      score,
    })
    const merged = mergeSources([make('a', 1), make('a', 3), make('b', 2, 'quest'), make('c', 2)], 2)
    expect(merged.map((s) => s.source_id)).toEqual(['a', 'c'])
  })
})
