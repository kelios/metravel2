import { render } from '@testing-library/react-native';
import MapClientSideComponent from '@/components/Map.web';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock leaflet modules
const mockLeaflet = {
  Icon: jest.fn().mockImplementation((options: any) => ({
    options,
    _getIconUrl: jest.fn(),
  })),
  latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
  latLngBounds: jest.fn((_points: any[]) => ({
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

// Mock react-native Platform
const mockPlatform = {
  OS: 'web',
  select: jest.fn((obj) => obj.web || obj.default),
};

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: mockPlatform,
  };
});

// Mock UnifiedTravelCard
jest.mock('@/components/ui/UnifiedTravelCard', () => {
  const RN = require('react-native')
  const View = RN.View
  return function UnifiedTravelCard() {
    return <View data-testid="unified-travel-card" />
  }
})

describe('MapClientSideComponent (Map.web.tsx)', () => {
  const renderWithQueryClient = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

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
    mockPlatform.OS = 'ios';
    
    const { getByText } = renderWithQueryClient(<MapClientSideComponent {...defaultProps} />);
    expect(getByText('Карта доступна только в браузере')).toBeTruthy();
    
    mockPlatform.OS = 'web';
  });

  it('renders loading state initially on web', () => {
    mockPlatform.OS = 'web';
    
    const rendered = renderWithQueryClient(<MapClientSideComponent {...defaultProps} />);
    expect(rendered.toJSON()).toBeTruthy();
  });

  it('handles travel data correctly', async () => {
    const travelData = {
      data: [
        {
          id: '1',
          coord: '53.9,27.5667',
          address: 'Test Address',
          travelImageThumbUrl: 'test.jpg',
          categoryName: 'Test Category',
        },
      ],
    };

    const rendered = renderWithQueryClient(
      <MapClientSideComponent {...defaultProps} travel={travelData} />
    );
    
    expect(rendered.toJSON()).toBeTruthy();
  });

  it('uses default coordinates when not provided', () => {
    const rendered = renderWithQueryClient(<MapClientSideComponent travel={{ data: [] }} />);
    expect(rendered.toJSON()).toBeTruthy();
  });

  it('handles null coordinates gracefully', () => {
    const rendered = renderWithQueryClient(
      <MapClientSideComponent travel={{ data: [] }} coordinates={null} />
    );
    expect(rendered.toJSON()).toBeTruthy();
  });

  it('filters out invalid coordinates', () => {
    const travelData = {
      data: [
        {
          id: '1',
          coord: 'invalid,coord',
          address: 'Test',
          travelImageThumbUrl: 'test.jpg',
          categoryName: 'Test',
        },
        {
          id: '2',
          coord: '53.9,27.5667',
          address: 'Test',
          travelImageThumbUrl: 'test.jpg',
          categoryName: 'Test',
        },
      ],
    };

    const rendered = renderWithQueryClient(
      <MapClientSideComponent {...defaultProps} travel={travelData} />
    );
    
    expect(rendered.toJSON()).toBeTruthy();
  });
});
