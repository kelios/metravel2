import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';

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
    radii: { md: 8, pill: 999 },
    shadows: { medium: '0 4px 6px rgba(0,0,0,0.1)' },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
    typography: {
      sizes: { sm: 12, md: 14, lg: 16 },
    },
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

  it('does not pass onWheel handler to horizontal shelves (prevents passive preventDefault warning)', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { getByTestId } = render(<HomeFavoritesHistorySection />);

    const favoritesList = getByTestId('home-favorites-list');
    expect(favoritesList.props.horizontal).toBe(true);
    expect(favoritesList.props.onWheel).toBeUndefined();

    const historyList = getByTestId('home-history-list');
    expect(historyList.props.horizontal).toBe(true);
    expect(historyList.props.onWheel).toBeUndefined();

    const errorText = consoleError.mock.calls.map((c) => String(c?.[0] ?? '')).join('\n');
    expect(errorText).not.toContain('Unable to preventDefault inside passive event listener');

    consoleError.mockRestore();
  });
});
