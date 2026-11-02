import React from 'react'
import { Platform } from 'react-native'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import TravelRouteActions from '@/components/travel/details/TravelRouteActions'

const mockOpenExternalUrlInNewTab = jest.fn((_url: string) => Promise.resolve(true))
const mockSaveRouteExportFile = jest.fn((_file: any, _title?: string) => Promise.resolve(true))
const mockSendAnalyticsEvent = jest.fn((_name: string, _params?: Record<string, unknown>) => Promise.resolve())
const mockShowToast = jest.fn()

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrlInNewTab: (url: string) => mockOpenExternalUrlInNewTab(url),
}))

jest.mock('@/utils/routeExport/save', () => ({
  saveRouteExportFile: (file: any, title?: string) => mockSaveRouteExportFile(file, title),
}))

jest.mock('@/utils/analytics', () => ({
  sendAnalyticsEvent: (name: string, params?: Record<string, unknown>) => mockSendAnalyticsEvent(name, params),
}))

// jest-expo резолвит native-вариант MenuOverlay (Paper Portal); desktop-меню
// в проде — web Modal, здесь достаточно «видим → рендерим детей».
jest.mock('@/components/ui/MenuOverlay', () => ({
  __esModule: true,
  default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? children : null,
}))

jest.mock('@/utils/toast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}))

const travel: any = {
  id: 7,
  slug: 'route-seven',
  name: 'Route seven',
  userName: 'Author',
  travelAddress: [
    { id: 1, name: 'A', coord: '53.9,27.56' },
    { id: 2, name: 'B', coord: '54.0,27.7' },
  ],
}

describe('TravelRouteActions (#2902)', () => {
  const originalPlatformOS = Platform.OS

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    Platform.OS = originalPlatformOS as any
  })

  it('renders nothing when the route has fewer than two valid points', async () => {
    await render(
      <TravelRouteActions
        travel={{ ...travel, travelAddress: [travel.travelAddress[0], { id: 3, coord: '' }] }}
        isMobile
      />,
    )
    expect(screen.queryByTestId('travel-route-actions')).toBeNull()
  })

  it('opens the navigator sheet on mobile and routes the link through externalLinks', async () => {
    // Android: ActionListSheet выполняет действие сразу, без ожидания iOS onDismiss.
    Platform.OS = 'android' as any
    await render(<TravelRouteActions travel={travel} isMobile />)

    expect(screen.getByLabelText('Открыть в навигаторе')).toBeTruthy()
    fireEvent.press(screen.getByTestId('travel-navigator-trigger'))

    const google = await screen.findByTestId('travel-navigator-google')
    expect(screen.getByTestId('travel-navigator-yandex')).toBeTruthy()
    expect(screen.getByTestId('travel-navigator-apple')).toBeTruthy()
    expect(screen.getByTestId('travel-navigator-osmand')).toBeTruthy()

    fireEvent.press(google)
    await waitFor(() => expect(mockOpenExternalUrlInNewTab).toHaveBeenCalledTimes(1))
    expect(mockOpenExternalUrlInNewTab.mock.calls[0][0]).toContain(
      'https://www.google.com/maps/dir/?api=1',
    )
    expect(mockSendAnalyticsEvent).toHaveBeenCalledWith('travel_navigator_open', {
      provider: 'google',
      travel_id: 7,
    })
  })

  it('shows a dropdown menu on desktop web', async () => {
    Platform.OS = 'web' as any
    await render(<TravelRouteActions travel={travel} isMobile={false} />)

    fireEvent.press(screen.getByTestId('travel-navigator-trigger'))
    expect(await screen.findByTestId('travel-navigator-dropdown')).toBeTruthy()

    fireEvent.press(screen.getByTestId('travel-navigator-osmand'))
    await waitFor(() => expect(mockOpenExternalUrlInNewTab).toHaveBeenCalledTimes(1))
    expect(mockOpenExternalUrlInNewTab.mock.calls[0][0]).toMatch(/^https:\/\/osmand\.net\/map\/navigate\//)
  })

  it('builds the GPX file and hands it to the shared save helper', async () => {
    Platform.OS = 'ios' as any
    await render(<TravelRouteActions travel={travel} isMobile />)

    fireEvent.press(screen.getByTestId('travel-gpx-download'))

    await waitFor(() => expect(mockSaveRouteExportFile).toHaveBeenCalledTimes(1))
    const [file] = mockSaveRouteExportFile.mock.calls[0]
    expect(file.filename).toBe('route-seven.gpx')
    expect(file.content).toContain('<rte>')
    await waitFor(() =>
      expect(mockSendAnalyticsEvent).toHaveBeenCalledWith('travel_gpx_download', {
        travel_id: 7,
        points: 2,
      }),
    )
    expect(mockShowToast).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
  })

  it('reports a failed save with an error toast', async () => {
    Platform.OS = 'ios' as any
    mockSaveRouteExportFile.mockResolvedValueOnce(false)
    await render(<TravelRouteActions travel={travel} isMobile />)

    fireEvent.press(screen.getByTestId('travel-gpx-download'))
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })),
    )
    expect(mockSendAnalyticsEvent).not.toHaveBeenCalledWith('travel_gpx_download', expect.anything())
  })
})
