// Round-trip офлайн-кэша сырого бандла квеста:
// пишем сырой JSON → при «офлайн» фейле fetch читаем из кэша → adaptBundle
// на клиенте даёт рабочий квест с работающим чекером ответа.
import { apiClient } from '@/api/client'
import { fetchQuestByQuestId, fetchQuestsList } from '@/api/quests'
import type { ApiQuestBundle, ApiQuestMeta } from '@/api/quests'
import {
  readCachedQuestBundle,
  writeCachedQuestBundle,
  readCachedQuestsList,
  writeCachedQuestsList,
  QUEST_BUNDLE_CACHE_PREFIX,
  QUEST_LIST_CACHE_KEY,
} from '@/api/questBundleCache'
import { adaptBundle } from '@/utils/questAdapters'

jest.mock('@/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
      this.name = 'ApiError'
    }
  },
}))

const AsyncStorage = require('@react-native-async-storage/async-storage')
const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>

const QUEST_ID = 'minsk-cmok'

const makeRawBundle = (): ApiQuestBundle => ({
  id: 777,
  quest_id: QUEST_ID,
  title: 'Тест-квест',
  cover_url: 'https://metravel.by/cover.jpg',
  steps: JSON.stringify([
    {
      id: 1,
      step_id: 'step-1',
      title: 'Первая точка',
      location: 'Площадь',
      story: 'История',
      task: 'Кто изображён на фасаде?',
      answer_pattern: { type: 'exact', value: 'дракон' },
      lat: 53.9,
      lng: 27.56,
      maps_url: 'https://maps.example/1',
      image_url: 'https://metravel.by/step-1.jpg',
      order: 1,
    },
  ]),
  finale: { text: 'Финал', video_url: null, poster_url: null },
  intro: null,
  storage_key: 'quest_minsk_cmok',
  city: { id: 1, name: 'Минск', lat: '53.9', lng: '27.56', country_code: 'BY' },
})

describe('questBundleCache offline round-trip', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    AsyncStorage.__reset?.()
  })

  it('writes and reads back the raw bundle unchanged', async () => {
    const bundle = makeRawBundle()
    await writeCachedQuestBundle(QUEST_ID, bundle, 1_700_000_000_000)

    const stored = await AsyncStorage.getItem(`${QUEST_BUNDLE_CACHE_PREFIX}${QUEST_ID}`)
    expect(stored).toContain('"version":1')

    const read = await readCachedQuestBundle(QUEST_ID)
    expect(read).toEqual(bundle)
  })

  it('returns null for a missing quest', async () => {
    expect(await readCachedQuestBundle('does-not-exist')).toBeNull()
  })

  it('falls back to cache when the network fetch fails and adaptBundle stays functional', async () => {
    // Заранее положили сырой бандл (как после прошлой онлайн-загрузки).
    await writeCachedQuestBundle(QUEST_ID, makeRawBundle())

    // Сеть недоступна — fetch падает.
    mockedGet.mockRejectedValue(new Error('offline'))

    const bundle = await fetchQuestByQuestId(QUEST_ID)
    expect(bundle.quest_id).toBe(QUEST_ID)

    // adaptBundle гоняется на клиенте и восстанавливает рабочий чекер ответа.
    const adapted = adaptBundle(bundle)
    expect(adapted.steps).toHaveLength(1)
    const checker = adapted.steps[0].answer
    expect(checker('Дракон')).toBe(true)
    expect(checker('кот')).toBe(false)
  })

  it('caches the raw bundle on a successful fetch', async () => {
    mockedGet.mockResolvedValue(makeRawBundle())

    await fetchQuestByQuestId(QUEST_ID)
    // Даём отработать fire-and-forget записи в кэш.
    await Promise.resolve()

    const cached = await readCachedQuestBundle(QUEST_ID)
    expect(cached?.quest_id).toBe(QUEST_ID)
  })

  it('rethrows when the fetch fails and there is no cache', async () => {
    mockedGet.mockRejectedValue(new Error('offline'))
    await expect(fetchQuestByQuestId('uncached-quest')).rejects.toThrow('offline')
  })
})

const makeRawMeta = (): ApiQuestMeta[] => [
  {
    id: 777,
    quest_id: QUEST_ID,
    title: 'Тест-квест',
    points: '5',
    city_id: '1',
    city_name: 'Минск',
    lat: '53.9',
    lng: '27.56',
    duration_min: 60,
    difficulty: 'easy',
    tags: null,
    pet_friendly: false,
    cover_url: 'https://metravel.by/cover.jpg',
    rating_avg: 4.5,
    rating_count: 10,
    user_rating: null,
    completions_count: 3,
    is_completed_by_me: false,
    first_completer: null,
  },
]

describe('questsList offline round-trip', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    AsyncStorage.__reset?.()
  })

  it('writes and reads back the raw list unchanged', async () => {
    const list = makeRawMeta()
    await writeCachedQuestsList(list, 1_700_000_000_000)

    const stored = await AsyncStorage.getItem(QUEST_LIST_CACHE_KEY)
    expect(stored).toContain('"version":1')

    expect(await readCachedQuestsList()).toEqual(list)
  })

  it('returns null when nothing is cached', async () => {
    expect(await readCachedQuestsList()).toBeNull()
  })

  it('caches the raw list on a successful fetch', async () => {
    mockedGet.mockResolvedValue(makeRawMeta())

    await fetchQuestsList()
    // Даём отработать fire-and-forget записи в кэш.
    await Promise.resolve()

    const cached = await readCachedQuestsList()
    expect(cached?.[0]?.quest_id).toBe(QUEST_ID)
  })

  it('falls back to the cached list when the network fetch fails', async () => {
    await writeCachedQuestsList(makeRawMeta())
    mockedGet.mockRejectedValue(new Error('offline'))

    const list = await fetchQuestsList()
    expect(list).toHaveLength(1)
    expect(list[0].quest_id).toBe(QUEST_ID)
  })

  it('rethrows when the list fetch fails and there is no cache', async () => {
    mockedGet.mockRejectedValue(new Error('offline'))
    await expect(fetchQuestsList()).rejects.toThrow('offline')
  })
})
