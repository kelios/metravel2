import React from 'react'
import { render } from '@testing-library/react-native'
import WeatherWidget from '@/components/WeatherWidget'

// Mock fetch
global.fetch = jest.fn()

describe('WeatherWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        daily: {
          time: ['2024-01-01', '2024-01-02', '2024-01-03'],
          temperature_2m_max: [10, 12, 15],
          temperature_2m_min: [5, 7, 10],
          weather_code: [0, 1, 2],
        },
      }),
    })
  })

  it('renders nothing on non-web platform', () => {
    const { queryByText } = render(
      <WeatherWidget points={[{ coord: '53.9,27.5', address: 'Minsk' }]} />
    )
    // On non-web, component returns null
    expect(queryByText('Погода')).toBeNull()
  })

  it('renders nothing when points are empty', () => {
    const { queryByText } = render(<WeatherWidget points={[]} />)
    expect(queryByText('Погода')).toBeNull()
  })

  it('renders nothing when coord is invalid', () => {
    const { queryByText } = render(
      <WeatherWidget points={[{ coord: 'invalid', address: 'Minsk' }]} />
    )
    expect(queryByText('Погода')).toBeNull()
  })
})

