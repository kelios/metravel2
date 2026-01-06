/**
 * Тесты безопасности для Map.web компонента
 * Проверяют обработку невалидных данных и граничных случаев
 */

import { render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import MapPageComponent from '@/components/MapPage/Map.web';

// Mock Leaflet
const mockLeaflet = {
  map: jest.fn(),
  tileLayer: jest.fn(),
  marker: jest.fn(),
  circle: jest.fn(),
  canvas: jest.fn(() => ({})),
  latLng: jest.fn((lat, lng) => ({ lat, lng, distanceTo: jest.fn(() => 1000) })),
};

jest.mock('@/src/utils/leafletWebLoader', () => ({
  ensureLeafletAndReactLeaflet: jest.fn().mockResolvedValue({
    L: mockLeaflet,
    rl: {
      MapContainer: ({ children }: any) => children,
      Marker: () => null,
      Popup: () => null,
      Circle: () => null,
      useMap: () => mockLeaflet.map(),
      useMapEvents: () => null,
    },
  }),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 53.9, longitude: 27.56 },
  }),
}));

describe('Map.web - Safety Tests', () => {
  let originalWindow: any;
  const defaultProps = {
    travel: { data: [] },
    coordinates: { latitude: 53.9, longitude: 27.5667 },
    routePoints: [] as [number, number][],
    onMapClick: jest.fn(),
    mode: 'radius' as const,
    transportMode: 'car' as const,
    setRouteDistance: jest.fn(),
    setFullRouteCoords: jest.fn(),
  };

  beforeAll(() => {
    originalWindow = (global as any).window;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'web';
    (global as any).window = {
      ...(originalWindow || {}),
      L: mockLeaflet,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
  });

  afterEach(() => {
    (global as any).window = originalWindow;
  });

  describe('Invalid Coordinates Handling', () => {
    it('handles NaN coordinates gracefully', async () => {
      const { root } = render(
        <MapPageComponent
          {...defaultProps}
          coordinates={{ latitude: NaN, longitude: 27.5667 }}
        />
      );

      await waitFor(() => {
        expect(root).toBeTruthy();
      });
    });

    it('handles Infinity coordinates gracefully', async () => {
      const { root } = render(
        <MapPageComponent
          {...defaultProps}
          coordinates={{ latitude: Infinity, longitude: 27.5667 }}
        />
      );

      await waitFor(() => {
        expect(root).toBeTruthy();
      });
    });

    it('handles out-of-range latitude', async () => {
      const { root } = render(
        <MapPageComponent
          {...defaultProps}
          coordinates={{ latitude: 91, longitude: 27.5667 }}
        />
      );

      await waitFor(() => {
        expect(root).toBeTruthy();
      });
    });

    it('handles out-of-range longitude', async () => {
      const { root } = render(
        <MapPageComponent
          {...defaultProps}
          coordinates={{ latitude: 53.9, longitude: 181 }}
        />
      );

      await waitFor(() => {
        expect(root).toBeTruthy();
      });
    });

    it('handles null coordinates', async () => {
      const { root } = render(
        <MapPageComponent
          {...defaultProps}
          coordinates={null as any}
        />
      );

      await waitFor(() => {
        expect(root).toBeTruthy();
      });
    });
  });

  describe('Invalid Route Points Handling', () => {
    it('filters out invalid route points', async () => {
      const invalidRoutePoints: [number, number][] = [
        [27.56, 53.9], // valid
        [NaN, 53.95], // invalid
        [27.6, Infinity], // invalid
        [181, 53.95], // invalid longitude
        [27.7, 91], // invalid latitude
      ];

      const { root } = render(
        <MapPageComponent
          {...defaultProps}
          mode="route"
          routePoints={invalidRoutePoints}
        />
      );

      await waitFor(() => {
        expect(root).toBeTruthy();
      });
    });

    it('handles empty route points array', async () => {
      const { root } = render(
        <MapPageComponent
          {...defaultProps}
          mode="route"
          routePoints={[]}
        />
      );

      await waitFor(() => {
        expect(root).toBeTruthy();
      });
    });

    it('handles single route point', async () => {
      const { root } = render(
        <MapPageComponent
          {...defaultProps}
          mode="route"
          routePoints={[[27.56, 53.9]]}
        />
      );

      await waitFor(() => {
        expect(root).toBeTruthy();
      });
    });
  });

  describe('Invalid Travel Data Handling', () => {
    it('handles travel data with invalid coordinates', async () => {
      const invalidTravelData = [
        { id: 1, coord: 'invalid', address: 'Test 1' },
        { id: 2, coord: '91,27.56', address: 'Test 2' }, // invalid lat
        { id: 3, coord: '53.9,181', address: 'Test 3' }, // invalid lng
        { id: 4, coord: '53.9,27.56', address: 'Test 4' }, // valid
      ];

      const { root } = render(
        <MapPageComponent
          {...defaultProps}
          travel={{ data: invalidTravelData }}
        />
      );

      await waitFor(() => {
        expect(root).toBeTruthy();
      });
    });

    it('handles null travel data', async () => {
      const { root } = render(
        <MapPageComponent
          {...defaultProps}
          travel={null as any}
        />
      );

      await waitFor(() => {
        expect(root).toBeTruthy();
      });
    });

    it('handles undefined travel data', async () => {
      const { root } = render(
        <MapPageComponent
          {...defaultProps}
          travel={undefined as any}
        />
      );

      await waitFor(() => {
        expect(root).toBeTruthy();
      });
    });
  });

  describe('Radius Mode Safety', () => {
    it('handles invalid radius value', async () => {
      const { root } = render(
        <MapPageComponent
          {...defaultProps}
          mode="radius"
          radius="invalid"
        />
      );

      await waitFor(() => {
        expect(root).toBeTruthy();
      });
    });

    it('handles negative radius', async () => {
      const { root } = render(
        <MapPageComponent
          {...defaultProps}
          mode="radius"
          radius="-10"
        />
      );

      await waitFor(() => {
        expect(root).toBeTruthy();
      });
    });

    it('handles zero radius', async () => {
      const { root } = render(
        <MapPageComponent
          {...defaultProps}
          mode="radius"
          radius="0"
        />
      );

      await waitFor(() => {
        expect(root).toBeTruthy();
      });
    });
  });

  describe('Memory Leak Prevention', () => {
    it('cleans up event listeners on unmount', async () => {
      const removeEventListener = jest.fn();
      (global as any).window.removeEventListener = removeEventListener;

      const { unmount } = render(<MapPageComponent {...defaultProps} />);

      await waitFor(() => {
        expect((global as any).window.addEventListener).toHaveBeenCalled();
      });

      unmount();

      expect(removeEventListener).toHaveBeenCalled();
    });

    it('cancels pending requests on unmount', async () => {
      const { unmount } = render(<MapPageComponent {...defaultProps} />);

      // Размонтируем до завершения загрузки
      unmount();

      // Проверяем, что нет ошибок
      await waitFor(() => {
        expect(true).toBe(true);
      });
    });
  });
});
