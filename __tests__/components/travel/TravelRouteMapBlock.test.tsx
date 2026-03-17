import { render, screen } from '@testing-library/react-native'

import { TravelRouteMapBlock } from '@/components/travel/details/sections/TravelRouteMapBlock'

const mockTravelMap = jest.fn((_props: any) => null)
const mockToggleableMap = jest.fn(({ children }: any) => children)
const mockRouteElevationProfile = jest.fn((_props: any) => null)
const mockUseTravelRouteMapBlockModel = jest.fn()

jest.mock('@/components/travel/TravelDetailSkeletons', () => ({
  MapSkeleton: () => null,
}))

jest.mock('@/components/travel/ToggleableMapSection', () => ({
  __esModule: true,
  default: (props: any) => mockToggleableMap(props),
}))

jest.mock('@/components/MapPage/TravelMap', () => ({
  TravelMap: (props: any) => mockTravelMap(props),
}))

jest.mock('@/components/travel/details/sections/RouteElevationProfile', () => ({
  __esModule: true,
  default: (props: any) => mockRouteElevationProfile(props),
}))

jest.mock('@/components/travel/details/TravelDetailsStyles', () => ({
  useTravelDetailsStyles: () => ({
    fallback: {},
  }),
}))

jest.mock('@/components/travel/details/hooks/useTravelRouteMapBlockModel', () => ({
  useTravelRouteMapBlockModel: (...args: any[]) => mockUseTravelRouteMapBlockModel(...args),
}))

const baseProps = {
  downloadingRouteId: null,
  handleDownloadRoute: jest.fn(),
  handleMapOpenChange: jest.fn(),
  hasMapData: true,
  highlightedPoint: null,
  isLoading: false,
  isMobileWeb: false,
  isRoutePreviewLoading: false,
  keyPointLabels: { startName: 'Старт' },
  mapOpenTrigger: 0,
  mapResizeTrigger: 0,
  placeHints: [],
  routePreviewItems: [
    {
      file: { id: 1 },
      label: 'Маршрут',
      color: '#123456',
      preview: { linePoints: [{ coord: '53.9,27.56' }, { coord: '52.1,23.7' }] },
    },
  ],
  shouldForceRenderMap: false,
  shouldRender: true,
  shouldRenderMapContent: true,
  styles: {
    sectionContainer: {},
    contentStable: {},
    webDeferredSection: {},
    sectionHeaderText: {},
    mapEmptyState: {},
    mapEmptyText: {},
  },
  transportHints: ['Машина'],
  travel: {
    id: 1,
    slug: 'route-map',
    travelAddress: [{ id: 1, coord: '53.9,27.56' }],
  } as any,
}

describe('TravelRouteMapBlock', () => {
  beforeEach(() => {
    mockTravelMap.mockClear()
    mockToggleableMap.mockClear()
    mockRouteElevationProfile.mockClear()
    mockUseTravelRouteMapBlockModel.mockReset()
    mockUseTravelRouteMapBlockModel.mockReturnValue({
      routeLines: [{ color: '#123456', coords: [[53.9, 27.56], [52.1, 23.7]] }],
      routeProfiles: [
        {
          key: 'route-profile-1-0',
          title: 'Профиль высот: Маршрут',
          lineColor: '#123456',
          preview: { linePoints: [{ coord: '53.9,27.56' }, { coord: '52.1,23.7' }] },
          onDownloadTrack: jest.fn(),
          isDownloadPending: false,
          keyPointLabels: { startName: 'Старт' },
        },
      ],
      shouldShowMapLoadingState: false,
      shouldShowRouteLine: true,
    })
  })

  it('renders interactive map branch with route lines and elevation profiles', () => {
    render(<TravelRouteMapBlock {...baseProps} />)

    expect(mockToggleableMap).toHaveBeenCalledWith(
      expect.objectContaining({
        initiallyOpen: true,
        isLoading: false,
        forceOpenTrigger: undefined,
        onOpenChange: baseProps.handleMapOpenChange,
      })
    )

    expect(mockTravelMap).toHaveBeenCalledWith(
      expect.objectContaining({
        showRouteLine: true,
        routeLines: [{ color: '#123456', coords: [[53.9, 27.56], [52.1, 23.7]] }],
        highlightedPoint: undefined,
      })
    )

    expect(mockRouteElevationProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Профиль высот: Маршрут',
        lineColor: '#123456',
        transportHints: ['Машина'],
      })
    )
  })

  it('renders loading fallback when route preview data is still loading and map data is absent', () => {
    mockUseTravelRouteMapBlockModel.mockReturnValueOnce({
      routeLines: [],
      routeProfiles: [],
      shouldShowMapLoadingState: true,
      shouldShowRouteLine: false,
    })

    render(
      <TravelRouteMapBlock
        {...baseProps}
        hasMapData={false}
        isRoutePreviewLoading
      />
    )

    expect(screen.queryByText('Маршрут ещё не добавлен')).toBeNull()
    expect(mockTravelMap).not.toHaveBeenCalled()
  })

  it('renders empty state when there is no map data and nothing is loading', () => {
    mockUseTravelRouteMapBlockModel.mockReturnValueOnce({
      routeLines: [],
      routeProfiles: [],
      shouldShowMapLoadingState: false,
      shouldShowRouteLine: false,
    })

    render(
      <TravelRouteMapBlock
        {...baseProps}
        hasMapData={false}
      />
    )

    expect(screen.getByText('Маршрут ещё не добавлен')).toBeTruthy()
    expect(mockTravelMap).not.toHaveBeenCalled()
  })
})
