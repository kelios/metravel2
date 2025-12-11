import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { FavoritesProvider } from '@/context/FavoritesContext';
import TravelListItem from '@/components/listTravel/TravelListItem';
import type { Travel } from '@/src/types/types';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('expo-image', () => ({
  Image: ({ testID }: { testID?: string }) => <></>,
}));

const baseTravel: Travel = {
  id: 1,
  name: 'Test travel',
  slug: 'test-travel',
  travel_image_thumb_url: 'https://example.com/image.jpg',
  url: '/travels/test-travel',
  userName: 'Author',
  userIds: '42',
  countryName: 'Россия',
  countUnicIpView: '0',
  gallery: [],
  travelAddress: [],
  year: '',
  monthName: '',
  number_days: 0,
  companions: [],
  countryCode: '',
} as any;

const createTestClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const renderItem = (overrides: Partial<Travel> = {}) => {
  const queryClient = createTestClient();
  const travel: Travel = { ...baseTravel, ...overrides } as any;

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FavoritesProvider>
          <TravelListItem
            travel={travel}
            currentUserId={null}
            isSuperuser={false}
            isMetravel={false}
            isMobile={false}
          />
        </FavoritesProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
};

describe('TravelListItem content & metadata', () => {
  it('renders image stub when image URL is missing', () => {
    const { getByTestId } = renderItem({ travel_image_thumb_url: '' } as any);
    expect(getByTestId('image-stub')).toBeTruthy();
  });

  it('renders image stub when image URL is from watermark domain', () => {
    const { getByTestId } = renderItem({
      travel_image_thumb_url: 'https://shutterstock.com/image-photo/test.jpg',
    } as any);
    expect(getByTestId('image-stub')).toBeTruthy();
  });

  it('does not render views meta when views are zero or empty', () => {
    const { queryByTestId } = renderItem({ countUnicIpView: '0' } as any);
    expect(queryByTestId('views-meta')).toBeNull();
  });

  it('renders views meta when views are greater than zero', () => {
    const { getByTestId } = renderItem({ countUnicIpView: '10' } as any);
    expect(getByTestId('views-meta')).toBeTruthy();
  });
});
