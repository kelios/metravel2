// #3430: until the GPX previews resolve the web map block holds one profile slot
// per route file, so arriving elevation profiles land in it instead of pushing
// the visible «Точки маршрута» (prod Hexenstieg 390: points y427→0, CLS 0.39).
import { act, render, screen } from '@testing-library/react-native'

const { TravelRouteMapBlock } = require('@/components/travel/details/sections/TravelRouteMapBlock.tsx')

const mockUseTravelRouteMapBlockModel = jest.fn()

jest.mock('@/components/travel/TravelDetailSkeletons', () => ({ MapSkeleton: () => null }))
jest.mock('@/components/travel/ToggleableMapSection', () => ({ __esModule: true, default: ({ children }: any) => children }))
jest.mock('@/components/MapPage/TravelMap', () => ({ TravelMap: () => null }))
jest.mock('@/components/travel/details/sections/RouteElevationProfile', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/travel/details/TravelDetailsStyles', () => ({ useTravelDetailsStyles: () => ({ fallback: {} }) }))
jest.mock('@/components/travel/details/hooks/useTravelRouteMapBlockModel', () => ({
  useTravelRouteMapBlockModel: (...args: any[]) => mockUseTravelRouteMapBlockModel(...args),
}))

const profile = {
  key: 'route-profile-1-0', title: 'Профиль высот', lineColor: '#123456',
  preview: { linePoints: [{ coord: '53.9,27.56' }, { coord: '52.1,23.7' }] },
  onDownloadTrack: jest.fn(), isDownloadPending: false, keyPointLabels: {},
}

const props = (pendingRouteFileCount: number) => ({
  downloadingRouteId: null, handleDownloadRoute: jest.fn(), handleMapOpenChange: jest.fn(), hasMapData: true,
  highlightedPoint: null, isLoading: false, isRoutePreviewLoading: true, keyPointLabels: {}, mapOpenTrigger: 0,
  mapResizeTrigger: 0, pendingRouteFileCount, placeHints: [], routeFilePoints: [], routePreviewItems: [],
  shouldForceRenderMap: false, shouldRender: true, shouldRenderMapContent: false,
  styles: { sectionContainer: {}, contentStable: {}, webDeferredSection: {}, sectionHeaderText: {}, mapEmptyState: {}, mapEmptyText: {} },
  transportHints: [], travel: { id: 1, slug: 'route-map', travelAddress: [] },
})

const model = (routeProfiles: unknown[]) => ({
  routeFileMarkers: [], routeLines: [], routeProfiles, shouldShowMapLoadingState: false, shouldShowRouteLine: false,
})

it('reserves a profile slot per pending route file before the previews resolve', async () => {
  mockUseTravelRouteMapBlockModel.mockReturnValue(model([]))
  await render(<TravelRouteMapBlock {...props(2)} />)
  await act(async () => { await Promise.resolve() })
  const reserve = screen.getByTestId('route-elevation-reserve')
  expect(Object.assign({}, ...[reserve.props.style].flat())).toMatchObject({ height: 2 * 547 })
})

it('drops the slots once the profiles are drawn', async () => {
  mockUseTravelRouteMapBlockModel.mockReturnValue(model([profile]))
  await render(<TravelRouteMapBlock {...props(0)} />)
  await act(async () => { await Promise.resolve() })
  expect(screen.queryByTestId('route-elevation-reserve')).toBeNull()
})
