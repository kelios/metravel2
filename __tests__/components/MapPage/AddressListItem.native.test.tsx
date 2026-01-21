import React from 'react';
import { render } from '@testing-library/react-native';
import AddressListItem from '@/components/MapPage/AddressListItem';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/context/AuthContext', () => ({
  __esModule: true,
  useAuth: () => ({ isAuthenticated: true, authReady: true }),
}));

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: {
    show: jest.fn(),
  },
}));

jest.mock('expo-clipboard', () => ({
  __esModule: true,
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

// Keep AddressListItem on native path and simplify hover behavior
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: {
      ...RN.Platform,
      OS: 'ios',
      select: (obj: any) => obj.ios ?? obj.default,
    },
  };
});

describe('AddressListItem (native list card)', () => {
  it('does not render coordinates row on mobile', () => {
    const travel: any = {
      id: 1,
      address: 'Test place',
      coord: '50.0619474, 19.9368564',
      travelImageThumbUrl: 'https://example.com/image.jpg',
      categoryName: 'Category 1, Category 2',
      articleUrl: 'https://example.com/article',
      urlTravel: 'https://example.com/quest',
      updated_at: '2024-01-01T00:00:00Z',
    };

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { queryByText } = render(
      <QueryClientProvider client={queryClient}>
        <AddressListItem travel={travel} isMobile={true} />
      </QueryClientProvider>
    );

    // Coordinate value must not be shown on mobile
    expect(queryByText(travel.coord)).toBeNull();
  });
});
