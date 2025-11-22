import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { View, Text } from 'react-native';

// Переопределяем react-native для десктопного web-контекста
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: {
      ...RN.Platform,
      OS: 'web',
      select: (obj: any) => obj.web ?? obj.default,
    },
    useWindowDimensions: () => ({ width: 1024, height: 768 }),
  };
});

const mockAddressListItem = jest.fn((props: any) => {
  // Имитируем простую RN-карту с поддержкой testID и onPress
  return (
    <View testID={`address-item-${props.travel.id}`}>
      <Text onPress={props.onPress}>{props.travel.address}</Text>
    </View>
  );
});

jest.mock('@/components/MapPage/AddressListItem', () => {
  return {
    __esModule: true,
    default: (props: any) => mockAddressListItem(props),
  };
});

import TravelListPanel from '@/components/MapPage/TravelListPanel';

const travelsData = [
  {
    id: 1,
    address: 'Place 1',
    coord: '50.0, 19.0',
  },
  {
    id: 2,
    address: 'Place 2',
    coord: '51.0, 20.0',
  },
];

describe('TravelListPanel (right list on map page)', () => {
  beforeEach(() => {
    mockAddressListItem.mockClear();
  });

  it('renders AddressListItem for each travel', () => {
    const noop = () => {};

    const { getByTestId } = render(
      <TravelListPanel
        travelsData={travelsData}
        buildRouteTo={noop}
        isMobile={false}
        isLoading={false}
      />
    );

    expect(mockAddressListItem).toHaveBeenCalledTimes(travelsData.length);

    // Проверяем, что карточки действительно отрисованы
    travelsData.forEach((item) => {
      expect(getByTestId(`address-item-${item.id}`)).toBeTruthy();
    });
  });

  it('calls buildRouteTo when item is pressed', () => {
    const buildRouteTo = jest.fn();

    const { getByTestId } = render(
      <TravelListPanel
        travelsData={travelsData}
        buildRouteTo={buildRouteTo}
        isMobile={false}
        isLoading={false}
      />
    );

    const firstItem = getByTestId('address-item-1');
    fireEvent.press(firstItem);

    expect(buildRouteTo).toHaveBeenCalledTimes(1);
    expect(buildRouteTo).toHaveBeenCalledWith(travelsData[0]);
  });
});
