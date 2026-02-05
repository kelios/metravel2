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

const { useLeafletLoader } = require('@/hooks/useLeafletLoader');
const { useMapMarkers } = require('@/hooks/useMapMarkers');
const { useLeafletIcons } = require('@/components/MapPage/Map/useLeafletIcons');

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
});
