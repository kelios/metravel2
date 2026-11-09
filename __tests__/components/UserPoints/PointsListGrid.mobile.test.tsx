import { render } from '@testing-library/react-native';

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return { ...RN, Platform: { ...RN.Platform, OS: 'web' } };
});

// Узкая раскладка (телефон): мобильный таб-бар Карта / Список / Фильтры.
let mockViewportWidth = 390;
jest.mock('@/hooks/useResponsive', () => {
  const actual = jest.requireActual('@/hooks/useResponsive');
  return { ...actual, useResponsiveWidth: () => mockViewportWidth };
});

jest.mock('@/components/UserPoints/UserPointsMap', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { UserPointsMap: () => <View testID="mock-userpoints-map" /> };
});

jest.mock('@/api/external/nominatim', () => ({ nominatimSearch: jest.fn() }));

const { PointsListGrid } = require('@/components/UserPoints/PointsListGrid');

const baseProps = (overrides: Record<string, unknown>) => ({
  styles: { mapInner: {}, locateFab: {}, locateFabDisabled: {}, mapContainer: {} } as any,
  colors: { text: '#111' },
  viewMode: 'map' as const,
  isLoading: false,
  filteredPoints: [] as any[],
  header: <></>,
  renderItem: () => <></>,
  renderEmpty: () => <></>,
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

// #3133: на телефоне счётчик списка — бейдж сегмента, подпись короткая «Список»;
// «Список (2655)» в подписи не помещалось в треть ширины 320–390 px.
describe('PointsListGrid mobile tab bar', () => {
  it('puts the point count into the segment badge and keeps the short label', async () => {
    const points = [1, 2].map((id) => ({ id, name: `P${id}`, latitude: 53, longitude: 27 }));
    const utils = await render(<PointsListGrid {...(baseProps({ filteredPoints: points }) as any)} />);
    const tab = utils.getByTestId('segmented-list');
    expect(tab.props.accessibilityLabel).toBe('Список (2)');
    expect(utils.getByText('Список')).toBeTruthy();
    expect(utils.queryByText('Список (2)')).toBeNull();
  });

  it('drops the tab icons below the phone breakpoint so the badge fits in a 320 px bar', async () => {
    mockViewportWidth = 320;
    try {
      const points = [1, 2].map((id) => ({ id, name: `P${id}`, latitude: 53, longitude: 27 }));
      const utils = await render(<PointsListGrid {...(baseProps({ filteredPoints: points }) as any)} />);
      expect(utils.queryByTestId('feather-list')).toBeNull();
      expect(utils.queryByTestId('feather-map')).toBeNull();
      expect(utils.getByTestId('segmented-list').props.accessibilityLabel).toBe('Список (2)');
    } finally {
      mockViewportWidth = 390;
    }
  });

  it('keeps the tab icons at 390 px', async () => {
    const utils = await render(<PointsListGrid {...(baseProps({ filteredPoints: [] }) as any)} />);
    expect(utils.getByTestId('feather-list')).toBeTruthy();
  });

  it('shows no badge while the first page loads', async () => {
    const utils = await render(<PointsListGrid {...(baseProps({ isLoading: true }) as any)} />);
    expect(utils.getByTestId('segmented-list').props.accessibilityLabel).toBe('Список');
    expect(utils.queryByText('…')).toBeNull();
  });
});
