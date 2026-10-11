import React from 'react'
import { fireEvent, render, waitFor, within } from '@testing-library/react-native'
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

  it('offers the next radius from the empty state without duplicating radius presets', () => {
    const onFilterChange = jest.fn()
    const { getByLabelText, queryByTestId } = renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      onFilterChange,
    })

    expect(queryByTestId('radius-presets')).toBeNull()

    fireEvent.press(getByLabelText('Увеличить радиус до 100 километров'))
    expect(onFilterChange).toHaveBeenCalledWith('radius', '100')
  })

  it('resolves numeric selections for display and keeps unknown members when toggling chips', () => {
    const onFilterChange = jest.fn()
    const { getByTestId } = renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      onFilterChange,
      filterValue: { ...mockFilterValue, categoryTravelAddress: ['1', 'Unknown'] },
    })
    const museum = getByTestId('category-option-0')
    const unknown = getByTestId('category-option-1')
    expect(museum.props.accessibilityLabel).toBe('Museum')
    expect(museum.props.accessibilityState.selected).toBe(true)
    expect(unknown.props.accessibilityLabel).toBe('Unknown')
    expect(unknown.props.accessibilityState.selected).toBe(true)
    fireEvent.press(museum)
    expect(onFilterChange).toHaveBeenLastCalledWith('categoryTravelAddress', ['Unknown'])
    fireEvent.press(unknown)
    expect(onFilterChange).toHaveBeenLastCalledWith('categoryTravelAddress', ['Museum'])
  })

  it.each(['loading', 'error', 'ready'])('keeps unknown URL chips removable with an empty %s dictionary', (state) => {
    const onFilterChange = jest.fn()
    const { getByTestId } = renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      onFilterChange,
      filters: { ...mockFilters, categoryTravelAddress: [], categoryDictionaryState: state },
      filterValue: { ...mockFilterValue, categoryTravelAddress: ['43', 'Unknown'] },
    })
    expect(getByTestId('category-option-0').props.accessibilityLabel).toBe('43')
    expect(getByTestId('category-option-1').props.accessibilityLabel).toBe('Unknown')
    fireEvent.press(getByTestId('category-option-0'))
    expect(onFilterChange).toHaveBeenCalledWith('categoryTravelAddress', ['Unknown'])
  })

  it.each([false, true])('labels loaded point facets in the shared panel (mobile: %s)', (isMobile) => {
    const { getByTestId } = renderWithTheme(<FiltersPanel />, {
      ...defaultProps,
      isMobile,
      resultsTotal: 332,
      travelsData: [{ categoryName: 'Museum, Museum' }, { categoryName: 'Park' }],
    })
    expect(getByTestId('category-count-scope').props.children).toBe('Счётчики — по загруженным точкам')
    expect(within(getByTestId('category-option-0')).getByText('(1)')).toBeTruthy()
    expect(within(getByTestId('category-option-1')).getByText('(1)')).toBeTruthy()
  })
})
