const React = require('react');
const { render, act } = require('@testing-library/react-native');

const { MapLogicComponent } = require('@/components/MapPage/Map/MapLogicComponent');

describe('MapLogicComponent radius fitBounds', () => {
  it('prefers circle center when auto-fitting without travel points', async () => {
    const fitBounds = jest.fn();
    const map = {
      fitBounds,
      setView: jest.fn(),
      closePopup: jest.fn(),
      getZoom: jest.fn(() => 11),
      getCenter: jest.fn(() => ({ lat: 50, lng: 10 })),
      on: jest.fn(),
      off: jest.fn(),
    };

    const useMap = jest.fn(() => map);
    const useMapEvents = jest.fn(() => null);

    const mockLeaflet = {
      latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
      latLngBounds: jest.fn(() => ({
        pad: jest.fn(() => 'padded-bounds'),
      })),
      circle: jest.fn(() => ({
        getBounds: () => ({
          getSouthWest: () => ({ lat: 53, lng: 27 }),
          getNorthEast: () => ({ lat: 54, lng: 28 }),
        }),
      })),
    };

    render(
      <MapLogicComponent
        mapClickHandler={() => undefined}
        mode="radius"
        coordinates={{ lat: 50, lng: 10 }}
        userLocation={{ lat: 1, lng: 2 }}
        disableFitBounds={false}
        L={mockLeaflet}
        travelData={[]}
        circleCenter={{ lat: 53.9, lng: 27.5667 }}
        radiusInMeters={60000}
        fitBoundsPadding={{ paddingTopLeft: [0, 0], paddingBottomRight: [0, 0] }}
        setMapZoom={jest.fn()}
        mapRef={{ current: null }}
        onMapReady={jest.fn()}
        savedMapViewRef={{ current: null }}
        hasInitializedRef={{ current: false }}
        lastModeRef={{ current: null }}
        lastAutoFitKeyRef={{ current: null }}
        leafletBaseLayerRef={{ current: null }}
        leafletOverlayLayersRef={{ current: new Map() }}
        leafletControlRef={{ current: null }}
        useMap={useMap}
        useMapEvents={useMapEvents}
      />
    );

    await act(async () => {});

    expect(mockLeaflet.latLng).toHaveBeenCalledWith(53.9, 27.5667);
    expect(mockLeaflet.latLng).not.toHaveBeenCalledWith(1, 2);
    expect(fitBounds).toHaveBeenCalledWith(
      'padded-bounds',
      expect.objectContaining({
        animate: false,
        paddingTopLeft: [0, 0],
        paddingBottomRight: [0, 0],
      })
    );

    expect(mockLeaflet.latLng.mock.calls).toMatchSnapshot();
  });
});
