import { QueryClient } from '@tanstack/react-query'

import { getActiveQueryClient } from '@/api/activeQueryClient'
import { fetchQuestsCompactCatalog } from '@/api/quests'
import { fetchTravels } from '@/api/travelListQueries'
import {
  htmlToSnippet,
  mergeSources,
  scoreText,
  searchSiteMaterials,
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
    expect(tokenizeQuery('Куда поехать на выходные под Гродно? Гродно!')).toEqual(['куда', 'поехать', 'выходные', 'под', 'гродно'])
    expect(scoreText('Квест по Гродне и выходной', ['гродно', 'выходные', 'минск'])).toBe(2)
    expect(scoreText('что угодно', [])).toBe(0)
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

    expect(mockedFetchTravels).toHaveBeenCalledWith(1, 8, 'Куда поехать на выходные под Гродно', {}, undefined)
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
