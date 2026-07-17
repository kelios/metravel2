import {
  getVisibleMapFilterChips,
  isMapFilterChipsRowVisible,
  MAP_FILTER_CHIPS_ROW_GAP,
  MAP_FILTER_CHIPS_ROW_HEIGHT,
  MAP_FILTER_CHIPS_STACK_OFFSET,
} from '@/components/MapPage/mapFilterChips'

const CATEGORY = { key: 'cat:Церковь', label: 'Церковь' }
const RADIUS = { key: 'radius', label: '50 км' }

describe('mapFilterChips.getVisibleMapFilterChips', () => {
  it('drops the radius pseudo-filter (it has a dedicated toolbar badge)', () => {
    expect(getVisibleMapFilterChips([RADIUS, CATEGORY])).toEqual([CATEGORY])
  })

  it('survives missing lists', () => {
    expect(getVisibleMapFilterChips(undefined)).toEqual([])
    expect(getVisibleMapFilterChips(null)).toEqual([])
  })
})

describe('mapFilterChips.isMapFilterChipsRowVisible', () => {
  it('is visible in radius mode with at least one real chip', () => {
    expect(
      isMapFilterChipsRowVisible({ mode: 'radius', items: [CATEGORY], canRemove: true }),
    ).toBe(true)
  })

  it('is hidden in route mode', () => {
    expect(
      isMapFilterChipsRowVisible({ mode: 'route', items: [CATEGORY], canRemove: true }),
    ).toBe(false)
  })

  it('is hidden when only the radius pseudo-filter is present', () => {
    expect(
      isMapFilterChipsRowVisible({ mode: 'radius', items: [RADIUS], canRemove: true }),
    ).toBe(false)
  })

  it('is hidden without a remove handler', () => {
    expect(
      isMapFilterChipsRowVisible({ mode: 'radius', items: [CATEGORY], canRemove: false }),
    ).toBe(false)
  })
})

// Ряд чипов и гео-баннер живут в разных поддеревьях/слоях, поэтому «стек» под
// тулбаром держится на этой константе. Если высота ряда изменится, а сдвиг
// баннера — нет, они снова начнут накладываться.
describe('mapFilterChips stack offset contract', () => {
  it('offsets whatever sits below by the row height plus its gap', () => {
    expect(MAP_FILTER_CHIPS_STACK_OFFSET).toBe(
      MAP_FILTER_CHIPS_ROW_HEIGHT + MAP_FILTER_CHIPS_ROW_GAP,
    )
  })

  it('clears the row itself', () => {
    expect(MAP_FILTER_CHIPS_STACK_OFFSET).toBeGreaterThan(MAP_FILTER_CHIPS_ROW_HEIGHT)
  })
})
