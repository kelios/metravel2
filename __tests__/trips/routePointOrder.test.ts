// #1899 — чистая часть предложения порядка точек маршрута.
import type { RoutePoint } from '@/api/plannedTrips'
import {
  applyRouteOrderMoves,
  buildRouteOrderRequest,
  isIdentityOrder,
  routeOrderAvailability,
  routeOrderErrorKind,
  routeOrderMoves,
  routeOrderPreviewRows,
  routeOrderSnapshotKey,
} from '@/components/trips/planning/routePointOrder'
import { remapIndexAfterMove } from '@/components/trips/planning/routePointReorder'

const point = (index: number, coordinates: RoutePoint['coordinates'] = [27 + index, 53 + index / 10]): RoutePoint => ({
  id: `p${index}`,
  type: 'custom',
  name: `Point ${index + 1}`,
  description: null,
  coordinates,
  placeId: null,
})

const route = (length: number) => Array.from({ length }, (_, index) => point(index))

describe('routeOrderAvailability', () => {
  it('hides the action for unroutable transport and for one or two points', () => {
    expect(routeOrderAvailability(route(6), 'public')).toBe('hidden')
    expect(routeOrderAvailability(route(6), 'mixed')).toBe('hidden')
    expect(routeOrderAvailability(route(2), 'car')).toBe('hidden')
    expect(routeOrderAvailability([], 'foot')).toBe('hidden')
  })

  it('explains three points instead of spending a request on a fixed answer', () => {
    expect(routeOrderAvailability(route(3), 'bike')).toBe('tooFew')
  })

  it('is ready from four points up to the contract limit', () => {
    expect(routeOrderAvailability(route(4), 'car')).toBe('ready')
    expect(routeOrderAvailability(route(50), 'foot')).toBe('ready')
    expect(routeOrderAvailability(route(51), 'foot')).toBe('tooMany')
  })

  it('requires coordinates on every point', () => {
    const withGap = route(5)
    withGap[2] = point(2, null)
    expect(routeOrderAvailability(withGap, 'car')).toBe('needCoordinates')

    const withNaN = route(5)
    withNaN[3] = point(3, [Number.NaN, 53])
    expect(routeOrderAvailability(withNaN, 'car')).toBe('needCoordinates')
  })
})

describe('buildRouteOrderRequest', () => {
  it('sends coordinates as lat/lng in draft order without ids or names', () => {
    const request = buildRouteOrderRequest(route(4), 'car', null)
    expect(request).toEqual({
      points: [
        { lat: 53, lng: 27 },
        { lat: 53.1, lng: 28 },
        { lat: 53.2, lng: 29 },
        { lat: 53.3, lng: 30 },
      ],
      transport_mode: 'car',
    })
  })

  it('adds bike_type only for a bicycle trip with a known type', () => {
    expect(buildRouteOrderRequest(route(4), 'bike', 'mountain')).toMatchObject({
      transport_mode: 'bike',
      bike_type: 'mountain',
    })
    expect(buildRouteOrderRequest(route(4), 'bike', null)).not.toHaveProperty('bike_type')
    expect(buildRouteOrderRequest(route(4), 'foot', 'road')).not.toHaveProperty('bike_type')
  })

  it('builds nothing when a point lacks coordinates or transport is not routable', () => {
    const withGap = route(4)
    withGap[1] = point(1, null)
    expect(buildRouteOrderRequest(withGap, 'car', null)).toBeNull()
    expect(buildRouteOrderRequest(route(4), 'public', null)).toBeNull()
  })
})

describe('routeOrderSnapshotKey', () => {
  const base = route(4)
  const key = routeOrderSnapshotKey(base, 'bike', 'regular')

  it('changes with the order, coordinates, transport and bike type', () => {
    expect(routeOrderSnapshotKey([base[0], base[2], base[1], base[3]], 'bike', 'regular')).not.toBe(key)
    expect(
      routeOrderSnapshotKey(base.map((item, index) => (index === 1 ? { ...item, coordinates: [28.5, 53.1] } : item)), 'bike', 'regular'),
    ).not.toBe(key)
    expect(routeOrderSnapshotKey(base, 'car', 'regular')).not.toBe(key)
    expect(routeOrderSnapshotKey(base, 'bike', 'road')).not.toBe(key)
  })

  it('ignores names and the bike type of a non-bicycle trip', () => {
    expect(routeOrderSnapshotKey(base.map((item) => ({ ...item, name: 'Renamed' })), 'bike', 'regular')).toBe(key)
    expect(routeOrderSnapshotKey(base, 'car', 'road')).toBe(routeOrderSnapshotKey(base, 'car', null))
  })
})

describe('applying a suggested order', () => {
  const orders = [
    [0, 1, 2, 3],
    [0, 2, 1, 3],
    [0, 3, 1, 2, 4],
    [0, 4, 3, 2, 1, 5],
    [0, 5, 2, 6, 1, 4, 3, 7],
  ]

  it.each(orders.map((order) => [order]))('produces exactly the permutation %j through moveItem', (order) => {
    const list = order.map((_, index) => `item-${index}`)
    const moves = routeOrderMoves(order)
    expect(applyRouteOrderMoves(list, moves)).toEqual(order.map((sourceIndex) => list[sourceIndex]))
    expect(moves.length).toBeLessThan(order.length)
  })

  it('makes no moves for the identity order', () => {
    expect(isIdentityOrder([0, 1, 2, 3])).toBe(true)
    expect(isIdentityOrder([0, 2, 1, 3])).toBe(false)
    expect(routeOrderMoves([0, 1, 2, 3])).toEqual([])
  })

  it('keeps an open editor on its own point when every move goes through the reorder entry point', () => {
    const order = [0, 5, 2, 6, 1, 4, 3, 7]
    const moves = routeOrderMoves(order)
    // Ровно то, что делает `RouteBuilder.handleReorder` на каждый ход.
    const follow = (index: number | null) =>
      moves.reduce<number | null>((current, [from, to]) => remapIndexAfterMove(current, from, to), index)
    order.forEach((sourceIndex, target) => {
      expect(follow(sourceIndex)).toBe(target)
    })
    expect(follow(null)).toBeNull()
  })

  it('does not mutate the draft it is applied to', () => {
    const list = ['a', 'b', 'c', 'd']
    const moves = routeOrderMoves([0, 2, 1, 3])
    expect(applyRouteOrderMoves(list, moves)).toEqual(['a', 'c', 'b', 'd'])
    expect(list).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('routeOrderPreviewRows', () => {
  it('lists points in the suggested order with their previous positions', () => {
    expect(routeOrderPreviewRows(route(4), [0, 2, 1, 3])).toEqual([
      { key: '0:p0', position: 1, previousPosition: 1, name: 'Point 1', moved: false },
      { key: '1:p2', position: 2, previousPosition: 3, name: 'Point 3', moved: true },
      { key: '2:p1', position: 3, previousPosition: 2, name: 'Point 2', moved: true },
      { key: '3:p3', position: 4, previousPosition: 4, name: 'Point 4', moved: false },
    ])
  })
})

describe('routeOrderErrorKind', () => {
  const apiError = (status: number, data?: unknown) => Object.assign(new Error('failed'), { status, data })

  it.each([
    [apiError(400, { code: 'INVALID_OPTIMIZATION_REQUEST' }), 'invalidRequest'],
    [apiError(401, { detail: 'Authentication credentials were not provided.' }), 'authRequired'],
    [apiError(403, { detail: 'CSRF Failed' }), 'authRequired'],
    [apiError(404, null), 'unavailable'],
    [apiError(422, { code: 'optimization_incomplete' }), 'incomplete'],
    [apiError(422, { code: 'provider_profile_unsupported' }), 'profileUnsupported'],
    [apiError(429, { code: 'optimization_rate_limited' }), 'rateLimited'],
    [apiError(429, { code: 'provider_rate_limited' }), 'rateLimited'],
    [apiError(502, { code: 'provider_unavailable' }), 'unavailable'],
    [apiError(502, { code: 'provider_response_invalid' }), 'unavailable'],
    [apiError(503, { code: 'provider_not_configured' }), 'unavailable'],
    [apiError(503, { code: 'provider_access_denied' }), 'unavailable'],
    [apiError(504, { code: 'provider_timeout' }), 'timeout'],
    [apiError(504, '<html>Gateway Time-out</html>'), 'timeout'],
    [apiError(0, { offline: true }), 'offline'],
    [Object.assign(new Error('Превышено время ожидания'), { name: 'TimeoutError' }), 'timeout'],
    [new Error('boom'), 'unavailable'],
    [undefined, 'unavailable'],
  ])('maps %p to %s', (error, kind) => {
    expect(routeOrderErrorKind(error)).toBe(kind)
  })
})
