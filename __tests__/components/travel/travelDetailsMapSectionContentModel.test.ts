import {
  getTravelDetailsMapSectionContentFlags,
  hasTravelDetailsMapData,
} from '@/components/travel/details/hooks/travelDetailsMapSectionContentModel'

describe('travelDetailsMapSectionContentModel', () => {
  it('builds map content render flags from heavy/map-open state', () => {
    expect(
      getTravelDetailsMapSectionContentFlags({
        canRenderHeavy: false,
        mapOpened: true,
        shouldForceRenderMap: false,
      })
    ).toEqual({
      isLoading: false,
      shouldRender: false,
      shouldRenderMapContent: true,
    })
  })

  it('detects map data from preview line points', () => {
    expect(
      hasTravelDetailsMapData({
        hasEmbeddedCoords: false,
        hasTravelAddressPoints: false,
        routePreviewItems: [{ preview: { linePoints: [{ coord: '1,1' }] } }],
      })
    ).toBe(true)
  })

  it('returns false when neither embedded coords nor previews exist', () => {
    expect(
      hasTravelDetailsMapData({
        hasEmbeddedCoords: false,
        hasTravelAddressPoints: false,
        routePreviewItems: [],
      })
    ).toBe(false)
  })
})
