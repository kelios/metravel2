import { QueryClient } from '@tanstack/react-query'

import { getActiveQueryClient } from '@/api/activeQueryClient'
import { fetchQuestsCompactCatalog } from '@/api/quests'
import { fetchTravels } from '@/api/travelListQueries'
import {
  detectIntent,
  htmlToSnippet,
  mergeSources,
  QUEST_RESERVED_SLOTS,
  buildTravelsSearchQuery,
  scoreText,
  searchSiteMaterials,
  searchStem,
  tokenizeQuery,
} from '@/api/aiAssist/retrieval'
import { selectPromptSources } from '@/api/aiAssist/prompt'
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

  it('местоимения уточнения не попадают в токены подбора (#2719; опора уточнений — retrievalQuery.test.ts)', () => {
    expect(tokenizeQuery('Что посмотреть в Несвиже? А какой из них подойдёт детям?')).not.toContain('них')
  })

  it('число вариантов в вопросе карточку не выбирает: «двух» не поднимает «…на двух реках»', async () => {
    expect(tokenizeQuery('По Дрездену нужно не больше двух вариантов. Что посоветуешь?')).toEqual(['дрездену', 'посоветуешь'])
    expect(tokenizeQuery('Назови не больше трёх квестов')).toEqual([])
    mockedFetchTravels.mockResolvedValue({ data: [], total: 0 } as never)
    mockedQuests.mockResolvedValue([
      quest('dresden-elbe', 'Дрезден: набережная Эльбы', 'dresden', 'Дрезден'),
      quest('lublin-two-rivers', 'Люблин: город на двух реках', 'lublin', 'Люблин'),
    ])
    const sources = await searchSiteMaterials({ query: 'По Дрездену нужно не больше двух вариантов. Что посоветуешь?', locale: 'ru' })
    expect(sources.map((s) => s.source_id)).toEqual(['dresden-elbe'])
  })

  it('#3315: служебные слова BE/UK/PL/EN токенами не становятся — «trzy», «questy», «які» карточку не выбирают', () => {
    expect(tokenizeQuery('Podaj najwyżej trzy questy w Grodnie, każdy z odnośnikiem.')).toEqual(['grodnie'])
    expect(tokenizeQuery('Збираємося до Пінська на вихідні. Які квести там є?')).toEqual(['збираємося', 'пінська', 'вихідні'])
    expect(tokenizeQuery('Якія квэсты ёсць у Гродне?')).toEqual(['гродне'])
    expect(tokenizeQuery('Which quests are there in Tallinn?')).toEqual(['tallinn'])
    // Возраст ребёнка карточку не выбирает: «old» иначе поднимает все квесты «…Old Town».
    expect(tokenizeQuery('Would any of that work for a nine-year-old?')).toEqual(['work', 'nine'])
    expect(tokenizeQuery('А ребёнку девяти лет что подойдёт?')).toEqual(['ребенку', 'девяти', 'подойдет'])
    expect(tokenizeQuery('Какие квесты есть в Гродно? Дай ссылку на каждый.')).toEqual(['гродно'])
  })

  it('#3315: карточка несёт место — квест: город на всех написаниях и страна, статья: только страна; подсказка получает карточки города', async () => {
    mockedFetchTravels.mockResolvedValue({ data: [travel(1, 'Гродно за выходные', 'grodno-weekend')], total: 1 } as never)
    mockedQuests.mockResolvedValue([
      quest('grodno-royal', 'Quest po Grodnie: królewskie miasto', 'grodno', 'Гродно', { city_name_localized: 'Grodno', city_name_canonical: 'Гродно', country_name: 'Беларусь' }),
      quest('kv', 'Quest po Karlowych Warach: trzynaste źródło w Grodnie nie bije', 'karlovy-vary', 'Карловы Вары', { city_name_localized: 'Karlowe Wary', country_name: 'Чехия' }),
    ])
    const query = 'Podaj najwyżej trzy questy w Grodnie, każdy z odnośnikiem.'
    const sources = await searchSiteMaterials({ query, locale: 'pl' })
    const royal = sources.find((s) => s.source_id === 'grodno-royal')
    expect(royal?.place).toEqual({ cities: ['Grodno', 'Гродно', 'Гродно'], countries: ['Беларусь'] })
    expect(sources.find((s) => s.type === 'travel')?.place).toEqual({ countries: ['Беларусь'] })
    // #3289: запись фактов каталога едет с карточкой — по ней общая цепочка проверяет условия вопроса.
    expect(royal?.facts).toEqual({ type: 'quest', source_id: 1, points: 8, duration_min: 90, difficulty: 'easy' })
    expect(sources.find((s) => s.type === 'travel')?.facts).toEqual({ type: 'travel', source_id: 1 })
    // Квест Карловых Вар найден по слову названия и остаётся в списке источников, но не в подсказке.
    expect(sources.map((s) => s.source_id)).toContain('kv')
    // Статья о городе названа другим написанием («Гродно») — она тоже карточка места.
    expect(selectPromptSources(sources, 8, query).map((s) => s.source_id).sort()).toEqual(['1', 'grodno-royal'])
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

  // #3276: при вопросе о детях детский квест города должен попасть в подсказку модели (первые карточки
  // подбора), а не остаться за статьями и другими квестами города.
  describe('вопрос о детях поднимает детские и семейные квесты города (#3276)', () => {
    const nesvizh = (locale: string, city: string) => [
      // Девять квестов города: без подъёма детский и семейный остались бы за пределом карточек.
      ...Array.from({ length: 7 }, (_, i) => quest(`nesvizh-${i}`, `Несвиж: прогулка ${i}`, 'nesvizh', 'Несвиж', { city_name_localized: city })),
      quest('nesvizh-family', 'Старый парк и ратуша', 'nesvizh', 'Несвиж', { city_name_localized: city, tags: ['family', 'citywalk'] }),
      // Слова «детский» в названии нет — как у 17 из 26 детских квестов каталога.
      quest('nesvizh-kids-park-page', 'Паж Стась и тайна парка', 'nesvizh', 'Несвиж', {
        city_name_localized: city,
        tags: { kids: true, family: true, 'age-8-10': true, 'adult-required': true },
      }),
      quest('brest-kids-fonari', 'Фонари Бреста', 'brest', 'Брест', { tags: ['kids', 'age-8-10'] }),
    ]
    const travels = Array.from({ length: 8 }, (_, i) => travel(300 + i, `Несвиж с детьми: что посмотреть ${i}`, `nesvizh-${i}`, '<p>Несвиж, замок, дети</p>'))

    it.each([
      ['ru', 'Несвиж', 'Что посмотреть в Несвиже? А какой из них подойдёт детям?'],
      ['be', 'Нясвіж', 'Што паглядзець у Нясвіжы з дзецьмі?'],
      ['uk', 'Несвіж', 'Що подивитися в Несвіжі з дитиною?'],
      ['pl', 'Nieśwież', 'Co zobaczyć w Nieświeżu z dziećmi?'],
      ['en', 'Nesvizh', 'What to see in Nesvizh with kids?'],
    ])('[%s] детский квест города — первая карточка, семейный — вторая', async (locale, city, query) => {
      mockedFetchTravels.mockResolvedValue({ data: travels, total: travels.length } as never)
      mockedQuests.mockResolvedValue(nesvizh(locale, city))
      const sources = await searchSiteMaterials({ query, locale })
      expect(sources.slice(0, 2).map((s) => s.source_id)).toEqual(['nesvizh-kids-park-page', 'nesvizh-family'])
      expect(sources[0].snippet).toBe(`Детский городской квест по городу ${city}. Возраст: 8–10 лет. Со взрослым. Точек: 8. Длительность: 90 мин. Сложность: лёгкий`)
      expect(sources[1].snippet).toContain(`Семейный городской квест по городу ${city}`)
      // Детский квест другого города наверх не идёт.
      expect(sources.slice(0, 4).map((s) => s.source_id)).not.toContain('brest-kids-fonari')
      expect(sources).toHaveLength(8)
    })

    it('без вопроса о детях и при просьбе о статье порядок прежний', async () => {
      mockedFetchTravels.mockResolvedValue({ data: travels, total: travels.length } as never)
      mockedQuests.mockResolvedValue(nesvizh('ru', 'Несвиж'))
      const plain = await searchSiteMaterials({ query: 'Что посмотреть в Несвиже?', locale: 'ru' })
      expect(plain[0].type).toBe('travel')
      expect(plain.map((s) => s.source_id)).not.toContain('nesvizh-kids-park-page')
      const article = await searchSiteMaterials({ query: 'Есть статья про Несвиж с детьми?', locale: 'ru' })
      expect(article.every((s) => s.type === 'travel')).toBe(true)
    })
  })

  describe('хвосты подбора (#3277): короткое название в винительном падеже и маршрут «из X в Y»', () => {
    it('«в Лиду», «в Ригу», «в Прагу», «do Rygi» находят город в другом падеже; длинное слово той же основы — нет', () => {
      expect(scoreText('Квест по Лиде: гости замка Гедимина Лида', ['лиду'])).toBe(1)
      expect(scoreText('Латвия. Рига и Юрмала в октябре', ['ригу'])).toBe(1)
      expect(scoreText('Квест по Праге: Вышеград', ['прагу'])).toBe(1)
      expect(scoreText('Quest po Rydze Ryga', ['rygi'])).toBe(1)
      expect(scoreText('Квест по Миру: Мирский замок Мир', ['мире'])).toBe(1)
      // Слово карточки длиннее слова вопроса — другое слово: «лидер», «Лидский район», «Мирный».
      expect(scoreText('Лидер проката и Лидский район', ['лиду'])).toBe(0)
      expect(scoreText('Город Мирный', ['мире'])).toBe(0)
      // Бэкенд ищет подстрокой: трёхбуквенная основа слишком коротка, слово возвращается в именительный падеж.
      expect(searchStem('лиду')).toBe('лида')
      expect(searchStem('ригу')).toBe('рига')
      expect(searchStem('прагу')).toBe('праг')
      expect(buildTravelsSearchQuery('Что посмотреть, если поеду в Лиду?', tokenizeQuery('Что посмотреть, если поеду в Лиду?'))).toBe('поед лида')
    })

    it('«Что посмотреть, если поеду в Лиду?» даёт квесты Лиды, а не пустой подбор', async () => {
      mockedFetchTravels.mockResolvedValue({ data: [], total: 0 } as never)
      mockedQuests.mockResolvedValue([
        quest('lida-castle', 'Квест по Лиде: гости замка Гедимина', '21', 'Лида'),
        quest('minsk-cmok', 'Квест по центру Минска', '4', 'Минск'),
      ])
      const sources = await searchSiteMaterials({ query: 'Что посмотреть, если поеду в Лиду?', locale: 'ru' })
      expect(sources.map((s) => s.source_id)).toEqual(['lida-castle'])
    })

    it('«Квест из Минска в Заславль»: город отправления квест не выбирает — восемь квестов Минска не вытесняют Заславль', async () => {
      mockedFetchTravels.mockResolvedValue({ data: [], total: 0 } as never)
      const minsk = Array.from({ length: 9 }, (_, index) => quest(`minsk-${index}`, `Квест по Минску №${index}`, '4', 'Минск'))
      mockedQuests.mockResolvedValue([...minsk, quest('zaslavl-rogneda', 'Квест по Заславлю: Рогнеда и Изяслав', '81', 'Заславль')])
      for (const query of ['Квест из Минска в Заславль', 'Есть квест, если ехать из Минска в Заславль?', 'Quest from Minsk to Заславль']) {
        const sources = await searchSiteMaterials({ query, locale: 'ru' })
        expect({ query, ids: sources.map((s) => s.source_id) }).toEqual({ query, ids: ['zaslavl-rogneda'] })
      }
      // Названо одно место — откуда едут: это и есть место вопроса.
      const fromMinsk = await searchSiteMaterials({ query: 'Квесты: куда поехать из Минска?', locale: 'ru' })
      expect(fromMinsk).toHaveLength(8)
      expect(fromMinsk.every((s) => s.source_id.startsWith('minsk-'))).toBe(true)
      // «з дзецьмі» — не место отправления: слово после «з» не называет место каталога, подбор прежний.
      const withKids = await searchSiteMaterials({ query: 'Квэсты ў Заслаўі з дзецьмі', locale: 'be' })
      expect(withKids.map((s) => s.source_id)).toEqual(['zaslavl-rogneda'])
    })
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
