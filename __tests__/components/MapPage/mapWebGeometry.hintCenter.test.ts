import { getHintCenterLatLng } from '@/components/MapPage/Map/mapWebGeometry'
import { strToLatLng } from '@/components/MapPage/Map/utils'

// #3397 — the order hint resolves loosely written catalog coordinates by distance
// to the search anchor. A points-only surface writes canonical "lat,lng"; with the
// centroid of a continent-wide quest catalog as the hint, every pair lying nearer
// to it when swapped (Tbilisi, Tashkent, Dubai…) was drawn at the mirrored spot.
describe('getHintCenterLatLng', () => {
  const circle = { lat: 53.9, lng: 27.56 }
  const anchor = { lat: 49.37, lng: 26.28 }

  it('uses the circle centre, then the anchor, for a radius search', () => {
    expect(getHintCenterLatLng('radius', circle, anchor)).toBe(circle)
    expect(getHintCenterLatLng('radius', null, anchor)).toBe(anchor)
    expect(getHintCenterLatLng('route', circle, anchor)).toBe(anchor)
  })

  it('gives a points-only surface no hint', () => {
    expect(getHintCenterLatLng('radius', circle, anchor, true)).toBeNull()
  })

  it('keeps a canonical pair where the catalog centroid would mirror it', () => {
    const tbilisi = '41.7151,44.8271'
    const [mirroredLng, mirroredLat] = strToLatLng(tbilisi, anchor) as [number, number]
    expect([mirroredLat, mirroredLng]).toEqual([44.8271, 41.7151])

    const [lng, lat] = strToLatLng(tbilisi, getHintCenterLatLng('radius', null, anchor, true)) as [number, number]
    expect([lat, lng]).toEqual([41.7151, 44.8271])
  })
})
