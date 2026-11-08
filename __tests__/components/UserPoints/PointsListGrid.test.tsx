import { render } from '@testing-library/react-native';

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: {
      ...RN.Platform,
      OS: 'web',
    },
  };
});

// #1814 — сетка перешла на общий вьюпорт-хук фичи (`useResponsiveWidth`),
// поэтому десктопная ширина задаётся тем же источником, что и у `PointsList`,
// а не заглушкой `useWindowDimensions`.
jest.mock('@/hooks/useResponsive', () => {
  const actual = jest.requireActual('@/hooks/useResponsive');
  return {
    ...actual,
    useResponsiveWidth: () => 1280,
  };
});

const userPointsMapProps: any[] = [];

jest.mock('@/components/UserPoints/UserPointsMap', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    UserPointsMap: (props: any) => {
      userPointsMapProps.push(props);
      return <View testID="mock-userpoints-map" />;
    },
  };
});

jest.mock('@/api/external/nominatim', () => ({
  nominatimSearch: jest.fn(),
}));

const { PointsListGrid } = require('@/components/UserPoints/PointsListGrid');

describe('PointsListGrid', () => {
  const styles: any = {
    mapInner: {},
    locateFab: {},
    locateFabDisabled: {},
    mapContainer: {},
  };

  beforeEach(() => {
    userPointsMapProps.length = 0;
  });

  it('bounds the initial web side-panel list render', async () => {
    (require('react-native').Platform as any).OS = 'web';

    const points = Array.from({ length: 120 }, (_, index) => ({
      id: index + 1,
      name: `Point ${index + 1}`,
      latitude: 53 + index / 1000,
      longitude: 27 + index / 1000,
    }));

    const utils = await render(
      <PointsListGrid
        styles={styles}
        colors={{ text: '#111' }}
        viewMode="map"
        isLoading={false}
        filteredPoints={points}
        renderHeader={() => <></>}
        renderItem={({ item }) => {
          const { Text } = require('react-native');
          return <Text testID="userpoints-rendered-row">{String(item.name)}</Text>;
        }}
        renderEmpty={() => <></>}
        onRefresh={jest.fn()}
        currentLocation={null}
        onMapPress={jest.fn()}
        showManualAdd={false}
        manualCoords={null}
        manualColor={null}
        isLocating={false}
        onLocateMe={jest.fn()}
        showingRecommendations={false}
        onCloseRecommendations={jest.fn()}
        onRefreshRecommendations={jest.fn()}
        searchQuery=""
        onSearch={jest.fn()}
        hasFilters={false}
        onResetFilters={jest.fn()}
      />
    );

    expect(utils.getByTestId('userpoints-panel-content-list')).toBeTruthy();
    // #3133: web-панель — тот же виртуализированный FlashList, что и native;
    // в jest он замокан и рисует всё переданное, окно рендера — забота FlashList.
    expect(utils.queryAllByTestId('userpoints-rendered-row')).toHaveLength(points.length);
    expect(utils.queryByTestId('userpoints-list-skeleton')).toBeNull();
    expect(utils.queryByTestId('userpoints-list-progress')).toBeNull();
  });

  const baseProps = (overrides: Record<string, unknown>) => ({
    styles,
    colors: { text: '#111' },
    viewMode: 'map' as const,
    isLoading: false,
    filteredPoints: [] as any[],
    renderHeader: () => <></>,
    renderItem: ({ item }: { item: any }) => {
      const { Text } = require('react-native');
      return <Text testID="userpoints-rendered-row">{String(item.name)}</Text>;
    },
    renderEmpty: () => {
      const { Text } = require('react-native');
      return <Text testID="userpoints-empty">empty</Text>;
    },
    onRefresh: jest.fn(),
    currentLocation: null,
    onMapPress: jest.fn(),
    showManualAdd: false,
    manualCoords: null,
    manualColor: null,
    isLocating: false,
    onLocateMe: jest.fn(),
    showingRecommendations: false,
    onCloseRecommendations: jest.fn(),
    onRefreshRecommendations: jest.fn(),
    searchQuery: '',
    onSearch: jest.fn(),
    hasFilters: false,
    onResetFilters: jest.fn(),
    ...overrides,
  });

  it('shows card skeletons and «…» in the tab while the first page loads (#3133)', async () => {
    (require('react-native').Platform as any).OS = 'web';
    const utils = await render(<PointsListGrid {...(baseProps({ isLoading: true }) as any)} />);

    // Каркас скрыт от скринридера (importantForAccessibility), поэтому ищем с includeHiddenElements.
    expect(utils.getByTestId('userpoints-list-skeleton', { includeHiddenElements: true })).toBeTruthy();
    expect(utils.queryByTestId('userpoints-empty')).toBeNull();
    expect(utils.getByText('Список (…)')).toBeTruthy();
  });

  it('shows the empty state and a formatted count once loaded', async () => {
    (require('react-native').Platform as any).OS = 'web';
    const utils = await render(<PointsListGrid {...(baseProps({ isLoading: false }) as any)} />);

    expect(utils.getByTestId('userpoints-empty')).toBeTruthy();
    expect(utils.queryByTestId('userpoints-list-skeleton', { includeHiddenElements: true })).toBeNull();
    expect(utils.getByText('Список (0)')).toBeTruthy();
  });

  it('renders the streaming progress footer until the collection is complete', async () => {
    (require('react-native').Platform as any).OS = 'web';
    const points = Array.from({ length: 1200 }, (_, index) => ({ id: index + 1, name: `P${index + 1}`, latitude: 53, longitude: 27 }));
    const utils = await render(
      <PointsListGrid
        {...(baseProps({
          filteredPoints: points,
          loadProgress: { loaded: 1200, total: 2656, complete: false },
        }) as any)}
      />
    );
    // Разделитель тысяч у форматтера — неразрывный пробел; сравниваем по смыслу.
    const plain = (value: unknown) => String(value).replace(/[\u00a0\u202f]/g, ' ');
    expect(plain(utils.getByTestId('userpoints-list-progress').props.children)).toBe('Загружено 1 200 из 2 656');
    expect(utils.getByText(/Список \(1[\u00a0\u202f ]200\)/)).toBeTruthy();

    await utils.rerender(
      <PointsListGrid
        {...(baseProps({
          filteredPoints: points,
          loadProgress: { loaded: 1200, total: 1200, complete: true },
        }) as any)}
      />
    );
    expect(utils.queryByTestId('userpoints-list-progress')).toBeNull();
  });

  it('renders «Загружены не все точки» with a retry button when the stream failed (#3130)', async () => {
    (require('react-native').Platform as any).OS = 'web';
    const { fireEvent } = require('@testing-library/react-native');
    const onRetryStream = jest.fn();
    const points = Array.from({ length: 200 }, (_, index) => ({ id: index + 1, name: `P${index + 1}`, latitude: 53, longitude: 27 }));
    const utils = await render(
      <PointsListGrid
        {...(baseProps({
          filteredPoints: points,
          loadProgress: { loaded: 200, total: 2656, complete: false, failed: true },
          onRetryStream,
        }) as any)}
      />
    );
    expect(utils.queryByTestId('userpoints-list-progress')).toBeNull();
    expect(utils.getByTestId('userpoints-list-progress-failed')).toBeTruthy();
    expect(utils.getByText(/Загружены не все точки — 200 из 2[\u00a0\u202f ]656/)).toBeTruthy();
    fireEvent.press(utils.getByTestId('userpoints-list-progress-retry'));
    expect(onRetryStream).toHaveBeenCalledTimes(1);
  });

  it('shows retry for a failed stream even without a server count (#3130)', async () => {
    (require('react-native').Platform as any).OS = 'web';
    const points = [{ id: 1, name: 'P1', latitude: 53, longitude: 27 }];
    const utils = await render(
      <PointsListGrid
        {...(baseProps({
          filteredPoints: points,
          loadProgress: { loaded: 200, total: 200, complete: false, failed: true },
          onRetryStream: jest.fn(),
        }) as any)}
      />
    );
    expect(utils.getByTestId('userpoints-list-progress-retry')).toBeTruthy();
  });

  it('keeps the panel search input mounted while the query changes (#3133)', async () => {
    (require('react-native').Platform as any).OS = 'web';
    const points = [{ id: 1, name: 'P1', latitude: 53, longitude: 27 }];
    const utils = await render(<PointsListGrid {...(baseProps({ filteredPoints: points, searchQuery: 'a' }) as any)} />);
    const before = utils.getByTestId('userpoints-list-search');

    await utils.rerender(<PointsListGrid {...(baseProps({ filteredPoints: points, searchQuery: 'ab' }) as any)} />);

    // Шапка передаётся элементом: новый колбэк renderListHeader не меняет тип
    // компонента, поэтому поле поиска не ремаунтится и не теряет фокус.
    expect(utils.getByTestId('userpoints-list-search')).toBe(before);
  });
});
