import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
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

  it('renders countries list with +N when more than 2 countries are present', () => {
    const { getByText, queryByText } = renderItem({ countryName: 'USA, France, Germany' } as any);
    expect(getByText('USA')).toBeTruthy();
    expect(queryByText('France')).toBeNull();
    expect(queryByText('+1')).toBeNull();
  });

  it('prefers travel.user name fields and allows navigating to author profile', () => {
    const { getByLabelText, getByText } = renderItem({
      user: { id: 99, first_name: 'John', last_name: 'Doe' } as any,
      userIds: undefined as any,
      userName: 'Fallback Author',
      countryName: '',
    } as any);

    expect(getByText('John Doe')).toBeTruthy();
    const authorPressable = getByLabelText('Открыть профиль автора John Doe');
    fireEvent.press(authorPressable);

    const { router } = require('expo-router');
    expect(router.push).toHaveBeenCalledWith('/user/99');
  });

  it('shows Popular/New badges based on views and created_at', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-01-10T00:00:00Z').getTime());

    const { getByText } = renderItem({
      countUnicIpView: '1501',
      created_at: '2024-01-08T00:00:00Z',
      updated_at: '2024-01-08T00:00:00Z',
    } as any);

    expect(getByText('Популярное')).toBeTruthy();
    expect(getByText('Новое')).toBeTruthy();

    nowSpy.mockRestore();
  });
});
