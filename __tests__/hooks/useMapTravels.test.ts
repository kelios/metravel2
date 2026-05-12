import { dedupeMapTravels, getMapTravelIdentity } from '@/hooks/map/useMapTravels'

describe('useMapTravels helpers', () => {
  it('builds a stable identity from url-like fields when id is absent', () => {
    expect(
      getMapTravelIdentity({
        url: 'https://metravel.by/travels/forty-krakova?id=435',
      } as any),
    ).toBe('url:https://metravel.by/travels/forty-krakova?id=435')
  })

  it('dedupes repeated travels returned with the same public url', () => {
    const duplicatedUrl = 'https://metravel.by/travels/forty-krakova?id=435'

    const result = dedupeMapTravels([
      {
        url: duplicatedUrl,
        address: 'Forty Krakova',
      } as any,
      {
        url: duplicatedUrl,
        address: 'Forty Krakova duplicate payload',
      } as any,
      {
        url: 'https://metravel.by/travels/other-place?id=436',
        address: 'Other place',
      } as any,
    ])

    expect(result).toHaveLength(2)
    expect(result.map((item) => (item as any).url)).toEqual([
      duplicatedUrl,
      'https://metravel.by/travels/other-place?id=436',
    ])
  })

  it('keeps distinct travels when only coordinates match but ids differ', () => {
    const result = dedupeMapTravels([
      {
        id: 101,
        coord: '53.1,27.1',
        address: 'Point A',
      } as any,
      {
        id: 102,
        coord: '53.1,27.1',
        address: 'Point B',
      } as any,
    ])

    expect(result).toHaveLength(2)
    expect(result.map((item) => (item as any).id)).toEqual([101, 102])
  })
})

