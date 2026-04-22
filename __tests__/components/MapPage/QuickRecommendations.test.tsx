import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: {
      ...RN.Platform,
      OS: 'web',
      select: (obj: any) => obj.web ?? obj.default,
    },
  };
});

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    surface: '#fff',
    border: '#ddd',
    backgroundSecondary: '#f4f4f4',
    primary: '#2f6f5f',
    text: '#222',
    shadows: { medium: {} },
  }),
}));

jest.mock('@/utils/coordinates', () => ({
  parseCoordinateString: jest.fn(() => ({ lat: 53.123, lng: 18.456 })),
}));

jest.mock('@/utils/distanceCalculator', () => ({
  getDistanceInfo: jest.fn(() => ({
    distance: 12,
    distanceText: '12 км',
    travelTimeText: '18 мин',
  })),
}));

jest.mock('@/components/MapPage/MapIcon', () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, name);
  },
}));

const mockPlaceListCard = jest.fn((props: any) => {
  const React = require('react');
  const { View } = require('react-native');
  return React.createElement(View, { testID: `place-card-${props.title}` });
});

jest.mock('@/components/places/PlaceListCard', () => ({
  __esModule: true,
  default: (props: any) => mockPlaceListCard(props),
}));

import { QuickRecommendations } from '@/components/MapPage/QuickRecommendations';

describe('QuickRecommendations', () => {
  beforeEach(() => {
    mockPlaceListCard.mockClear();
  });

  it('passes larger media and content title layout to nearby recommendation cards', () => {
    render(
      <QuickRecommendations
        places={[
          {
            id: 1,
            address: 'Башня, Старый город',
            coord: '53.123,18.456',
            categoryName: 'Башня, обзорная',
            travel_image_thumb_url: 'https://example.com/thumb.jpg',
          },
        ]}
        userLocation={{ latitude: 53.11, longitude: 18.44 }}
        transportMode="foot"
        onPlaceSelect={jest.fn()}
      />,
    );

    expect(screen.getByTestId('place-card-Башня, Старый город')).toBeTruthy();

    const firstCallProps = mockPlaceListCard.mock.calls[0]?.[0];
    expect(firstCallProps).toEqual(
      expect.objectContaining({
        titleLayout: 'content',
        titleNumberOfLines: 3,
        badges: ['12 км', 'Пешком 18 мин'],
      }),
    );
    expect(firstCallProps.imageHeight).toBeGreaterThanOrEqual(148);
  });
});
