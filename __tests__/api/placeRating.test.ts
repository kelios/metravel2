jest.mock('@/api/client', () => ({
  apiClient: { post: jest.fn(), get: jest.fn() },
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message?: string) {
      super(message ?? String(status))
      this.status = status
      this.name = 'ApiError'
    }
  },
}))

jest.mock('@/utils/logger', () => ({
  devWarn: jest.fn(),
  devLog: jest.fn(),
  devError: jest.fn(),
}))

import { apiClient } from '@/api/client'
import { ratePlace, getPlaceRating } from '@/api/placeRating'

const mockedPost = apiClient.post as jest.Mock
const mockedGet = apiClient.get as jest.Mock

const aggregate = { rating: 4.6, rating_count: 128, user_rating: 5 }

describe('placeRating API', () => {
  beforeEach(() => jest.clearAllMocks())

  it('POSTs a rating to /places/{id}/rating/ and returns the aggregate', async () => {
    mockedPost.mockResolvedValueOnce(aggregate)
    const res = await ratePlace({ placeId: '1039', rating: 5 })
    expect(mockedPost).toHaveBeenCalledWith('/places/1039/rating/', { rating: 5 })
    expect(res).toEqual(aggregate)
  })

  it('rejects out-of-range ratings before any request', async () => {
    await expect(ratePlace({ placeId: 1, rating: 0 })).rejects.toBeInstanceOf(Error)
    await expect(ratePlace({ placeId: 1, rating: 6 })).rejects.toBeInstanceOf(Error)
    expect(mockedPost).not.toHaveBeenCalled()
  })

  it('URL-encodes the place id in the path', async () => {
    mockedPost.mockResolvedValueOnce(aggregate)
    await ratePlace({ placeId: 'a/b 1', rating: 3 })
    expect(mockedPost).toHaveBeenCalledWith('/places/a%2Fb%201/rating/', { rating: 3 })
  })

  it('GETs the aggregate + user rating from /places/{id}/rating/', async () => {
    mockedGet.mockResolvedValueOnce(aggregate)
    const res = await getPlaceRating(1039)
    expect(mockedGet).toHaveBeenCalledWith('/places/1039/rating/')
    expect(res).toEqual(aggregate)
  })
})
