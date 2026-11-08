import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import PlacePopupCard from '@/components/MapPage/Map/PlacePopupCard';
import { getThemedColors } from '@/constants/designSystem';

// #3131: фото попапа, которое так и не загрузилось, не должно оставлять пустой
// белый блок — карточка перестраивается как точка без фото.
const mockImageCardMedia = jest.fn((_props: any) => <View testID="mock-hero-image" />);

jest.mock('react-dom', () => ({
  createPortal: (node: any) => node,
}));

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  isIOSSafariUserAgent: () => false,
  default: (props: any) => mockImageCardMedia(props),
}));

jest.mock('@/components/travel/RelatedTravelActionStack', () => ({
  __esModule: true,
  default: () => null,
}));

describe('PlacePopupCard hero image failure', () => {
  beforeEach(() => {
    mockImageCardMedia.mockClear();
  });

  it('drops the hero slot after a terminal image error and restores it for a new url', async () => {
    const colors = getThemedColors(false);
    const props = {
      colors,
      title: 'Точка без фото на сервере',
      coord: '52.427021, 31.014192',
      imageUrl: 'https://metravel.by/address-image/15719/conversions/missing.webp',
      popupSplit: true,
      onCopyCoord: jest.fn(),
      onClose: jest.fn(),
    } as const;

    await render(<PlacePopupCard {...props} />);
    expect(screen.getByTestId('mock-hero-image')).toBeTruthy();
    const heroProps = mockImageCardMedia.mock.calls.at(-1)?.[0];
    expect(typeof heroProps.onTerminalError).toBe('function');
    // Промежуточная ошибка попытки (native зовёт onError перед ретраем) hero не снимает.
    expect(heroProps.onError).toBeUndefined();

    await act(async () => {
      heroProps.onTerminalError();
    });
    expect(screen.queryByTestId('mock-hero-image')).toBeNull();

    // Другая картинка для того же попапа — слот возвращается без ручного сброса.
    await screen.rerender(<PlacePopupCard {...props} imageUrl="https://metravel.by/address-image/1/ok.webp" />);
    expect(screen.getByTestId('mock-hero-image')).toBeTruthy();
  });
});
