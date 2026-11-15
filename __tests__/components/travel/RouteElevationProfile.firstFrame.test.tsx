// #3430: the profile mounts after its GPX loads, when the reader may already be
// on the route block. Its first frame must already have the final geometry: the
// width-0 frame used to draw the wide layout without the chart and collapse to
// the compact one a frame later, moving «Точки маршрута» twice.
import { fireEvent, render, screen } from '@testing-library/react-native'

import RouteElevationProfile from '@/components/travel/details/sections/RouteElevationProfile'

let mockViewportWidth = 390
jest.mock('@/hooks/useResponsive', () => ({
  ...jest.requireActual('@/hooks/useResponsive'),
  useResponsiveWidth: () => mockViewportWidth,
}))

const preview = {
  linePoints: [
    { coord: '53.9,27.56', elevation: 905 },
    { coord: '53.9338,27.56', elevation: 1030 },
    { coord: '53.9676,27.56', elevation: 1145 },
  ],
  elevationProfile: [
    { distanceKm: 0, elevationM: 905 },
    { distanceKm: 3.75, elevationM: 1030 },
    { distanceKm: 7.5, elevationM: 1145 },
  ],
} as any

const SUMMARY_LINE = '7,5 км • +240 м набора • пик 1 145 м • 32 м/км'

describe('RouteElevationProfile first frame', () => {
  it('draws the compact layout and reserves the chart box before its own layout on a phone', async () => {
    mockViewportWidth = 390
    await render(<RouteElevationProfile preview={preview} />)

    expect(screen.queryByText(SUMMARY_LINE)).toBeNull()
    expect(screen.queryByText('Сброс')).toBeNull()
    expect(screen.getByTestId('route-elevation-chart-reserve')).toBeTruthy()

    await fireEvent(screen.getByTestId('route-elevation-profile'), 'layout', {
      nativeEvent: { layout: { width: 358, height: 240 } },
    })
    expect(screen.queryByTestId('route-elevation-chart-reserve')).toBeNull()
    expect(screen.queryByText(SUMMARY_LINE)).toBeNull()
  })

  it('keeps the wide layout from the first frame on a wide viewport', async () => {
    mockViewportWidth = 1280
    await render(<RouteElevationProfile preview={preview} />)

    expect(screen.getByText(SUMMARY_LINE)).toBeTruthy()
    expect(screen.getByTestId('route-elevation-chart-reserve')).toBeTruthy()
  })
})
