/**
 * #2184: бюджет запросов каталога мест.
 *
 * 04.10.2026 одно открытие /places слало шесть параллельных запросов каталога
 * (список, фасеты и по запросу на каждую подборку) и повторяло каждый до двух
 * раз после клиентского таймаута — до 18 серверных расчётов с одного посетителя.
 * Набор держит правило слоя данных «один ресурс каталога = один запрос» и
 * политику повторов: таймаут не повторяется, обрыв соединения — один раз.
 */
import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { invalidateBlockSensitiveQueries } from '@/api/blockSensitiveQueries'
import { ApiError } from '@/api/clientErrors'
import { fetchPlacesCatalog } from '@/api/places'
import { usePlacesCatalogController } from '@/screens/tabs/usePlacesCatalogController'
import type { CatalogPlace, PlacesCatalogPage } from '@/utils/placesCatalog'

const mockSetParams = jest.fn()
let mockParams: Record<string, string | undefined> = {}

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: jest.fn(), setParams: mockSetParams }),
}))

jest.mock('@/api/places', () => ({
  fetchPlacesCatalog: jest.fn(),
}))

const mockedFetch = fetchPlacesCatalog as jest.MockedFunction<typeof fetchPlacesCatalog>

const makePlaces = (from: number, size: number): CatalogPlace[] =>
  Array.from({ length: size }, (_, index) => ({ id: `place-${from + index}` }) as CatalogPlace)

const CATALOG_FACETS = {
  categoryFacets: [
    { id: 43, name: 'Замок', count: 30 },
    { id: 51, name: 'Озеро', count: 12 },
  ],
  countryFacets: [{ id: null, name: 'Беларусь', count: 120 }],
}

// Ответ без категорий: полный каталог, его итог и фасеты.
const CATALOG_PAGE: PlacesCatalogPage = { places: makePlaces(1, 20), count: 120, ...CATALOG_FACETS }
// Ответ с категориями: бэкенд сужает и итог, и фасеты до совпавших мест.
const FILTERED_PAGE: PlacesCatalogPage = {
  places: makePlaces(500, 7),
  count: 7,
  categoryFacets: [{ id: 51, name: 'Озеро', count: 7 }],
  countryFacets: [{ id: null, name: 'Беларусь', count: 7 }],
}

// Текст таймаута локализован — берём белорусский: правило обязано узнавать
// таймаут по имени ошибки, а не по русскому или английскому слову в сообщении.
const timeoutError = () =>
  Object.assign(new Error('Перавышаны час чакання (15000ms). Паспрабуйце пазней.'), { name: 'TimeoutError' })
const connectionError = () =>
  new Error('Network error while fetching https://metravel.by/api/places/catalog/?page=1. Is the API server running and reachable from this device/browser?')

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const NEAR_BOTTOM_SCROLL = {
  nativeEvent: { layoutMeasurement: { height: 800 }, contentOffset: { y: 1000 }, contentSize: { height: 1900 } },
} as any

let queryClient: QueryClient

// Клиент без своего `retry`: если слой данных потеряет политику повторов, в
// силу вступит дефолт React Query (три повтора) и набор покраснеет.
const renderController = () => {
  queryClient = new QueryClient()
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => usePlacesCatalogController({ isCompact: false, isWide: true }), { wrapper })
}

// Часы теста поддельные. Ждать опросом здесь нельзя: в jsdom таймер опроса сам
// поддельный и не тикает. `tick` — один проход часов вместе с микрозадачами.
const tick = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })

// `settle` — «пока экран не затихнет»: за первый проход отрабатывают ответ,
// пауза перед повтором и пауза ввода. Рендер после таймера React выполняет уже
// на выходе из `act`, поэтому запросу, который этот рендер запустил, и его
// ответу нужны следующие проходы.
const settle = async () => {
  await tick(20_000)
  await tick(1_000)
  await tick(1_000)
}

const callParams = (index: number) => mockedFetch.mock.calls[index][0]

describe('usePlacesCatalogController — бюджет запросов каталога (#2184)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockParams = {}
    ;(Platform as any).OS = 'web'
    mockedFetch.mockImplementation(async (params) => (params.categories?.length ? FILTERED_PAGE : CATALOG_PAGE))
  })

  afterEach(() => {
    queryClient?.clear()
    jest.useRealTimers()
  })

  it('первое открытие без фильтров: один запрос на список, итог и фасеты', async () => {
    const { result } = renderController()
    await settle()

    expect(result.current.resultsStatus).toBe('list')
    expect(mockedFetch).toHaveBeenCalledTimes(1)
    expect(callParams(0)).toEqual({ page: 1, perPage: 20, sort: 'default' })
    expect(result.current.visiblePlaces).toHaveLength(20)
    expect(result.current.totalCount).toBe(120)
    // Итог каталога и фасеты пришли из того же ответа, а не отдельным запросом.
    expect(result.current.catalogTotal).toBe(120)
    expect(result.current.showLoadedCounts).toBe(true)
    expect(result.current.isScopeLoading).toBe(false)
    expect(result.current.filteredCategoryFacets).toEqual(CATALOG_FACETS.categoryFacets)
    expect(result.current.countryFacets).toEqual(CATALOG_FACETS.countryFacets)
    // Счётчик подборки клиент не выдумывает: до её открытия числа нет.
    expect(result.current.collectionCards.map((card) => card.countReady)).toEqual([false, false, false, false])
  })

  it('выбор подборки: один запрос списка, объём без категорий остаётся из кэша', async () => {
    const { result } = renderController()
    await settle()
    const nature = result.current.collectionCards.find((card) => card.id === 'nature')!

    act(() => result.current.selectCategoryCollection(nature))
    await settle()

    expect(result.current.totalCount).toBe(7)
    expect(mockedFetch).toHaveBeenCalledTimes(2)
    expect(callParams(1)).toEqual({ page: 1, perPage: 20, categories: [...nature.categories], sort: 'default' })
    // Фасеты ответа сужены до подборки, но панель категорий показывает весь каталог.
    expect(result.current.catalogTotal).toBe(120)
    expect(result.current.filteredCategoryFacets.map((facet) => facet.name)).toEqual(
      expect.arrayContaining(['Замок', 'Озеро']),
    )
    // Счётчик подборки взят из ответа её списка; остальные по-прежнему без числа.
    expect(result.current.collectionCards.filter((card) => card.countReady)).toEqual([
      expect.objectContaining({ id: 'nature', count: 7 }),
    ])

    // Возврат ко всем местам — из кэша, без запроса.
    act(() => result.current.handleClearCategories())
    await settle()
    expect(result.current.totalCount).toBe(120)
    expect(mockedFetch).toHaveBeenCalledTimes(2)
  })

  it('заход по ссылке с категорией: объём запрашивается после ответа списка, не параллельно', async () => {
    mockParams = { category: 'Замок' }
    const list = deferred<PlacesCatalogPage>()
    const scope = deferred<PlacesCatalogPage>()
    mockedFetch.mockImplementation((params) => (params.categories?.length ? list.promise : scope.promise))

    const { result } = renderController()
    await settle()

    // Список ещё в пути — второго расчёта рядом с ним нет.
    expect(mockedFetch).toHaveBeenCalledTimes(1)
    expect(callParams(0)).toEqual({ page: 1, perPage: 20, categories: ['Замок'], sort: 'default' })
    expect(result.current.isScopeLoading).toBe(true)

    list.resolve(FILTERED_PAGE)
    await settle()
    expect(mockedFetch).toHaveBeenCalledTimes(2)
    expect(callParams(1)).toEqual({ page: 1, perPage: 1 })

    scope.resolve({ ...CATALOG_PAGE, places: makePlaces(1, 1) })
    await settle()

    expect(result.current.catalogTotal).toBe(120)
    expect(result.current.totalCount).toBe(7)
    expect(result.current.isScopeLoading).toBe(false)
    expect(mockedFetch).toHaveBeenCalledTimes(2)
  })

  it('заход по ссылке с категорией: список не ответил — объём не запрашивается', async () => {
    mockParams = { category: 'Замок' }
    mockedFetch.mockRejectedValue(timeoutError())

    const { result } = renderController()
    await settle()

    expect(result.current.resultsStatus).toBe('error')
    expect(mockedFetch).toHaveBeenCalledTimes(1)
    expect(result.current.isScopeLoading).toBe(false)
    expect(result.current.showLoadedCounts).toBe(false)
  })

  it('таймаут: повторов нет, ошибка с ручным «Повторить»', async () => {
    mockedFetch.mockRejectedValue(timeoutError())

    const { result } = renderController()
    await settle()

    expect(result.current.resultsStatus).toBe('error')
    expect(mockedFetch).toHaveBeenCalledTimes(1)
    expect(result.current.loadErrorDescription).toContain('Сервер не отвечает')

    mockedFetch.mockImplementation(async () => CATALOG_PAGE)
    act(() => {
      void result.current.placesQuery.refetch()
    })
    await settle()

    expect(result.current.resultsStatus).toBe('list')
    expect(mockedFetch).toHaveBeenCalledTimes(2)
  })

  it('504 от шлюза: сервер ещё считает — повторов нет', async () => {
    mockedFetch.mockRejectedValue(new ApiError(504, 'HTTP 504: '))

    const { result } = renderController()
    await settle()

    expect(result.current.resultsStatus).toBe('error')
    expect(mockedFetch).toHaveBeenCalledTimes(1)
  })

  it('обрыв соединения: ровно один повтор', async () => {
    mockedFetch.mockRejectedValue(connectionError())

    const { result } = renderController()
    await settle()

    expect(result.current.resultsStatus).toBe('error')
    expect(mockedFetch).toHaveBeenCalledTimes(2)
    expect(result.current.loadErrorDescription).toContain('Проверьте соединение')
  })

  it('503 «каталог занят»: один повтор, и он доводит до списка', async () => {
    mockedFetch.mockRejectedValueOnce(new ApiError(503, 'HTTP 503: Service Unavailable'))

    const { result } = renderController()
    await settle()

    expect(result.current.resultsStatus).toBe('list')
    expect(mockedFetch).toHaveBeenCalledTimes(2)
    expect(result.current.catalogTotal).toBe(120)
  })

  it('сбой дозагрузки: список остаётся, скролл не повторяет, кнопка — только эту страницу', async () => {
    mockedFetch.mockImplementation(async (params) => {
      if (params.page === 1) return { ...CATALOG_PAGE, count: 40 }
      throw timeoutError()
    })
    const { result } = renderController()
    await settle()

    // Автодогрузка по скроллу запрашивает вторую страницу — она падает по таймауту.
    act(() => result.current.handleScroll(NEAR_BOTTOM_SCROLL))
    await settle()
    expect(result.current.loadMoreFailed).toBe(true)
    expect(mockedFetch).toHaveBeenCalledTimes(2)
    expect(callParams(1)).toMatchObject({ page: 2 })
    expect(result.current.resultsStatus).toBe('list')
    expect(result.current.visiblePlaces).toHaveLength(20)

    // Скролл у низа списка больше ничего не шлёт.
    act(() => result.current.handleScroll(NEAR_BOTTOM_SCROLL))
    await settle()
    expect(mockedFetch).toHaveBeenCalledTimes(2)

    // Кнопка в подвале повторяет одну несостоявшуюся страницу, а не весь список.
    mockedFetch.mockImplementation(async () => ({ ...CATALOG_PAGE, count: 40, places: makePlaces(21, 20) }))
    act(() => result.current.loadMorePlaces())
    await settle()

    expect(result.current.visiblePlaces).toHaveLength(40)
    expect(mockedFetch).toHaveBeenCalledTimes(3)
    expect(callParams(2)).toMatchObject({ page: 2 })
    expect(result.current.loadMoreFailed).toBe(false)
  })

  it('инвалидация каталога (блок автора) без категорий: перечитывается только список', async () => {
    const { result } = renderController()
    await settle()
    expect(mockedFetch).toHaveBeenCalledTimes(1)

    act(() => invalidateBlockSensitiveQueries(queryClient, 'block'))
    await settle()

    // Объём заново заполняет первая страница списка: отдельного `perPage=1` нет.
    expect(mockedFetch).toHaveBeenCalledTimes(2)
    expect(callParams(1)).toEqual({ page: 1, perPage: 20, sort: 'default' })
    expect(result.current.catalogTotal).toBe(120)
  })

  it('«Сбросить» при поиске и подборке: запроса промежуточного состояния нет', async () => {
    const { result } = renderController()
    await settle()
    const nature = result.current.collectionCards.find((card) => card.id === 'nature')!
    act(() => result.current.selectCategoryCollection(nature))
    await settle()
    act(() => result.current.handleQueryChange('зам'))
    await settle()
    // Список подборки с поиском и после него объём для этого поиска.
    expect(mockedFetch).toHaveBeenCalledTimes(4)
    expect(callParams(2)).toEqual({ page: 1, perPage: 20, q: 'зам', categories: [...nature.categories], sort: 'default' })
    expect(callParams(3)).toEqual({ page: 1, perPage: 1, q: 'зам' })

    // Очищенный поиск применяется в тот же рендер, что и сброс фильтров: запрос
    // «старый поиск без категорий» не уходит, каталог без фильтров — из кэша.
    act(() => result.current.resetAll())
    await settle()

    expect(mockedFetch).toHaveBeenCalledTimes(4)
    expect(result.current.appliedQuery).toBe('')
    expect(result.current.totalCount).toBe(120)
  })

  it('поиск: один запрос на паузу ввода, а не на каждый символ', async () => {
    const { result } = renderController()
    await settle()

    act(() => result.current.handleQueryChange('з'))
    act(() => result.current.handleQueryChange('за'))
    act(() => result.current.handleQueryChange('зам'))
    await tick(399)
    expect(mockedFetch).toHaveBeenCalledTimes(1)

    await settle()

    expect(mockedFetch).toHaveBeenCalledTimes(2)
    expect(callParams(1)).toEqual({ page: 1, perPage: 20, q: 'зам', sort: 'default' })
  })
})
