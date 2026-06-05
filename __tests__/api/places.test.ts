import { fetchPlacesCatalog } from '@/api/places'
import { fetchTravelsForMap } from '@/api/map'

jest.mock('@/api/map', () => ({
  fetchTravelsForMap: jest.fn(),
}))

const mockedFetchTravelsForMap = fetchTravelsForMap as jest.MockedFunction<typeof fetchTravelsForMap>

const pagePayload = (items: unknown[], total: number) => {
  const payload: Record<string, unknown> = {}
  items.forEach((item, index) => {
    payload[index] = item
  })
  Object.defineProperty(payload, '__total', {
    value: total,
    enumerable: false,
  })
  return payload
}

const makePlace = (id: number) => ({
  id,
  address: `Место ${id}, Беларусь`,
  categoryName: 'Замок',
  lat: String(53 + id / 1000),
  lng: String(27 + id / 1000),
  urlTravel: `/travels/place-${id}`,
})

describe('fetchPlacesCatalog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('loads every paginated catalog page when backend returns total count', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => makePlace(index + 1))
    const secondPage = [makePlace(1001), makePlace(1002)]

    mockedFetchTravelsForMap
      .mockResolvedValueOnce(pagePayload(firstPage, 1002) as any)
      .mockResolvedValueOnce(pagePayload(secondPage, 1002) as any)

    const places = await fetchPlacesCatalog()

    expect(places).toHaveLength(1002)
    expect(mockedFetchTravelsForMap).toHaveBeenCalledTimes(2)
    expect(mockedFetchTravelsForMap).toHaveBeenNthCalledWith(
      1,
      0,
      1000,
      expect.objectContaining({ radius: 20000 }),
      expect.objectContaining({ throwOnError: true }),
    )
    expect(mockedFetchTravelsForMap).toHaveBeenNthCalledWith(
      2,
      1,
      1000,
      expect.objectContaining({ radius: 20000 }),
      expect.objectContaining({ throwOnError: true }),
    )
  })

  it('keeps the single-request path for legacy unpaginated payloads', async () => {
    mockedFetchTravelsForMap.mockResolvedValueOnce([
      makePlace(1),
      makePlace(2),
    ] as any)

    const places = await fetchPlacesCatalog()

    expect(places).toHaveLength(2)
    expect(mockedFetchTravelsForMap).toHaveBeenCalledTimes(1)
  })
})
