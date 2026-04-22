import { render, waitFor, fireEvent, act } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from 'react-native'
import MapScreen from '@/screens/tabs/MapScreen'
import { useMapPanelStore } from '@/stores/mapPanelStore'
import { useRouteStore } from '@/stores/routeStore'

let mockResponsiveState = { isPhone: true, isLargePhone: false, isMobile: true, width: 390 }

const originalPlatformOS = Platform.OS

jest.mock('@/hooks/usePanelController', () => {
  const React = require('react')
  return {
    __esModule: true,
    usePanelController: (isMobile: boolean) => ({
      ...(function usePanelControllerMock() {
        const [isPanelVisible, setIsPanelVisible] = React.useState(!isMobile)

        return {
          isPanelVisible,
          openPanel: jest.fn(() => setIsPanelVisible(true)),
          closePanel: jest.fn(() => setIsPanelVisible(false)),
          panelStyle: {},
          overlayStyle: {},
        }
      })(),
    }),
  }
})

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockResponsiveState,
}))

jest.mock('@/hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value: any) => value,
}))

// Мокаем expo-router/usePathname, чтобы не тянуть реальный роутер
jest.mock('expo-router', () => ({
  usePathname: () => '/map',
  useLocalSearchParams: () => ({}),
}))

// Мокаем useIsFocused, чтобы SEO-часть не отваливалась
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native')
  return {
    ...actual,
    useIsFocused: () => true,
  }
})

// Мокаем InstantSEO как no-op компонент
jest.mock('@/components/seo/InstantSEO', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: ({ children }: any) =>
      children ? React.createElement(React.Fragment, null, children) : null,
  }
})

// Мокаем тяжёлый MapPanel простой заглушкой
jest.mock('@/components/MapPage/MapPanel', () => {
  const React = require('react')
  const { View, Text } = require('react-native')
  return {
    __esModule: true,
    default: ({ travelsData }: any) =>
      React.createElement(
        View,
        { testID: 'map-panel' },
        React.createElement(Text, null, 'MockMapPanel'),
        React.createElement(Text, { testID: 'travels-count' }, travelsData?.length ?? 0),
      ),
  }
})

// Мокаем FiltersPanel, чтобы не тянуть сложную форму
jest.mock('@/components/MapPage/FiltersPanel', () => {
  const React = require('react')
  const { View, Text } = require('react-native')
  return {
    __esModule: true,
    default: () =>
      React.createElement(
        View,
        { testID: 'filters-panel' },
        React.createElement(Text, null, 'FiltersPanel'),
      ),
  }
})

// Мокаем TravelListPanel, чтобы проверить передачу данных
jest.mock('@/components/MapPage/TravelListPanel', () => {
  const React = require('react')
  const { View, Text } = require('react-native')
  return {
    __esModule: true,
    default: ({ travelsData, isLoading }: any) =>
      React.createElement(
        View,
        { testID: 'travel-list-panel' },
        isLoading ? React.createElement(Text, null, 'Загрузка...') : React.createElement(Text, null, 'TravelListPanel'),
        React.createElement(Text, { testID: 'list-count' }, travelsData?.length ?? 0),
      ),
  }
})

// Мокаем expo-location, чтобы не дёргать реальные разрешения
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 53.9, longitude: 27.56 },
  }),
}))

// Мокаем сетевые запросы карты (можно перенастраивать в тестах)
const mockFetchTravelsForMap = jest.fn().mockResolvedValue({
  a: {
    id: 1,
    categoryName: 'Категория 1',
    coord: '53.95,27.60',
    lat: '53.95',
    lng: '27.60',
    travelImageThumbUrl: '',
    urlTravel: '',
  },
  b: {
    id: 2,
    categoryName: 'Категория 2',
    coord: '53.92,27.55',
    lat: '53.92',
    lng: '27.55',
    travelImageThumbUrl: '',
    urlTravel: '',
  },
});
const mockFetchFiltersMap = jest.fn().mockResolvedValue({
  categories: ['Категория 1', 'Категория 2'],
  categoryTravelAddress: ['Минск'],
});

const defaultTravelsForMapResponse = {
  a: {
    id: 1,
    categoryName: 'Категория 1',
    coord: '53.95,27.60',
    lat: '53.95',
    lng: '27.60',
    travelImageThumbUrl: '',
    urlTravel: '',
  },
  b: {
    id: 2,
    categoryName: 'Категория 2',
    coord: '53.92,27.55',
    lat: '53.92',
    lng: '27.55',
    travelImageThumbUrl: '',
    urlTravel: '',
  },
};

jest.mock('@/api/map', () => ({
  fetchTravelsForMap: (...args: any[]) => mockFetchTravelsForMap(...args),
  fetchTravelsNearRoute: jest.fn().mockResolvedValue([]),
  fetchFiltersMap: jest.fn().mockResolvedValue({
    categories: ['Категория 1', 'Категория 2'],
    categoryTravelAddress: ['Минск'],
  }),
}));

// Мокаем ErrorDisplay и нормализатор сетевых ошибок
jest.mock('@/components/ui/ErrorDisplay', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ message }: any) =>
      React.createElement(
        View,
        { testID: 'error-display' },
        React.createElement(Text, null, message),
      ),
  };
});

jest.mock('@/utils/networkErrorHandler', () => ({
  getUserFriendlyNetworkError: () => ({ message: 'Сетевая ошибка' }),
}));

// Утилита для клиента React Query
const createTestClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

const renderWithClient = () => {
  const client = createTestClient()
  return render(
    <QueryClientProvider client={client}>
      <MapScreen />
    </QueryClientProvider>
  )
}

describe('MapScreen (map tab)', () => {
  beforeEach(() => {
    ;(Platform as any).OS = 'web'
    mockResponsiveState = { isPhone: false, isLargePhone: false, isMobile: false, width: 1024 }
    // Reset useWindowDimensions to desktop viewport (used by useMapResponsive)
    const RN = require('react-native');
    const api = require('@/api/map');
    (RN.useWindowDimensions as jest.Mock).mockReturnValue({ width: 1024, height: 768 });
    useMapPanelStore.setState({ openNonce: 0 })
    mockFetchTravelsForMap.mockReset();
    mockFetchTravelsForMap.mockResolvedValue(defaultTravelsForMapResponse);
    mockFetchFiltersMap.mockReset();
    mockFetchFiltersMap.mockResolvedValue({
      categories: ['Категория 1', 'Категория 2'],
      categoryTravelAddress: ['Минск'],
    });
    api.fetchFiltersMap.mockResolvedValue({
      categories: ['Категория 1', 'Категория 2'],
      categoryTravelAddress: ['Минск'],
    });
    useRouteStore.setState({
      mode: 'radius',
      transportMode: 'car',
      points: [],
      route: null,
      isBuilding: false,
      error: null,
    });
  });

  afterAll(() => {
    ;(Platform as any).OS = originalPlatformOS
  })

  it('renders map placeholder and filters panel shell', async () => {
    const { queryByTestId, getByTestId, getByText } = renderWithClient()

    // On web mapReady=true from the start, so overlay should NOT be present.
    // Data loading is indicated by MapLoadingBar (thin progress bar), not by the full overlay.
    expect(queryByTestId('map-loading-overlay')).toBeNull()

    act(() => {
      useMapPanelStore.getState().requestOpen()
    })

    await waitFor(() => {
      expect(getByTestId('map-panel-tab-search')).toBeTruthy()
      expect(getByTestId('map-panel-tab-route')).toBeTruthy()
      expect(getByTestId('map-reset-filters-button')).toBeTruthy()
      expect(getByText('Загрузка фильтров…')).toBeTruthy()
    })
  })

  it('shows the sightseeing quick filter after map categories load', async () => {
    const { getByLabelText } = renderWithClient()

    await waitFor(() => {
      expect(mockFetchTravelsForMap).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(getByLabelText('Что посмотреть: Все')).toBeTruthy()
    })
  })

  it('falls back to categories from map points when filterformap returns no sightseeing options', async () => {
    const api = require('@/api/map')

    mockFetchFiltersMap.mockResolvedValue({
      categories: [],
      categoryTravelAddress: [],
    })
    api.fetchFiltersMap.mockResolvedValue({
      categories: [],
      categoryTravelAddress: [],
    })
    mockFetchTravelsForMap.mockResolvedValue({
      a: {
        id: 1,
        categoryName: 'Замок',
        coord: '53.95,27.60',
        lat: '53.95',
        lng: '27.60',
        travelImageThumbUrl: '',
        urlTravel: '',
      },
      b: {
        id: 2,
        categoryName: 'Болото, Замок',
        coord: '53.92,27.55',
        lat: '53.92',
        lng: '27.55',
        travelImageThumbUrl: '',
        urlTravel: '',
      },
    })

    const { getByLabelText } = renderWithClient()

    await waitFor(() => {
      expect(mockFetchTravelsForMap).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(getByLabelText('Что посмотреть: Все')).toBeTruthy()
    })
  })

  it('shows overlays quick filter on the map header', async () => {
    const { getByLabelText } = renderWithClient()

    await waitFor(() => {
      expect(mockFetchTravelsForMap).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(getByLabelText('Оверлеи: Выкл')).toBeTruthy()
    })
  })

  it('does not render a separate floating radius pill on desktop web', async () => {
    const { getByTestId, queryByTestId } = renderWithClient()

    await waitFor(() => {
      expect(mockFetchTravelsForMap).toHaveBeenCalled()
    })

    expect(getByTestId('map-quick-filters')).toBeTruthy()
    expect(queryByTestId('map-radius-pill')).toBeNull()
  })

  const openPanelAndGoToListTab = async (utils: ReturnType<typeof renderWithClient>) => {
    const { getByTestId } = utils

    act(() => {
      useMapPanelStore.getState().requestOpen()
    })

    await waitFor(() => {
      expect(getByTestId('map-panel-tab-travels')).toBeTruthy()
    })

    const listTab = getByTestId('map-panel-tab-travels')
    fireEvent.press(listTab)
  }

  it('toggles right panel visibility using close and open buttons', async () => {
    const { getByTestId, queryByTestId, getByLabelText } = renderWithClient()

    // На mobile панель закрыта по умолчанию — открываем
    act(() => {
      useMapPanelStore.getState().requestOpen()
    })

    await waitFor(() => {
      expect(getByTestId('map-panel-tab-search')).toBeTruthy()
      expect(getByTestId('map-panel-tab-route')).toBeTruthy()
      expect(getByTestId('map-panel-tab-travels')).toBeTruthy()
    })

    // На web+desktop вместо "Скрыть панель" показываем кнопку "Сбросить фильтры"
    const resetButton = getByLabelText('Сбросить фильтры')
    expect(resetButton).toBeTruthy()

    // Панель на desktop не должна скрываться, вкладки остаются доступны
    expect(getByTestId('map-panel-tab-search')).toBeTruthy()
    expect(getByTestId('map-panel-tab-route')).toBeTruthy()
    expect(getByTestId('map-panel-tab-travels')).toBeTruthy()

    // Нажатие на reset не должно ломать наличие вкладок
    act(() => {
      fireEvent.press(resetButton)
    })
    expect(queryByTestId('map-panel-tab-search')).toBeTruthy()
    expect(queryByTestId('map-panel-tab-route')).toBeTruthy()
    expect(queryByTestId('map-panel-tab-travels')).toBeTruthy()
  })

  it('shows correct travels count in list tab after data is loaded', async () => {
    const utils = renderWithClient();
    const { getByTestId } = utils;

    // Запрос на данные карты начинается только после получения геолокации
    await waitFor(() => {
      expect(mockFetchTravelsForMap).toHaveBeenCalled();
    });

    // Переключаемся на вкладку "Список" (на mobile панель закрыта по умолчанию)
    await openPanelAndGoToListTab(utils);

    // Ждём, пока данные загрузятся и попадут в моки панели списка
    await waitFor(() => {
      expect(getByTestId('list-count').props.children).toBe(2);
    });

    // Количество отображается в панели списка
  });

  it('clears route state when switching from route tab back to search', async () => {
    useRouteStore.setState({
      mode: 'route',
      transportMode: 'foot',
      points: [
        {
          id: 'start',
          coordinates: { lat: 53.9, lng: 27.56 },
          address: 'Start',
          type: 'start',
          timestamp: 1,
        },
        {
          id: 'end',
          coordinates: { lat: 53.91, lng: 27.57 },
          address: 'End',
          type: 'end',
          timestamp: 2,
        },
      ],
      route: null,
      isBuilding: false,
      error: null,
    });

    const { getByTestId, queryByText } = renderWithClient();

    act(() => {
      useMapPanelStore.getState().requestOpen();
    });

    await waitFor(() => {
      expect(getByTestId('map-panel-tab-search')).toBeTruthy();
    });

    fireEvent.press(getByTestId('map-panel-tab-search'));

    await waitFor(() => {
      expect(useRouteStore.getState().mode).toBe('radius');
      expect(useRouteStore.getState().points).toHaveLength(0);
    });

    expect(queryByText('Пешком')).toBeNull();
  });

  it('does not render floating list pill on mobile web', async () => {
    mockResponsiveState = { isPhone: true, isLargePhone: false, isMobile: true, width: 390 };
    // Override useWindowDimensions mock to simulate mobile viewport (used by useMapResponsive)
    const RN = require('react-native');
    (RN.useWindowDimensions as jest.Mock).mockReturnValue({ width: 390, height: 844 });

    const { queryByLabelText } = renderWithClient();

    await waitFor(() => {
      expect(mockFetchTravelsForMap).toHaveBeenCalled();
    });

    // On mobile web, the separate floating list pill (MapShowListButton) should NOT render
    // (it is only for desktop). Mobile uses the integrated bottom sheet list.
    expect(queryByLabelText('Показать 2 места списком')).toBeNull();
  });

  it('shows error display when map data loading fails', async () => {
    mockFetchTravelsForMap.mockRejectedValue(new Error('Network error'));

    const utils = renderWithClient();
    const { getByText, getByTestId } = utils;

    // Запрос на данные карты начинается только после получения геолокации
    await waitFor(() => {
      expect(mockFetchTravelsForMap).toHaveBeenCalled();
    });

    // Ожидаем отображение компонента ошибки
    await waitFor(() => {
      expect(getByTestId('error-display')).toBeTruthy();
    });

    // Сообщение берётся из getUserFriendlyNetworkError (замокано как "Сетевая ошибка")
    expect(getByText('Сетевая ошибка')).toBeTruthy();
  });
})
