import { QueryClient } from '@tanstack/react-query'

import { getActiveQueryClient } from '@/api/activeQueryClient'
import { fetchQuestsCompactCatalog } from '@/api/quests'
import { fetchTravel } from '@/api/travelDetailsQueries'
import { htmlToSnippet, loadSourceCard, questToSource, travelToSource } from '@/api/aiAssist/sourceCard'

jest.mock('@/api/travelDetailsQueries', () => ({ fetchTravel: jest.fn() }))
jest.mock('@/api/quests', () => ({ fetchQuestsCompactCatalog: jest.fn() }))
jest.mock('@/api/activeQueryClient', () => ({ getActiveQueryClient: jest.fn(() => null) }))
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({ userId: null }) } }))

const mockedFetchTravel = fetchTravel as jest.MockedFunction<typeof fetchTravel>
const mockedQuests = fetchQuestsCompactCatalog as jest.MockedFunction<typeof fetchQuestsCompactCatalog>
const mockedQueryClient = getActiveQueryClient as jest.MockedFunction<typeof getActiveQueryClient>

const travel = (id: number, name: string, slug: string, description = '') =>
  ({ id, name, slug, description, countryName: 'Беларусь', cityName: 'Гродно' }) as never

const quest = (id: number, quest_id: string, title: string, city_id: string, city_name: string, extra: Record<string, unknown> = {}) =>
  ({ id, quest_id, title, city_id, city_name, points: 8, duration_min: 90, difficulty: 'easy', ...extra }) as never

describe('карточка страницы-источника ассистента (#2897, #3297)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedQueryClient.mockReturnValue(null)
  })

  it('HTML описания превращается в короткий абзац', () => {
    const snippet = htmlToSnippet('<p>Два дня <b>по замкам</b>&nbsp;и озёрам.</p><script>alert(1)</script>', 40)
    expect(snippet).toBe('Два дня по замкам и озёрам.')
    expect(htmlToSnippet('слово '.repeat(100), 50).endsWith('…')).toBe(true)
  })

  it('#3315: карточка несёт место — квест: город на всех написаниях и страна, статья: только страна; факты каталога едут с карточкой', () => {
    const royal = questToSource(
      quest(1, 'grodno-royal', 'Quest po Grodnie: królewskie miasto', 'grodno', 'Гродно', { city_name_localized: 'Grodno', city_name_canonical: 'Гродно', country_name: 'Беларусь' }),
    )
    expect(royal?.place).toEqual({ cities: ['Grodno', 'Гродно', 'Гродно'], countries: ['Беларусь'] })
    expect(royal?.facts).toEqual({ type: 'quest', source_id: 1, points: 8, duration_min: 90, difficulty: 'easy' })
    expect(royal?.path).toBe('/quests/grodno/grodno-royal')
    const article = travelToSource(travel(1, 'Гродно за выходные', 'grodno-weekend', '<p>Старый город и Неман.</p>'))
    expect(article?.place).toEqual({ countries: ['Беларусь'] })
    expect(article?.facts).toEqual({ type: 'travel', source_id: 1 })
    expect(article?.snippet).toBe('Беларусь. Старый город и Неман.')
    expect(article?.snippet).not.toContain('Гродно')
  })

  it('карточка без названия или без пути не строится', () => {
    expect(travelToSource(travel(1, ' ', 'grodno-weekend'))).toBeNull()
    expect(questToSource(quest(1, 'q', '  ', 'grodno', 'Гродно'))).toBeNull()
  })

  it('статья-источник читается запросом статьи, квест — из компактного каталога по числовому id', async () => {
    mockedFetchTravel.mockResolvedValue(travel(816, 'Гродно за выходные', 'grodno-weekend') as never)
    const article = await loadSourceCard({ type: 'travel', id: 816 }, 'ru')
    expect(mockedFetchTravel).toHaveBeenCalledWith(816, undefined)
    expect(article).toMatchObject({ type: 'travel', source_id: '816', title: 'Гродно за выходные' })

    mockedQuests.mockResolvedValue([
      quest(7, 'minsk-old', 'Старый Минск', 'minsk', 'Минск'),
      quest(9, 'grodno-royal', 'Королевский Гродно', 'grodno', 'Гродно'),
    ])
    const card = await loadSourceCard({ type: 'quest', id: 9 }, 'pl')
    expect(mockedQuests).toHaveBeenCalledWith({ locale: 'pl' })
    expect(card).toMatchObject({ type: 'quest', source_id: 'grodno-royal', title: 'Королевский Гродно' })
    expect(await loadSourceCard({ type: 'quest', id: 404 }, 'pl')).toBeNull()
  })

  it('статья и каталог квестов идут через общий кэш React Query, когда клиент смонтирован', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockedQueryClient.mockReturnValue(client)
    mockedFetchTravel.mockResolvedValue(travel(816, 'Гродно за выходные', 'grodno-weekend') as never)
    mockedQuests.mockResolvedValue([quest(9, 'grodno-royal', 'Королевский Гродно', 'grodno', 'Гродно')])
    await loadSourceCard({ type: 'travel', id: 816 }, 'ru')
    await loadSourceCard({ type: 'travel', id: 816 }, 'ru')
    await loadSourceCard({ type: 'quest', id: 9 }, 'ru')
    await loadSourceCard({ type: 'quest', id: 9 }, 'ru')
    // Каталог квестов живёт в кэше экранов квестов: второй вопрос его не перезапрашивает.
    expect(mockedQuests).toHaveBeenCalledTimes(1)
    client.clear()
  })

  it('материала нет или запрос упал — карточки нет, диалог идёт без неё', async () => {
    mockedFetchTravel.mockRejectedValue(new Error('404'))
    expect(await loadSourceCard({ type: 'travel', id: 1 }, 'ru')).toBeNull()
    mockedQuests.mockRejectedValue(new Error('network'))
    expect(await loadSourceCard({ type: 'quest', id: 1 }, 'ru')).toBeNull()
  })
})
