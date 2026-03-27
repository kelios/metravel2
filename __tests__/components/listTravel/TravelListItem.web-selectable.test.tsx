import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform } from 'react-native';
import TravelListItem from '@/components/listTravel/TravelListItem';
import type { Travel } from '@/types/types';

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

  it('renders a dedicated web checkbox control for selection', () => {
    const queryClient = createTestQueryClient();
    const { getByLabelText } = render(
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

    const checkbox = getByLabelText('Выбрать');
    expect(checkbox.type).toBe('View');
    expect(checkbox.props.role).toBe('checkbox');
    expect(checkbox.props.onClick).toEqual(expect.any(Function));
    expect(checkbox.props.onTouchEnd).toEqual(expect.any(Function));
  });

  it('toggles selection from the checkbox itself on web', () => {
    const queryClient = createTestQueryClient();
    const onToggle = jest.fn();
    const { getByTestId } = render(
      <QueryClientProvider client={queryClient}>
        <TravelListItem
          travel={baseTravel}
          currentUserId={null}
          isSuperuser={false}
          isMetravel={false}
          selectable={true}
          isSelected={false}
          onToggle={onToggle}
        />
      </QueryClientProvider>
    );

    fireEvent(getByTestId('selection-checkbox'), 'click', {
      stopPropagation: jest.fn(),
      preventDefault: jest.fn(),
    });

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('handles touch selection on web without relying only on click', () => {
    const queryClient = createTestQueryClient();
    const onToggle = jest.fn();
    const { getByTestId } = render(
      <QueryClientProvider client={queryClient}>
        <TravelListItem
          travel={baseTravel}
          currentUserId={null}
          isSuperuser={false}
          isMetravel={false}
          selectable={true}
          isSelected={false}
          onToggle={onToggle}
        />
      </QueryClientProvider>
    );

    const card = getByTestId('travel-card-selectable-test-travel');

    expect(card.props.onTouchEnd).toEqual(expect.any(Function));

    fireEvent(card, 'touchEnd', {
      stopPropagation: jest.fn(),
      preventDefault: jest.fn(),
    });

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('still toggles selection when the travel has no navigation url', () => {
    const queryClient = createTestQueryClient();
    const onToggle = jest.fn();
    const { getByTestId } = render(
      <QueryClientProvider client={queryClient}>
        <TravelListItem
          travel={{
            ...baseTravel,
            slug: '',
            url: '',
          } as any}
          currentUserId={null}
          isSuperuser={false}
          isMetravel={false}
          selectable={true}
          isSelected={false}
          onToggle={onToggle}
        />
      </QueryClientProvider>
    );

    fireEvent.press(getByTestId('travel-card-selectable-1'));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
