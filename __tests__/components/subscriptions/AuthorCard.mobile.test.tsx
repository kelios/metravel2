import React from 'react';
import { render } from '@testing-library/react-native';

import AuthorCard from '@/components/subscriptions/AuthorCard';

const mockTabTravelCard = jest.fn(() => null);

jest.mock('@/components/listTravel/TabTravelCard', () => ({
  __esModule: true,
  default: (props: any) => {
    mockTabTravelCard(props);
    return null;
  },
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isMobile: true,
    width: 390,
  }),
}));

const author = {
  profile: {
    id: 42,
    user: 42,
    first_name: 'Siarhey',
    last_name: '',
    avatar: null,
  },
  travelsTotal: 2,
  isLoadingTravels: false,
  travels: [
    {
      id: 101,
      name: 'Краков. Полёт на планере',
      countryName: 'Польша',
      travel_image_thumb_url: 'https://example.com/plane.jpg',
    },
    {
      id: 102,
      name: 'Экзамен по маршруту',
      countryName: 'Литва',
      travel_image_thumb_url: 'https://example.com/exam.jpg',
    },
  ],
} as any;

describe('AuthorCard mobile layout', () => {
  beforeEach(() => {
    mockTabTravelCard.mockClear();
  });

  it('renders compact horizontal rail cards for mobile subscriptions', () => {
    const { getByTestId } = render(
      <AuthorCard
        author={author}
        onUnsubscribe={jest.fn()}
        onMessage={jest.fn()}
        onOpenTravel={jest.fn()}
        onOpenProfile={jest.fn()}
      />,
    );

    expect(getByTestId('subscription-travels-rail')).toBeTruthy();
    expect(mockTabTravelCard).toHaveBeenCalledTimes(2);
    expect(mockTabTravelCard.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        layout: 'grid',
        imageHeight: 112,
        contentMinHeight: 58,
        webTouchAction: 'pan-x pan-y',
      }),
    );
  });
});
