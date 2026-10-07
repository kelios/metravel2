// PERM-3: геолокация запрашивается только по действию пользователя, а не при
// монтировании экрана «мои точки» (на web это был high-accuracy промпт при
// загрузке страницы). Без геолокации рекомендации показываются без маршрутов,
// а «моё местоположение» дорисовывает маршруты к уже выбранной тройке.

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { usePointsRecommendations } from '@/components/UserPoints/usePointsRecommendations';
import { osrmRoute } from '@/api/external/osrm';

jest.mock('@/api/external/osrm', () => ({ osrmRoute: jest.fn() }));
jest.mock('@/components/UserPoints/pointsListLogic', () => ({
  pickRandomDistinct: <T,>(items: T[], count: number) => items.slice(0, count),
}));

const mockedOsrmRoute = osrmRoute as jest.Mock;

const POINTS = [
  { id: 1, latitude: 53.9, longitude: 27.56 },
  { id: 2, latitude: 53.91, longitude: 27.57 },
];

const okRoute = () => ({
  json: async () => ({
    code: 'Ok',
    routes: [{ distance: 2500, duration: 600, geometry: { coordinates: [[27.56, 53.9], [27.57, 53.91]] } }],
  }),
});

describe('usePointsRecommendations (PERM-3)', () => {
  const originalPlatformOS = Platform.OS;
  let getCurrentPosition: jest.Mock;

  beforeEach(() => {
    Platform.OS = 'web';
    getCurrentPosition = jest.fn();
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      writable: true,
      value: { geolocation: { getCurrentPosition } },
    });
    mockedOsrmRoute.mockReset();
    mockedOsrmRoute.mockResolvedValue(okRoute());
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
  });

  it('does not request geolocation on mount', () => {
    renderHook(() => usePointsRecommendations({ setActivePointId: jest.fn() }));

    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('requests geolocation only when the user opens recommendations and builds routes', async () => {
    getCurrentPosition.mockImplementation((resolve: (pos: unknown) => void) =>
      resolve({ coords: { latitude: 53.95, longitude: 27.5 } }),
    );
    const setActivePointId = jest.fn();
    const { result } = renderHook(() => usePointsRecommendations({ setActivePointId }));

    await act(async () => {
      await result.current.handleOpenRecommendations(POINTS);
    });

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(result.current.currentLocation).toEqual({ lat: 53.95, lng: 27.5 });
    expect(result.current.showingRecommendations).toBe(true);
    expect(result.current.recommendedPointIds).toEqual([1, 2]);
    await waitFor(() => expect(Object.keys(result.current.recommendedRoutes)).toEqual(['1', '2']));
    expect(result.current.recommendedRoutes[1]).toMatchObject({ distance: 3, duration: 10 });
    expect(setActivePointId).toHaveBeenCalledWith(null);
  });

  it('denied geolocation: recommendations are shown without routes, nothing crashes', async () => {
    getCurrentPosition.mockImplementation((_resolve: unknown, reject: (e: unknown) => void) =>
      reject(new Error('denied')),
    );
    const { result } = renderHook(() => usePointsRecommendations({ setActivePointId: jest.fn() }));

    await act(async () => {
      await result.current.handleOpenRecommendations(POINTS);
    });

    expect(result.current.showingRecommendations).toBe(true);
    expect(result.current.currentLocation).toBeNull();
    expect(result.current.recommendedRoutes).toEqual({});
    expect(mockedOsrmRoute).not.toHaveBeenCalled();
  });

  it('"locate me" after a denial fills routes for the already shown recommendations', async () => {
    getCurrentPosition
      .mockImplementationOnce((_resolve: unknown, reject: (e: unknown) => void) => reject(new Error('denied')))
      .mockImplementationOnce((resolve: (pos: unknown) => void) =>
        resolve({ coords: { latitude: 53.95, longitude: 27.5 } }),
      );
    const { result } = renderHook(() => usePointsRecommendations({ setActivePointId: jest.fn() }));

    await act(async () => {
      await result.current.handleOpenRecommendations(POINTS);
    });
    expect(result.current.recommendedRoutes).toEqual({});

    await act(async () => {
      await result.current.handleLocateMe();
    });

    expect(result.current.isLocating).toBe(false);
    expect(result.current.currentLocation).toEqual({ lat: 53.95, lng: 27.5 });
    expect(result.current.recommendedPointIds).toEqual([1, 2]); // тройка не перевыбрана
    await waitFor(() => expect(Object.keys(result.current.recommendedRoutes)).toEqual(['1', '2']));
  });

  it('native: asks for the foreground permission on the user action, not on mount', async () => {
    Platform.OS = 'android';
    const requestForegroundPermissionsAsync = jest.fn().mockResolvedValue({ granted: true });
    const getCurrentPositionAsync = jest.fn().mockResolvedValue({ coords: { latitude: 53.95, longitude: 27.5 } });
    jest.doMock('expo-location', () => ({ requestForegroundPermissionsAsync, getCurrentPositionAsync }), {
      virtual: true,
    });

    const { result } = renderHook(() => usePointsRecommendations({ setActivePointId: jest.fn() }));
    expect(requestForegroundPermissionsAsync).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleOpenRecommendations(POINTS);
    });

    expect(requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(result.current.currentLocation).toEqual({ lat: 53.95, lng: 27.5 });
  });
});
