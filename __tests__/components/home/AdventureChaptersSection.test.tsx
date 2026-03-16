import React from 'react';
import renderer from 'react-test-renderer';
import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import AdventureChaptersSection from '@/components/home/AdventureChaptersSection';

const mockPush = jest.fn();
const mockImageCardMedia = jest.fn((props: any) => React.createElement('mock-image-card-media', props));

jest.mock('@tanstack/react-query');
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/api/map', () => ({
  fetchTravelsPopular: jest.fn(),
}));
jest.mock('@/utils/analytics', () => ({
  sendAnalyticsEvent: jest.fn(),
}));
jest.mock('@/utils/subscriptionsHelpers', () => ({
  resolveTravelUrl: jest.fn(() => '/travels/test-slug'),
}));
jest.mock('@/components/travel/OptimizedFavoriteButton', () => {
  const React = require('react');
  return function MockOptimizedFavoriteButton() {
    return React.createElement('mock-favorite-button');
  };
});
jest.mock('@/components/ui/SkeletonLoader', () => ({
  SkeletonLoader: () => null,
}));
jest.mock('@/components/ui/Button', () => {
  const React = require('react');
  return function MockButton() {
    return React.createElement('mock-button');
  };
});
jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: any) => mockImageCardMedia(props),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isPhone: false, isLargePhone: false }),
  useResponsiveColumns: () => 3,
}));
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    text: '#111111',
    textMuted: '#666666',
    textSecondary: '#666666',
    textOnDark: '#ffffff',
    brand: '#ff8800',
    primary: '#ff8800',
    primarySoft: '#fff1e6',
    primaryText: '#8a4b00',
    primaryAlpha30: 'rgba(255,136,0,0.3)',
    primaryAlpha40: 'rgba(255,136,0,0.4)',
    border: '#dddddd',
    borderLight: '#eeeeee',
    borderStrong: '#bbbbbb',
    surface: '#ffffff',
    backgroundSecondary: '#f5f5f5',
    warningSoft: '#fff5cc',
  }),
}));

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;

describe('AdventureChaptersSection', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'web';
    mockPush.mockClear();
    mockImageCardMedia.mockClear();
    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 101,
          name: 'Тестовый маршрут',
          slug: 'test-slug',
          countryName: 'Беларусь',
          travel_image_thumb_url: 'https://metravel.by/travel-image/sample.jpg',
          countUnicIpView: 42,
          rating: 4.8,
        },
      ],
      isLoading: false,
    } as any);
  });

  afterAll(() => {
    Platform.OS = originalPlatform;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('passes the original travel image url to ImageCardMedia on web', () => {
    renderer.act(() => {
      renderer.create(<AdventureChaptersSection />);
    });

    expect(mockImageCardMedia).toHaveBeenCalled();
    const props = mockImageCardMedia.mock.calls[0]?.[0];
    expect(props).toBeTruthy();
    expect(props.src).toBe('https://metravel.by/travel-image/sample.jpg');
    expect(props.fit).toBe('contain');
    expect(props.blurBackground).toBe(true);
  });
});
