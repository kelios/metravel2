import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform, ScrollView } from 'react-native';

import HomeFavoritesHistorySection from '@/components/home/HomeFavoritesHistorySection';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';

jest.mock('@/context/AuthContext');
jest.mock('@/context/FavoritesContext');

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/components/layout', () => ({
  ResponsiveContainer: ({ children }: any) => children,
}));

jest.mock('@/constants/designSystem', () => ({
  DESIGN_TOKENS: {
    colors: {
      background: '#fff',
      primary: '#000',
      primaryLight: '#eee',
      text: '#000',
      textMuted: '#666',
      surface: '#fff',
      borderLight: '#eee',
    },
    radii: { md: 8 },
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: ({ name, ...props }: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: `feather-${name}`, ...props });
  },
}));

jest.mock('@/components/listTravel/TabTravelCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockTabTravelCard(props: any) {
    return React.createElement(View, { testID: 'tab-travel-card', ...props });
  };
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseFavorites = useFavorites as jest.MockedFunction<typeof useFavorites>;

describe('HomeFavoritesHistorySection (web)', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    (Platform.OS as any) = 'web';

    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
    } as any);

    mockUseFavorites.mockReturnValue({
      favorites: [
        {
          id: 1,
          title: 'Fav 1',
          imageUrl: null,
          url: '/travels/1',
        },
      ],
      viewHistory: [
        {
          id: 2,
          title: 'Hist 2',
          imageUrl: null,
          url: '/travels/2',
          type: 'travel',
        },
      ],
      ensureServerData: jest.fn(),
    } as any);
  });

  afterEach(() => {
    (Platform.OS as any) = originalPlatform;
    jest.clearAllMocks();
  });

  it('renders horizontal ScrollView lists with onWheel enabled', () => {
    const { getByTestId, UNSAFE_getAllByType } = render(<HomeFavoritesHistorySection />);

    const favoritesList = getByTestId('home-favorites-list');
    expect(favoritesList.props.horizontal).toBe(true);
    expect(typeof favoritesList.props.onWheel).toBe('function');

    const historyList = getByTestId('home-history-list');
    expect(historyList.props.horizontal).toBe(true);
    expect(typeof historyList.props.onWheel).toBe('function');

    const scrollViews = UNSAFE_getAllByType(ScrollView);
    // At least the 2 horizontal scroll shelves should be ScrollViews on web.
    expect(scrollViews.length).toBeGreaterThanOrEqual(2);
  });
});
