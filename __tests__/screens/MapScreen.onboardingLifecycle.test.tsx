import { act, render } from '@testing-library/react-native'
// The shared setup caches RN before this file; set the actual module-time
// platform before importing the production screen and lazy tour.
const cachedRN = require('react-native')
const initialPlatform = cachedRN.Platform.OS
cachedRN.Platform.OS = 'web'
const MapScreen = require('@/screens/tabs/MapScreen').default as typeof import('@/screens/tabs/MapScreen').default
const { MapOnboarding, restartMapOnboarding } = require('@/components/MapPage/MapOnboarding') as typeof import('@/components/MapPage/MapOnboarding')
afterAll(() => { cachedRN.Platform.OS = initialPlatform })

jest.mock('react-native', () => ({ ...jest.requireActual('react-native'), Platform: { ...jest.requireActual('react-native').Platform, OS: 'web' } }))
jest.mock('@/hooks/useMapScreenController', () => ({ useMapScreenController: () => ({
  isMobile: false, isFocused: false, canonical: '/map', travelsData: [],
  styles: {}, themedColors: {}, routingSlice: { mode: 'radius' },
  filtersPanelProps: {}, locationState: { status: 'current' }, mapError: 'fixture',
}) }))
jest.mock('@/hooks/useMapViewportHeightVar', () => ({ useMapViewportHeightVar: () => undefined }))
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: true }) }))
jest.mock('@/screens/tabs/mapScreenHelpers', () => ({
  buildQuickFiltersData: () => ({ selected: [], categories: [], radius: [] }),
  buildActiveFilterItems: () => [],
}))
jest.mock('@/components/MapPage/MapCanvas', () => ({ MapCanvas: () => null }))
jest.mock('@/components/MapPage/MapScreenParts/MapScreenMobile', () => ({ MapScreenMobile: () => null }))
jest.mock('@/components/MapPage/MapScreenParts/MapScreenDesktop', () => ({ MapScreenDesktopChrome: () => null, MapScreenDesktopOverlays: () => null }))
jest.mock('@/components/MapPage/MapScreenParts/MapScreenError', () => ({ MapScreenError: () => null }))
jest.mock('@/components/MapPage/MapScreenParts/MapScreenShell', () => ({ MapScreenShell: () => null }))
jest.mock('@/components/MapPage/MapPageHeading', () => ({ MapPageHeading: () => null }))
jest.mock('@/utils/loadLeafletRuntime', () => ({ loadLeafletRuntime: async () => undefined }))

afterEach(() => jest.useRealTimers())

it('actual MapScreen unmount cancels the restart while its tour UI is still deferred', async () => {
  expect(cachedRN.Platform.OS).toBe('web')
  jest.useFakeTimers()
  localStorage.setItem('metravel_map_onboarding_completed', 'true')
  const screen = render(<MapScreen />)
  restartMapOnboarding()
  screen.unmount()
  const tour = render(<MapOnboarding mobileWebCoachmark />)
  await act(async () => Promise.resolve())
  act(() => jest.advanceTimersByTime(1200))
  expect(tour.queryByTestId('onboarding-card')).toBeNull()
  expect(localStorage.getItem('metravel_map_onboarding_completed')).toBe('true')
  tour.unmount()
  jest.useRealTimers()
})
