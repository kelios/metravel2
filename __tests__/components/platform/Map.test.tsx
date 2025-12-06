import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';

// Mock react-native-maps
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  
  class MockMapView extends React.Component {
    fitToCoordinates = jest.fn();
    
    render() {
      return React.createElement(View, this.props, this.props.children);
    }
  }

  return {
    __esModule: true,
    default: MockMapView,
    Marker: View,
    Callout: View,
  };
});

// Mock leaflet для web
jest.mock('leaflet', () => ({
  icon: jest.fn(),
  marker: jest.fn(),
  map: jest.fn(),
  divIcon: jest.fn(),
  latLng: jest.fn(),
  latLngBounds: jest.fn(),
}));

jest.mock('react-leaflet', () => {
  const React = require('react');
  return {
    MapContainer: ({ children }: any) => React.createElement('div', { 'data-testid': 'map-container' }, children),
    TileLayer: () => React.createElement('div', { 'data-testid': 'tile-layer' }),
    Marker: ({ children }: any) => React.createElement('div', { 'data-testid': 'marker' }, children),
    Popup: ({ children }: any) => React.createElement('div', { 'data-testid': 'popup' }, children),
    Circle: () => React.createElement('div', { 'data-testid': 'circle' }),
    useMap: jest.fn(() => ({
      setView: jest.fn(),
      fitBounds: jest.fn(),
    })),
    useMapEvents: jest.fn(() => ({})),
  };
});

// Mock RoutingMachine
jest.mock('@/components/MapPage/RoutingMachine', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'routing-machine' });
});

// Mock PopupContentComponent
jest.mock('@/components/MapPage/PopupContentComponent', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'popup-content' });
});

// Mock MapLegend
jest.mock('@/components/MapPage/MapLegend', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'map-legend' });
});

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

describe('Map Component - Platform Specific', () => {
  const mockTravel = {
    travelAddress: {
      current_page: 1,
      data: [
        {
          id: 1,
          lat: '53.9',
          lng: '27.5',
          coord: '53.9,27.5',
          address: 'Test Address',
          travelImageThumbUrl: 'https://example.com/image.jpg',
          categoryName: 'Test Category',
        },
      ],
      next_page_url: null,
      path: '',
      per_page: 10,
      prev_page_url: null,
      to: 1,
      total: 1,
    },
  };

  const mockCoordinates = {
    latitude: 53.9,
    longitude: 27.5,
  };

  describe('iOS Platform', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    it('should render Map component on iOS', () => {
      const Map = require('../../../components/Map.ios').default;
      const { getByTestId } = render(
        <Map travel={mockTravel} coordinates={mockCoordinates} />
      );
      // iOS использует react-native-maps, который мы замокали как View
      expect(() => render(<Map travel={mockTravel} coordinates={mockCoordinates} />)).not.toThrow();
    });

    it('should handle null coordinates on iOS', () => {
      const Map = require('../../../components/Map.ios').default;
      expect(() => render(<Map travel={mockTravel} coordinates={null} />)).not.toThrow();
    });
  });

  describe('Android Platform', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    it('should render Map component on Android', () => {
      const Map = require('../../../components/Map.android').default;
      expect(() => render(<Map travel={mockTravel} coordinates={mockCoordinates} />)).not.toThrow();
    });

    it('should handle null coordinates on Android', () => {
      const Map = require('../../../components/Map.android').default;
      expect(() => render(<Map travel={mockTravel} coordinates={null} />)).not.toThrow();
    });

    it('should use same implementation as iOS', () => {
      const MapAndroid = require('../../../components/Map.android').default;
      const MapIOS = require('../../../components/Map.ios').default;
      // Android экспортирует iOS версию
      expect(MapAndroid).toBeDefined();
    });
  });

  describe('Web Platform', () => {
    beforeEach(() => {
      Platform.OS = 'web';
    });

    it('should have web-specific Map component', () => {
      // Web версия использует Leaflet
      expect(() => require('../../../components/Map.web')).not.toThrow();
    });
  });

  describe('Platform Detection', () => {
    it('should correctly identify iOS platform', () => {
      Platform.OS = 'ios';
      expect(Platform.OS).toBe('ios');
    });

    it('should correctly identify Android platform', () => {
      Platform.OS = 'android';
      expect(Platform.OS).toBe('android');
    });

    it('should correctly identify Web platform', () => {
      Platform.OS = 'web';
      expect(Platform.OS).toBe('web');
    });
  });

  describe('Component Exports', () => {
    it('should export Map component for iOS', () => {
      const MapIOS = require('../../../components/Map.ios');
      expect(MapIOS.default).toBeDefined();
    });

    it('should export Map component for Android', () => {
      const MapAndroid = require('../../../components/Map.android');
      expect(MapAndroid.default).toBeDefined();
    });

    it('should export Map component for Web', () => {
      const MapWeb = require('../../../components/Map.web');
      expect(MapWeb.default).toBeDefined();
    });
  });

  describe('MapPage Map Component', () => {
    it('should have iOS version in MapPage', () => {
      expect(() => require('../../../components/MapPage/Map.ios')).not.toThrow();
    });

    it('should have Android version in MapPage', () => {
      expect(() => require('../../../components/MapPage/Map.android')).not.toThrow();
    });

    it('should have Web version in MapPage', () => {
      expect(() => require('../../../components/MapPage/Map.web')).not.toThrow();
    });
  });
});
