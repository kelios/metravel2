import { createRef } from 'react'
import { render } from '@testing-library/react-native'

import type { Travel } from '@/types/types'
import { TravelDetailsMapSection } from '@/components/travel/details/sections/TravelDetailsMapSection'

const mockExcursionsSection = jest.fn((_props: any) => null)
const mockTravelRouteMapBlock = jest.fn((_props: any) => null)
const mockTravelWeatherBlock = jest.fn((_props: any) => null)
const mockTravelPointsBlock = jest.fn((_props: any) => null)
const mockSetMapSectionRef = jest.fn()
const mockHandleDownloadRoute = jest.fn()
const mockHandleMapOpenChange = jest.fn()
const mockHandlePointCardPress = jest.fn()
const mockSetWeatherVisible = jest.fn()

jest.mock('@/components/travel/details/TravelDetailsStyles', () => ({
  useTravelDetailsStyles: () => ({
    sectionContainer: {},
    contentStable: {},
    webDeferredSection: {},
    fallback: {},
    mapEmptyState: {},
    mapEmptyText: {},
  }),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({ primary: '#000' }),
}))

jest.mock('@/components/travel/details/hooks/useTravelDetailsMapSectionModel', () => ({
  useTravelDetailsMapSectionModel: () => ({
    downloadingRouteId: 7,
    handleDownloadRoute: mockHandleDownloadRoute,
    handleMapOpenChange: mockHandleMapOpenChange,
    handlePointCardPress: mockHandlePointCardPress,
    hasEmbeddedCoords: true,
    hasTravelAddressPoints: true,
    highlightedPoint: { coord: '53.9,27.56', key: 'point-1' },
    isMobileWeb: false,
    mapOpenTrigger: 2,
    mapOpened: true,
    mapResizeTrigger: 3,
    placeHints: [{ name: 'Минск', coord: '53.9,27.56' }],
    setWeatherVisible: mockSetWeatherVisible,
    shouldForceRenderExcursions: true,
    shouldForceRenderMap: true,
    transportHints: ['Машина'],
    weatherVisible: true,
  }),
}))

jest.mock('@/components/travel/details/hooks/useTravelDetailsMapSectionContentModel', () => ({
  useTravelDetailsMapSectionContentModel: () => ({
    hasMapData: true,
    isLoading: false,
    isRoutePreviewLoading: false,
    keyPointLabels: { startName: 'Старт', peakName: 'Пик', finishName: 'Финиш' },
    routePreviewItems: [{ file: { id: 9 }, preview: { linePoints: [{ coord: '1,1' }, { coord: '2,2' }] } }],
    setMapSectionRef: mockSetMapSectionRef,
    shouldRender: true,
    shouldRenderMapContent: true,
  }),
}))

jest.mock('@/components/travel/details/sections/ExcursionsSection', () => ({
  __esModule: true,
  default: (props: any) => mockExcursionsSection(props),
}))

jest.mock('@/components/travel/details/sections/TravelRouteMapBlock', () => ({
  __esModule: true,
  default: (props: any) => mockTravelRouteMapBlock(props),
}))

jest.mock('@/components/travel/details/sections/TravelWeatherBlock', () => ({
  __esModule: true,
  default: (props: any) => mockTravelWeatherBlock(props),
}))

jest.mock('@/components/travel/details/sections/TravelPointsBlock', () => ({
  __esModule: true,
  default: (props: any) => mockTravelPointsBlock(props),
}))

describe('TravelDetailsMapSection', () => {
  beforeEach(() => {
    mockExcursionsSection.mockClear()
    mockTravelRouteMapBlock.mockClear()
    mockTravelWeatherBlock.mockClear()
    mockTravelPointsBlock.mockClear()
    mockSetMapSectionRef.mockClear()
  })

  it('composes map section blocks with props from map and content models', () => {
    const anchors = {
      gallery: createRef(),
      video: createRef(),
      description: createRef(),
      recommendation: createRef(),
      plus: createRef(),
      minus: createRef(),
      map: createRef(),
      points: createRef(),
      near: createRef(),
      popular: createRef(),
      excursions: createRef(),
      comments: createRef(),
    }

    const travel = {
      id: 11,
      slug: 'map-travel',
      name: 'Map travel',
      travelAddress: [{ id: 1, coord: '53.9,27.56' }],
    } as Travel

    render(
      <TravelDetailsMapSection
        travel={travel}
        anchors={anchors}
        canRenderHeavy
        scrollToMapSection={jest.fn()}
        forceOpenKey="map"
      />
    )

    expect(mockExcursionsSection).toHaveBeenCalledWith(
      expect.objectContaining({
        travel,
        anchors,
        shouldForceRenderExcursions: true,
      })
    )

    expect(mockTravelRouteMapBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        downloadingRouteId: 7,
        handleDownloadRoute: mockHandleDownloadRoute,
        handleMapOpenChange: mockHandleMapOpenChange,
        hasMapData: true,
        highlightedPoint: { coord: '53.9,27.56', key: 'point-1' },
        isLoading: false,
        isRoutePreviewLoading: false,
        mapOpenTrigger: 2,
        mapResizeTrigger: 3,
        shouldForceRenderMap: true,
        shouldRender: true,
        shouldRenderMapContent: true,
        transportHints: ['Машина'],
        travel,
      })
    )

    expect(mockTravelWeatherBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        setWeatherVisible: mockSetWeatherVisible,
        travel,
        weatherVisible: true,
      })
    )

    expect(mockTravelPointsBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        anchors,
        handlePointCardPress: mockHandlePointCardPress,
        travel,
      })
    )
  })
})
