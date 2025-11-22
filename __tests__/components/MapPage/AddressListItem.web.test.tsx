import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform, View, Text } from 'react-native';

const mockPopup = jest.fn((props: any) => (
  <View testID="popup-content-mock">
    <Text testID="popup-address">{props.travel.address}</Text>
  </View>
));

// Мокаем PopupContentComponent, чтобы проверить, что он используется AddressListItem
jest.mock('@/components/MapPage/PopupContentComponent', () => {
  return {
    __esModule: true,
    default: (props: any) => mockPopup(props),
  };
});

import AddressListItem from '@/components/MapPage/AddressListItem';

const baseTravel: any = {
  id: 1,
  address: 'Kraków, Poland',
  coord: '50.0619474, 19.9368564',
  travelImageThumbUrl: 'https://example.com/image.jpg',
  categoryName: 'Category 1, Category 2',
  articleUrl: 'https://example.com/article',
  urlTravel: 'https://example.com/quest',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('AddressListItem (web right panel)', () => {
  it('renders PopupContentComponent with travel data on web', () => {
    const prevOs = Platform.OS;
    (Platform as any).OS = 'web';

    const { getByTestId } = render(
      <AddressListItem travel={baseTravel} isMobile={false} />
    );

    const popup = getByTestId('popup-content-mock');
    expect(popup).toBeTruthy();

    const address = getByTestId('popup-address');
    expect((address as any).props.children).toContain('Kraków');

    expect(mockPopup).toHaveBeenCalledTimes(1);
    expect(mockPopup).toHaveBeenCalledWith(
      expect.objectContaining({
        travel: expect.objectContaining({ address: baseTravel.address }),
      }),
    );

    (Platform as any).OS = prevOs;
  });
});
