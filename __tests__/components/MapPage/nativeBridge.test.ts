import {
  isSameViewportSnapshot,
  normalizeRoutePoint,
  parseNativeMapBridgeMessage,
} from '@/components/MapPage/Map/nativeBridge'

describe('native map bridge', () => {
  it('parses discriminated bridge events and coerces numeric transport fields', () => {
    expect(parseNativeMapBridgeMessage('{"type":"READY"}')).toEqual({ type: 'READY' })
    expect(
      parseNativeMapBridgeMessage(
        JSON.stringify({ type: 'TILE_REQ', z: '8', x: 140, y: 83 }),
      ),
    ).toEqual({ type: 'TILE_REQ', z: 8, x: 140, y: 83, key: '8/140/83' })
    // #1573 — SELECT_PLACE несёт стабильный placeKey места; legacy-сообщение без
    // него остаётся валидным (пустой ключ → резолв по id/coord/index).
    expect(
      parseNativeMapBridgeMessage(
        JSON.stringify({ type: 'SELECT_PLACE', id: 42, coord: ' 53.9,27.5 ' }),
      ),
    ).toEqual({ type: 'SELECT_PLACE', placeKey: '', index: null, id: '42', coord: '53.9,27.5' })
  })

  it('normalizes move and viewport data through finite coordinate contracts', () => {
    const message = parseNativeMapBridgeMessage(
      JSON.stringify({
        type: 'MAP_MOVED',
        lat: 53.9,
        lng: 27.56,
        zoom: 12,
        userInitiated: true,
        bbox: { south: 53, west: 27, north: 54, east: 28 },
      }),
    )

    expect(message).toEqual({
      type: 'MAP_MOVED',
      move: {
        latitude: 53.9,
        longitude: 27.56,
        zoom: 12,
        userInitiated: true,
        bbox: { south: 53, west: 27, north: 54, east: 28 },
      },
      viewport: {
        zoom: 12,
        bbox: { south: 53, west: 27, north: 54, east: 28 },
      },
    })
  })

  it('ignores unknown, malformed and invalid-coordinate events', () => {
    expect(parseNativeMapBridgeMessage('{not-json')).toBeNull()
    expect(parseNativeMapBridgeMessage('{"type":"EVAL","code":"alert(1)"}')).toBeNull()
    expect(parseNativeMapBridgeMessage('{"type":"MAP_CLICK","lat":91,"lng":27}')).toBeNull()
    expect(parseNativeMapBridgeMessage('{"type":"OPEN_URL","url":{"bad":true}}')).toBeNull()
  })

  it('normalizes route point order and compares viewport snapshots with tolerance', () => {
    expect(normalizeRoutePoint([27.56, 53.9])).toEqual([53.9, 27.56])
    expect(normalizeRoutePoint([181, 53.9])).toBeNull()
    const snapshot = { zoom: 10, bbox: { south: 53, west: 27, north: 54, east: 28 } }
    expect(isSameViewportSnapshot(snapshot, { ...snapshot, zoom: 10.005 })).toBe(true)
    expect(isSameViewportSnapshot(snapshot, { ...snapshot, zoom: 10.02 })).toBe(false)
  })

  // #1781 — точки маршрута планировщика правятся прямо с карты: WebView отдаёт
  // индекс точки и позицию дропа. Мусорный индекс и нефинитная координата не
  // должны доехать до владельца маршрута ни в каком виде.
  it('parses route point drag and tap events and rejects unusable payloads', () => {
    expect(
      parseNativeMapBridgeMessage(
        JSON.stringify({ type: 'ROUTE_POINT_MOVED', index: 2, lat: '53.91', lng: 27.6 }),
      ),
    ).toEqual({ type: 'ROUTE_POINT_MOVED', index: 2, latitude: 53.91, longitude: 27.6 })
    expect(parseNativeMapBridgeMessage(JSON.stringify({ type: 'ROUTE_POINT_TAP', index: 0 }))).toEqual({
      type: 'ROUTE_POINT_TAP',
      index: 0,
    })

    expect(
      parseNativeMapBridgeMessage(
        JSON.stringify({ type: 'ROUTE_POINT_MOVED', index: 1, lat: 'нет', lng: 27.6 }),
      ),
    ).toBeNull()
    expect(
      parseNativeMapBridgeMessage(
        JSON.stringify({ type: 'ROUTE_POINT_MOVED', index: 1.5, lat: 53.9, lng: 27.6 }),
      ),
    ).toBeNull()
    expect(
      parseNativeMapBridgeMessage(JSON.stringify({ type: 'ROUTE_POINT_TAP', index: -1 })),
    ).toBeNull()
  })
})
