import {
  getNextRadiusOption,
  shouldShowMapEmptyState,
} from '@/components/MapPage/mapEmptyState'

const RADIUS_OPTIONS = [
  { id: '30', name: '30' },
  { id: '50', name: '50' },
  { id: '100', name: '100' },
]

describe('mapEmptyState.getNextRadiusOption', () => {
  it('returns the next wider preset for the current radius', () => {
    expect(getNextRadiusOption(RADIUS_OPTIONS, '50')).toEqual({ id: '100', name: '100' })
  })

  it('compares presets by value, not by reference type (number radius)', () => {
    expect(getNextRadiusOption(RADIUS_OPTIONS, 30)).toEqual({ id: '50', name: '50' })
  })

  it('returns null on the widest preset so the CTA can be hidden', () => {
    expect(getNextRadiusOption(RADIUS_OPTIONS, '100')).toBeNull()
  })

  it('falls back to the first preset when the current radius is unknown', () => {
    expect(getNextRadiusOption(RADIUS_OPTIONS, '77')).toEqual({ id: '30', name: '30' })
  })

  it('survives missing/empty option lists', () => {
    expect(getNextRadiusOption(undefined, '50')).toBeNull()
    expect(getNextRadiusOption([], '50')).toBeNull()
  })
})

describe('mapEmptyState.shouldShowMapEmptyState', () => {
  it('shows the empty state when a finished radius query returned nothing', () => {
    expect(shouldShowMapEmptyState({ mode: 'radius', totalPoints: 0, isBusy: false })).toBe(true)
  })

  // #211 — иначе «Ничего не нашлось» мигает во время рефетча/дебаунса.
  it('stays hidden while the query is still in flight', () => {
    expect(shouldShowMapEmptyState({ mode: 'radius', totalPoints: 0, isBusy: true })).toBe(false)
  })

  it('stays hidden when there are results', () => {
    expect(shouldShowMapEmptyState({ mode: 'radius', totalPoints: 12, isBusy: false })).toBe(false)
  })

  it('stays hidden in route mode (route has its own hint chrome)', () => {
    expect(shouldShowMapEmptyState({ mode: 'route', totalPoints: 0, isBusy: false })).toBe(false)
  })
})
