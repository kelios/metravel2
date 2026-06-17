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

  it('keeps distinct points of the same travel (same urlTravel, different coord)', () => {
    const urlTravel = 'https://metravel.by/travels/krakow?id=435'

    const result = dedupeMapTravels([
      { urlTravel, coord: '50.06,19.93', address: 'Point A' } as any,
      { urlTravel, coord: '50.07,19.95', address: 'Point B' } as any,
      { urlTravel, coord: '50.08,19.99', address: 'Point C' } as any,
    ])

    expect(result).toHaveLength(3)
    expect(result.map((item) => (item as any).address)).toEqual([
      'Point A',
      'Point B',
      'Point C',
    ])
  })

  it('removes exact duplicate points (same urlTravel and same coord)', () => {
    const urlTravel = 'https://metravel.by/travels/krakow?id=435'

    const result = dedupeMapTravels([
      { urlTravel, coord: '50.06,19.93', address: 'Point A' } as any,
      { urlTravel, coord: '50.06,19.93', address: 'Point A duplicate payload' } as any,
      { urlTravel, coord: '50.07,19.95', address: 'Point B' } as any,
    ])

    expect(result).toHaveLength(2)
    expect(result.map((item) => (item as any).coord)).toEqual([
      '50.06,19.93',
      '50.07,19.95',
    ])
  })

  it('derives point coord identity from lat+lng when coord field is absent', () => {
    const urlTravel = 'https://metravel.by/travels/krakow?id=435'

    const result = dedupeMapTravels([
      { urlTravel, lat: '50.06', lng: '19.93', address: 'Point A' } as any,
      { urlTravel, lat: '50.07', lng: '19.95', address: 'Point B' } as any,
      { urlTravel, lat: '50.06', lng: '19.93', address: 'Point A duplicate' } as any,
    ])

    expect(result).toHaveLength(2)
    expect(result.map((item) => (item as any).address)).toEqual([
      'Point A',
      'Point B',
    ])
  })

  it('keeps coord-less url payload deduped by url only', () => {
    const urlTravel = 'https://metravel.by/travels/krakow?id=435'

    const result = dedupeMapTravels([
      { urlTravel, address: 'No coords A' } as any,
      { urlTravel, address: 'No coords B' } as any,
    ])

    expect(result).toHaveLength(1)
  })
})

