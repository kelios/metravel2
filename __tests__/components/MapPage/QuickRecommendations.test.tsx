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

const mockHandleAddPoint = jest.fn();
const mockAddressActions = jest.fn((_place: any) => ({
  isAddingPoint: false,
  pointAdded: false,
  isSavedPointsReady: true,
  isAuthenticated: true,
  authReady: true,
  handleAddPoint: mockHandleAddPoint,
}));

jest.mock('@/hooks/useAddressListItemActions', () => ({
  useAddressListItemActions: (place: any) => mockAddressActions(place),
}));

import { QuickRecommendations } from '@/components/MapPage/QuickRecommendations';

describe('QuickRecommendations', () => {
  beforeEach(() => {
    mockPlaceListCard.mockClear();
    mockAddressActions.mockClear();
  });

  it('passes larger media and content title layout to nearby recommendation cards', async () => {
    await render(
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

    // F-47: the card shows the clean POI title (first meaningful address
    // segment), with the remaining address moved into the secondary line.
    expect(screen.getByTestId('place-card-Башня')).toBeTruthy();

    const firstCallProps = mockPlaceListCard.mock.calls[0]?.[0];
    expect(firstCallProps).toEqual(
      expect.objectContaining({
        title: 'Башня',
        titleLayout: 'content',
        titleNumberOfLines: 3,
        badges: ['Старый город', '12 км', 'Пешком 18 мин'],
      }),
    );
    expect(firstCallProps.imageHeight).toBeGreaterThanOrEqual(148);
  });

  it('passes the primary source travel id of the recommendation urlTravel (#1960)', async () => {
    await render(
      <QuickRecommendations
        places={[
          {
            id: 2,
            address: 'Замок, Мир',
            coord: '53.451,26.473',
            categoryName: 'Замок',
            urlTravel: 'https://metravel.by/travels/mirskiy-zamok',
            primarySource: {
              sourceId: 'travel-address:2',
              pointId: 2,
              travelId: 512,
              articleTitle: 'Мирский замок',
              articleUrl: 'https://metravel.by/travels/mirskiy-zamok',
              thumbnailUrl: null,
              thumbnailWidth: null,
              thumbnailHeight: null,
            },
          },
        ]}
        userLocation={{ latitude: 53.45, longitude: 26.47 }}
        onPlaceSelect={jest.fn()}
      />,
    );

    expect(mockPlaceListCard.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        relatedTravelUrl: 'https://metravel.by/travels/mirskiy-zamok',
        relatedTravelId: 512,
        sourcePointId: 2,
      }),
    );
  });
  // 08.11.2026: ♥ рекомендации сохранял статью-источник — две рекомендации одной
  // статьи загорались разом. Теперь ♥ — toggle ЭТОЙ точки в «Мои точки».
  it('wires the card heart to saving THIS place, not the source article', async () => {
    mockAddressActions.mockImplementation(((place: any) => ({
      isAddingPoint: false,
      pointAdded: place.id === 1,
      isSavedPointsReady: true,
      isAuthenticated: true,
      authReady: true,
      handleAddPoint: mockHandleAddPoint,
    })) as any);
    const shared = { categoryName: 'Замок', urlTravel: 'https://metravel.by/travels/one-article' };
    await render(
      <QuickRecommendations
        places={[
          { id: 1, address: 'Замок, Мир', coord: '53.451,26.473', ...shared },
          { id: 2, address: 'Парк, Мир', coord: '53.452,26.474', ...shared },
        ]}
        userLocation={{ latitude: 53.45, longitude: 26.47 }}
        onPlaceSelect={jest.fn()}
      />,
    );

    expect(mockAddressActions.mock.calls.map(([place]) => place.id)).toEqual([1, 2]);
    const [first, second] = mockPlaceListCard.mock.calls.slice(-2).map(([props]) => props);
    expect(first).toEqual(expect.objectContaining({ onAddPoint: mockHandleAddPoint, isSaved: true, addDisabled: false }));
    expect(second).toEqual(expect.objectContaining({ onAddPoint: mockHandleAddPoint, isSaved: false }));
  });
});
