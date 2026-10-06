// #2197: регрессия-гвард контракта языка контента квестов. Каждое чтение
// каталога и бандла в `api/quests.ts` несёт `lang`, каждый контентный ключ
// квестов в `api/queryKeys.ts` заканчивается локалью. Новое чтение или ключ без
// классификации здесь роняют тест, а не тихо отдают квест на чужом языке.
import fs from 'fs'
import path from 'path'

import { apiClient } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import * as questsApi from '@/api/quests'

let mockLocale = 'be'

jest.mock('@/api/questContentLocale', () => ({
  ...jest.requireActual('@/api/questContentLocale'),
  getQuestContentLocale: () => mockLocale,
}))

jest.mock('@/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

jest.mock('@/api/questBundleCache', () => ({
  readCachedQuestsList: jest.fn(async () => null),
  writeCachedQuestsList: jest.fn(async () => {}),
  readCachedQuestBundle: jest.fn(async () => null),
  writeCachedQuestBundle: jest.fn(async () => {}),
}))

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>

const BUNDLE = {
  id: 1,
  quest_id: 'krakow-dragon',
  title: 'Smok',
  steps: [],
  finale: { text: '', video_url: null, poster_url: null },
  intro: null,
  storage_key: 'k',
  city: { id: 1, name: 'Kraków', lat: 0, lng: 0 },
}

/** Чтения контента квеста: каждое обязано передать `lang`. */
const CONTENT_READS: Record<string, (locale?: string) => Promise<unknown>> = {
  fetchQuestsList: (locale) => questsApi.fetchQuestsList({ locale }),
  fetchQuestsPreview: (locale) => questsApi.fetchQuestsPreview(2, { locale }),
  fetchQuestsCompactCatalog: (locale) => questsApi.fetchQuestsCompactCatalog({ locale }),
  fetchQuestsNearLocation: (locale) => questsApi.fetchQuestsNearLocation({ city: 'Kraków' }, { locale }),
  fetchQuestsByCity: (locale) => questsApi.fetchQuestsByCity(1, locale),
  fetchQuestByQuestId: (locale) => questsApi.fetchQuestByQuestId('krakow-dragon', { locale }),
  fetchQuestById: (locale) => questsApi.fetchQuestById(1, locale),
}

/** Не контент квеста: отзывы игроков, личный прогресс, ответы. `lang` им не нужен. */
const NON_CONTENT_FETCHERS = new Set([
  'fetchQuestReviews',
  'fetchAllProgress',
  'fetchQuestProgress',
  'fetchOrCreateProgress',
])

const respond = (url: string) => {
  if (url.includes('/near-location/')) return { results: [], count: 0 }
  if (url.includes('/by-quest-id/') || /\/quests\/\d+\//.test(url)) return BUNDLE
  return []
}

describe('quest content reads carry lang', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedGet.mockImplementation(async (url: string) => respond(url) as never)
    mockLocale = 'be'
  })

  it('classifies every exported fetcher of api/quests.ts', () => {
    const fetchers = Object.keys(questsApi).filter((name) => /^fetch/.test(name))
    const unclassified = fetchers.filter(
      (name) => !(name in CONTENT_READS) && !NON_CONTENT_FETCHERS.has(name),
    )
    expect(unclassified).toEqual([])
  })

  it.each(Object.keys(CONTENT_READS))('%s sends the explicit locale', async (name) => {
    await CONTENT_READS[name]('pl')
    const urls = mockedGet.mock.calls.map(([url]) => url)
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) expect(url).toMatch(/[?&]lang=pl(&|$)/)
  })

  it.each(Object.keys(CONTENT_READS))('%s defaults to the content-locale resolver', async (name) => {
    await CONTENT_READS[name]()
    const urls = mockedGet.mock.calls.map(([url]) => url)
    for (const url of urls) expect(url).toMatch(/[?&]lang=be(&|$)/)
  })

  it('wraps every quest catalog/bundle path literal in api/quests.ts with withQuestLang', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../api/quests.ts'), 'utf8')
    const offenders = source
      .split('\n')
      .map((line, index) => ({ line: line.trim(), index: index + 1 }))
      .filter(({ line }) => !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('/*'))
      .filter(({ line }) => /['`]\/quests\//.test(line))
      // Отзывы — пользовательский текст, не контент квеста.
      .filter(({ line }) => !line.includes('/reviews/'))
      .filter(({ line }) => !line.includes('withQuestLang('))
    expect(offenders).toEqual([])
  })
})

describe('quest content query keys end with the locale', () => {
  const LOCALE = 'xx-test'

  /** Контентные ключи: последний элемент — локаль. */
  const CONTENT_KEYS: Record<string, () => readonly unknown[]> = {
    questBundle: () => queryKeys.questBundle('krakow-dragon', LOCALE),
    questsCatalog: () => queryKeys.questsCatalog(LOCALE),
    questsPreview: () => queryKeys.questsPreview(6, LOCALE),
    questsCompactCatalog: () => queryKeys.questsCompactCatalog('7', LOCALE),
    questCityClassification: () => queryKeys.questCityClassification(1, LOCALE),
    questsNearLocation: () => queryKeys.questsNearLocation('minsk', LOCALE),
  }

  /** Префиксы «все локали» и не-контентные ключи (отзывы, прогресс). */
  const PREFIX_OR_NON_CONTENT = new Set([
    'questBundles',
    'questBundleAllLocales',
    'quests',
    'questsCatalogAllLocales',
    'questsCompactCatalogAllLocales',
    'questReviews',
    'questUserReview',
    'questProgressAll',
  ])

  it('classifies every quest key factory', () => {
    const factories = Object.keys(queryKeys).filter((name) => /^quests?[A-Z]|^quests?$/.test(name))
    const unclassified = factories.filter(
      (name) => !(name in CONTENT_KEYS) && !PREFIX_OR_NON_CONTENT.has(name),
    )
    expect(unclassified).toEqual([])
  })

  it.each(Object.keys(CONTENT_KEYS))('%s ends with the locale', (name) => {
    const key = CONTENT_KEYS[name]()
    expect(key[key.length - 1]).toBe(LOCALE)
  })

  it('all-locale prefixes cover the per-locale keys', () => {
    const isPrefix = (prefix: readonly unknown[], key: readonly unknown[]) =>
      prefix.every((part, index) => key[index] === part)
    expect(isPrefix(queryKeys.questBundleAllLocales('q'), queryKeys.questBundle('q', 'pl'))).toBe(true)
    expect(isPrefix(queryKeys.questBundles(), queryKeys.questBundle('q', 'pl'))).toBe(true)
    expect(isPrefix(queryKeys.questsCatalogAllLocales(), queryKeys.questsCatalog('pl'))).toBe(true)
    expect(isPrefix(queryKeys.questsCompactCatalogAllLocales('7'), queryKeys.questsCompactCatalog('7', 'pl'))).toBe(true)
    // Каталог не накрывает соседние срезы под тем же корнем.
    expect(isPrefix(queryKeys.questsCatalogAllLocales(), queryKeys.questsPreview(2, 'pl'))).toBe(false)
    expect(isPrefix(queryKeys.questsCatalogAllLocales(), queryKeys.questsCompactCatalog(null, 'pl'))).toBe(false)
    expect(queryKeys.questBundle('q', 'ru')).not.toEqual(queryKeys.questBundle('q', 'pl'))
  })
})
