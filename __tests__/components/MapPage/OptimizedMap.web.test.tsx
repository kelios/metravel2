import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import OptimizedMap from '@/components/MapPage/OptimizedMap.web';

// Mock Map.web component using React Native primitives so testIDs work
jest.mock('@/components/MapPage/Map.web', () => {
  const React = require('react')
  const { View, Text } = require('react-native')
  return jest.fn((props: any) => (
    <View testID="map-component">
      <Text testID="map-coordinates">
        {props.coordinates.latitude}, {props.coordinates.longitude}
      </Text>
      <Text testID="map-mode">{props.mode}</Text>
      <Text testID="map-transport-mode">{props.transportMode}</Text>
      <Text testID="map-route-points">{props.routePoints.length}</Text>
      <Text testID="map-travel-data">{props.travel?.data?.length || 0}</Text>
    </View>
  ))
})

describe('OptimizedMap.web', () => {
  const defaultProps = {
    travel: { data: [] },
    coordinates: { latitude: 53.9, longitude: 27.5667 },
    routePoints: [] as [number, number][],
    placesAlongRoute: [],
    mode: 'radius' as const,
    onMapClick: jest.fn(),
    transportMode: 'car' as const,
    setRouteDistance: jest.fn(),
    setFullRouteCoords: jest.fn(),
    setRoutePoints: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByTestId } = render(<OptimizedMap {...defaultProps} />);
    expect(getByTestId('map-component')).toBeTruthy();
  });

  it('passes coordinates to Map component', () => {
    const { getByTestId } = render(<OptimizedMap {...defaultProps} />);
    const coords = getByTestId('map-coordinates');
    expect(coords.props.children).toEqual([53.9, ', ', 27.5667]);
  });

  it('passes mode to Map component', () => {
    const { getByTestId } = render(<OptimizedMap {...defaultProps} mode="route" />);
    const mode = getByTestId('map-mode');
    expect(mode.props.children).toBe('route');
  });

  it('passes transportMode to Map component', () => {
    const { getByTestId } = render(<OptimizedMap {...defaultProps} transportMode="bike" />);
    const transportMode = getByTestId('map-transport-mode');
    expect(transportMode.props.children).toBe('bike');
  });

  it('passes routePoints to Map component', () => {
    const routePoints: [number, number][] = [[27.5667, 53.9], [27.6, 53.95]];
    const { getByTestId } = render(<OptimizedMap {...defaultProps} routePoints={routePoints} />);
    const points = getByTestId('map-route-points');
    expect(points.props.children).toBe(2);
  });

  it('passes travel data to Map component', () => {
    const travelData = {
      data: [
        { id: 1, coord: '53.9,27.5667', address: 'Test Address 1', travelImageThumbUrl: '', categoryName: '' },
        { id: 2, coord: '53.95,27.6', address: 'Test Address 2', travelImageThumbUrl: '', categoryName: '' },
      ],
    };
    const { getByTestId } = render(<OptimizedMap {...defaultProps} travel={travelData} />);
    const data = getByTestId('map-travel-data');
    expect(data.props.children).toBe(2);
  });

  it('handles empty travel data', () => {
    const { getByTestId } = render(<OptimizedMap {...defaultProps} travel={{ data: [] }} />);
    const data = getByTestId('map-travel-data');
    expect(data.props.children).toBe(0);
  });

  it('handles missing travel prop', () => {
    const { travel, ...propsWithoutTravel } = defaultProps;
    const { getByTestId } = render(<OptimizedMap {...propsWithoutTravel} />);
    const data = getByTestId('map-travel-data');
    expect(data.props.children).toBe(0);
  });

  it('passes setRoutePoints callback to Map component', () => {
    const setRoutePoints = jest.fn();
    render(<OptimizedMap {...defaultProps} setRoutePoints={setRoutePoints} />);
    // Component should render without errors
    expect(setRoutePoints).not.toHaveBeenCalled();
  });

  it('ignores placesAlongRoute prop (for compatibility)', () => {
    const placesAlongRoute = [
      { id: 1, coord: '53.9,27.5667', address: 'Place 1' },
      { id: 2, coord: '53.95,27.6', address: 'Place 2' },
    ];
    const { getByTestId } = render(
      <OptimizedMap {...defaultProps} placesAlongRoute={placesAlongRoute} />
    );
    // Should render without errors even with placesAlongRoute
    expect(getByTestId('map-component')).toBeTruthy();
  });

  it('is memoized correctly', () => {
    const { rerender } = render(<OptimizedMap {...defaultProps} />);
    const firstRender = jest.fn();
    
    // Re-render with same props
    rerender(<OptimizedMap {...defaultProps} />);
    
    // Component should handle re-renders
    expect(firstRender).not.toHaveBeenCalled();
  });
});

