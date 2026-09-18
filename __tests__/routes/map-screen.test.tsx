import React from 'react'
import { render, waitFor, fireEvent, act } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from 'react-native'
import { Helmet, HelmetProvider, type HelmetServerState } from 'expo-router/vendor/react-helmet-async/lib'
import MapScreen from '@/screens/tabs/MapScreen'
import LazyInstantSEO from '@/components/seo/LazyInstantSEO'
import { useMapPanelStore } from '@/stores/mapPanelStore'
import { useRouteStore } from '@/stores/routeStore'

const readHelmetJsonLd = (screen: ReturnType<typeof render>) => {
  const { additionalTags } = screen.UNSAFE_root.findByType(LazyInstantSEO).props
  const context: { helmet?: HelmetServerState } = {}
  const originalCanUseDOM = HelmetProvider.canUseDOM
  let helmetScreen: ReturnType<typeof render> | undefined
  HelmetProvider.canUseDOM = false
  try {
    helmetScreen = render(
      <HelmetProvider context={context}>
        <Helmet>{additionalTags}</Helmet>
      </HelmetProvider>,
    )
    const html = context.helmet?.script.toString() ?? ''
    const template = document.createElement('template')
    template.innerHTML = html
    const scripts = template.content.querySelectorAll('script')
    return { html, scripts }
  } finally {
    helmetScreen?.unmount()
    HelmetProvider.canUseDOM = originalCanUseDOM
  }
}

let mockResponsiveState = { isPhone: true, isLargePhone: false, isMobile: true, width: 390 }
let mockSearchParams: Record<string, string> = {}
const mockMapMobileLayout = jest.fn()

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
  useDebouncedValueWithPending: (value: any) => [value, false],
}))

// Мокаем expo-router/usePathname, чтобы не тянуть реальный роутер
jest.mock('expo-router', () => ({
  usePathname: () => '/map',
  useLocalSearchParams: () => mockSearchParams,
  useIsFocused: () => true,
}))

jest.mock('@/components/MapPage/MapMobileLayout', () => {
  const React = require('react')
  const { View, Text } = require('react-native')
  return {
    __esModule: true,
    MapMobileLayout: (props: any) => {
      mockMapMobileLayout(props)
      return React.createElement(
        View,
        { testID: 'map-mobile-layout' },
        React.createElement(Text, { testID: 'map-mobile-selected-place' }, props.selectedPlace?.address ?? ''),
      )
    },
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
    mockSearchParams = {}
    mockMapMobileLayout.mockClear()
    mockResponsiveState = { isPhone: false, isLargePhone: false, isMobile: false, width: 1024 }
    // Reset useWindowDimensions to desktop viewport (used by useMapResponsive)
    const RN = require('react-native');
    const api = require('@/api/map');
    (RN.useWindowDimensions as jest.Mock).mockReturnValue({ width: 1024, height: 768 });
    useMapPanelStore.setState({
      commandNonce: 0,
      command: { kind: 'open', tab: 'filters' },
      openNonce: 0,
      requestedTab: 'filters',
      toggleNonce: 0,
    })
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
    const { queryByTestId, getByTestId } = renderWithClient()

    // On web mapReady=true from the start, so overlay should NOT be present.
    // Data loading is indicated by MapLoadingBar (thin progress bar), not by the full overlay.
    expect(queryByTestId('map-loading-overlay')).toBeNull()

    act(() => {
      useMapPanelStore.getState().requestOpen()
    })

    await waitFor(() => {
      // На desktop фильтры — кнопка-иконка, а сегмент сводится к 2 вкладкам.
      expect(getByTestId('map-filters-button')).toBeTruthy()
      expect(getByTestId('map-panel-tab-route')).toBeTruthy()
      expect(getByTestId('map-panel-tab-travels')).toBeTruthy()
      expect(getByTestId('map-reset-filters-button')).toBeTruthy()
      expect(getByTestId('filters-panel')).toBeTruthy()
    })
  })

  it('does not render a separate floating radius pill on desktop web', async () => {
    const { queryByTestId } = renderWithClient()

    await waitFor(() => {
      expect(mockFetchTravelsForMap).toHaveBeenCalled()
    })

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
      expect(getByTestId('map-filters-button')).toBeTruthy()
      expect(getByTestId('map-panel-tab-route')).toBeTruthy()
      expect(getByTestId('map-panel-tab-travels')).toBeTruthy()
    })

    // На web+desktop вместо "Скрыть панель" показываем кнопку "Сбросить фильтры"
    const resetButton = getByLabelText('Сбросить фильтры')
    expect(resetButton).toBeTruthy()

    // Панель на desktop не должна скрываться, вкладки/фильтры остаются доступны
    expect(getByTestId('map-filters-button')).toBeTruthy()
    expect(getByTestId('map-panel-tab-route')).toBeTruthy()
    expect(getByTestId('map-panel-tab-travels')).toBeTruthy()

    // Нажатие на reset не должно ломать наличие вкладок
    act(() => {
      fireEvent.press(resetButton)
    })
    expect(queryByTestId('map-filters-button')).toBeTruthy()
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
      expect(getByTestId('map-filters-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('map-filters-button'));

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

  it('surfaces a selected place from URL params for mobile map deep links', async () => {
    mockResponsiveState = { isPhone: true, isLargePhone: false, isMobile: true, width: 390 };
    mockSearchParams = {
      lat: '53.9',
      lng: '27.56',
      radius: '5',
      categories: 'Парковка',
      placeId: 'place-1',
      placeTitle: 'Парковка у озера',
      placeAddress: 'Минск, Беларусь',
      placeCategory: 'Парковка',
      placeTravelUrl: '/travels/parking',
      placeTravelId: '646',
    };
    const RN = require('react-native');
    (RN.useWindowDimensions as jest.Mock).mockReturnValue({ width: 390, height: 844 });

    renderWithClient();

    await waitFor(() => {
      expect(mockMapMobileLayout).toHaveBeenCalled();
    });

    const lastProps = mockMapMobileLayout.mock.calls.at(-1)?.[0];
    expect(lastProps?.selectedPlace).toEqual(expect.objectContaining({
      id: 'place-1',
      coord: '53.9,27.56',
      address: 'Минск, Беларусь',
      categoryName: 'Парковка',
      urlTravel: '/travels/parking',
      // #1960: id статьи из deep-link /places доходит до нижней карточки места.
      travelId: 646,
    }));
  });

  it('builds /map JSON-LD with canonical travel urls on the site host (#1960)', async () => {
    mockFetchTravelsForMap.mockResolvedValue({
      a: {
        ...defaultTravelsForMapResponse.a,
        address: 'Форты Кракова',
        // Локальный API строит ссылку от своего хоста и пока добавляет `?id=`.
        urlTravel: 'http://localhost:8000/travels/forty-krakova?id=435',
      },
      b: {
        ...defaultTravelsForMapResponse.b,
        address: 'Минск за выходные',
        urlTravel: 'https://metravel.by/travels/minsk-za-vykhodnye#points',
      },
    });

    const screen = renderWithClient();
    const { UNSAFE_root } = screen;

    const readJsonLd = () =>
      UNSAFE_root.findAll(
        (node: any) => node.type === 'script' && node.props?.type === 'application/ld+json',
      ).map((node: any) => String(node.props.children ?? node.props.dangerouslySetInnerHTML?.__html ?? ''));

    await waitFor(() => {
      expect(readJsonLd().some((html) => html.includes('forty-krakova'))).toBe(true);
    });

    const html = readJsonLd().find((value) => value.includes('forty-krakova')) ?? '';
    const graph = JSON.parse(html)['@graph'] as Array<Record<string, any>>;
    const itemList = graph.find((node) => node['@type'] === 'ItemList');
    const urls = (itemList?.itemListElement ?? []).map((entry: any) => entry.item?.url);

    expect(urls).toEqual([
      'https://metravel.by/travels/forty-krakova',
      'https://metravel.by/travels/minsk-za-vykhodnye',
    ]);
    expect(html).not.toContain('?id=');
    expect(html).not.toContain('localhost');

    const helmet = readHelmetJsonLd(screen);
    expect(helmet.scripts).toHaveLength(1);
    expect(helmet.scripts[0].type).toBe('application/ld+json');
    expect(helmet.scripts[0].getAttribute('data-rh')).toBe('true');
    expect(helmet.html).toContain('forty-krakova');
    expect(helmet.html).not.toContain('?id=');
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
