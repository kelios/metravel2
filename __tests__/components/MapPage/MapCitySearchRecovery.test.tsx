import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import MapCitySearchRecovery from '@/components/MapPage/MapCitySearchRecovery'
import { useMapCitySearch } from '@/hooks/map/useMapCitySearch'
import { openExternalUrl } from '@/utils/externalLinks'

jest.mock('@/hooks/map/useMapCitySearch', () => ({ useMapCitySearch: jest.fn() }))
jest.mock('@/utils/externalLinks', () => ({ openExternalUrl: jest.fn() }))
const useSearch = jest.mocked(useMapCitySearch)
const props = { query: 'Несвиж', enabled: true, onSelect: jest.fn() }
const requestControls = { request: jest.fn(), coolingDown: false }

describe('city recovery controls', () => {
  beforeEach(() => jest.clearAllMocks())

  it.each([null, 'settled'] as const)('does not manufacture a city when status is %s and no result exists', async status => {
    useSearch.mockReturnValue({ ...requestControls, status, results: [], select: jest.fn(), retry: jest.fn() })
    const screen = await render(<MapCitySearchRecovery {...props} />)
    expect(screen.queryByTestId('map-city-search-result-0')).toBeNull()
    expect(screen.queryByTestId('map-city-search-retry')).toBeNull()
  })

  it('announces pending lookup without a false zero or a city action', async () => {
    useSearch.mockReturnValue({ ...requestControls, status: 'pending', results: [], select: jest.fn(), retry: jest.fn() })
    const screen = await render(<MapCitySearchRecovery {...props} />)
    expect(screen.getByText('Ищем город за пределами этой области…').props.accessibilityLiveRegion).toBe('polite')
    expect(screen.queryByTestId('map-city-search-result-0')).toBeNull()
  })

  it('announces geocoder failure and retries explicitly', async () => {
    const retry = jest.fn()
    useSearch.mockReturnValue({ ...requestControls, status: 'error', results: [], select: jest.fn(), retry })
    const screen = await render(<MapCitySearchRecovery {...props} />)
    expect(screen.getByText('Не удалось найти город. Можно повторить поиск или расширить область.')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('map-city-search-retry'))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('keeps the full disambiguating city label and selects only after a press', async () => {
    const city = { id: 'nesvizh', label: 'Несвиж, Минская область, Беларусь', lat: 53.218, lng: 26.677 }
    const select = jest.fn()
    useSearch.mockReturnValue({ ...requestControls, status: 'settled', results: [city], select, retry: jest.fn() })
    const screen = await render(<MapCitySearchRecovery {...props} />)
    const label = screen.getByText(`Перейти к городу: ${city.label}`)
    expect(label.props.numberOfLines).toBeUndefined()
    expect(select).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByTestId('map-city-search-result-0'))
    expect(select).toHaveBeenCalledWith(city)
    expect(screen.getByText('© Участники OpenStreetMap')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('map-city-search-credit'))
    expect(openExternalUrl).toHaveBeenCalledWith('https://www.openstreetmap.org/copyright')
  })

  it('starts lookup only from its labelled action and exposes cooldown as transient disabled state', async () => {
    useSearch.mockReturnValue({ ...requestControls, status: 'idle', results: [], select: jest.fn(), retry: jest.fn() })
    const screen = await render(<MapCitySearchRecovery {...props} />)
    expect(requestControls.request).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByTestId('map-city-search-start'))
    expect(requestControls.request).toHaveBeenCalledTimes(1)
    useSearch.mockReturnValue({ ...requestControls, coolingDown: true, status: 'idle', results: [], select: jest.fn(), retry: jest.fn() })
    await screen.rerender(<MapCitySearchRecovery {...props} />)
    expect(screen.getByTestId('map-city-search-start').props.accessibilityState.disabled).toBe(true)
  })
})
