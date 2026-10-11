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

  it('reports the backend point total rather than only the loaded page', () => {
    const { result } = renderHook(() => useMapMobilePointSummary(base))
    expect(result.current.listBadge).toBe('332')
    expect(result.current.radiusBadge).toBe('50')
    expect(result.current.listHeaderSummaryText).toBe('332 точки · 50 км')
  })

  it('qualifies locally filtered totals and updates when more loaded results arrive', () => {
    const { result, rerender } = renderHook(({ count }) => useMapMobilePointSummary({
      ...base, totalCount: count, filtersContextProps: { ...base.filtersContextProps, resultsTotalScope: 'loaded' },
    }), { initialProps: { count: 2 } })
    expect(result.current.listHeaderSummaryText).toBe('Загружено: 2 точки · 50 км')
    rerender({ count: 5 })
    expect(result.current.listHeaderSummaryText).toBe('Загружено: 5 точек · 50 км')
  })

  it('keeps capped badges and the existing two radius callbacks without changing their source', () => {
    const { result, rerender } = renderHook(({ count }) => useMapMobilePointSummary({ ...base, totalCount: count }), {
      initialProps: { count: 1200 },
    })
    expect(result.current.listBadge).toBe('999+')
    const select = result.current.handleRadiusSelect
    const expand = result.current.handleExpandRadiusFromToast
    act(() => { select('100'); expand('200') })
    expect(onFilterChange.mock.calls).toEqual([['radius', '100'], ['radius', '200']])
    rerender({ count: 1300 })
    expect(result.current.handleRadiusSelect).toBe(select)
    expect(result.current.handleExpandRadiusFromToast).toBe(expand)
  })

  it('retains the empty-state loading gate and the single reset escape hatch', () => {
    const { result, rerender } = renderHook(({ busy, selected }) => useMapMobilePointSummary({
      ...base, totalCount: 0,
      filtersContextProps: { ...base.filtersContextProps, isBusy: busy },
      activeFilterItems: selected ? [{ key: 'category:Замок', label: 'Замок' }] : [],
      onRemoveActiveFilter: jest.fn(),
    }), { initialProps: { busy: true, selected: false } })
    expect(result.current.showEmptyStateToast).toBe(false)
    expect(result.current.showAllPlacesButton).toBe(onShowAllPlaces)
    rerender({ busy: false, selected: true })
    expect(result.current.showEmptyStateToast).toBe(true)
    expect(result.current.showAllPlacesButton).toBeUndefined()
  })
})
