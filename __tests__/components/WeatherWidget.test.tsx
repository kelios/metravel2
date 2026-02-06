import { act, render, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'
import WeatherWidget from '@/components/home/WeatherWidget'

describe('WeatherWidget', () => {
  const originalPlatform = Platform.OS
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.useRealTimers()
    ;(Platform as any).OS = 'web'
    global.fetch = jest.fn()
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
    global.fetch = originalFetch
    jest.clearAllMocks()
  })

  it('returns null on non-web platform or invalid coords', () => {
    ;(Platform as any).OS = 'ios'
    const { queryByText, rerender } = render(
      <WeatherWidget points={[{ coord: 'bad' }]} countryName="BY" />
    )
    expect(queryByText(/Погода/)).toBeNull()

    ;(Platform as any).OS = 'web'
    rerender(<WeatherWidget points={[{ coord: 'bad', address: 'Минск' }]} />)
    expect(queryByText(/Погода/)).toBeNull()
  })

  it('renders forecast for valid coordinates', async () => {
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValue({
      json: () =>
        Promise.resolve({
          daily: {
            time: ['2024-01-01', '2024-01-02', '2024-01-03'],
            temperature_2m_max: [10.2, 3.5, -1],
            temperature_2m_min: [1.5, -2, -4],
            weather_code: [0, 85, 96],
          },
        }),
    })

    const { getByText, queryByText } = render(
      <WeatherWidget
        points={[{ coord: '53.9, 27.56', address: 'Минск, Беларусь, Центр' }]}
        countryName="BY"
      />
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await act(async () => {
      await Promise.resolve()
    })
    await waitFor(() => expect(getByText(/Погода в Минск, Беларусь, Центр, BY/)).toBeTruthy())
    await waitFor(() => expect(getByText('Ясно')).toBeTruthy())
    expect(getByText(/Гроза/)).toBeTruthy()
    expect(queryByText(/tooltip/i)).toBeNull()
  })
})
