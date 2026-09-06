/**
 * #1788 — режим «Моих точек» приходит из ширины вьюпорта, а не из платформы.
 *
 * Раньше `isMobile` в `PointsList` считался как `Platform.OS !== 'web'`: mobile
 * web на 390px получал десктопный набор управления, а iPhone на той же ширине —
 * мобильный, хотя `docs/RULES.md` требует один responsive-UX. Тест ловит именно
 * проводку: какое значение уходит в шапку списка.
 */
import React from 'react';
import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { PointsList } from '@/components/UserPoints/PointsList';

// Шапка списка рисуется как ListHeaderComponent внутри виртуального списка и в
// map-режиме не монтируется вовсе. Ловим саму проводку — аргументы рендерера.
const headerProps: Array<Record<string, unknown>> = [];

jest.mock('@/components/UserPoints/usePointsHeaderRenderer', () => ({
  usePointsHeaderRenderer: (args: Record<string, unknown>) => {
    headerProps.push(args);
    return () => null;
  },
}));

jest.mock('@/components/UserPoints/UserPointsMap', () => {
  const { View } = require('react-native');
  return { UserPointsMap: () => <View testID="userpoints-map-engine" /> };
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
const originalOS = Platform.OS;
const setPlatform = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
};

let mockWidth = 1280;

const renderPoints = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PointsList />
    </QueryClientProvider>,
  );
};

const lastHeaderMode = (): boolean | undefined => {
  expect(headerProps.length).toBeGreaterThan(0);
  return headerProps[headerProps.length - 1].isMobile as boolean;
};

describe('PointsList: режим раскладки из вьюпорта (#1788)', () => {
  beforeEach(() => {
    headerProps.length = 0;
    jest
      .spyOn(require('@/hooks/useResponsive'), 'useBreakpoints')
      .mockImplementation(() => ({
        width: mockWidth,
        isMobile: mockWidth < BREAKPOINT_TABLET,
      }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setPlatform(originalOS);
  });

  it.each([
    ['web', 390, true],
    ['ios', 390, true],
    ['android', 390, true],
    ['web', 1280, false],
    ['ios', 1280, false],
  ])('%s на ширине %ipx отдаёт в шапку isMobile=%s', (os, width, expected) => {
    setPlatform(os as typeof Platform.OS);
    mockWidth = width;

    renderPoints();

    expect(lastHeaderMode()).toBe(expected);
  });
});
