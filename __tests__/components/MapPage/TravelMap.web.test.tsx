import React from 'react';
import { render } from '@testing-library/react-native';
import { TravelMap } from '@/components/MapPage/TravelMap';

jest.mock('@/hooks/useLeafletLoader', () => ({
  useLeafletLoader: jest.fn(),
}));

jest.mock('@/hooks/useMapMarkers', () => ({
  useMapMarkers: jest.fn(),
}));

jest.mock('@/components/MapPage/Map/useLeafletIcons', () => ({
  useLeafletIcons: jest.fn(),
}));

jest.mock('@/components/MapPage/Map/createMapPopupComponent', () => ({
  createMapPopupComponent: jest.fn(() => () => null),
}));

const mockMapMarkers = jest.fn(() => null);
const mockClusterLayer = jest.fn(() => null);

jest.mock('@/components/MapPage/Map/MapMarkers', () => ({
  __esModule: true,
  default: (props: any) => {
    mockMapMarkers(props);
    return <div data-testid="mock-map-markers" />;
  },
}));

jest.mock('@/components/MapPage/Map/ClusterLayer', () => ({
  __esModule: true,
  default: (props: any) => {
    mockClusterLayer(props);
    return <div data-testid="mock-cluster-layer" />;
  },
}));

const { useLeafletLoader } = require('@/hooks/useLeafletLoader');
const { useMapMarkers } = require('@/hooks/useMapMarkers');
const { useLeafletIcons } = require('@/components/MapPage/Map/useLeafletIcons');
const { createMapPopupComponent } = require('@/components/MapPage/Map/createMapPopupComponent');

describe('TravelMap (web)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: leaflets ready
    useLeafletLoader.mockReturnValue({
      L: {},
      RL: {
        MapContainer: ({ children, whenCreated }: any) => {
          // Simulate react-leaflet calling whenCreated with map instance
          whenCreated?.({ setView: jest.fn() });
          return <div data-testid="rl-map">{children}</div>;
        },
        TileLayer: () => <div data-testid="rl-tile" />,
        Marker: () => <div data-testid="rl-marker" />,
        Popup: ({ children }: any) => <div data-testid="rl-popup">{children}</div>,
        useMap: jest.fn(),
      },
      loading: false,
      ready: true,
      error: null,
    });

    useMapMarkers.mockReturnValue({
      shouldRenderClusters: false,
      clusters: [],
      markers: [{ coord: '53.9, 27.56' }],
      markerOpacity: 1,
    });

    useLeafletIcons.mockReturnValue({
      meTravel: {},
    });
  });

  it('renders a stable container with data-testid="travel-map" on web when ready', () => {
    const { getByTestId } = render(
      <TravelMap
        travelData={[{ coord: '53.9, 27.56' }]}
        compact
        height={400}
      />
    );

    // RN testID
    expect(getByTestId('travel-map')).toBeTruthy();
  });

  it('does not crash when MapContainer uses whenCreated (strictmode-safe)', () => {
    const { getByTestId } = render(
      <TravelMap
        travelData={[{ coord: '53.9, 27.56' }]}
        compact
        height={400}
      />
    );

    expect(getByTestId('travel-map')).toBeTruthy();
  });

  it('does not call rl.useMap by default (points-only, no route line)', () => {
    render(
      <TravelMap
        travelData={[
          { coord: '53.9, 27.56' },
          { coord: '53.91, 27.57' },
        ]}
        compact
        height={400}
      />
    );

    const { useLeafletLoader } = require('@/hooks/useLeafletLoader');
    const loaderValue = useLeafletLoader.mock.results[0]?.value;
    expect(loaderValue?.RL?.useMap).toHaveBeenCalledTimes(0);
  });

  it('calls rl.useMap when showRouteLine=true and there are 2+ points', () => {
    render(
      <TravelMap
        travelData={[
          { coord: '53.9, 27.56' },
          { coord: '53.91, 27.57' },
        ]}
        showRouteLine
        compact
        height={400}
      />
    );

    const { useLeafletLoader } = require('@/hooks/useLeafletLoader');
    const loaderValue = useLeafletLoader.mock.results[0]?.value;
    expect(loaderValue?.RL?.useMap).toHaveBeenCalled();
  });

  it('renders map when there are no points but there is a route line', () => {
    const { getByTestId } = render(
      <TravelMap
        travelData={[]}
        showRouteLine
        routeLines={[
          {
            coords: [
              [51.72829, 10.260445],
              [51.745633, 11.031075],
            ],
          },
        ]}
        compact
        height={400}
      />
    );

    expect(getByTestId('travel-map')).toBeTruthy();
  });

  it('passes responsive metravel popup props to travel map markers', () => {
    render(
      <TravelMap
        travelData={[{ coord: '53.9, 27.56' }]}
        compact
        height={400}
      />
    );

    expect(createMapPopupComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        useMap: expect.any(Function),
        userLocation: null,
      })
    );

    expect(mockMapMarkers).toHaveBeenCalled();
    const props = mockMapMarkers.mock.calls[0]?.[0];
    expect(props).toBeTruthy();
    expect(props.popupProps).toEqual(
      expect.objectContaining({
        autoPan: true,
        keepInView: true,
        className: 'metravel-place-popup',
        maxWidth: 436,
        minWidth: 336,
        autoPanPaddingTopLeft: [24, 140],
        autoPanPaddingBottomRight: [24, 140],
      })
    );
    expect(props.popupProps.eventHandlers).toEqual(
      expect.objectContaining({
        popupopen: expect.any(Function),
      })
    );
  });
});
