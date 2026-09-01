// #1671: на 390pt блок «Профиль высот» занимал половину экрана, потому что
// подзаголовок с итогами и сетка из шести плиток печатали одни и те же цифры.
// Тест держит границу: узкая раскладка — три плитки без строки итогов,
// широкая — полный набор и подзаголовок на месте.
import { fireEvent, render, screen } from '@testing-library/react-native'

import RouteElevationProfile from '@/components/travel/details/sections/RouteElevationProfile'

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

const SUMMARY_LINE = '7,5 км • +240 м набора • пик 1 145 м • 32 м/км'

const layoutTo = (width: number) =>
  fireEvent(screen.getByTestId('route-elevation-profile'), 'layout', {
    nativeEvent: { layout: { width, height: 240 } },
  })

describe('RouteElevationProfile summary density', () => {
  it('keeps only the three key tiles and drops the duplicate summary line on a narrow layout', () => {
    render(<RouteElevationProfile preview={preview} />)
    layoutTo(390)

    expect(screen.queryByText(SUMMARY_LINE)).toBeNull()
    expect(screen.getByText('Дистанция')).toBeTruthy()
    expect(screen.getByText('Набор')).toBeTruthy()
    expect(screen.getByText('Перепад')).toBeTruthy()
    expect(screen.queryByText('Сброс')).toBeNull()
    expect(screen.queryByText('Мин высота')).toBeNull()
    expect(screen.queryByText('Макс высота')).toBeNull()

    // Ряд не переносится: три плитки делят ширину поровну.
    const grid = screen.getByTestId('route-elevation-summary-cards')
    const gridStyle = Object.assign({}, ...[grid.props.style].flat(2).filter(Boolean))
    expect(gridStyle.flexWrap).toBe('nowrap')
  })

  it('keeps the full desktop tile set and the summary line on a wide layout', () => {
    render(<RouteElevationProfile preview={preview} />)
    layoutTo(1280)

    expect(screen.getByText(SUMMARY_LINE)).toBeTruthy()
    for (const label of [
      'Дистанция',
      'Набор',
      'Сброс',
      'Мин высота',
      'Макс высота',
      'Перепад',
    ]) {
      expect(screen.getByText(label)).toBeTruthy()
    }

    const grid = screen.getByTestId('route-elevation-summary-cards')
    const gridStyle = Object.assign({}, ...[grid.props.style].flat(2).filter(Boolean))
    expect(gridStyle.flexWrap).toBe('wrap')
  })
})
