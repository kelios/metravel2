import React from 'react';
import { render } from '@testing-library/react-native';
import OptimizedMap from '@/components/MapPage/OptimizedMap.web';

const mapWebRenderProps: any[] = [];

jest.mock('@/components/MapPage/Map.web', () => {
  const React = require('react');
  return function MapWebMock(props: any) {
    mapWebRenderProps.push(props);
    return React.createElement('MockMapWeb');
  };
});

describe('OptimizedMap.web', () => {
  beforeEach(() => {
    mapWebRenderProps.length = 0;
  });

  it('passes fullRouteCoords down to Map.web', () => {
    const fullRouteCoords: [number, number][] = [
      [27.559, 53.9006],
      [27.5601, 53.9007],
      [27.5612, 53.9008],
    ];

    render(
      <OptimizedMap
        travel={{ data: [] }}
        coordinates={{ latitude: 53.9006, longitude: 27.559 }}
        routePoints={[
          [27.559, 53.9006],
          [27.57, 53.91],
        ]}
        fullRouteCoords={fullRouteCoords}
        setRoutePoints={jest.fn()}
        onMapClick={jest.fn()}
        mode="route"
        transportMode="car"
        setRouteDistance={jest.fn()}
        setFullRouteCoords={jest.fn()}
      />
    );

    expect(mapWebRenderProps.length).toBe(1);
    expect(mapWebRenderProps[0]?.fullRouteCoords).toEqual(fullRouteCoords);
  });

  it('re-renders when fullRouteCoords changes (prevents memo regression)', () => {
    const baseProps = {
      travel: { data: [] as any[] },
      coordinates: { latitude: 53.9006, longitude: 27.559 },
      routePoints: [
        [27.559, 53.9006],
        [27.57, 53.91],
      ] as [number, number][],
      setRoutePoints: jest.fn(),
      onMapClick: jest.fn(),
      mode: 'route' as const,
      transportMode: 'car' as const,
      setRouteDistance: jest.fn(),
      setFullRouteCoords: jest.fn(),
    };

    const { rerender } = render(
      <OptimizedMap
        {...baseProps}
        fullRouteCoords={[
          [27.559, 53.9006],
          [27.5601, 53.9007],
        ]}
      />
    );

    rerender(
      <OptimizedMap
        {...baseProps}
        fullRouteCoords={[
          [27.559, 53.9006],
          [27.5601, 53.9007],
          [27.5612, 53.9008],
        ]}
      />
    );

    expect(mapWebRenderProps.length).toBe(2);
  });
});

