// __tests__/components/Map.ios.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';

// Mock react-native-maps
jest.mock('react-native-maps', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ children, ...props }: any) => 
      React.createElement('MapView', props, children),
    Marker: ({ children, ...props }: any) => 
      React.createElement('Marker', props, children),
    Callout: ({ children, ...props }: any) => 
      React.createElement('Callout', props, children),
  };
});

describe('Map.ios Component', () => {
  // Динамический импорт только для iOS тестов
  let Map: any;

  beforeAll(async () => {
    // Импортируем iOS версию напрямую
    Map = (await import('@/components/map/Map.ios')).default;
  });

  const mockTravel = {
    travelAddress: {
      data: [
        {
          id: 1,
          lat: '53.9',
          lng: '27.5',
          coord: '53.9,27.5',
          address: 'Test Address, Minsk',
          travelImageThumbUrl: 'https://example.com/image.jpg',
          categoryName: 'Attraction',
        },
        {
          id: 2,
          lat: '53.8',
          lng: '27.6',
          coord: '53.8,27.6',
          address: 'Another Address',
          travelImageThumbUrl: '',
          categoryName: 'Restaurant',
        },
      ],
    },
  };

  const mockCoordinates = {
    latitude: 53.9,
    longitude: 27.5,
  };

  it('should render without crashing', () => {
    const { UNSAFE_getByType } = render(
      <Map travel={mockTravel} coordinates={mockCoordinates} />
    );
    expect(UNSAFE_getByType('MapView' as any)).toBeTruthy();
  });

  it('should render MapView component', () => {
    const { UNSAFE_getByType } = render(
      <Map travel={mockTravel} coordinates={mockCoordinates} />
    );
    
    const mapView = UNSAFE_getByType('MapView' as any);
    expect(mapView).toBeTruthy();
  });

  it('should render correct number of markers', () => {
    const { UNSAFE_getAllByType } = render(
      <Map travel={mockTravel} coordinates={mockCoordinates} />
    );
    
    const markers = UNSAFE_getAllByType('Marker' as any);
    expect(markers.length).toBe(mockTravel.travelAddress.data.length);
  });

  it('should handle empty travel data', () => {
    const emptyTravel = { 
      travelAddress: { 
        data: [] 
      } 
    };
    
    const { UNSAFE_getByType } = render(
      <Map travel={emptyTravel} coordinates={mockCoordinates} />
    );
    
    const mapView = UNSAFE_getByType('MapView' as any);
    expect(mapView).toBeTruthy();
  });

  it('should use default coordinates when not provided', () => {
    const { UNSAFE_getByType } = render(
      <Map travel={mockTravel} coordinates={null} />
    );
    
    const mapView = UNSAFE_getByType('MapView' as any);
    expect(mapView).toBeTruthy();
    expect(mapView.props.initialRegion).toBeDefined();
  });

  it('should parse coordinates correctly', () => {
    const { UNSAFE_getAllByType } = render(
      <Map travel={mockTravel} coordinates={mockCoordinates} />
    );
    
    const markers = UNSAFE_getAllByType('Marker' as any);
    const firstMarker = markers[0];
    
    expect(firstMarker.props.coordinate).toEqual({
      latitude: 53.9,
      longitude: 27.5,
    });
  });

  it('should render callout with point information', () => {
    const { getAllByText } = render(
      <Map travel={mockTravel} coordinates={mockCoordinates} />
    );
    
    expect(getAllByText('Адрес места:')[0]).toBeTruthy();
    expect(getAllByText('Координаты:')[0]).toBeTruthy();
    expect(getAllByText('Категория объекта:')[0]).toBeTruthy();
  });

  it('should display point address in callout', () => {
    const { getByText } = render(
      <Map travel={mockTravel} coordinates={mockCoordinates} />
    );
    
    expect(getByText('Test Address, Minsk')).toBeTruthy();
  });

  it('should display point category in callout', () => {
    const { getByText } = render(
      <Map travel={mockTravel} coordinates={mockCoordinates} />
    );
    
    expect(getByText('Attraction')).toBeTruthy();
  });

  it('should handle missing image gracefully', () => {
    const travelWithoutImage = {
      travelAddress: {
        data: [{
          ...mockTravel.travelAddress.data[1],
          travelImageThumbUrl: '',
        }],
      },
    };

    const { UNSAFE_getByType } = render(
      <Map travel={travelWithoutImage} coordinates={mockCoordinates} />
    );
    
    expect(UNSAFE_getByType('MapView' as any)).toBeTruthy();
  });
});
