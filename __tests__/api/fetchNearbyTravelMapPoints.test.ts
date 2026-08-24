import { fetchNearbyTravelMapPoints } from '@/api/map'
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'

jest.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(),
}))

const mockedFetchWithTimeout = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>

const responseWithJson = (payload: unknown): Response => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  text: jest.fn(async () => JSON.stringify(payload)),
} as unknown as Response)

describe('fetchNearbyTravelMapPoints', () => {
  beforeEach(() => {
    mockedFetchWithTimeout.mockReset()
  })

  it('queries the light catalog by slug and keeps only exact nearby travel points', async () => {
    mockedFetchWithTimeout.mockResolvedValueOnce(responseWithJson([
      {
        id: 11,
        coord: '50.061,19.938',
        title: 'Nearby route',
        countryName: 'Poland',
        travelImageThumbUrl: '/address-image/11/',
        travel: { id: 301, slug: 'nearby-route' },
        urlTravel: '/travels/nearby-route',
      },
      {
        id: 12,
        coord: '51.1,20.2',
        title: 'Different route',
        travel: { id: 999, slug: 'different-route' },
      },
    ]))

    const points = await fetchNearbyTravelMapPoints(
      { lat: 50.05, lng: 19.94 },
      [{ id: 301, slug: 'nearby-route' }],
    )

    expect(points).toEqual([
      {
        id: '11',
        coord: '50.061,19.938',
        address: 'Nearby route',
        travelImageThumbUrl: 'https://metravel.by/address-image/11/',
        categoryName: 'Poland',
        urlTravel: '/travels/nearby-route',
      },
    ])
    expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(1)

    const requestedUrl = new URL(String(mockedFetchWithTimeout.mock.calls[0]?.[0]))
    expect(requestedUrl.pathname).toContain('/travels/search_travels_for_map_lite/')
    expect(JSON.parse(requestedUrl.searchParams.get('where') ?? '{}')).toEqual({
      lat: 50.05,
      lng: 19.94,
      radius: 60,
      publish: true,
      moderation: true,
      query: 'nearby-route',
    })
  })

  it('does not request the map catalog without a valid origin or travel slug', async () => {
    await expect(fetchNearbyTravelMapPoints(
      { lat: Number.NaN, lng: 19.94 },
      [{ id: 301, slug: 'nearby-route' }],
    )).resolves.toEqual([])
    await expect(fetchNearbyTravelMapPoints(
      { lat: 50.05, lng: 19.94 },
      [{ id: 301, slug: '' }],
    )).resolves.toEqual([])
    expect(mockedFetchWithTimeout).not.toHaveBeenCalled()
  })

  it('rejects when every target request fails but preserves partial success', async () => {
    mockedFetchWithTimeout.mockRejectedValueOnce(new TypeError('Network request failed'))

    await expect(fetchNearbyTravelMapPoints(
      { lat: 50.05, lng: 19.94 },
      [{ id: 301, slug: 'nearby-route' }],
    )).rejects.toThrow('Network request failed')

    mockedFetchWithTimeout
      .mockResolvedValueOnce(responseWithJson([
        {
          id: 11,
          coord: '50.061,19.938',
          title: 'Nearby route',
          travel: { id: 301, slug: 'nearby-route' },
        },
      ]))
      .mockRejectedValueOnce(new TypeError('Second request failed'))

    await expect(fetchNearbyTravelMapPoints(
      { lat: 50.05, lng: 19.94 },
      [
        { id: 301, slug: 'nearby-route' },
        { id: 302, slug: 'other-nearby-route' },
      ],
    )).resolves.toEqual([
      expect.objectContaining({ id: '11', coord: '50.061,19.938' }),
    ])
  })
})
