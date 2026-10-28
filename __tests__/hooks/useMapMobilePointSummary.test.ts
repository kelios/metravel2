import { act, renderHook } from '@testing-library/react-native'
import { useMapMobilePointSummary } from '@/hooks/map/useMapMobilePointSummary'

const onFilterChange = jest.fn()
const onShowAllPlaces = jest.fn()
const base = {
  activeRadius: '50', totalCount: 332, loadedCount: 30,
  filtersContextProps: { filterValue: { radius: '50' }, onFilterChange },
  routeMode: 'radius' as const, sheetState: 'collapsed', hasSelectedPlace: false,
  activePopover: null, onShowAllPlaces,
}

describe('mobile map point summary and existing radius actions', () => {
  beforeEach(() => jest.clearAllMocks())

  it('reports the backend point total rather than only the loaded page', async () => {
    const { result } = await renderHook(() => useMapMobilePointSummary(base))
    expect(result.current.listBadge).toBe('332')
    expect(result.current.radiusBadge).toBe('50')
    expect(result.current.listHeaderSummaryText).toBe('332 точки · 50 км')
  })

  it('qualifies locally filtered totals and updates when more loaded results arrive', async () => {
    const { result, rerender } = await renderHook(({ count }) => useMapMobilePointSummary({
      ...base, totalCount: count, filtersContextProps: { ...base.filtersContextProps, resultsTotalScope: 'loaded' },
    }), { initialProps: { count: 2 } })
    expect(result.current.listHeaderSummaryText).toBe('Загружено: 2 точки · 50 км')
    await rerender({ count: 5 })
    expect(result.current.listHeaderSummaryText).toBe('Загружено: 5 точек · 50 км')
  })

  it('keeps capped badges and the existing two radius callbacks without changing their source', async () => {
    const { result, rerender } = await renderHook(({ count }) => useMapMobilePointSummary({ ...base, totalCount: count }), {
      initialProps: { count: 1200 },
    })
    expect(result.current.listBadge).toBe('999+')
    const select = result.current.handleRadiusSelect
    const expand = result.current.handleExpandRadiusFromToast
    await act(() => { select('100'); expand('200') })
    expect(onFilterChange.mock.calls).toEqual([['radius', '100'], ['radius', '200']])
    await rerender({ count: 1300 })
    expect(result.current.handleRadiusSelect).toBe(select)
    expect(result.current.handleExpandRadiusFromToast).toBe(expand)
  })

  it('retains the empty-state loading gate and the single reset escape hatch', async () => {
    const { result, rerender } = await renderHook(({ busy, selected }) => useMapMobilePointSummary({
      ...base, totalCount: 0,
      filtersContextProps: { ...base.filtersContextProps, isBusy: busy },
      activeFilterItems: selected ? [{ key: 'category:Замок', label: 'Замок' }] : [],
      onRemoveActiveFilter: jest.fn(),
    }), { initialProps: { busy: true, selected: false } })
    expect(result.current.showEmptyStateToast).toBe(false)
    // #2777: на радиусе по умолчанию без фильтров сбрасывать нечего.
    expect(result.current.showAllPlacesButton).toBeUndefined()
    await rerender({ busy: false, selected: true })
    expect(result.current.showEmptyStateToast).toBe(true)
    expect(result.current.showAllPlacesButton).toBeUndefined()
  })

  // #2777: сброс есть, только когда сбрасывать есть что.
  it.each([
    ['default radius, no filters', '50', false, false],
    ['non-default radius (home «Карта до 60 км»)', '60', false, true],
    ['text query without chips', '50', true, true],
  ])('reset button: %s', async (_label, radius, hasActiveFilters, visible) => {
    const { result } = await renderHook(() => useMapMobilePointSummary({
      ...base, activeRadius: radius, hasActiveFilters,
    }))
    expect(result.current.showAllPlacesButton).toBe(visible ? onShowAllPlaces : undefined)
  })
})
