import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TravelListItem from '@/components/listTravel/TravelListItem';
import type { Travel } from '@/src/types/types';

// Не тестируем избранное здесь, поэтому подменяем FavoriteButton
jest.mock('@/components/FavoriteButton', () => ({
  __esModule: true,
  default: () => null,
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
  userIds: '42',
  year: '',
  monthName: '',
  number_days: 0,
  companions: [],
  countryCode: '',
} as any;

const createTestClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderItem = (props: Partial<React.ComponentProps<typeof TravelListItem>> = {}) => {
  const queryClient = createTestClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <TravelListItem
        travel={baseTravel}
        currentUserId={null}
        isSuperuser={false}
        isMetravel={false}
        isMobile={false}
        {...props}
      />
    </QueryClientProvider>
  );
};

describe('TravelListItem permissions', () => {
  it('does not show edit/delete buttons for guest (no currentUserId)', () => {
    const { queryByLabelText } = renderItem({ currentUserId: null, isSuperuser: false });

    expect(queryByLabelText('Редактировать')).toBeNull();
    expect(queryByLabelText('Удалить')).toBeNull();
  });

  it('shows edit/delete buttons for owner user', () => {
    const { getByLabelText } = renderItem({ currentUserId: '42', isSuperuser: false });

    expect(getByLabelText('Редактировать')).toBeTruthy();
    expect(getByLabelText('Удалить')).toBeTruthy();
  });

  it('shows edit/delete buttons for superuser regardless of owner', () => {
    const travel: Travel = { ...baseTravel, userIds: '100' } as any;
    const { getByLabelText } = renderItem({
      travel,
      currentUserId: '42',
      isSuperuser: true,
    });

    expect(getByLabelText('Редактировать')).toBeTruthy();
    expect(getByLabelText('Удалить')).toBeTruthy();
  });
});
