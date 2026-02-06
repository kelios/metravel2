import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform } from 'react-native';
import TravelListItem from '@/components/listTravel/TravelListItem';
import type { Travel } from '@/src/types/types';

jest.mock('@/components/travel/OptimizedFavoriteButton', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

const baseTravel: Travel = {
  id: 1,
  name: 'Test travel',
  slug: 'test-travel',
  travel_image_thumb_url: '',
  url: '',
  userName: 'Author',
  userIds: '42',
  countryName: '',
  countUnicIpView: '0',
  gallery: [],
  travelAddress: [],
  year: '',
  monthName: '',
  number_days: 0,
  companions: [],
  countryCode: '',
} as any;

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

describe('TravelListItem selectable (web)', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  });

  it('renders a non-interactive selection badge to avoid nested buttons', () => {
    const queryClient = createTestQueryClient();
    const { getByTestId } = render(
      <QueryClientProvider client={queryClient}>
        <TravelListItem
          travel={baseTravel}
          currentUserId={null}
          isSuperuser={false}
          isMetravel={false}
          selectable={true}
          isSelected={false}
        />
      </QueryClientProvider>
    );

    const checkbox = getByTestId('selection-checkbox');
    expect(checkbox.type).toBe('View');
    expect(checkbox.props.onPress).toBeUndefined();
    expect(checkbox.props.onClick).toBeUndefined();
    expect(checkbox.props.role).toBeUndefined();
  });
});
