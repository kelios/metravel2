/**
 * #3292: блоки «Похожие» без службы — соседи из статического слепка
 * `/assets/data/ai-similar.json` (`EXPO_PUBLIC_AI_SIMILAR_SOURCE=static`).
 */
import { fetchAiSimilar, resetAiSimilarArtifactCacheForTests } from '@/api/aiPicks'
import { getAiSimilarSource, getAiSimilarStaticUrl, isAiSimilarEnabled } from '@/utils/aiPicksConfig'
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'

jest.mock('@/utils/fetchWithTimeout', () => ({ fetchWithTimeout: jest.fn() }))

const mockedFetch = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>
const jsonResponse = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as unknown as Response

const card = (id: number, title: string) => ({
  title,
  url: `https://metravel.by/travels/slug-${id}`,
  city: 'Kraków',
  country: 'Польша',
  cover: `https://metravel.by/travel-image/${id}.webp`,
})

const ARTIFACT = {
  version: 1,
  index_built_at: '2026-11-11T10:00:00.000Z',
  sources: { travel: 4, quest: 1 },
  limit: 6,
  cards: { '568': card(568, 'Краков: путеводитель'), '636': card(636, 'Вокруг Кракова'), '297': card(297, 'Рядом с Краковом'), '999': { title: 'без адреса' } },
  travel: { '816': [568, 636, 999, 297], '568': [636] },
  quest: { '13': [297, 568] },
}

const saved = { picks: process.env.EXPO_PUBLIC_AI_PICKS, source: process.env.EXPO_PUBLIC_AI_SIMILAR_SOURCE }

beforeEach(() => {
  mockedFetch.mockReset()
  resetAiSimilarArtifactCacheForTests()
  process.env.EXPO_PUBLIC_AI_PICKS = ''
  process.env.EXPO_PUBLIC_AI_SIMILAR_SOURCE = 'static'
})

afterAll(() => {
  process.env.EXPO_PUBLIC_AI_PICKS = saved.picks
  process.env.EXPO_PUBLIC_AI_SIMILAR_SOURCE = saved.source
})

describe('источник блоков «Похожие» (#3292)', () => {
  it('static включает блоки без флага подбора; без обоих — блоков нет; подбор без static — служба', () => {
    expect(getAiSimilarSource()).toBe('static')
    expect(isAiSimilarEnabled()).toBe(true)

    process.env.EXPO_PUBLIC_AI_SIMILAR_SOURCE = ''
    expect(getAiSimilarSource()).toBeNull()
    expect(isAiSimilarEnabled()).toBe(false)

    process.env.EXPO_PUBLIC_AI_PICKS = '1'
    expect(getAiSimilarSource()).toBe('service')
    process.env.EXPO_PUBLIC_AI_SIMILAR_SOURCE = 'service'
    expect(getAiSimilarSource()).toBe('service')

    // Явное static сильнее флага подбора; опечатка в значении static не включает.
    process.env.EXPO_PUBLIC_AI_SIMILAR_SOURCE = ' Static '
    expect(getAiSimilarSource()).toBe('static')
    process.env.EXPO_PUBLIC_AI_PICKS = ''
    process.env.EXPO_PUBLIC_AI_SIMILAR_SOURCE = 'statik'
    expect(getAiSimilarSource()).toBeNull()
  })

  it('адрес слепка не зависит от адреса службы подбора', () => {
    const savedUrl = process.env.EXPO_PUBLIC_AI_PICKS_URL
    process.env.EXPO_PUBLIC_AI_PICKS_URL = 'https://assist.example'
    try {
      expect(getAiSimilarStaticUrl()).toMatch(/\/assets\/data\/ai-similar\.json$/)
      expect(getAiSimilarStaticUrl()).not.toContain('assist.example')
    } finally {
      process.env.EXPO_PUBLIC_AI_PICKS_URL = savedUrl
    }
  })
})

describe('fetchAiSimilar из слепка (#3292)', () => {
  it('соседи статьи в порядке слепка, карточка без адреса отброшена, лимит соблюдён', async () => {
    mockedFetch.mockResolvedValue(jsonResponse(200, ARTIFACT))
    const items = await fetchAiSimilar({ type: 'travel', id: 816, locale: 'ru', limit: 2, resultType: 'travel' })
    expect(items.map((item) => item.source_id)).toEqual([568, 636])
    expect(items[0]).toEqual({
      type: 'travel',
      source_id: 568,
      title: 'Краков: путеводитель',
      url: 'https://metravel.by/travels/slug-568',
      path: '/travels/slug-568',
      snippet: '',
      score: null,
      city: 'Kraków',
      country: 'Польша',
      lat: null,
      lng: null,
      cover: 'https://metravel.by/travel-image/568.webp',
    })
    // Карточка 999 без адреса не занимает место: при лимите 3 третьей идёт 297.
    const three = await fetchAiSimilar({ type: 'travel', id: 816, locale: 'ru', limit: 3, resultType: 'travel' })
    expect(three.map((item) => item.source_id)).toEqual([568, 636, 297])
  })

  it('один запрос слепка на все страницы, к службе /ai/ запросов нет', async () => {
    mockedFetch.mockResolvedValue(jsonResponse(200, ARTIFACT))
    const signal = new AbortController().signal
    const [travel, quest] = await Promise.all([
      fetchAiSimilar({ type: 'travel', id: 568, locale: 'pl', limit: 6, resultType: 'travel', signal }),
      fetchAiSimilar({ type: 'quest', id: 13, locale: 'en', limit: 3, resultType: 'travel' }),
    ])
    expect(travel.map((item) => item.source_id)).toEqual([636])
    expect(quest.map((item) => item.source_id)).toEqual([297, 568])
    expect(mockedFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockedFetch.mock.calls[0]
    expect(String(url)).toMatch(/\/assets\/data\/ai-similar\.json$/)
    expect(String(url)).not.toContain('/ai/')
    // Уход со страницы не должен ронять общую загрузку слепка.
    expect(init?.signal).toBeUndefined()
  })

  it('источника нет в слепке или просят квесты-соседи — пустой список', async () => {
    mockedFetch.mockResolvedValue(jsonResponse(200, ARTIFACT))
    expect(await fetchAiSimilar({ type: 'travel', id: 4242, locale: 'ru', limit: 6, resultType: 'travel' })).toEqual([])
    expect(await fetchAiSimilar({ type: 'quest', id: 816, locale: 'ru', limit: 6, resultType: 'travel' })).toEqual([])
    expect(mockedFetch).toHaveBeenCalledTimes(1)
    mockedFetch.mockClear()
    expect(await fetchAiSimilar({ type: 'travel', id: 816, locale: 'ru', limit: 6, resultType: 'quest' })).toEqual([])
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it('отказ и чужая форма файла — ошибка без кэша: следующий блок читает слепок заново', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(404, {}))
    await expect(fetchAiSimilar({ type: 'travel', id: 816, locale: 'ru', limit: 6 })).rejects.toMatchObject({ status: 404 })
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { version: 2, cards: {} }))
    await expect(fetchAiSimilar({ type: 'travel', id: 816, locale: 'ru', limit: 6 })).rejects.toMatchObject({ status: 502 })
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, ARTIFACT))
    expect(await fetchAiSimilar({ type: 'travel', id: 568, locale: 'ru', limit: 6 })).toHaveLength(1)
    expect(mockedFetch).toHaveBeenCalledTimes(3)
  })

  it('без static запрос идёт к службе, как раньше', async () => {
    process.env.EXPO_PUBLIC_AI_SIMILAR_SOURCE = ''
    process.env.EXPO_PUBLIC_AI_PICKS = '1'
    mockedFetch.mockResolvedValue(jsonResponse(200, { items: [{ type: 'travel', source_id: 568, title: 'Краков', url: 'https://metravel.by/travels/k' }] }))
    const items = await fetchAiSimilar({ type: 'travel', id: 816, locale: 'be', limit: 6, resultType: 'travel' })
    expect(items).toHaveLength(1)
    expect(String(mockedFetch.mock.calls[0][0])).toMatch(/\/ai\/similar\?type=travel&id=816&limit=6&locale=be&result_type=travel$/)
  })
})
