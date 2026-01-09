import React from 'react';
import { Platform, View, Text, Linking } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockUnifiedCard = jest.fn((props: any) => (
  <View testID="unified-card-mock">
    <Text testID="card-title">{props.title}</Text>
    <Text testID="card-meta">{props.metaText}</Text>
    {props.contentSlot}
  </View>
));

jest.mock('@/components/ui/UnifiedTravelCard', () => ({
  __esModule: true,
  default: (props: any) => mockUnifiedCard(props),
}));

import PointList from '@/components/travel/PointList';

jest.mock('expo-clipboard', () => ({
  __esModule: true,
  setStringAsync: jest.fn(async () => true),
}));

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

    const writeText = jest.fn(() => Promise.resolve());
    Object.defineProperty(global, 'navigator', {
      value: { clipboard: { writeText } },
      writable: true,
    });

    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true as any);
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as any);

    const baseUrl = 'https://example.com/travel-page';

    const { getByLabelText } = render(
      <PointList points={[basePoint as any]} baseUrl={baseUrl} />
    );

    const toggleButton = getByLabelText('Показать координаты мест');
    fireEvent.press(toggleButton);

    expect(getByLabelText('Скопировать координаты')).toBeTruthy();
    expect(getByLabelText('Поделиться в Telegram')).toBeTruthy();
    expect(getByLabelText('Открыть в Google Maps')).toBeTruthy();
    expect(getByLabelText('Открыть в Organic Maps')).toBeTruthy();
    expect(getByLabelText('Открыть статью')).toBeTruthy();

    fireEvent.press(getByLabelText('Открыть в Google Maps'));
    return waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://www.google.com/maps/search/?api=1&query=50,20'
      );
    }).then(() => {
      fireEvent.press(getByLabelText('Открыть в Organic Maps'));
      return waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith('https://omaps.app/50,20');
      });
    }).then(() => {
      fireEvent.press(getByLabelText('Скопировать координаты'));
      return waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(basePoint.coord);
      });
    }).then(() => {
      fireEvent.press(getByLabelText('Поделиться в Telegram'));
      return waitFor(() => {
        const calls = (Linking.openURL as any).mock.calls.map((c: any[]) => String(c?.[0] ?? ''));
        expect(calls.some((v: string) => /^(tg:\/\/|https:\/\/t\.me\/share\/url\?url=)/.test(v))).toBe(true);
      }).then(() => {
        fireEvent.press(getByLabelText('Открыть статью'));
        return waitFor(() => {
          expect(Linking.openURL).toHaveBeenCalledWith(baseUrl);
        }).then(() => {
          (Platform as any).OS = prevOs;
        });
      });
    });
  });
});
