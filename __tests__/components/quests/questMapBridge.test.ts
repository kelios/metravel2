import { parseQuestMapBridgeMessage } from '@/components/quests/questMapBridge'

describe('quest map bridge', () => {
  it('parses navigation, marker status and PNG events as discriminated messages', () => {
    expect(
      parseQuestMapBridgeMessage(
        JSON.stringify({ type: 'quest-map-nav', app: 'organic', lat: '50.06', lng: 19.94 }),
      ),
    ).toEqual({ type: 'quest-map-nav', app: 'organic', lat: 50.06, lng: 19.94 })

    expect(
      parseQuestMapBridgeMessage(
        JSON.stringify({
          type: 'quest-map-status',
          expectedMarkers: '3',
          markerNodes: 3,
          visibleMarkers: 2,
          settled: true,
        }),
      ),
    ).toEqual({
      type: 'quest-map-status',
      expectedMarkers: 3,
      markerNodes: 3,
      visibleMarkers: 2,
      settled: true,
    })

    expect(
      parseQuestMapBridgeMessage(
        JSON.stringify({ type: 'quest-map-png', ok: true, dataUrl: 'data:image/png;base64,AA==' }),
      ),
    ).toEqual({ type: 'quest-map-png', ok: true, dataUrl: 'data:image/png;base64,AA==' })
  })

  it('ignores unknown apps, invalid coordinates, malformed PNG data and non-JSON input', () => {
    expect(
      parseQuestMapBridgeMessage(
        JSON.stringify({ type: 'quest-map-nav', app: 'javascript', lat: 50, lng: 20 }),
      ),
    ).toBeNull()
    expect(
      parseQuestMapBridgeMessage(
        JSON.stringify({ type: 'quest-map-nav', app: 'osm', lat: 100, lng: 20 }),
      ),
    ).toBeNull()
    expect(
      parseQuestMapBridgeMessage(
        JSON.stringify({ type: 'quest-map-png', ok: 'yes', dataUrl: [] }),
      ),
    ).toBeNull()
    expect(parseQuestMapBridgeMessage('window.location="https://evil.test"')).toBeNull()
  })
})
