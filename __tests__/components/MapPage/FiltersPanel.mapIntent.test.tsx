/**
 * #2887: строка «Опишите, что ищете» в панели фильтров под `EXPO_PUBLIC_AI_PICKS`
 * (ленивый чанк по литеральному флагу в `FiltersPanelBody`): с флагом строка есть в
 * режиме радиуса и не делает запросов, пока посетитель ничего не ввёл; в режиме
 * маршрута её нет. Сборка без флага — `FiltersPanel.mapIntent.off.test.tsx`
 * (`React.lazy` держит одну ветку на экземпляр модуля, поэтому два файла).
 */
process.env.EXPO_PUBLIC_AI_PICKS = '1'

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

describe('FiltersPanel × строка «Опишите, что ищете» с флагом (#2887)', () => {
  it('строка появляется в режиме радиуса над поиском места без запросов к /ai/*', async () => {
    const utils = await renderPanel()
    await waitFor(() => expect(utils.getByTestId('map-intent-row')).toBeTruthy())
    expect(utils.getByTestId('map-intent-input').props.placeholder).toBe('Например: замки и смотровые в 50 км от Гродно')
    expect(utils.getByTestId('map-search-input')).toBeTruthy()
    expect(fetchWithTimeout).not.toHaveBeenCalled()
  })

  it('в режиме маршрута строки нет', async () => {
    const utils = await renderPanel('route')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(utils.queryByTestId('map-intent-row')).toBeNull()
    expect(fetchWithTimeout).not.toHaveBeenCalled()
  })
})
