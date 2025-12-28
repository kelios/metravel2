import React from 'react';
import { render, act } from '@testing-library/react-native';
import { FlatList } from 'react-native';

import HistoryScreen from '@/app/(tabs)/history';

const mockUseAuth = jest.fn();
const mockUseFavorites = jest.fn();

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => mockUseFavorites(),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => (global as any).__mockResponsive ?? { width: 390 },
}));

const tabTravelCardProps: any[] = [];

jest.mock('@/components/listTravel/TabTravelCard', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: (props: any) => {
      tabTravelCardProps.push(props);
      return React.createElement(View, { testID: `tab-travel-card-${String(props?.item?.id ?? 'unknown')}` });
    },
  };
});

describe('HistoryScreen grid regression', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    tabTravelCardProps.length = 0;

    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseFavorites.mockReturnValue({
      viewHistory: [
        {
          id: 1,
          type: 'travel',
          title: 'T1',
          url: '/travels/1',
          imageUrl: null,
          city: null,
          countryName: 'Belarus',
          viewedAt: 'now',
        },
      ],
      clearHistory: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    delete (global as any).__mockResponsive;
  });

  const renderLoaded = async () => {
    const utils = render(<HistoryScreen />);

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    return utils;
  };

  it('uses 1 column on narrow widths', async () => {
    (global as any).__mockResponsive = { width: 500 };

    const utils = await renderLoaded();
    const list = utils.UNSAFE_getByType(FlatList);

    expect(list.props.numColumns).toBe(1);
  });

  it('uses 2 columns on medium widths', async () => {
    (global as any).__mockResponsive = { width: 700 };

    const utils = await renderLoaded();
    const list = utils.UNSAFE_getByType(FlatList);

    expect(list.props.numColumns).toBe(2);
  });

  it('uses up to 3 columns on wide widths and renders TabTravelCard with layout="grid"', async () => {
    (global as any).__mockResponsive = { width: 1100 };

    const utils = await renderLoaded();
    const list = utils.UNSAFE_getByType(FlatList);

    expect(list.props.numColumns).toBe(3);

    expect(tabTravelCardProps.length).toBeGreaterThan(0);
    expect(tabTravelCardProps[0]?.layout).toBe('grid');
  });
});
