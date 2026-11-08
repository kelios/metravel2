import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { UserPointPopupContent } from '@/components/UserPoints/UserPointPopupContent.web';
import { PointStatus, type ImportedPoint } from '@/types/userPoints';

const mockPlacePopupCard = jest.fn((props: any) => (
  <View testID="mock-place-popup-card">
    <Text>{props.title}</Text>
    {props.onClose && !props.suppressInlineClose ? (
      <Text accessibilityLabel="Закрыть попап" onPress={props.onClose}>
        Закрыть
      </Text>
    ) : null}
    {(props.extraActions ?? []).map((action: any) => (
      <Text key={action.key} accessibilityLabel={action.accessibilityLabel} onPress={action.onPress}>
        {action.label}
      </Text>
    ))}
  </View>
));

jest.mock('@/components/MapPage/Map/PlacePopupCard', () => ({
  __esModule: true,
  default: (props: any) => mockPlacePopupCard(props),
}));

jest.mock('expo-clipboard', () => ({
  __esModule: true,
  setStringAsync: jest.fn(async () => true),
}));

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrlInNewTab: jest.fn(async () => true),
}));

describe('UserPointPopupContent (web, #3131)', () => {
  const point: ImportedPoint = {
    id: 77,
    name: 'Saved place',
    description: 'Personal note',
    latitude: 50.05924,
    longitude: 19.93941,
    address: 'Krakow, Poland',
    color: 'blue',
    categoryIds: ['Food'],
    category: 'Food',
    status: PointStatus.PLANNING,
    source: 'osm',
    imported_at: '2026-07-03T08:00:00Z',
    created_at: '2026-07-03T08:00:00Z',
    updated_at: '2026-07-03T08:00:00Z',
    tags: {
      articleUrl: '/articles/krakow',
      travelUrl: '/travels/krakow',
    },
  };

  const colors = {
    backgroundTertiary: '#eee',
    primary: '#111',
    primaryDark: '#111',
    primarySoft: '#ddd',
    surface: '#fff',
    text: '#111',
    textMuted: '#666',
  } as any;

  const renderContent = async (overrides: Partial<React.ComponentProps<typeof UserPointPopupContent>> = {}) => {
    const onClose = jest.fn();
    const onEditPoint = jest.fn();
    const onDeletePoint = jest.fn();
    await render(
      <UserPointPopupContent
        point={point}
        colors={colors}
        isCompactPopup
        onClose={onClose}
        onEditPoint={onEditPoint}
        onDeletePoint={onDeletePoint}
        {...overrides}
      />
    );
    return { onClose, onEditPoint, onDeletePoint };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlacePopupCard.mockClear();
  });

  it('renders the saved point popup through the shared PlacePopupCard template', async () => {
    await renderContent();

    expect(screen.getByTestId('mock-place-popup-card')).toBeTruthy();
    const props = mockPlacePopupCard.mock.calls[0]?.[0];

    expect(props.title).toBe('Saved place');
    expect(props.subtitle).toBe('Krakow, Poland');
    expect(props.categoryLabel).toBe('Food');
    expect(props.coord).toBe('50.059240, 19.939410');
    expect(props.articleHref).toBe('/articles/krakow');
    expect(props.relatedTravelUrl).toBe('/travels/krakow');
    // Точка сохранена до #1960: `tags.travelId` нет — стек разбирает сам url.
    expect(props.relatedTravelId).toBeNull();
    expect(props.onAddPoint).toBeUndefined();
    expect(props.suppressFallbackPrimaryAction).toBe(true);
    expect(props.compactLayout).toBe(true);
    expect(props.fullscreenOnMobile).toBe(false);
    expect(props.popupSplit).toBe(false);

    expect(props.onOpenGoogleMaps).toEqual(expect.any(Function));
    expect(props.onOpenAppleMaps).toEqual(expect.any(Function));
    expect(props.onOpenOrganicMaps).toEqual(expect.any(Function));
    expect(props.onOpenWaze).toEqual(expect.any(Function));
    expect(props.onOpenYandexMaps).toEqual(expect.any(Function));
    expect(props.onOpenYandexNavi).toEqual(expect.any(Function));
    expect(props.onOpenOpenStreetMap).toEqual(expect.any(Function));
    expect(props.onShareTelegram).toEqual(expect.any(Function));
    expect(props.onClose).toEqual(expect.any(Function));
    expect(props.suppressInlineClose).toBeFalsy();

    expect(props.extraActions.map((action: any) => action.key)).toEqual(['edit', 'delete']);
  });

  it('passes the saved travel id from tags to the related travel stack (#1960)', async () => {
    await renderContent({
      point: {
        ...point,
        tags: { travelUrl: 'https://metravel.by/travels/forty-krakova', travelId: 435 },
      },
    });

    expect(mockPlacePopupCard.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        relatedTravelUrl: 'https://metravel.by/travels/forty-krakova',
        relatedTravelId: 435,
      }),
    );
  });

  it('ignores a malformed saved travel id', async () => {
    await renderContent({ point: { ...point, tags: { travelUrl: '/travels/krakow', travelId: 'abc' } } });

    expect(mockPlacePopupCard.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ relatedTravelUrl: '/travels/krakow', relatedTravelId: null }),
    );
  });

  it('does not pass a saved travel id without its travel url', async () => {
    await renderContent({ point: { ...point, tags: { travelId: 435 } } });

    expect(mockPlacePopupCard.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ relatedTravelUrl: null, relatedTravelId: null }),
    );
  });

  it('closes the popup before edit/delete and exposes the card close', async () => {
    const { onClose, onDeletePoint, onEditPoint } = await renderContent();

    await fireEvent.press(screen.getByLabelText('Редактировать'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onEditPoint).toHaveBeenCalledWith(point);

    await fireEvent.press(screen.getByLabelText('Удалить'));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onDeletePoint).toHaveBeenCalledWith(point);

    await fireEvent.press(screen.getByLabelText('Закрыть попап'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('turns drive info into metres and seconds for the card', async () => {
    await renderContent({ driveInfo: { status: 'ok', distanceKm: 12.5, durationMin: 20 } });
    expect(mockPlacePopupCard.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ drivingDistanceMeters: 12500, drivingDurationSeconds: 1200, isDrivingLoading: false }),
    );
  });
});
