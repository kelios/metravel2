import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import FiltersPanel from '@/components/MapPage/FiltersPanel'
import { FiltersProvider } from '@/context/MapFiltersContext'
import { ThemeProvider } from '@/hooks/useTheme'

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native')
  return {
    ...RN,
    useWindowDimensions: () => ({ width: 1280, height: 800 }),
    Platform: { OS: 'web', select: jest.fn((obj) => obj.web || obj.default) },
  }
})

const mockFilters = {
  categories: [
    { id: 1, name: 'Museum' },
    { id: 2, name: 'Park' },
  ],
  categoryTravelAddress: [
    { id: 1, name: 'Museum' },
    { id: 2, name: 'Park' },
  ],
  radius: [
    { id: '60', name: '60' },
    { id: '100', name: '100' },
    { id: '200', name: '200' },
  ],
  address: '',
}

const mockFilterValue = {
  categories: [],
  categoryTravelAddress: [],
  radius: '60',
  address: '',
  searchQuery: '',
}

const defaultProps = {
  filters: mockFilters,
  filterValue: mockFilterValue,
  onFilterChange: jest.fn(),
  onTextFilterChange: jest.fn(),
  resetFilters: jest.fn(),
  travelsData: [],
  filteredTravelsData: [],
  isMobile: false,
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
  hideTopControls: false,
  hideFooterCta: false,
  hideFooterReset: false,
}

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

const renderWithTheme = (ui: React.ReactNode, contextProps: any = defaultProps) => {
  const queryClient = createQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <FiltersProvider {...contextProps}>{ui}</FiltersProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('FiltersPanel inline options', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows category options directly in the panel', async () => {
    const { getByTestId } = renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      travelsData: [
        { categoryName: 'Museum', name: 'History Hall', address: 'Center' },
        { categoryName: 'Museum, Park', name: 'Green Quarter', address: 'North' },
      ],
    })

    await waitFor(() => {
      expect(getByTestId('category-options')).toBeTruthy()
      expect(getByTestId('category-option-0')).toBeTruthy()
      expect(getByTestId('category-option-1')).toBeTruthy()
    })
  })

  it('falls back to categories from visible map points without opening a dropdown', async () => {
    const { getByTestId } = renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      filters: {
        ...mockFilters,
        categoryTravelAddress: [],
      },
      travelsData: [
        { categoryName: 'Castle', name: 'Old Castle', address: 'West' },
        { categoryName: 'Lake, Castle', name: 'Blue Lake', address: 'East' },
      ],
    })

    await waitFor(() => {
      expect(getByTestId('category-options')).toBeTruthy()
      expect(getByTestId('category-option-0')).toBeTruthy()
      expect(getByTestId('category-option-1')).toBeTruthy()
    })
  })

  it('toggles category chips directly from the visible list', () => {
    const onFilterChange = jest.fn()
    const { getByTestId } = renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      onFilterChange,
      filterValue: {
        ...mockFilterValue,
        categoryTravelAddress: ['Museum'],
      },
      travelsData: [
        { categoryName: 'Museum' },
        { categoryName: 'Park' },
      ],
    })

    fireEvent.press(getByTestId('category-option-1'))
    expect(onFilterChange).toHaveBeenCalledWith('categoryTravelAddress', ['Museum', 'Park'])

    fireEvent.press(getByTestId('category-option-0'))
    expect(onFilterChange).toHaveBeenCalledWith('categoryTravelAddress', [])
  })

  it('keeps radius presets visible and updates the selected radius', () => {
    const onFilterChange = jest.fn()
    const { getByTestId } = renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      onFilterChange,
    })

    expect(getByTestId('radius-presets-scroll')).toBeTruthy()
    expect(getByTestId('radius-presets')).toBeTruthy()

    fireEvent.press(getByTestId('radius-option-100'))
    expect(onFilterChange).toHaveBeenCalledWith('radius', '100')
  })
})
