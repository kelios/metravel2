// Round-trip офлайн-кэша сырого бандла квеста:
// пишем сырой JSON → при «офлайн» фейле fetch читаем из кэша → adaptBundle
// на клиенте даёт рабочий квест с работающим чекером ответа.
const mockOfflinePackages = new Map<string, unknown>()

jest.mock('@/services/offline/packageStore', () => ({
  __esModule: true,
  default: {
    read: jest.fn(async (key: string) => mockOfflinePackages.get(key) ?? null),
    write: jest.fn(async (key: string, payload: unknown) => {
      mockOfflinePackages.set(key, payload)
      return { bytes: JSON.stringify(payload).length, includesAssetBytes: true }
    }),
    remove: jest.fn(async (key: string) => {
      mockOfflinePackages.delete(key)
    }),
  },
}))

import { apiClient } from '@/api/client'
import { fetchQuestByQuestId, fetchQuestsCompactCatalog, fetchQuestsList } from '@/api/quests'
import type { ApiQuestBundle, ApiQuestMeta } from '@/api/quests'
import {
  readCachedQuestBundle,
  writeCachedQuestBundle,
  readCachedQuestsList,
  writeCachedQuestsList,
  QUEST_BUNDLE_CACHE_PREFIX,
  LEGACY_QUEST_LIST_CACHE_KEY,
  questListCacheKey,
} from '@/api/questBundleCache'
import { adaptBundle, adaptMeta } from '@/utils/questAdapters'
import { filterQuestsCompletedByOthers } from '@/utils/questCatalogSelection'

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
    mockOfflinePackages.clear()
  })

  it('writes and reads back the raw bundle unchanged', async () => {
    const bundle = makeRawBundle()
    await writeCachedQuestBundle(QUEST_ID, bundle, 1_700_000_000_000)

    const stored = await AsyncStorage.getItem(`${QUEST_BUNDLE_CACHE_PREFIX}${QUEST_ID}`)
    expect(stored).toBeNull()
    expect(mockOfflinePackages.has(`quest:${QUEST_ID}`)).toBe(true)

    const read = await readCachedQuestBundle(QUEST_ID)
    expect(read).toEqual(bundle)
  })

  it('migrates a legacy bundle once and removes its old writable key', async () => {
    const bundle = makeRawBundle()
    await AsyncStorage.setItem(`${QUEST_BUNDLE_CACHE_PREFIX}${QUEST_ID}`, JSON.stringify({
      version: 1,
      savedAt: 1_700_000_000_000,
      bundle,
    }))

    await expect(readCachedQuestBundle(QUEST_ID)).resolves.toEqual(bundle)
    await expect(AsyncStorage.getItem(`${QUEST_BUNDLE_CACHE_PREFIX}${QUEST_ID}`)).resolves.toBeNull()
    await expect(readCachedQuestBundle(QUEST_ID)).resolves.toEqual(bundle)
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

  it('does not cache the bundle when the reader opts out of the offline commit', async () => {
    mockedGet.mockResolvedValue(makeRawBundle())

    // Городская посадочная читает бандлы квестов, которых посетитель не
    // открывал (#1569): такой квест не должен занимать слот «недавних».
    await fetchQuestByQuestId(QUEST_ID, { persistOffline: false })
    await Promise.resolve()

    expect(await readCachedQuestBundle(QUEST_ID)).toBeNull()
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
    mockOfflinePackages.clear()
  })

  it('preserves public metadata and marks the shared snapshot personal status unavailable', async () => {
    const list = makeRawMeta()
    await writeCachedQuestsList(list, 'ru', 1_700_000_000_000)

    const stored = await AsyncStorage.getItem(questListCacheKey('ru'))
    expect(stored).toContain('"version":2')

    expect(await readCachedQuestsList('ru')).toEqual(list.map((quest) => ({
      ...quest,
      personal_status_unavailable: true,
    })))
  })

  it('returns null when nothing is cached', async () => {
    expect(await readCachedQuestsList('ru')).toBeNull()
  })

  it('caches the raw list on a successful fetch', async () => {
    mockedGet.mockResolvedValue(makeRawMeta())

    await fetchQuestsList()
    // Даём отработать fire-and-forget записи в кэш.
    await Promise.resolve()

    const cached = await readCachedQuestsList('ru')
    expect(cached?.[0]?.quest_id).toBe(QUEST_ID)
  })

  it('falls back to the cached list when the network fetch fails', async () => {
    await writeCachedQuestsList(makeRawMeta(), 'ru')
    mockedGet.mockRejectedValue(new Error('offline'))

    const list = await fetchQuestsList()
    expect(list).toHaveLength(1)
    expect(list[0].quest_id).toBe(QUEST_ID)
  })

  it('rethrows when the list fetch fails and there is no cache', async () => {
    mockedGet.mockRejectedValue(new Error('offline'))
    await expect(fetchQuestsList()).rejects.toThrow('offline')
  })

  it('does not attribute sanitized own completions to others and restores filtering after a fresh response', async () => {
    const mineOnly = { ...makeRawMeta()[0], is_completed_by_me: true, completions_count: 1 }
    await writeCachedQuestsList([mineOnly], 'ru')
    mockedGet.mockRejectedValue(new Error('offline'))

    const offline = (await fetchQuestsList()).map(adaptMeta)
    expect(offline[0]).toMatchObject({ isCompletedByMe: false, completionsCount: 1, personalStatusUnavailable: true })
    expect(filterQuestsCompletedByOthers(offline)).toEqual([])

    // A fresh successful response replaces the shared snapshot, including its marker.
    mockedGet.mockResolvedValue([{ ...mineOnly, is_completed_by_me: false }])
    const online = (await fetchQuestsList()).map(adaptMeta)
    expect(online[0].personalStatusUnavailable).toBe(false)
    expect(filterQuestsCompletedByOthers(online).map((quest) => quest.id)).toEqual([QUEST_ID])
  })
})

// #1793: ключ каталога один на устройство, поэтому персональные поля не должны
// ни попадать в него, ни выходить из него — иначе после выхода или смены
// аккаунта следующий пользователь видит чужие «Пройден» и чужую оценку.
describe('questsList cache keeps personal fields out of device-shared storage', () => {
  const makeCompletedMeta = (): ApiQuestMeta[] =>
    makeRawMeta().map((meta) => ({ ...meta, is_completed_by_me: true, user_rating: 5 as const }))

  const writeLegacyEnvelope = async (list: ApiQuestMeta[]) => {
    await AsyncStorage.setItem(
      LEGACY_QUEST_LIST_CACHE_KEY,
      JSON.stringify({ version: 1, savedAt: 1_700_000_000_000, list }),
    )
  }

  beforeEach(() => {
    jest.clearAllMocks()
    AsyncStorage.__reset?.()
    mockOfflinePackages.clear()
  })

  it('does not persist the personal flag or rating', async () => {
    await writeCachedQuestsList(makeCompletedMeta(), 'ru')

    const stored = JSON.parse((await AsyncStorage.getItem(questListCacheKey('ru'))) as string)
    expect(stored.list[0].is_completed_by_me).toBe(false)
    expect(stored.list[0].user_rating).toBeNull()
    // Общие поля остаются: офлайн-карточка по-прежнему знает рейтинг и счётчик.
    expect(stored.list[0].rating_avg).toBe(4.5)
    expect(stored.list[0].completions_count).toBe(3)
  })

  it('drops the personal flag from a cache written by an older client', async () => {
    await writeLegacyEnvelope(makeCompletedMeta())

    const cached = await readCachedQuestsList('ru')
    expect(cached?.[0]?.is_completed_by_me).toBe(false)
    expect(cached?.[0]?.user_rating).toBeNull()
    expect(cached?.[0]?.personal_status_unavailable).toBe(true)
  })

  it('does not show the previous account completions in the offline catalog', async () => {
    await writeLegacyEnvelope(makeCompletedMeta())
    mockedGet.mockRejectedValue(new Error('offline'))

    const list = await fetchQuestsList()
    expect(list[0].is_completed_by_me).toBe(false)
  })

  it('does not show them in the offline compact catalog either', async () => {
    await writeLegacyEnvelope(makeCompletedMeta())
    mockedGet.mockRejectedValue(new Error('offline'))

    const list = await fetchQuestsCompactCatalog()
    expect(list[0].is_completed_by_me).toBe(false)
  })
})

// #2197: каталог хранится по локали контента, сохранённый квест — одной записью
// с `content_locale` в снимке. Без сети лучше пройти квест на другом языке, чем
// потерять его.
describe('offline copies by content locale', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    AsyncStorage.__reset?.()
    mockOfflinePackages.clear()
  })

  const metaOn = (locale: string): ApiQuestMeta[] =>
    makeRawMeta().map((meta) => ({ ...meta, title: `title-${locale}`, content_locale: locale }))

  it('writes the catalog under its own locale and reads that copy first', async () => {
    await writeCachedQuestsList(metaOn('ru'), 'ru')
    await writeCachedQuestsList(metaOn('pl'), 'pl')

    expect(await AsyncStorage.getItem(questListCacheKey('pl'))).toContain('title-pl')
    expect((await readCachedQuestsList('pl'))?.[0]?.title).toBe('title-pl')
    expect((await readCachedQuestsList('ru'))?.[0]?.title).toBe('title-ru')
  })

  it('falls back to a copy on another locale before the legacy list', async () => {
    await writeCachedQuestsList(metaOn('be'), 'be')
    await AsyncStorage.setItem(
      LEGACY_QUEST_LIST_CACHE_KEY,
      JSON.stringify({ version: 1, savedAt: 1, list: makeRawMeta().map((meta) => ({ ...meta, title: 'legacy' })) }),
    )

    const cached = await readCachedQuestsList('pl')
    expect(cached?.[0]?.title).toBe('title-be')
    expect(adaptMeta(cached![0]).contentLocale).toBe('be')
  })

  it('drops the unreachable legacy list once a localized copy is written', async () => {
    await AsyncStorage.setItem(
      LEGACY_QUEST_LIST_CACHE_KEY,
      JSON.stringify({ version: 1, savedAt: 1, list: makeRawMeta() }),
    )
    await writeCachedQuestsList(metaOn('pl'), 'pl')

    expect(await AsyncStorage.getItem(LEGACY_QUEST_LIST_CACHE_KEY)).toBeNull()
    expect((await readCachedQuestsList('ru'))?.[0]?.title).toBe('title-pl')
  })

  it('reads the pre-translation v1 list as Russian when no localized copy exists', async () => {
    await AsyncStorage.setItem(
      LEGACY_QUEST_LIST_CACHE_KEY,
      JSON.stringify({ version: 1, savedAt: 1, list: makeRawMeta() }),
    )
    mockedGet.mockRejectedValue(new Error('offline'))

    const list = await fetchQuestsList({ locale: 'en' })
    expect(list[0].quest_id).toBe(QUEST_ID)
    expect(adaptMeta(list[0]).contentLocale).toBe('ru')
    // Легаси-копия не мигрируется и не переписывается.
    expect(await AsyncStorage.getItem(questListCacheKey('en'))).toBeNull()
  })

  it('opens the saved quest offline on another language and keeps one catalog record', async () => {
    mockedGet.mockResolvedValue({ ...makeRawBundle(), title: 'Smok', content_locale: 'pl', available_locales: ['ru', 'pl'] })
    await fetchQuestByQuestId(QUEST_ID, { locale: 'pl' })
    expect(mockedGet.mock.calls[0][0]).toBe(`/quests/by-quest-id/${QUEST_ID}/?lang=pl`)

    mockedGet.mockRejectedValue(new Error('offline'))
    const offline = await fetchQuestByQuestId(QUEST_ID, { locale: 'en' })
    expect(offline.title).toBe('Smok')
    const adapted = adaptBundle(offline)
    expect(adapted.contentLocale).toBe('pl')
    expect(adapted.steps.every((step) => step.contentLocale === 'pl')).toBe(true)
    expect([...mockOfflinePackages.keys()].filter((key) => key.includes(QUEST_ID))).toEqual([`quest:${QUEST_ID}`])
  })
})
