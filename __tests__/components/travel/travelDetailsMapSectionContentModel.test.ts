import {
  getTravelDetailsMapSectionContentFlags,
  hasTravelDetailsMapData,
} from '@/components/travel/details/hooks/travelDetailsMapSectionContentModel'

describe('travelDetailsMapSectionContentModel', () => {
  it('builds map content render flags from heavy/map-open state', () => {
    expect(
      getTravelDetailsMapSectionContentFlags({
        canRenderHeavy: false,
        mapNearViewport: false,
        mapOpened: true,
        shouldForceRenderMap: false,
      })
    ).toEqual({
      isLoading: false,
      shouldRender: false,
      shouldRenderMapContent: true,
    })
  })

  it('gates heavy map content on viewport proximity on web', () => {
    expect(
      getTravelDetailsMapSectionContentFlags({
        canRenderHeavy: true,
        mapNearViewport: false,
        mapOpened: false,
        shouldForceRenderMap: false,
      })
    ).toEqual({
      isLoading: false,
      shouldRender: true,
      shouldRenderMapContent: false,
    })
  })

  it('mounts heavy map content once it nears the viewport', () => {
    expect(
      getTravelDetailsMapSectionContentFlags({
        canRenderHeavy: true,
        mapNearViewport: true,
        mapOpened: false,
        shouldForceRenderMap: false,
      })
    ).toEqual({
      isLoading: false,
      shouldRender: true,
      shouldRenderMapContent: true,
    })
  })

  it('force-renders the map for PDF/print regardless of viewport', () => {
    expect(
      getTravelDetailsMapSectionContentFlags({
        canRenderHeavy: true,
        mapNearViewport: false,
        mapOpened: false,
        shouldForceRenderMap: true,
      })
    ).toEqual({
      isLoading: false,
      shouldRender: true,
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
