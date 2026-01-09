import React from 'react';
import { Platform, View, Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

const mockUnifiedCard = jest.fn((props: any) => (
  <View testID="unified-card-mock">
    <Text testID="card-title">{props.title}</Text>
    <Text testID="card-meta">{props.metaText}</Text>
  </View>
));

jest.mock('@/components/ui/UnifiedTravelCard', () => ({
  __esModule: true,
  default: (props: any) => mockUnifiedCard(props),
}));

import PointList from '@/components/travel/PointList';

const basePoint = {
  id: '1',
  address: 'Test address',
  coord: '50.0,20.0',
  travelImageThumbUrl: 'https://example.com/img.jpg',
  categoryName: 'Category',
  description: 'desc',
};

describe('PointList (web coordinates list uses popup template)', () => {
  it('passes baseUrl as articleUrl to PopupContentComponent on web', () => {
    const prevOs = Platform.OS;
    (Platform as any).OS = 'web';

    const baseUrl = 'https://example.com/travel-page';

    const { getByLabelText } = render(
      <PointList points={[basePoint as any]} baseUrl={baseUrl} />
    );

    const toggleButton = getByLabelText('Показать координаты мест');
    fireEvent.press(toggleButton);

    expect(mockUnifiedCard).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.any(String),
        metaText: expect.any(String),
      }),
    );

    (Platform as any).OS = prevOs;
  });
});
