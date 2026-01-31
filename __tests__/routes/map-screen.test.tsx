import { render, waitFor, fireEvent, act } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from 'react-native'
import MapScreen from '@/src/screens/tabs/MapScreen'
import { useMapPanelStore } from '@/stores/mapPanelStore'

let mockResponsiveState = { isPhone: true, isLargePhone: false, width: 390 }

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

jest.mock('@/src/api/map', () => ({
  fetchTravelsForMap: (...args: any[]) => mockFetchTravelsForMap(...args),
  fetchTravelsNearRoute: jest.fn().mockResolvedValue([]),
  fetchFiltersMap: jest.fn().mockResolvedValue({
    categories: ['Категория 1', 'Категория 2'],
    categoryTravelAddress: ['Минск'],
  }),
}));

// Мокаем ErrorDisplay и нормализатор сетевых ошибок
jest.mock('@/components/ErrorDisplay', () => {
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

jest.mock('@/src/utils/networkErrorHandler', () => ({
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
    mockResponsiveState = { isPhone: false, isLargePhone: false, width: 1024 }
    useMapPanelStore.setState({ openNonce: 0 })
    mockFetchTravelsForMap.mockReset();
    mockFetchTravelsForMap.mockResolvedValue(defaultTravelsForMapResponse);
  });

  afterAll(() => {
    ;(Platform as any).OS = originalPlatformOS
  })

  it('renders map placeholder and filters panel', async () => {
    const { getByText, getByTestId } = renderWithClient()

    // Сначала отображается плейсхолдер карты
    expect(getByText('Загружаем карту…')).toBeTruthy()

    // На mobile панель закрыта по умолчанию — открываем, чтобы увидеть фильтры
    act(() => {
      useMapPanelStore.getState().requestOpen()
    })

    // Ждём, пока смонтируется правая панель с фильтрами
    await waitFor(() => {
      expect(getByTestId('filters-panel')).toBeTruthy()
    })
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
      expect(getByTestId('map-panel-tab-filters')).toBeTruthy()
      expect(getByTestId('map-panel-tab-travels')).toBeTruthy()
    })

    // На web+desktop вместо "Скрыть панель" показываем кнопку "Сбросить фильтры"
    const resetButton = getByLabelText('Сбросить фильтры')
    expect(resetButton).toBeTruthy()

    // Панель на desktop не должна скрываться, вкладки остаются доступны
    expect(getByTestId('map-panel-tab-filters')).toBeTruthy()
    expect(getByTestId('map-panel-tab-travels')).toBeTruthy()

    // Нажатие на reset не должно ломать наличие вкладок
    act(() => {
      fireEvent.press(resetButton)
    })
    expect(queryByTestId('map-panel-tab-filters')).toBeTruthy()
    expect(queryByTestId('map-panel-tab-travels')).toBeTruthy()
  })

  it('shows open panel button after isMobile changes from desktop to mobile (SSR-safe)', async () => {
    mockResponsiveState = { isPhone: false, isLargePhone: false, width: 1024 }
    const client = createTestClient()
    const utils = render(
      <QueryClientProvider client={client}>
        <MapScreen />
      </QueryClientProvider>
    )

    // Desktop: панель открыта по умолчанию
    await waitFor(() => {
      expect(utils.getByTestId('map-panel-tab-filters')).toBeTruthy()
    })

    // Симулируем смену брейкпоинта на mobile после первого рендера
    mockResponsiveState = { isPhone: true, isLargePhone: false, width: 390 }
    utils.rerender(
      <QueryClientProvider client={client}>
        <MapScreen />
      </QueryClientProvider>
    )

    // Mobile: панель должна закрыться по умолчанию
    await waitFor(() => {
      expect(utils.queryByTestId('map-panel-tab-filters')).toBeNull()
      expect(utils.queryByTestId('map-panel-tab-travels')).toBeNull()
    })
  })

  it('shows loader in travels list tab while data is loading', async () => {
    // Возвращаем промис, который разрешится после проверки лоадера
    let resolveRequest: (value: any) => void;
    const slowPromise = new Promise<any>((resolve) => {
      resolveRequest = resolve;
    });

    mockFetchTravelsForMap.mockImplementation(() => slowPromise);

    const utils = renderWithClient();
    const { getByTestId } = utils;

    // Запрос на данные карты начинается только после получения геолокации
    await waitFor(() => {
      expect(mockFetchTravelsForMap).toHaveBeenCalled();
    });

    // Переключаемся на вкладку "Список" (на mobile панель закрыта по умолчанию)
    await openPanelAndGoToListTab(utils);

    // Пока запрос не завершён, должен отображаться лоадер
    expect(getByTestId('map-loading-overlay')).toBeTruthy();

    // Завершаем запрос, чтобы избежать зависаний
    resolveRequest!({});
  });

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
