import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { UserPointsMapPointMarkerWeb } from '@/components/UserPoints/UserPointsMapPointMarker.web';
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

describe('UserPointsMapPointMarkerWeb', () => {
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

  const markerElement = {
    setAttribute: jest.fn(),
  };
  const markerApi = {
    openPopup: jest.fn(),
    closePopup: jest.fn(),
    getElement: jest.fn(() => markerElement),
  };

  const Marker = React.forwardRef<any, any>(({ children, eventHandlers }, ref) => {
    React.useImperativeHandle(ref, () => markerApi);
    return (
      <View testID="mock-marker">
        <Text accessibilityLabel="marker" onPress={eventHandlers?.click}>
          marker
        </Text>
        {children}
      </View>
    );
  });
  Marker.displayName = 'MockMarker';

  const Popup = ({ children, className }: any) => (
    <View testID="mock-popup" data-class-name={className}>
      {children}
    </View>
  );

  const renderMarker = (overrides: Partial<React.ComponentProps<typeof UserPointsMapPointMarkerWeb>> = {}) => {
    const mapInstance = {
      getZoom: jest.fn(() => 12),
      setView: jest.fn(),
      closePopup: jest.fn(),
    };
    const onEditPoint = jest.fn();
    const onDeletePoint = jest.fn();
    const requestDriveInfo = jest.fn();

    render(
      <UserPointsMapPointMarkerWeb
        mods={{ Marker, Popup }}
        point={point}
        isActive
        colors={{
          backgroundTertiary: '#eee',
          primary: '#111',
          primaryDark: '#111',
          primarySoft: '#ddd',
          surface: '#fff',
          text: '#111',
          textMuted: '#666',
        } as any}
        mapInstance={mapInstance}
        isCompactPopup
        isNarrowPopup
        isTinyPopup={false}
        centerOverride={{ lat: 50, lng: 19 }}
        getMarkerIconCached={jest.fn(() => 'icon')}
        onPointPress={jest.fn()}
        onEditPoint={onEditPoint}
        onDeletePoint={onDeletePoint}
        requestDriveInfo={requestDriveInfo}
        {...overrides}
      />
    );

    return { mapInstance, onDeletePoint, onEditPoint, requestDriveInfo };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlacePopupCard.mockClear();
    markerElement.setAttribute.mockClear();
  });

  it('renders the saved point popup through the shared PlacePopupCard template', () => {
    renderMarker();

    expect(markerElement.setAttribute).toHaveBeenCalledWith('aria-label', 'Saved place');

    expect(screen.getByTestId('mock-place-popup-card')).toBeTruthy();
    const props = mockPlacePopupCard.mock.calls[0]?.[0];

    expect(props.title).toBe('Saved place');
    expect(props.subtitle).toBe('Krakow, Poland');
    expect(props.categoryLabel).toBe('Food');
    expect(props.coord).toBe('50.059240, 19.939410');
    expect(props.articleHref).toBe('/articles/krakow');
    expect(props.relatedTravelUrl).toBe('/travels/krakow');
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

  it('keeps edit, delete, close and marker click behavior from the old popup', () => {
    const { mapInstance, onDeletePoint, onEditPoint, requestDriveInfo } = renderMarker();

    fireEvent.press(screen.getByLabelText('marker'));
    expect(markerApi.openPopup).toHaveBeenCalled();
    expect(mapInstance.setView).toHaveBeenCalledWith([50.05924, 19.93941], 14, { animate: true });
    expect(requestDriveInfo).toHaveBeenCalledWith({ pointId: 77, pointLat: 50.05924, pointLng: 19.93941 });

    fireEvent.press(screen.getByLabelText('Редактировать'));
    expect(markerApi.closePopup).toHaveBeenCalled();
    expect(mapInstance.closePopup).toHaveBeenCalled();
    expect(onEditPoint).toHaveBeenCalledWith(point);

    fireEvent.press(screen.getByLabelText('Удалить'));
    expect(onDeletePoint).toHaveBeenCalledWith(point);

    fireEvent.press(screen.getByLabelText('Закрыть попап'));
    expect(markerApi.closePopup).toHaveBeenCalledTimes(3);
  });
});
