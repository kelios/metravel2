import { fireEvent, render, screen } from '@testing-library/react-native'

import RouteElevationProfile from '@/components/travel/details/sections/RouteElevationProfile'

describe('RouteElevationProfile', () => {
  it('renders richer route metrics and key point cards', () => {
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

    render(
      <RouteElevationProfile
        title="Профиль высот: Маршрут"
        preview={preview}
        transportHints={['Пешком']}
        keyPointLabels={{
          startName: 'Witow',
          peakName: 'Schronisko',
          finishName: 'Парковка',
        }}
      />
    )

    expect(screen.getByText('Профиль высот: Маршрут')).toBeTruthy()
    expect(screen.getByText('7.5 км • +240 м набора • пик 1145 м • 32 м/км')).toBeTruthy()
    expect(screen.getByText('Дистанция')).toBeTruthy()
    expect(screen.getByText('Набор')).toBeTruthy()
    expect(screen.getByText('Сброс')).toBeTruthy()
    expect(screen.getByText('Перепад')).toBeTruthy()
    fireEvent(screen.getByTestId('route-elevation-profile'), 'layout', {
      nativeEvent: { layout: { width: 360, height: 240 } },
    })

    expect(screen.getByText('Старт')).toBeTruthy()
    expect(screen.getByText('Высшая точка')).toBeTruthy()
    expect(screen.getByText('Финиш')).toBeTruthy()
    expect(screen.getByText('Witow')).toBeTruthy()
    expect(screen.getByText('Schronisko')).toBeTruthy()
    expect(screen.getByText('Парковка')).toBeTruthy()
    expect(screen.getByText('Транспорт: Пешком')).toBeTruthy()
  })
})
