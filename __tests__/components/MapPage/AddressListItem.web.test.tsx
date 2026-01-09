import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform, View, Text } from 'react-native';

const mockUnifiedCard = jest.fn((props: any) => (
  <View testID="unified-card-mock">
    <Text testID="card-title">{props.title}</Text>
    <Text testID="card-meta">{props.metaText}</Text>
  </View>
));

// Мокаем UnifiedTravelCard, чтобы проверить, что он используется AddressListItem
jest.mock('@/components/ui/UnifiedTravelCard', () => {
  return {
    __esModule: true,
    default: (props: any) => mockUnifiedCard(props),
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
  it('renders UnifiedTravelCard with travel data on web', () => {
    const prevOs = Platform.OS;
    (Platform as any).OS = 'web';

    const { getByTestId } = render(
      <AddressListItem travel={baseTravel} isMobile={false} />
    );

    const card = getByTestId('unified-card-mock');
    expect(card).toBeTruthy();

    const title = getByTestId('card-title');
    expect((title as any).props.children).toContain('Kraków');

    expect(mockUnifiedCard).toHaveBeenCalledTimes(1);
    expect(mockUnifiedCard).toHaveBeenCalledWith(
      expect.objectContaining({
        title: baseTravel.address,
      }),
    );

    (Platform as any).OS = prevOs;
  });
});
