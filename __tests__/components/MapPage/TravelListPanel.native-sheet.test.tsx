import React from 'react';
import { render } from '@testing-library/react-native';
import { View } from 'react-native';

const mockBottomSheetFlatList = jest.fn((props: any) => {
  const { data = [], renderItem, keyExtractor } = props;
  return (
    <View testID="mock-bottom-sheet-flat-list">
      {data.map((item: any, index: number) => {
        const key = keyExtractor ? keyExtractor(item, index) : String(item?.id ?? index);
        return <View key={key}>{renderItem?.({ item, index })}</View>;
      })}
    </View>
  );
});

const mockFlashList = jest.fn(() => <View testID="mock-flash-list" />);

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetFlatList: (props: any) => mockBottomSheetFlatList(props),
}));

jest.mock('@shopify/flash-list', () => ({
  FlashList: (props: any) => mockFlashList(props),
}));

jest.mock('@/components/MapPage/AddressListItem', () => ({
  __esModule: true,
  default: ({ travel }: any) => {
    const RN = require('react-native');
    return (
      <RN.View testID={`address-item-${travel.id}`}>
        <RN.Text>{travel.address}</RN.Text>
      </RN.View>
    );
  },
}));

jest.mock('@/components/MapPage/SwipeableListItem', () => ({
  SwipeableListItem: ({ children }: any) => {
    const RN = require('react-native');
    return <RN.View testID="swipeable-list-item">{children}</RN.View>;
  },
}));

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({
    addFavorite: jest.fn(),
    removeFavorite: jest.fn(),
    isFavorite: jest.fn(() => false),
  }),
}));

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    isAuthenticated: true,
    requireAuth: jest.fn(),
  }),
}));

jest.mock('@/utils/toast', () => ({
  showToast: jest.fn(),
}));

import TravelListPanel from '@/components/MapPage/TravelListPanel';

const travelsData = [
  { id: 1, address: 'Place 1', coord: '50.0, 19.0' },
  { id: 2, address: 'Place 2', coord: '51.0, 20.0' },
  { id: 3, address: 'Place 3', coord: '52.0, 21.0' },
];

describe('TravelListPanel native bottom sheet list', () => {
  beforeEach(() => {
    mockBottomSheetFlatList.mockClear();
    mockFlashList.mockClear();
  });

  it('uses BottomSheetFlatList and renders every nearby card inside the map sheet', () => {
    const { getByTestId } = render(
      <TravelListPanel
        travelsData={travelsData}
        buildRouteTo={jest.fn()}
        isMobile
        useBottomSheetScrollable
        currentRadiusKm={60}
        userLocation={{ latitude: 53.9, longitude: 27.56 }}
      />,
    );

    expect(getByTestId('mock-bottom-sheet-flat-list')).toBeTruthy();
    expect(getByTestId('address-item-1')).toBeTruthy();
    expect(getByTestId('address-item-2')).toBeTruthy();
    expect(getByTestId('address-item-3')).toBeTruthy();
    expect(mockBottomSheetFlatList).toHaveBeenCalledWith(
      expect.objectContaining({
        data: travelsData,
        style: expect.objectContaining({ flex: 1, width: '100%' }),
      }),
    );
    expect(mockFlashList).not.toHaveBeenCalled();
  });

  it('renders compact preview rows with readable place titles', () => {
    const { getByText, queryByTestId } = render(
      <TravelListPanel
        travelsData={travelsData}
        buildRouteTo={jest.fn()}
        isMobile
        compactPreview
        useBottomSheetScrollable
      />,
    );

    expect(getByText('Place 1')).toBeTruthy();
    expect(getByText('Place 2')).toBeTruthy();
    expect(getByText('Place 3')).toBeTruthy();
    expect(queryByTestId('travel-list-mobile-summary')).toBeNull();
  });
});
