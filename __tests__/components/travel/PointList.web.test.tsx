import React from 'react';
import { Platform, View, Text } from 'react-native';
import { render } from '@testing-library/react-native';

const popupMock = jest.fn((props: any) => (
  <View testID="popup-content-mock">
    <Text testID="popup-article-url">{props.travel.articleUrl}</Text>
  </View>
));

jest.mock('@/components/MapPage/PopupContentComponent', () => ({
  __esModule: true,
  default: (props: any) => popupMock(props),
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

    const { getByTestId } = render(
      <PointList points={[basePoint as any]} baseUrl={baseUrl} />
    );

    const popup = getByTestId('popup-content-mock');
    expect(popup).toBeTruthy();

    const urlText = getByTestId('popup-article-url');
    expect((urlText as any).props.children).toBe(baseUrl);

    expect(popupMock).toHaveBeenCalledWith(
      expect.objectContaining({
        travel: expect.objectContaining({ articleUrl: baseUrl, urlTravel: baseUrl }),
      }),
    );

    (Platform as any).OS = prevOs;
  });
});
