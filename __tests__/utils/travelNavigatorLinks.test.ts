import {
  TRAVEL_NAVIGATOR_PROVIDERS,
  buildTravelNavigatorUrl,
  getTravelRouteWaypoints,
  hasTravelRouteForNavigation,
} from '@/utils/travelNavigatorLinks'

describe('travelNavigatorLinks (#2902)', () => {
  // `coord` в API — строка "lat,lng"; порядок точек — авторский.
  const travelAddress = [
    { id: 1, name: 'Минск', coords: '53.9,27.56' },
    { id: 2, name: 'Без координат', coords: '' },
    { id: 3, name: 'Заславль', coord: '53.95, 27.6' },
    { id: 4, name: 'Логойск', coord: '54.0,27.7' },
  ]

  it('reads ordered waypoints through the shared travel-points parser and skips invalid ones', () => {
    const waypoints = getTravelRouteWaypoints(travelAddress)
    expect(waypoints.map((w) => w.coordinates)).toEqual([
      [27.56, 53.9],
      [27.6, 53.95],
      [27.7, 54.0],
    ])
  })

  it('requires at least two valid points', () => {
    expect(hasTravelRouteForNavigation(getTravelRouteWaypoints([travelAddress[0], travelAddress[1]]))).toBe(false)
    expect(hasTravelRouteForNavigation(getTravelRouteWaypoints(travelAddress))).toBe(true)
    expect(buildTravelNavigatorUrl('google', getTravelRouteWaypoints([travelAddress[0]]))).toBeNull()
    expect(hasTravelRouteForNavigation(getTravelRouteWaypoints(undefined))).toBe(false)
  })

  it('lists the four providers in the mock order', () => {
    expect(TRAVEL_NAVIGATOR_PROVIDERS).toEqual(['google', 'yandex', 'apple', 'osmand'])
  })

  const waypoints = getTravelRouteWaypoints(travelAddress)

  it('builds a Google Maps directions URL with origin, destination and waypoints', () => {
    const url = new URL(buildTravelNavigatorUrl('google', waypoints)!)
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/')
    expect(url.searchParams.get('api')).toBe('1')
    expect(url.searchParams.get('origin')).toBe('53.9,27.56')
    expect(url.searchParams.get('destination')).toBe('54,27.7')
    expect(url.searchParams.get('waypoints')).toBe('53.95,27.6')
  })

  it('caps Google intermediate waypoints at 9', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ coord: `53.${i + 10},27.5` }))
    const url = new URL(buildTravelNavigatorUrl('google', getTravelRouteWaypoints(many))!)
    expect(url.searchParams.get('waypoints')!.split('|')).toHaveLength(9)
    expect(url.searchParams.get('destination')).toBe('53.24,27.5')
  })

  it('builds a Yandex Maps rtext route with all points in order', () => {
    expect(buildTravelNavigatorUrl('yandex', waypoints)).toBe(
      'https://yandex.ru/maps/?rtext=53.9,27.56~53.95,27.6~54,27.7&rtt=auto',
    )
  })

  it('builds an Apple Maps origin to destination leg', () => {
    const url = new URL(buildTravelNavigatorUrl('apple', waypoints)!)
    expect(url.host).toBe('maps.apple.com')
    expect(url.searchParams.get('saddr')).toBe('53.9,27.56')
    expect(url.searchParams.get('daddr')).toBe('54,27.7')
    expect(url.searchParams.get('dirflg')).toBe('d')
  })

  it('builds an OsmAnd navigate link with start, end, via and profile', () => {
    expect(buildTravelNavigatorUrl('osmand', waypoints)).toBe(
      'https://osmand.net/map/navigate/?start=53.9,27.56&end=54,27.7&via=53.95,27.6&profile=car#10/53.9/27.56',
    )
  })
})
