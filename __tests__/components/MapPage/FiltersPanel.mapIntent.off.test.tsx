/**
 * #2887: сборка без `EXPO_PUBLIC_AI_PICKS` — строки «Опишите, что ищете» в панели нет,
 * запросов к `/ai/*` панель не делает, ручные фильтры на месте. Вариант с флагом —
 * `FiltersPanel.mapIntent.test.tsx`.
 */
delete process.env.EXPO_PUBLIC_AI_PICKS

import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import FiltersPanel from '@/components/MapPage/FiltersPanel'
import { FiltersProvider } from '@/context/MapFiltersContext'
import { ThemeProvider } from '@/hooks/useTheme'
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'

jest.mock('@/utils/fetchWithTimeout', () => ({ fetchWithTimeout: jest.fn(), fetchStatusWithTimeout: jest.fn() }))
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native')
  return {
    ...RN,
    useWindowDimensions: () => ({ width: 390, height: 844 }),
    Platform: { OS: 'web', select: jest.fn((obj) => obj.web || obj.default) },
  }
})

const contextProps = {
  filters: { categories: [], categoryTravelAddress: [{ id: 1, name: 'Музеи' }], radius: [{ id: '50', name: '50' }, { id: '100', name: '100' }], address: '' },
  filterValue: { categories: [], categoryTravelAddress: [], radius: '50', address: '', searchQuery: '' },
  onFilterChange: jest.fn(),
  resetFilters: jest.fn(),
  travelsData: [],
  filteredTravelsData: [],
  isMobile: true,
  closeMenu: jest.fn(),
  mode: 'radius' as const,
  setMode: jest.fn(),
  transportMode: 'car' as const,
  setTransportMode: jest.fn(),
  startAddress: '',
  endAddress: '',
  routeDistance: null,
  routePoints: [],
  onBuildRoute: jest.fn(),
  routeHintDismissed: false,
  onRouteHintDismiss: jest.fn(),
  onAddressSelect: jest.fn(),
  onAddressClear: jest.fn(),
  routingLoading: false,
  routingError: null,
  mapUiApi: null,
  userLocation: null,
  onPlaceSelect: jest.fn(),
  onOpenList: jest.fn(),
}

const renderPanel = (mode: 'radius' | 'route' = 'radius') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ThemeProvider>
        <FiltersProvider {...contextProps} mode={mode}>
          <FiltersPanel />
        </FiltersProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )

describe('FiltersPanel × строка «Опишите, что ищете» без флага (#2887)', () => {
  it('строки нет, запросов к /ai/* нет, поиск места работает', async () => {
    const utils = await renderPanel()
    await waitFor(() => expect(utils.getByTestId('map-search-input')).toBeTruthy())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(utils.queryByTestId('map-intent-row')).toBeNull()
    expect(utils.queryByTestId('map-intent-input')).toBeNull()
    expect(fetchWithTimeout).not.toHaveBeenCalled()
  })
})
