import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import NavigationArrows from '@/components/travel/NavigationArrows';
import { useRouter } from 'expo-router';
import type { Travel } from '@/types/types';

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  usePathname: () => '/travels/test-travel',
}));

// Mock expo-image
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

// Mock image optimization utils
jest.mock('@/utils/imageOptimization', () => ({
  optimizeImageUrl: jest.fn((url) => url),
  buildVersionedImageUrl: jest.fn((url) => url),
  getOptimalImageSize: jest.fn(() => ({ width: 60, height: 60 })),
  generateSrcSet: jest.fn((url) => url),
}));

// Mock useWindowDimensions
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    useWindowDimensions: () => ({ width: 375, height: 667 }),
  };
});

describe('NavigationArrows', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  const baseTravel: Travel = {
    id: 0,
    slug: 'base',
    name: 'Base',
    travel_image_thumb_url: 'https://example.com/thumb.jpg',
    travel_image_thumb_small_url: 'https://example.com/thumb-small.jpg',
    url: '/travels/base',
    youtube_link: '',
    userName: '',
    description: '',
    recommendation: '',
    plus: '',
    minus: '',
    cityName: '',
    countryName: '',
    countUnicIpView: '',
    gallery: [],
    travelAddress: [],
    userIds: '',
    year: '',
    monthName: '',
    number_days: 0,
    companions: [],
    countryCode: '',
  };

  const mockTravel: Travel = {
    ...baseTravel,
    id: 1,
    slug: 'test-travel',
    name: 'Текущее путешествие',
    description: 'Test Description',
  };

  const mockRelatedTravels: Travel[] = [
    {
      ...baseTravel,
      id: 0,
      slug: 'prev-travel',
      name: 'Предыдущий маршрут',
    },
    mockTravel,
    {
      ...baseTravel,
      id: 2,
      slug: 'next-travel',
      name: 'Следующий маршрут',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  it('should render previous and next navigation buttons', () => {
    const { getByText } = render(
      <NavigationArrows
        currentTravel={mockTravel}
        relatedTravels={mockRelatedTravels}
      />
    );

    expect(getByText('Предыдущее')).toBeTruthy();
    expect(getByText('Следующее')).toBeTruthy();
  });

  it('should not render when there are no related travels', () => {
    const { queryByText } = render(
      <NavigationArrows
        currentTravel={mockTravel}
        relatedTravels={[mockTravel]}
      />
    );

    expect(queryByText('Предыдущее')).toBeNull();
    expect(queryByText('Следующее')).toBeNull();
  });

  it('should navigate to previous travel when previous button is pressed', () => {
    const { getByText } = render(
      <NavigationArrows
        currentTravel={mockTravel}
        relatedTravels={mockRelatedTravels}
      />
    );

    const prevButton = getByText('Предыдущее').parent;
    fireEvent.press(prevButton!);

    expect(mockRouter.push).toHaveBeenCalledWith('/travels/prev-travel');
  });

  it('should navigate to next travel when next button is pressed', () => {
    const { getByText } = render(
      <NavigationArrows
        currentTravel={mockTravel}
        relatedTravels={mockRelatedTravels}
      />
    );

    const nextButton = getByText('Следующее').parent;
    fireEvent.press(nextButton!);

    expect(mockRouter.push).toHaveBeenCalledWith('/travels/next-travel');
  });

  it('should use custom onNavigate callback when provided', () => {
    const onNavigate = jest.fn();
    const { getByText } = render(
      <NavigationArrows
        currentTravel={mockTravel}
        relatedTravels={mockRelatedTravels}
        onNavigate={onNavigate}
      />
    );

    const nextButton = getByText('Следующее').parent;
    fireEvent.press(nextButton!);

    expect(onNavigate).toHaveBeenCalledWith('next-travel');
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('should not render when current travel is not in related travels', () => {
    const unrelatedTravel: Travel = {
      ...baseTravel,
      id: 999,
      slug: 'unrelated',
      name: 'Unrelated',
    };

    const { queryByText } = render(
      <NavigationArrows
        currentTravel={unrelatedTravel}
        relatedTravels={mockRelatedTravels}
      />
    );

    expect(queryByText('Предыдущее')).toBeNull();
    expect(queryByText('Следующее')).toBeNull();
  });

  it('should handle travel without slug by using id', () => {
    const travelWithoutSlug: Travel = {
      ...baseTravel,
      id: 1,
      slug: 'current-travel',
      name: 'Test Travel',
    };

    const relatedTravels: Travel[] = [
      { ...baseTravel, id: 0, slug: 'prev-travel', name: 'Previous' },
      travelWithoutSlug,
      { ...baseTravel, id: 2, name: 'Next', slug: '' },
    ];

    const { getByLabelText } = render(
      <NavigationArrows
        currentTravel={travelWithoutSlug}
        relatedTravels={relatedTravels}
      />
    );

    const nextButton = getByLabelText('Следующее путешествие: Next');
    fireEvent.press(nextButton!);

    expect(mockRouter.push).toHaveBeenCalledWith('/travels/2');
  });
});

