import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { PointsList } from '@/components/UserPoints/PointsList';

// Keep the actual PointsList → renderer → Header / Grid composition. Only the
// map engine and panel internals are replaced, so visibility must reach the UI.
jest.mock('@/components/UserPoints/UserPointsMap', () => {
  const { View } = require('react-native');
  return { UserPointsMap: () => <View testID="userpoints-map-engine" /> };
});
jest.mock('@/components/MapPage/FiltersPanelMapSettings', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View testID="userpoints-map-settings-panel" /> };
});
jest.mock('@/components/UserPoints/usePointsDataModel', () => {
  const data = {
    points: [],
    filteredPoints: [],
    isLoading: false,
    loadFailed: false,
    refetch: jest.fn(),
    categoryIdToName: new Map(),
    categoryData: [],
    resolveCategoryIdsByNames: () => [],
    availableCategoryOptions: [],
    availableColors: [],
    manualColorOptions: [],
  };
  return { usePointsDataModel: () => data };
});
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
}));

const BREAKPOINT_TABLET = 768;

/** Минимальный снимок вьюпорта: PointsList читает из него ширину и режим. */
const buildResponsiveState = (width: number) => ({
  width,
  isMobile: width < BREAKPOINT_TABLET,
});

const originalOS = Platform.OS;
const setPlatform = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
};
let mockWidth = 1280;

const renderPoints = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={client}>
      <PointsList />
    </QueryClientProvider>
  );
  const result = render(tree());
  return { ...result, resize: (width: number) => { mockWidth = width; result.rerender(tree()); } };
};

const expectSettingsAbsent = () => {
  expect(screen.queryByTestId('userpoints-map-settings-toggle')).toBeNull();
  expect(screen.queryByTestId('userpoints-map-settings-panel')).toBeNull();
  expect(screen.queryByText('Показать настройки карты')).toBeNull();
  expect(screen.queryByText('Скрыть настройки карты')).toBeNull();
};

describe('PointsList map settings availability (#1787)', () => {
  beforeEach(() => {
    setPlatform('web');
    mockWidth = 1280;
    // #1788 — PointsList берёт и ширину, и режим из общего вьюпорт-хука
    // (`useBreakpoints({ clientOnly: true })`), а не из `useWindowDimensions` +
    // `Platform.OS`. Мок двигает ровно тот источник, который читает код.
    jest.spyOn(require('@/hooks/useResponsive'), 'useBreakpoints').mockImplementation(() =>
      buildResponsiveState(mockWidth),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setPlatform(originalOS);
  });

  it.each([
    ['ios', 390],
    ['android', 390],
    ['ios', 1280],
    ['android', 1280],
    ['web', 390],
    ['web', 1023],
  ] as const)('hides unavailable settings on %s at %ipx across mobile tabs', (os, width) => {
    setPlatform(os);
    mockWidth = width;
    renderPoints();

    expect(screen.getByTestId('userpoints-map-engine')).toBeTruthy();
    expectSettingsAbsent();
    fireEvent.press(screen.getByTestId('segmented-list'));
    expectSettingsAbsent();
    fireEvent.press(screen.getByTestId('segmented-filters'));
    expectSettingsAbsent();
    expect(screen.getByText('Управление точками')).toBeTruthy();
    expect(screen.getByText('Показать фильтры')).toBeTruthy();
    fireEvent.press(screen.getByTestId('userpoints-filters-toggle'));
    expect(screen.getByText('Скрыть фильтры')).toBeTruthy();
  });

  it.each([1024, 1280])('opens and closes the actual panel slot in desktop map mode at %ipx', (width) => {
    mockWidth = width;
    renderPoints();
    fireEvent.press(screen.getByTestId('segmented-filters'));

    expect(screen.getByText('Показать настройки карты')).toBeTruthy();
    expect(screen.queryByTestId('userpoints-map-settings-panel')).toBeNull();
    fireEvent.press(screen.getByTestId('userpoints-map-settings-toggle'));
    expect(screen.getByText('Скрыть настройки карты')).toBeTruthy();
    expect(screen.getByTestId('userpoints-map-settings-panel')).toBeTruthy();
    expect(screen.getByTestId('userpoints-map-engine')).toBeTruthy();
    fireEvent.press(screen.getByTestId('userpoints-map-settings-toggle'));
    expect(screen.getByText('Показать настройки карты')).toBeTruthy();
    expect(screen.queryByTestId('userpoints-map-settings-panel')).toBeNull();
  });

  it('hides settings in standalone desktop list mode and restores a consistent map state', () => {
    renderPoints();
    fireEvent.press(screen.getByTestId('segmented-filters'));
    fireEvent.press(screen.getByTestId('userpoints-map-settings-toggle'));
    // The side-panel tab and the header view toggle both have a list option.
    fireEvent.press(screen.getByText('Список'));
    expectSettingsAbsent();
    expect(screen.queryByTestId('userpoints-map-engine')).toBeNull();
    expect(screen.getByText('Управление точками')).toBeTruthy();

    fireEvent.press(screen.getByText('Карта'));
    expect(screen.getByTestId('userpoints-map-engine')).toBeTruthy();
    expect(screen.getByText('Скрыть настройки карты')).toBeTruthy();
    expect(screen.getByTestId('userpoints-map-settings-panel')).toBeTruthy();
  });

  it('cannot leave an open panel behind when resizing to mobile web', () => {
    const { resize } = renderPoints();
    fireEvent.press(screen.getByTestId('segmented-filters'));
    fireEvent.press(screen.getByTestId('userpoints-map-settings-toggle'));
    expect(screen.getByTestId('userpoints-map-settings-panel')).toBeTruthy();

    resize(390);
    fireEvent.press(screen.getByTestId('segmented-filters'));
    expectSettingsAbsent();
    resize(1280);
    expect(screen.getByText('Скрыть настройки карты')).toBeTruthy();
    expect(screen.getByTestId('userpoints-map-settings-panel')).toBeTruthy();
  });
});
