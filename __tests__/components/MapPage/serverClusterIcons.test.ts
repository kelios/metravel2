import {
  getServerClusterIcon,
  getServerClusterIconKey,
} from '@/components/MapPage/Map/serverClusterIcons'

// #2451 — one divIcon per visual class (size|label|theme).
describe('getServerClusterIcon', () => {
  const makeLeaflet = () => ({ divIcon: jest.fn((options: any) => ({ options })) })

  it('builds one divIcon per class and returns the same instance afterwards', () => {
    const L = makeLeaflet()
    const first = getServerClusterIcon(L, 37, false)
    const again = getServerClusterIcon(L, 37, false)

    expect(again).toBe(first)
    expect(L.divIcon).toHaveBeenCalledTimes(1)
  })

  it('separates classes by label, size bucket and theme', () => {
    const L = makeLeaflet()
    const light = getServerClusterIcon(L, 37, false)
    const dark = getServerClusterIcon(L, 37, true)
    const other = getServerClusterIcon(L, 38, false)

    expect(new Set([light, dark, other]).size).toBe(3)
    expect(L.divIcon).toHaveBeenCalledTimes(3)
    expect(getServerClusterIconKey(37, false)).toBe('56|37|light')
    expect(getServerClusterIconKey(5000, true)).toBe('68|999+|dark')
  })

  it('shares the capped 999+ class between all huge counts', () => {
    const L = makeLeaflet()
    expect(getServerClusterIcon(L, 1200, false)).toBe(getServerClusterIcon(L, 4800, false))
    expect(L.divIcon).toHaveBeenCalledTimes(1)
  })

  it('keeps caches per Leaflet namespace and tolerates a missing one', () => {
    const a = makeLeaflet()
    const b = makeLeaflet()
    expect(getServerClusterIcon(a, 10, false)).not.toBe(getServerClusterIcon(b, 10, false))
    expect(getServerClusterIcon(null, 10, false)).toBeUndefined()
  })

  it('centres the icon on the cluster point', () => {
    const L = makeLeaflet()
    const icon = getServerClusterIcon(L, 64, false)
    expect(icon.options).toEqual(
      expect.objectContaining({
        className: 'metravel-cluster-icon',
        iconSize: [62, 62],
        iconAnchor: [31, 31],
      }),
    )
  })
})
