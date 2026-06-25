import { render } from '@testing-library/react-native'

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    text: '#1a1a1a',
    textMuted: '#666666',
    surfaceMuted: 'rgba(255,255,255,0.75)',
    borderLight: '#ececec',
  }),
}))

// Импортируем после моков
import WeatherLegend from '@/components/MapPage/WeatherLegend.web'

const TEMP = 'weather-temp'
const LABELS = 'weather-temp-labels'
const PRECIP = 'weather-precip'
const CLOUDS = 'weather-clouds'

describe('WeatherLegend.web — выбор шкалы по enabledOverlays', () => {
  it('temp=true → показывает шкалу температуры (°C)', () => {
    const { getByTestId } = render(
      <WeatherLegend enabledOverlays={{ [TEMP]: true }} />,
    )
    const legend = getByTestId('weather-legend')
    expect(legend.props.accessibilityLabel).toContain('Температура')
  })

  it('precip=true → показывает шкалу осадков (мм/ч)', () => {
    const { getByTestId } = render(
      <WeatherLegend enabledOverlays={{ [PRECIP]: true }} />,
    )
    const legend = getByTestId('weather-legend')
    expect(legend.props.accessibilityLabel).toContain('Осадки')
  })

  it('clouds=true → показывает шкалу облачности (%)', () => {
    const { getByTestId } = render(
      <WeatherLegend enabledOverlays={{ [CLOUDS]: true }} />,
    )
    const legend = getByTestId('weather-legend')
    expect(legend.props.accessibilityLabel).toContain('Облачность')
  })

  it('только labels=true (без заливки temp) → показывает температурную шкалу', () => {
    // Подписи °C без heatmap тоже требуют шкалы температуры для контекста.
    const { getByTestId } = render(
      <WeatherLegend enabledOverlays={{ [LABELS]: true }} />,
    )
    const legend = getByTestId('weather-legend')
    expect(legend.props.accessibilityLabel).toContain('Температура')
  })

  it('пустой объект enabledOverlays → компонент не рендерится (null)', () => {
    const { queryByTestId } = render(
      <WeatherLegend enabledOverlays={{}} />,
    )
    expect(queryByTestId('weather-legend')).toBeNull()
  })

  it('enabledOverlays=null → компонент не рендерится', () => {
    const { queryByTestId } = render(
      <WeatherLegend enabledOverlays={null} />,
    )
    expect(queryByTestId('weather-legend')).toBeNull()
  })

  it('enabledOverlays=undefined → компонент не рендерится', () => {
    const { queryByTestId } = render(<WeatherLegend />)
    expect(queryByTestId('weather-legend')).toBeNull()
  })

  it('все погодные слои выключены явно → компонент не рендерится', () => {
    const { queryByTestId } = render(
      <WeatherLegend
        enabledOverlays={{
          [TEMP]: false,
          [LABELS]: false,
          [PRECIP]: false,
          [CLOUDS]: false,
        }}
      />,
    )
    expect(queryByTestId('weather-legend')).toBeNull()
  })
})
