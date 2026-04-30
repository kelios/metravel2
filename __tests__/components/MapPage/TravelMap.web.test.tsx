import React from 'react';
import { render } from '@testing-library/react-native';
import { TravelMap } from '@/components/MapPage/TravelMap';

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
}));

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
  const originalWindowDimensions = require('react-native').useWindowDimensions;

  beforeEach(() => {
    jest.clearAllMocks();

    require('react-native').useWindowDimensions = jest.fn(() => ({
      width: 1024,
      height: 768,
      scale: 1,
      fontScale: 1,
    }));

    // Default: leaflets ready
    useLeafletLoader.mockReturnValue({
      L: {},
      RL: {
        MapContainer: React.forwardRef(({ children }: any, ref: any) => {
          React.useImperativeHandle(ref, () => ({ setView: jest.fn() }));
          return <div data-testid="rl-map">{children}</div>;
        }),
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

  afterEach(() => {
    require('react-native').useWindowDimensions = originalWindowDimensions;
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

  it('does not crash when MapContainer uses ref (strictmode-safe)', () => {
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
        userLocation: null,
        compactLayout: true,
      })
    );

    expect(mockMapMarkers).toHaveBeenCalled();
    const props = mockMapMarkers.mock.calls[0]?.[0];
    expect(props).toBeTruthy();
    expect(props.popupProps).toEqual(
      expect.objectContaining({
        autoPan: true,
        closeOnClick: false,
        keepInView: true,
        className: 'metravel-place-popup',
        maxWidth: 300,
        minWidth: 248,
        autoPanPaddingTopLeft: [12, 72],
        autoPanPaddingBottomRight: [12, 72],
      })
    );
    expect(props.popupProps.eventHandlers).toEqual(
      expect.objectContaining({
        popupopen: expect.any(Function),
      })
    );
  });

  it('uses a smaller popup shell on very narrow compact mobile viewports', () => {
    require('react-native').useWindowDimensions = jest.fn(() => ({
      width: 360,
      height: 740,
      scale: 1,
      fontScale: 1,
    }));

    render(
      <TravelMap
        travelData={[{ coord: '53.9, 27.56' }]}
        compact
        height={320}
      />
    );

    expect(mockMapMarkers).toHaveBeenCalled();
    const props = mockMapMarkers.mock.calls[0]?.[0];
    expect(props).toBeTruthy();
    expect(props.popupProps).toEqual(
      expect.objectContaining({
        maxWidth: 236,
        minWidth: 212,
        autoPanPaddingTopLeft: [8, 56],
        autoPanPaddingBottomRight: [8, 104],
      })
    );
  });
});
