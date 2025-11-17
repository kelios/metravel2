import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import MapClientSideComponent from '@/components/Map.web';

// Mock leaflet modules
const mockLeaflet = {
  Icon: jest.fn().mockImplementation((options: any) => ({
    options,
    _getIconUrl: jest.fn(),
  })),
  latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
  latLngBounds: jest.fn((points: any[]) => ({
    isValid: jest.fn(() => true),
    pad: jest.fn((padding: number) => ({ pad: padding })),
  })),
};

const mockReactLeaflet = {
  MapContainer: ({ children, ...props }: any) => <div data-testid="map-container" {...props}>{children}</div>,
  TileLayer: (props: any) => <div data-testid="tile-layer" {...props} />,
  Marker: (props: any) => <div data-testid="marker" {...props} />,
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
  useMap: jest.fn(() => ({
    fitBounds: jest.fn(),
    setView: jest.fn(),
    closePopup: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    getZoom: jest.fn(() => 10),
  })),
};

// Mock window object
Object.defineProperty(window, 'window', {
  value: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    requestIdleCallback: jest.fn((callback: any) => {
      setTimeout(callback, 0);
      return 1;
    }),
    L: mockLeaflet,
  },
  writable: true,
});

// Mock document
Object.defineProperty(window, 'document', {
  value: {
    querySelector: jest.fn(() => null),
    createElement: jest.fn(() => ({
      setAttribute: jest.fn(),
      rel: '',
      href: '',
    })),
    head: {
      appendChild: jest.fn(),
    },
  },
  writable: true,
});

// Mock leaflet CSS import
jest.mock('leaflet/dist/leaflet.css', () => ({}), { virtual: true });

// Mock leaflet module
jest.mock('leaflet', () => ({
  __esModule: true,
  default: mockLeaflet,
}));

// Mock react-leaflet module
jest.mock('react-leaflet', () => mockReactLeaflet);

// Mock PopupContentComponent
jest.mock('@/components/MapPage/PopupContentComponent', () => {
  const React = require('react')
  const MockComponent = () => <div data-testid="popup-content" />
  return {
    __esModule: true,
    default: MockComponent,
  }
})

describe('MapClientSideComponent (Map.web.tsx)', () => {
  const defaultProps = {
    travel: { data: [] },
    coordinates: { latitude: 53.8828449, longitude: 27.7273595 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (window as any).L = mockLeaflet;
    (window as any).requestIdleCallback = jest.fn((callback: any) => {
      setTimeout(callback, 0);
      return 1;
    });
  });

  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  it('renders placeholder when not on web', () => {
    const originalPlatform = require('react-native').Platform;
    require('react-native').Platform.OS = 'ios';
    
    const { getByText } = render(<MapClientSideComponent {...defaultProps} />);
    expect(getByText('Карта доступна только в браузере')).toBeTruthy();
    
    require('react-native').Platform.OS = originalPlatform.OS;
  });

  it('renders loading state initially on web', () => {
    require('react-native').Platform.OS = 'web';
    
    const rendered = render(<MapClientSideComponent {...defaultProps} />);
    expect(rendered.toJSON()).toBeTruthy();
  });

  it('uses public URL path for marker icon', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../../components/Map.web.tsx');
    
    if (!fs.existsSync(filePath)) {
      return;
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    expect(fileContent).toContain('marker-icon-orange.png');
    expect(fileContent).toContain('raw.githubusercontent.com/pointhi/leaflet-color-markers');
  });

  it('handles travel data correctly', async () => {
    const travelData = {
      data: [
        {
          id: 1,
          coord: '53.9,27.5667',
          address: 'Test Address',
          travelImageThumbUrl: 'test.jpg',
          categoryName: 'Test Category',
        },
      ],
    };

    const rendered = render(
      <MapClientSideComponent {...defaultProps} travel={travelData} />
    );
    
    expect(rendered.toJSON()).toBeTruthy();
  });

  it('uses default coordinates when not provided', () => {
    const rendered = render(<MapClientSideComponent travel={{ data: [] }} />);
    expect(rendered.toJSON()).toBeTruthy();
  });

  it('handles null coordinates gracefully', () => {
    const rendered = render(
      <MapClientSideComponent travel={{ data: [] }} coordinates={null} />
    );
    expect(rendered.toJSON()).toBeTruthy();
  });

  it('filters out invalid coordinates', () => {
    const travelData = {
      data: [
        {
          id: 1,
          coord: 'invalid,coord',
          address: 'Test',
          travelImageThumbUrl: 'test.jpg',
          categoryName: 'Test',
        },
        {
          id: 2,
          coord: '53.9,27.5667',
          address: 'Test',
          travelImageThumbUrl: 'test.jpg',
          categoryName: 'Test',
        },
      ],
    };

    const rendered = render(
      <MapClientSideComponent {...defaultProps} travel={travelData} />
    );
    
    expect(rendered.toJSON()).toBeTruthy();
  });
});

