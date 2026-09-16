// #1899 — клиент `POST /api/routing/optimize/` поверх контракта v1 бэкенда #1951.
import {
  isFixedEndpointPermutation,
  optimizeRouteOrder,
  ROUTE_ORDER_INVALID_RESPONSE_CODE,
} from '@/api/routeOrderOptimization'

jest.mock('@/api/client', () => {
  class ApiError extends Error {
    status: number
    data?: unknown
    constructor(status: number, message: string, data?: unknown) {
      super(message)
      this.status = status
      this.data = data
    }
  }
  return { apiClient: { post: jest.fn() }, ApiError }
})

const { apiClient, ApiError } = jest.requireMock('@/api/client') as {
  apiClient: { post: jest.Mock }
  ApiError: new (status: number, message: string, data?: unknown) => Error & {
    status: number
    data?: unknown
  }
}

const points = [
  { lat: 53.9, lng: 27.56 },
  { lat: 52.09, lng: 23.73 },
  { lat: 53.68, lng: 23.83 },
  { lat: 55.19, lng: 30.2 },
]

const serverAnswer = (order: number[]) => ({
  order,
  provider: 'ors',
  is_optimized: true,
  objective: 'duration',
  fallback_reason: null,
  warnings: ['optimality_not_guaranteed', 'improvement_not_measured'],
})

describe('optimizeRouteOrder', () => {
  beforeEach(() => {
    apiClient.post.mockReset()
  })

  it('posts only the coordinates, transport and bike type to the optimize action', async () => {
    apiClient.post.mockResolvedValue(serverAnswer([0, 2, 1, 3]))

    const response = await optimizeRouteOrder({
      points,
      transport_mode: 'bike',
      bike_type: 'road',
    })

    expect(response.order).toEqual([0, 2, 1, 3])
    expect(apiClient.post).toHaveBeenCalledTimes(1)
    const [endpoint, body, timeout] = apiClient.post.mock.calls[0]
    expect(endpoint).toBe('/routing/optimize/')
    expect(body).toEqual({ points, transport_mode: 'bike', bike_type: 'road' })
    // Сервер сам отвечает 504 через 8 секунд — клиент не должен обрывать раньше.
    expect(timeout).toBeGreaterThan(8_000)
  })

  it.each([
    ['a partial order', [0, 2, 3]],
    ['a duplicated index', [0, 1, 1, 3]],
    ['a moved start', [1, 0, 2, 3]],
    ['a moved end', [0, 1, 3, 2]],
    ['an index outside the route', [0, 4, 1, 3]],
    ['a non-integer index', [0, 1.5, 2, 3]],
  ])('rejects %s instead of reordering the draft', async (_label, order) => {
    apiClient.post.mockResolvedValue(serverAnswer(order))

    await expect(optimizeRouteOrder({ points, transport_mode: 'car' })).rejects.toMatchObject({
      status: 502,
      data: { code: ROUTE_ORDER_INVALID_RESPONSE_CODE },
    })
  })

  it('rejects an empty body', async () => {
    apiClient.post.mockResolvedValue(null)

    await expect(optimizeRouteOrder({ points, transport_mode: 'foot' })).rejects.toMatchObject({
      data: { code: ROUTE_ORDER_INVALID_RESPONSE_CODE },
    })
  })

  it('passes a backend error through untouched', async () => {
    const error = new ApiError(503, 'unavailable', { code: 'provider_not_configured' })
    apiClient.post.mockRejectedValue(error)

    await expect(optimizeRouteOrder({ points, transport_mode: 'car' })).rejects.toBe(error)
  })
})

describe('isFixedEndpointPermutation', () => {
  it('accepts the identity and any inner permutation', () => {
    expect(isFixedEndpointPermutation([0, 1, 2], 3)).toBe(true)
    expect(isFixedEndpointPermutation([0, 3, 1, 2, 4], 5)).toBe(true)
  })

  it('rejects anything that is not an array of the route length', () => {
    expect(isFixedEndpointPermutation(undefined, 3)).toBe(false)
    expect(isFixedEndpointPermutation('0,1,2', 3)).toBe(false)
    expect(isFixedEndpointPermutation([0, 1, 2], 4)).toBe(false)
    expect(isFixedEndpointPermutation([], 0)).toBe(false)
  })
})
