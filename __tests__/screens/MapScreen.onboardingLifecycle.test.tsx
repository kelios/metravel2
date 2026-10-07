// RNTL auto cleanup flushes setImmediate before restoring fake timers. The
// setup polyfill schedules that on timeout0; use its supported explicit entry.
import { act, cleanupAsync, fireEvent, render } from '@testing-library/react-native/pure'
// The shared setup caches RN before this file; set the actual module-time
// platform before importing the production screen and lazy tour.
const cachedRN = require('react-native')
const initialPlatform = cachedRN.Platform.OS
cachedRN.Platform.OS = 'web'
const MapScreen = require('@/screens/tabs/MapScreen').default as typeof import('@/screens/tabs/MapScreen').default
const { MapOnboarding, restartMapOnboarding } = require('@/components/MapPage/MapOnboarding') as typeof import('@/components/MapPage/MapOnboarding')
afterAll(() => { cachedRN.Platform.OS = initialPlatform })

jest.mock('react-native', () => ({ ...jest.requireActual('react-native'), Platform: { ...jest.requireActual('react-native').Platform, OS: 'web' } }))
let mockIsFocused = true
let mockMapError: string | null = null
const mockMapCanvasMount = jest.fn()
const mockMapCanvasUnmount = jest.fn()
jest.mock('@/hooks/useMapScreenController', () => ({ useMapScreenController: () => ({
  isMobile: true, isFocused: mockIsFocused, canonical: '/map', travelsData: [],
  styles: {}, themedColors: {}, routingSlice: { mode: 'radius' },
  filtersPanelProps: {}, locationState: { status: 'current' }, mapError: mockMapError,
}) }))
jest.mock('@/hooks/useMapViewportHeightVar', () => ({ useMapViewportHeightVar: () => undefined }))
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: true }) }))
jest.mock('@/screens/tabs/mapScreenHelpers', () => ({
  buildQuickFiltersData: () => ({ selected: [], categories: [], radius: [] }),
  buildActiveFilterItems: () => [],
}))
jest.mock('@/components/MapPage/MapCanvas', () => ({ MapCanvas: () => {
  const React = require('react')
  React.useEffect(() => {
    mockMapCanvasMount()
    return () => mockMapCanvasUnmount()
  }, [])
  return null
} }))
// Keep the actual mobile chrome and tour. Only unrelated deferred map/list UI
// is replaced, so the production shouldLoadOnboarding prop controls the Modal.
jest.mock('@/screens/tabs/mapDeferred', () => ({
  MapMobileLayout: () => null,
  MapOnboarding: jest.requireActual('@/components/MapPage/MapOnboarding').MapOnboarding,
}))
jest.mock('@/components/MapPage/MapScreenParts/MapScreenDesktop', () => ({ MapScreenDesktopChrome: () => null, MapScreenDesktopOverlays: () => null }))
jest.mock('@/components/MapPage/MapScreenParts/MapScreenError', () => ({ MapScreenError: () => null }))
jest.mock('@/components/MapPage/MapScreenParts/MapScreenShell', () => ({
  MapScreenShell: ({ mapComponent, chrome }: { mapComponent: import('react').ReactNode; chrome: import('react').ReactNode }) => <>{mapComponent}{chrome}</>,
}))
jest.mock('@/components/MapPage/MapPageHeading', () => ({ MapPageHeading: () => null }))
jest.mock('@/utils/loadLeafletRuntime', () => ({ loadLeafletRuntime: async () => undefined }))

beforeEach(() => {
  expect(cachedRN.Platform.OS).toBe('web')
  jest.useFakeTimers()
  mockIsFocused = true
  mockMapError = null
  mockMapCanvasMount.mockClear()
  mockMapCanvasUnmount.mockClear()
  localStorage.setItem('metravel_map_onboarding_completed', 'true')
})
afterEach(async () => {
  try { await cleanupAsync() } finally { jest.useRealTimers() }
})

const settle = async (milliseconds = 1200) => {
  await act(async () => { await Promise.resolve() })
  await act(async () => { await jest.advanceTimersByTimeAsync(milliseconds) })
}

const changeFocus = (screen: ReturnType<typeof render>, focused: boolean) => {
  mockIsFocused = focused
  screen.rerender(<MapScreen />)
}

it('blur closes a manually reopened real mobile Modal while retaining MapScreen and its canvas', async () => {
  const screen = render(<MapScreen />)
  await settle()
  expect(screen.queryByTestId('onboarding-card')).toBeNull()
  act(() => restartMapOnboarding())
  expect(screen.getByTestId('onboarding-card')).toBeTruthy()
  expect(document.body.getAttribute('data-map-onboarding-open')).toBe('true')

  changeFocus(screen, false)
  expect(screen.queryByTestId('onboarding-card')).toBeNull()
  expect(document.body.hasAttribute('data-map-onboarding-open')).toBe(false)
  expect(mockMapCanvasMount).toHaveBeenCalledTimes(1)
  expect(mockMapCanvasUnmount).not.toHaveBeenCalled()

  changeFocus(screen, true)
  await settle()
  expect(screen.queryByTestId('onboarding-card')).toBeNull()
  expect(localStorage.getItem('metravel_map_onboarding_completed')).toBe('true')
  // This visit still supports an ordinary manual replay after returning.
  act(() => restartMapOnboarding())
  expect(screen.getAllByTestId('onboarding-card')).toHaveLength(1)
})

it('blur cancels a manual restart before deferred mount; returning does not replay it', async () => {
  const screen = render(<MapScreen />)
  expect(screen.queryByTestId('onboarding-card')).toBeNull()
  act(() => restartMapOnboarding())
  changeFocus(screen, false)
  await settle()
  expect(screen.queryByTestId('onboarding-card')).toBeNull()
  changeFocus(screen, true)
  await settle()
  expect(screen.queryByTestId('onboarding-card')).toBeNull()
  expect(localStorage.getItem('metravel_map_onboarding_completed')).toBe('true')
  expect(mockMapCanvasMount).toHaveBeenCalledTimes(1)
  expect(mockMapCanvasUnmount).not.toHaveBeenCalled()
})

it('same-visit manual restart before deferred mount still opens exactly one tour', async () => {
  const screen = render(<MapScreen />)
  act(() => restartMapOnboarding())
  await settle()
  expect(screen.getAllByTestId('onboarding-card')).toHaveLength(1)
  expect(localStorage.getItem('metravel_map_onboarding_completed')).toBe('true')
})

it('a genuine first-time mobile visit still auto-opens and completing persists the flag', async () => {
  localStorage.removeItem('metravel_map_onboarding_completed')
  const screen = render(<MapScreen />)
  await settle(600)
  await settle(800)
  expect(screen.getByTestId('onboarding-card')).toBeTruthy()
  for (let step = 0; step < 4; step++) fireEvent.press(screen.getByTestId('onboarding-next'))
  expect(screen.queryByTestId('onboarding-card')).toBeNull()
  expect(localStorage.getItem('metravel_map_onboarding_completed')).toBe('true')
})

it('actual MapScreen unmount cancels the restart while its tour UI is still deferred', async () => {
  mockMapError = 'fixture'
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
