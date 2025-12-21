import { render, waitFor, fireEvent } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MapScreen from '@/app/(tabs)/map'

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
    default: ({ travelsData }: any) =>
      React.createElement(
        View,
        { testID: 'travel-list-panel' },
        React.createElement(Text, null, 'TravelListPanel'),
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
  a: { id: 1, categoryName: 'Категория 1' },
  b: { id: 2, categoryName: 'Категория 2' },
});

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
  getUserFriendlyNetworkError: () => 'Сетевая ошибка',
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
  it('renders map placeholder and filters panel', async () => {
    const { getByText, getByTestId } = renderWithClient()

    // Сначала отображается плейсхолдер карты
    expect(getByText('Загружаем карту…')).toBeTruthy()

    // Ждём, пока смонтируется правая панель с фильтрами
    await waitFor(() => {
      expect(getByTestId('filters-panel')).toBeTruthy()
    })
  })

  it('toggles right panel visibility using close and open buttons', async () => {
    const { getByText, queryByText, getByLabelText } = renderWithClient()

    // Дождаться появления панели
    await waitFor(() => {
      expect(getByText('Фильтры')).toBeTruthy()
    })

    // Закрываем панель кнопкой "Скрыть панель"
    const closeButton = getByLabelText('Скрыть панель')
    fireEvent.press(closeButton)

    // Текст вкладок больше не отображается
    expect(queryByText('Фильтры')).toBeNull()
    expect(queryByText('Список')).toBeNull()

    // Открываем панель снова кнопкой-гамбургером
    const openButton = getByLabelText('Показать панель')
    fireEvent.press(openButton)

    await waitFor(() => {
      expect(getByText('Фильтры')).toBeTruthy()
      expect(getByText('Список')).toBeTruthy()
    })
  })

  it('shows loader in travels list tab while data is loading', async () => {
    // Возвращаем промис, который разрешится после проверки лоадера
    let resolveRequest: (value: any) => void;
    const slowPromise = new Promise<any>((resolve) => {
      resolveRequest = resolve;
    });

    mockFetchTravelsForMap.mockImplementationOnce(() => slowPromise);

    const { getByText } = renderWithClient();

    // Запрос на данные карты начинается только после получения геолокации
    await waitFor(() => {
      expect(mockFetchTravelsForMap).toHaveBeenCalled();
    });

    // Переключаемся на вкладку "Список"
    const listTab = getByText('Список');
    fireEvent.press(listTab);

    // Пока запрос не завершён, должен отображаться лоадер
    expect(getByText('Загрузка...')).toBeTruthy();

    // Завершаем запрос, чтобы избежать зависаний
    resolveRequest!({});
  });

  it('shows correct travels count in list tab after data is loaded', async () => {
    const { getByText, getByTestId } = renderWithClient();

    // Запрос на данные карты начинается только после получения геолокации
    await waitFor(() => {
      expect(mockFetchTravelsForMap).toHaveBeenCalled();
    });

    // Переключаемся на вкладку "Список"
    const listTab = getByText('Список');
    fireEvent.press(listTab);

    // Ждём, пока данные загрузятся и попадут в моки панели списка
    await waitFor(() => {
      expect(getByTestId('list-count').props.children).toBe(2);
    });

    // В тексте вкладки также отображается количество мест
    const travelsCountLabel = getByText('2 мест');
    expect(travelsCountLabel).toBeTruthy();
  });

  it('shows error display when map data loading fails', async () => {
    mockFetchTravelsForMap.mockRejectedValueOnce(new Error('Network error'));

    const { getByText, getByTestId } = renderWithClient();

    // Запрос на данные карты начинается только после получения геолокации
    await waitFor(() => {
      expect(mockFetchTravelsForMap).toHaveBeenCalled();
    });

    // Переключаемся на вкладку "Список"
    const listTab = getByText('Список');
    fireEvent.press(listTab);

    // Ожидаем отображение компонента ошибки
    await waitFor(() => {
      expect(getByTestId('error-display')).toBeTruthy();
    });

    // Сообщение берётся из getUserFriendlyNetworkError (замокано как "Сетевая ошибка")
    expect(getByText('Сетевая ошибка')).toBeTruthy();
  });
})
