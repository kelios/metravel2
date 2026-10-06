// #2197: смена языка интерфейса меняет ключ запроса квестов и перезапрашивает
// контент без перезагрузки; данные одной локали под ключом другой не всплывают.
import { createElement, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { i18n } from '@/i18n'
import { queryKeys } from '@/api/queryKeys'

const mockFetchQuestsList = jest.fn()
const mockFetchQuestByQuestId = jest.fn()

jest.mock('@/api/questBundleCache', () => ({ writeCachedQuestBundle: jest.fn() }))

jest.mock('@/api/quests', () => ({
  fetchQuestsList: (...args: unknown[]) => mockFetchQuestsList(...args),
  fetchQuestByQuestId: (...args: unknown[]) => mockFetchQuestByQuestId(...args),
  fetchQuestsByCity: jest.fn(async () => []),
  fetchQuestsPreview: jest.fn(async () => []),
  fetchQuestProgress: jest.fn(),
  fetchQuestReviews: jest.fn(),
}))

import { useQuestBundle, useQuestsList } from '@/hooks/useQuestsApi'

const metaOn = (locale: string) => ({
  id: 1,
  quest_id: 'krakow-dragon',
  title: `title-${locale}`,
  points: 5,
  city_id: '1',
  city_name: locale === 'ru' ? 'Краков' : 'Kraków',
  city_name_canonical: 'Краков',
  content_locale: locale,
  available_locales: ['ru', 'pl'],
  lat: 50,
  lng: 19,
  duration_min: 60,
  difficulty: 'easy',
  tags: { bike: true },
  pet_friendly: false,
  cover_url: 'https://metravel.by/c.jpg',
  rating_avg: null,
  rating_count: 0,
  completions_count: 0,
  is_completed_by_me: false,
  first_completer: null,
})

const bundleOn = (locale: string) => ({
  id: 1,
  quest_id: 'krakow-dragon',
  title: `title-${locale}`,
  tags: {},
  cover_url: 'https://metravel.by/c.jpg',
  steps: [
    {
      id: 10,
      step_id: 's1',
      title: `step-${locale}`,
      location: 'Wawel',
      story: 'story',
      task: 'task',
      answer_pattern: { type: 'exact', value: 'smok' },
      lat: 50,
      lng: 19,
      maps_url: '',
      order: 1,
    },
  ],
  finale: { text: '', video_url: null, poster_url: null },
  intro: null,
  storage_key: 'k',
  city: { id: 1, name: locale === 'ru' ? 'Краков' : 'Kraków', name_canonical: 'Краков', lat: 50, lng: 19 },
  content_locale: locale,
  available_locales: ['ru', 'pl'],
})

function makeWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}

describe('quest content follows the UI language', () => {
  let client: QueryClient

  beforeEach(async () => {
    await i18n.changeLanguage('ru')
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockFetchQuestsList.mockReset()
    mockFetchQuestsList.mockImplementation(async ({ locale }: { locale: string }) => [metaOn(locale)])
    mockFetchQuestByQuestId.mockReset()
    mockFetchQuestByQuestId.mockImplementation(async (_id: string, { locale }: { locale: string }) => bundleOn(locale))
  })

  afterEach(async () => {
    client.clear()
    await act(async () => {
      await i18n.changeLanguage('ru')
    })
  })

  it('refetches the catalog under the new locale key and never shows the old language there', async () => {
    const seen: string[] = []
    const { result } = renderHook(() => {
      const value = useQuestsList()
      value.quests.forEach((quest) => seen.push(`${quest.contentLocale}:${quest.title}`))
      return value
    }, { wrapper: makeWrapper(client) })

    await waitFor(() => expect(result.current.quests[0]?.title).toBe('title-ru'))
    expect(mockFetchQuestsList).toHaveBeenLastCalledWith(expect.objectContaining({ locale: 'ru' }))

    seen.length = 0
    await act(async () => {
      await i18n.changeLanguage('pl')
    })
    await waitFor(() => expect(result.current.quests[0]?.title).toBe('title-pl'))
    expect(mockFetchQuestsList).toHaveBeenLastCalledWith(expect.objectContaining({ locale: 'pl' }))
    expect(seen.every((entry) => entry === 'pl:title-pl')).toBe(true)
    expect(result.current.quests[0]).toMatchObject({ contentLocale: 'pl', cityNameCanonical: 'Краков' })

    // Две локали — два ключа; копия на одной не подменяет другую.
    expect(client.getQueryData<{ title: string }[]>(queryKeys.questsCatalog('ru'))?.[0]?.title).toBe('title-ru')
    expect(client.getQueryData<{ title: string }[]>(queryKeys.questsCatalog('pl'))?.[0]?.title).toBe('title-pl')

    await act(async () => {
      await i18n.changeLanguage('ru')
    })
    await waitFor(() => expect(result.current.quests[0]?.title).toBe('title-ru'))
  })

  it('reloads the bundle in the new language and stamps its steps with that locale', async () => {
    const { result } = renderHook(() => useQuestBundle('krakow-dragon'), { wrapper: makeWrapper(client) })

    await waitFor(() => expect(result.current.bundle?.title).toBe('title-ru'))
    expect(result.current.bundle?.steps[0]?.contentLocale).toBe('ru')

    await act(async () => {
      await i18n.changeLanguage('pl')
    })
    await waitFor(() => expect(result.current.bundle?.title).toBe('title-pl'))
    expect(mockFetchQuestByQuestId).toHaveBeenLastCalledWith(
      'krakow-dragon',
      expect.objectContaining({ locale: 'pl' }),
    )
    expect(result.current.bundle).toMatchObject({ contentLocale: 'pl', availableLocales: ['ru', 'pl'] })
    expect(result.current.bundle?.steps[0]?.contentLocale).toBe('pl')
    expect(result.current.bundle?.city?.nameCanonical).toBe('Краков')
  })
})
