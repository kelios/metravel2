import { runClusterClick } from '@/components/MapPage/Map/MarkerClusterGroup'

type FakeBounds = {
  isValid: () => boolean
  getNorthEast: () => { equals: (o: any) => boolean }
  getSouthWest: () => { equals: (o: any) => boolean }
  getCenter: () => { lat: number; lng: number }
}

const makeBounds = (degenerate = false): FakeBounds => {
  const ne = { lat: 53.91, lng: 27.57, equals: () => degenerate }
  const sw = { lat: 53.9, lng: 27.56, equals: () => degenerate }
  return {
    isValid: () => true,
    getNorthEast: () => ne,
    getSouthWest: () => sw,
    getCenter: () => ({ lat: 53.905, lng: 27.565 }),
  }
}

const makeClusterLayer = (bounds: FakeBounds | null) => ({
  getBounds: bounds ? () => bounds : undefined,
  spiderfy: jest.fn(),
})

const makeMap = (overrides: Record<string, any> = {}) => ({
  getContainer: () => ({ clientWidth: 375, clientHeight: 667 }),
  getMaxZoom: () => 19,
  getZoom: () => 11,
  getBoundsZoom: jest.fn(() => 14),
  fitBounds: jest.fn(),
  setView: jest.fn(),
  ...overrides,
})

describe('runClusterClick (mobile cluster zoom)', () => {
  it('zooms IN to bounds when getBoundsZoom is higher than current zoom', () => {
    const map = makeMap()
    const cluster = makeClusterLayer(makeBounds())

    runClusterClick(map, cluster)

    expect(map.fitBounds).toHaveBeenCalledTimes(1)
    expect(cluster.spiderfy).not.toHaveBeenCalled()
  })

  it('clamps padding so it never exceeds the mobile container (regression: empty map)', () => {
    // height 667 → MAX_PADDING_FRACTION 0.4 → 266.8 cap. The mobile preset uses
    // paddingBottomRight [16, 224] which is under the cap, but on a SHORT viewport
    // the cap must bite. Use a very short viewport to force clamping.
    const map = makeMap({ getContainer: () => ({ clientWidth: 375, clientHeight: 400 }) })
    const cluster = makeClusterLayer(makeBounds())

    runClusterClick(map, cluster)

    const opts = map.fitBounds.mock.calls[0][1]
    // 0.4 * 400 = 160 → bottom padding (224) must be clamped to <= 160.
    expect(opts.paddingBottomRight[1]).toBeLessThanOrEqual(160)
    expect(opts.paddingTopLeft[1]).toBeLessThanOrEqual(160)
  })

  it('never zooms OUT: falls back to current+1 when getBoundsZoom <= current zoom', () => {
    // The core bug: getBoundsZoom returns a zoom <= current (degenerate bounds +
    // large padding). fitBounds would then zoom the map OUT and hide all markers.
    const map = makeMap({ getZoom: () => 13, getBoundsZoom: jest.fn(() => 9) })
    const cluster = makeClusterLayer(makeBounds())

    runClusterClick(map, cluster)

    expect(map.fitBounds).not.toHaveBeenCalled()
    expect(map.setView).toHaveBeenCalledTimes(1)
    const targetZoom = map.setView.mock.calls[0][1]
    expect(targetZoom).toBe(14) // current 13 + 1, never the 9 that would zoom out
  })

  it('never zooms OUT: falls back when getBoundsZoom returns a non-finite value', () => {
    const map = makeMap({ getZoom: () => 12, getBoundsZoom: jest.fn(() => NaN) })
    const cluster = makeClusterLayer(makeBounds())

    runClusterClick(map, cluster)

    expect(map.fitBounds).not.toHaveBeenCalled()
    expect(map.setView).toHaveBeenCalledWith(
      expect.anything(),
      13,
      expect.objectContaining({ animate: true }),
    )
  })

  it('spiderfies a degenerate (single-coordinate) cluster instead of fitting bounds', () => {
    const map = makeMap()
    const cluster = makeClusterLayer(makeBounds(true))

    runClusterClick(map, cluster)

    expect(cluster.spiderfy).toHaveBeenCalledTimes(1)
    expect(map.fitBounds).not.toHaveBeenCalled()
  })

  it('spiderfies when already at max zoom and points stay clustered', () => {
    const map = makeMap({
      getZoom: () => 16,
      getMaxZoom: () => 16,
      getBoundsZoom: jest.fn(() => 16),
    })
    const cluster = makeClusterLayer(makeBounds())

    runClusterClick(map, cluster)

    expect(cluster.spiderfy).toHaveBeenCalledTimes(1)
    expect(map.fitBounds).not.toHaveBeenCalled()
  })

  it('is a no-op for an invalid cluster layer', () => {
    const map = makeMap()
    expect(() => runClusterClick(map, null)).not.toThrow()
    expect(() => runClusterClick(map, makeClusterLayer(null))).not.toThrow()
    expect(map.fitBounds).not.toHaveBeenCalled()
  })
})
