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

  it('requests six routes in one batch and keeps only their points', async () => {
    mockedFetchWithTimeout.mockResolvedValueOnce(responseWithJson({ results: [
      {
        id: 11,
        lat: 50.061,
        lng: 19.938,
        title: 'Nearby route',
        countryName: 'Poland',
        travelImageThumbUrl: '/address-image/11/',
        travel_id: 301,
        urlTravel: '/travels/nearby-route',
      },
      {
        id: 12,
        coord: '51.1,20.2',
        title: 'Different route',
        travel_id: 999,
      },
    ] }))

    const points = await fetchNearbyTravelMapPoints(
      { lat: 50.05, lng: 19.94 },
      [301, 302, 303, 304, 305, 306],
    )

    expect(points).toEqual([
      {
        id: '11',
        coord: '50.061,19.938',
        address: 'Nearby route',
        travelImageThumbUrl: 'https://metravel.by/address-image/11/',
        categoryName: 'Poland',
        urlTravel: '/travels/nearby-route',
        // #1960: id статьи из `travel_id` — попап карты «Рядом» не запрашивает её по slug.
        travelId: 301,
      },
    ])
    expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(1)

    const requestedUrl = new URL(String(mockedFetchWithTimeout.mock.calls[0]?.[0]))
    expect(requestedUrl.pathname).toBe('/api/travels/nearby-map-points/')
    expect(Object.fromEntries(requestedUrl.searchParams)).toEqual({
      travel_ids: '301,302,303,304,305,306',
      lat: '50.05',
      lng: '19.94',
    })
  })

  it('skips the request without valid coordinates or route ids', async () => {
    await expect(fetchNearbyTravelMapPoints({ lat: Number.NaN, lng: 19.94 }, [301]))
      .resolves.toEqual([])
    await expect(fetchNearbyTravelMapPoints({ lat: 50.05, lng: 19.94 }, [0, -1]))
      .resolves.toEqual([])
    expect(mockedFetchWithTimeout).not.toHaveBeenCalled()
  })

  it('distinguishes an empty result from an invalid response', async () => {
    const origin = { lat: 50.05, lng: 19.94 }
    mockedFetchWithTimeout.mockResolvedValueOnce(responseWithJson({ results: [] }))
    await expect(fetchNearbyTravelMapPoints(origin, [301])).resolves.toEqual([])
    mockedFetchWithTimeout.mockResolvedValueOnce(responseWithJson({ results: null }))
    await expect(fetchNearbyTravelMapPoints(origin, [301])).rejects.toMatchObject({
      data: { code: 'INVALID_NEARBY_MAP_RESPONSE' },
    })
  })

  it('propagates cancellation', async () => {
    const abortError = new Error('Aborted')
    abortError.name = 'AbortError'
    mockedFetchWithTimeout.mockRejectedValueOnce(abortError)
    await expect(fetchNearbyTravelMapPoints({ lat: 50.05, lng: 19.94 }, [301, 302]))
      .rejects.toBe(abortError)
    expect(mockedFetchWithTimeout).toHaveBeenCalledTimes(1)
  })
})
