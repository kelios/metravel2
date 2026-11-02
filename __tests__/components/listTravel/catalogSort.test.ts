/**
 * #2903: сортировка публичного каталога «Ближе ко мне / По релевантности /
 * Новые». Порядок считает сервер (`sort=distance&lat=&lng=`, #2929) —
 * клиент лишь собирает параметры, помнит выбор на сессию и шлёт событие.
 */
import { renderHook, act } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useCatalogSort } from '@/components/listTravel/hooks/useCatalogSort'
import {
  DISTANCE_SORT_ID,
  RELEVANCE_SORT_ID,
  normalizeCatalogSortValue,
  readRememberedCatalogSort,
  rememberCatalogSort,
  resetRememberedCatalogSortForTests,
  resolveActiveSortId,
  resolveInitialCatalogSort,
  withDistanceSortOrigin,
} from '@/components/listTravel/utils/catalogSort'
import { buildTravelFilterGroups } from '@/components/listTravel/utils/filterGroups'
import { getCatalogHeaderSortingOptions, withCatalogProximitySortings } from '@/components/listTravel/utils/sortings'
import { i18n } from '@/i18n'
import { queueAnalyticsEvent } from '@/utils/analytics'

jest.mock('@/utils/analytics', () => ({ queueAnalyticsEvent: jest.fn(), sendAnalyticsEvent: jest.fn() }))

const mockQueue = queueAnalyticsEvent as jest.Mock

describe('catalog sort params (#2903)', () => {
  afterEach(() => resetRememberedCatalogSortForTests())

  it('adds a rounded origin only to the distance sort and leaves other params untouched', () => {
    const params = { categories: [21, 22, 2], publish: 1, sort: 'distance' }
    expect(withDistanceSortOrigin(params, { lat: 53.90234, lng: 27.56187 })).toEqual({
      categories: [21, 22, 2], publish: 1, sort: 'distance', lat: 53.9, lng: 27.56,
    })
    // Без точки сервер сам считает от Минска.
    expect(withDistanceSortOrigin(params, null)).toEqual(params)
    expect(withDistanceSortOrigin(params, { lat: Number.NaN, lng: 27 })).toEqual(params)

    const newest = { sort: 'newest', publish: 1 }
    expect(withDistanceSortOrigin(newest, { lat: 53.9, lng: 27.56 })).toBe(newest)
    expect(withDistanceSortOrigin({ sort: 'newest', lat: 1, lng: 2 }, { lat: 53.9, lng: 27.56 })).toEqual({ sort: 'newest' })
  })

  it('treats «relevance» as no sort param', () => {
    expect(normalizeCatalogSortValue(RELEVANCE_SORT_ID)).toBe('')
    expect(normalizeCatalogSortValue(' distance ')).toBe(DISTANCE_SORT_ID)
    expect(normalizeCatalogSortValue(undefined)).toBe('')
  })

  it('marks relevance active for an empty sort only where the option exists', () => {
    expect(resolveActiveSortId('', ['distance', 'relevance', 'newest'], 'newest')).toBe('relevance')
    expect(resolveActiveSortId('', ['newest', 'oldest'], 'newest')).toBe('newest')
    expect(resolveActiveSortId('distance', ['distance', 'relevance'], 'newest')).toBe('distance')
  })

  it('remembers the explicit choice for the session, but text search keeps relevance by default', () => {
    expect(readRememberedCatalogSort()).toBeNull()
    expect(resolveInitialCatalogSort({ urlSort: '', search: '' })).toBeNull()

    rememberCatalogSort(DISTANCE_SORT_ID)
    expect(resolveInitialCatalogSort({ urlSort: '', search: '' })).toBe(DISTANCE_SORT_ID)
    expect(resolveInitialCatalogSort({ urlSort: '', search: 'Гродно' })).toBeNull()
    expect(resolveInitialCatalogSort({ urlSort: 'newest', search: '' })).toBeNull()

    rememberCatalogSort(RELEVANCE_SORT_ID)
    expect(readRememberedCatalogSort()).toBe('')
    expect(resolveInitialCatalogSort({ urlSort: '', search: '' })).toBeNull()
  })

  it('persists the choice in sessionStorage on web', () => {
    const original = Platform.OS
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    try {
      rememberCatalogSort(DISTANCE_SORT_ID)
      expect(window.sessionStorage.getItem('metravel:catalog-sort')).toBe(DISTANCE_SORT_ID)
      resetRememberedCatalogSortForTests()
      expect(window.sessionStorage.getItem('metravel:catalog-sort')).toBeNull()
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: original })
    }
  })
})

describe('catalog sort options (#2903)', () => {
  beforeAll(async () => { await i18n.changeLanguage('ru') })

  it('leads the public catalog switch with «Ближе ко мне», «По релевантности», «Сначала новые»', () => {
    const options = getCatalogHeaderSortingOptions([{ id: 'newest' }, { id: 'popular_desc' }], { includeProximity: true })
    expect(options.slice(0, 3)).toEqual([
      { id: 'distance', name: 'Ближе ко мне' },
      { id: 'relevance', name: 'По релевантности' },
      { id: 'newest', name: 'Сначала новые' },
    ])
  })

  it('keeps the full default list under the proximity options until filter options load', () => {
    const defaults = getCatalogHeaderSortingOptions([]).map((option) => option.id)
    const publicIds = getCatalogHeaderSortingOptions([], { includeProximity: true }).map((option) => option.id)
    expect(publicIds).toEqual(['distance', 'relevance', ...defaults])
    expect(withCatalogProximitySortings([{ id: 'distance' }]).map((option) => option.id)).toEqual(['relevance', 'distance'])
  })

  it('keeps own travels and export without proximity options', () => {
    const ids = getCatalogHeaderSortingOptions([{ id: 'newest' }]).map((option) => option.id)
    expect(ids).not.toContain('distance')
    expect(ids).not.toContain('relevance')
  })

  it('offers the same switch in the filter sheet of the public catalog', () => {
    const groups = buildTravelFilterGroups({
      options: { sortings: [{ id: 'newest', name: 'Newest' }] } as never,
      includeSort: true,
      includeProximitySort: true,
    })
    const sort = groups.find((group) => group.key === 'sort')
    expect(sort?.options.map((option) => option.id)).toEqual(['distance', 'relevance', 'newest'])
  })

  it.each([
    ['be', 'Бліжэй да мяне'],
    ['uk', 'Ближче до мене'],
    ['pl', 'Najbliżej mnie'],
    ['en', 'Closest to me'],
  ])('localizes the distance option in %s', async (locale, label) => {
    await i18n.changeLanguage(locale)
    expect(getCatalogHeaderSortingOptions([], { includeProximity: true })[0].name).toBe(label)
    await i18n.changeLanguage('ru')
  })
})

describe('useCatalogSort (#2903)', () => {
  beforeEach(() => {
    mockQueue.mockClear()
    resetRememberedCatalogSortForTests()
  })

  it('remembers an explicit choice and reports search_sort_change once per choice', async () => {
    const onSelect = jest.fn()
    const { result } = await renderHook(() => useCatalogSort({
      enabled: true, hydrationReady: true, urlSort: '', search: '', entry: undefined, onSelect,
    }))
    await act(async () => result.current.handleFilterSelect('sort', DISTANCE_SORT_ID))
    expect(onSelect).toHaveBeenCalledWith('sort', DISTANCE_SORT_ID)
    expect(readRememberedCatalogSort()).toBe(DISTANCE_SORT_ID)
    expect(mockQueue).toHaveBeenCalledWith('search_sort_change', { sort: 'distance', source: 'travel_catalog' })

    await act(async () => result.current.handleFilterSelect('sort', RELEVANCE_SORT_ID))
    expect(mockQueue).toHaveBeenLastCalledWith('search_sort_change', { sort: 'relevance', source: 'travel_catalog' })
    expect(readRememberedCatalogSort()).toBe('')

    await act(async () => result.current.handleFilterSelect('categories', [1]))
    expect(mockQueue).toHaveBeenCalledTimes(2)
    expect(onSelect).toHaveBeenLastCalledWith('categories', [1])
  })

  it('restores the remembered sort after hydration on a bare catalog entry, not on a text search', async () => {
    rememberCatalogSort(DISTANCE_SORT_ID)
    const onSelect = jest.fn()
    const props = { enabled: true, hydrationReady: false, urlSort: '', search: '', entry: undefined as unknown, onSelect }
    const { rerender } = await renderHook((p: typeof props) => useCatalogSort(p), { initialProps: props })
    expect(onSelect).not.toHaveBeenCalled()

    await rerender({ ...props, hydrationReady: true })
    expect(onSelect).toHaveBeenCalledWith('sort', DISTANCE_SORT_ID)
    expect(mockQueue).not.toHaveBeenCalled()

    onSelect.mockClear()
    await rerender({ ...props, hydrationReady: true, search: 'Гродно', entry: { search: 'Гродно' } })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('feeds the toolbar: proximity options only in the public catalog, a second tap clears the sort', async () => {
    const onSelect = jest.fn()
    const props = { enabled: true, hydrationReady: true, urlSort: '', search: '', entry: undefined as unknown, onSelect, sortValue: DISTANCE_SORT_ID as unknown }
    const { result, rerender } = await renderHook((p: typeof props) => useCatalogSort(p), { initialProps: props })
    expect(result.current.sortOptions.map((option) => option.id).slice(0, 2)).toEqual([DISTANCE_SORT_ID, RELEVANCE_SORT_ID])
    expect(result.current.sortValue).toBe(DISTANCE_SORT_ID)

    await act(async () => result.current.handleSortChange(DISTANCE_SORT_ID))
    expect(onSelect).toHaveBeenLastCalledWith('sort', '')
    expect(mockQueue).toHaveBeenLastCalledWith('search_sort_change', { sort: 'relevance', source: 'travel_catalog' })

    await rerender({ ...props, enabled: false, sortValue: undefined })
    expect(result.current.sortOptions.map((option) => option.id)).not.toContain(DISTANCE_SORT_ID)
    expect(result.current.sortValue).toBe('')
  })

  it('does nothing outside the public catalog', async () => {
    rememberCatalogSort(DISTANCE_SORT_ID)
    const onSelect = jest.fn()
    const { result } = await renderHook(() => useCatalogSort({
      enabled: false, hydrationReady: true, urlSort: '', search: '', entry: undefined, onSelect,
    }))
    expect(onSelect).not.toHaveBeenCalled()
    await act(async () => result.current.handleFilterSelect('sort', 'newest'))
    expect(onSelect).toHaveBeenCalledWith('sort', 'newest')
    expect(mockQueue).not.toHaveBeenCalled()
    expect(readRememberedCatalogSort()).toBe(DISTANCE_SORT_ID)
  })
})
