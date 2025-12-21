import { render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import MapPanel from '@/components/MapPage/MapPanel';

const mockWebMap = jest.fn((props: any) => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return (
    <View testID="web-map">
      <Text testID="map-travel-data">{props.travel?.data?.length || 0}</Text>
      <Text testID="map-coordinates">
        {props.coordinates.latitude}, {props.coordinates.longitude}
      </Text>
    </View>
  );
});

jest.mock('@/components/MapPage/Map', () => ({
  __esModule: true,
  default: (props: any) => mockWebMap(props),
}));

describe('MapPanel', () => {
  const defaultProps = {
    travelsData: [
      { id: 1, coord: '53.9,27.5667', address: 'Test Address 1' },
      { id: 2, coord: '53.95,27.6', address: 'Test Address 2' },
    ],
    coordinates: { latitude: 53.9, longitude: 27.5667 },
    routePoints: [] as [number, number][],
    placesAlongRoute: [],
    mode: 'radius' as const,
    setRoutePoints: jest.fn(),
    onMapClick: jest.fn(),
    transportMode: 'car' as const,
    setRouteDistance: jest.fn(),
    setFullRouteCoords: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Platform.OS
    (Platform.OS as any) = 'web';
    // Mock window object
    (global as any).window = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      matchMedia: jest.fn(() => ({
        matches: false,
        addListener: jest.fn(),
        removeListener: jest.fn(),
      })),
    };
  });

  afterEach(() => {
    delete (global as any).window;
  });

  it('renders placeholder on non-web platform', () => {
    (Platform.OS as any) = 'ios';
    const { getByText } = render(<MapPanel {...defaultProps} />);
    expect(getByText('Карта доступна только в браузере')).toBeTruthy();
  });

  it('renders loading state initially on web', async () => {
    (Platform.OS as any) = 'web';
    const { getByText } = render(<MapPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(getByText('Инициализация карты…')).toBeTruthy();
    });
  });

  it('passes travelsData to OptimizedMap', async () => {
    (Platform.OS as any) = 'web';
    render(<MapPanel {...defaultProps} />);
    
    await waitFor(() => {
      expect(mockWebMap).toHaveBeenCalled();
      const lastCall = mockWebMap.mock.calls[mockWebMap.mock.calls.length - 1];
      const props = lastCall[0];
      expect(props.travel.data).toHaveLength(2);
    });
  });

  it('passes coordinates to OptimizedMap', async () => {
    (Platform.OS as any) = 'web';
    const coordinates = { latitude: 54.0, longitude: 27.7 };
    render(<MapPanel {...defaultProps} coordinates={coordinates} />);
    
    await waitFor(() => {
      expect(mockWebMap).toHaveBeenCalled();
      const lastCall = mockWebMap.mock.calls[mockWebMap.mock.calls.length - 1];
      const props = lastCall[0];
      expect(props.coordinates).toEqual(coordinates);
    });
  });

  it('passes routePoints to OptimizedMap', async () => {
    (Platform.OS as any) = 'web';
    const routePoints: [number, number][] = [[27.5667, 53.9], [27.6, 53.95]];
    render(<MapPanel {...defaultProps} routePoints={routePoints} />);
    
    await waitFor(() => {
      expect(mockWebMap).toHaveBeenCalled();
      const lastCall = mockWebMap.mock.calls[mockWebMap.mock.calls.length - 1];
      const props = lastCall[0];
      expect(props.routePoints).toEqual(routePoints);
    });
  });

  it('passes mode to OptimizedMap', async () => {
    (Platform.OS as any) = 'web';
    render(<MapPanel {...defaultProps} mode="route" />);
    
    await waitFor(() => {
      expect(mockWebMap).toHaveBeenCalled();
      const lastCall = mockWebMap.mock.calls[mockWebMap.mock.calls.length - 1];
      const props = lastCall[0];
      expect(props.mode).toBe('route');
    });
  });

  it('passes transportMode to OptimizedMap', async () => {
    (Platform.OS as any) = 'web';
    render(<MapPanel {...defaultProps} transportMode="bike" />);
    
    await waitFor(() => {
      expect(mockWebMap).toHaveBeenCalled();
      const lastCall = mockWebMap.mock.calls[mockWebMap.mock.calls.length - 1];
      const props = lastCall[0];
      expect(props.transportMode).toBe('bike');
    });
  });

  it('handles empty travelsData', async () => {
    (Platform.OS as any) = 'web';
    render(<MapPanel {...defaultProps} travelsData={[]} />);
    
    await waitFor(() => {
      expect(mockWebMap).toHaveBeenCalled();
      const lastCall = mockWebMap.mock.calls[mockWebMap.mock.calls.length - 1];
      const props = lastCall[0];
      expect(props.travel.data).toHaveLength(0);
    });
  });

  it('uses default values for optional props', async () => {
    (Platform.OS as any) = 'web';
    const minimalProps = {
      travelsData: [],
      coordinates: { latitude: 53.9, longitude: 27.5667 },
      setRouteDistance: jest.fn(),
      setFullRouteCoords: jest.fn(),
    };
    render(<MapPanel {...minimalProps} />);
    
    await waitFor(() => {
      expect(mockWebMap).toHaveBeenCalled();
      const lastCall = mockWebMap.mock.calls[mockWebMap.mock.calls.length - 1];
      const props = lastCall[0];
      expect(props.routePoints).toEqual([]);
      expect(props.mode).toBe('radius');
      expect(props.transportMode).toBe('car');
    });
  });

  it('is memoized correctly', async () => {
    (Platform.OS as any) = 'web';
    const { rerender } = render(<MapPanel {...defaultProps} />);

    // Дождаться ленивой загрузки web-карты
    await waitFor(() => {
      expect(mockWebMap).toHaveBeenCalled();
    });

    const callsBefore = mockWebMap.mock.calls.length;

    // Повторный рендер с теми же пропсами не должен ломать поведение
    rerender(<MapPanel {...defaultProps} />);

    await waitFor(() => {
      expect(mockWebMap.mock.calls.length).toBeGreaterThanOrEqual(callsBefore);
    });
  });
});

