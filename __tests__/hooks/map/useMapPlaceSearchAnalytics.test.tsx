import React from 'react';
import { Platform } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMapDataController } from '@/hooks/map/useMapDataController';
import { fetchTravelsForMap } from '@/api/map';
import type { TravelCoords } from '@/types/types';
import { queueAnalyticsEvent } from '@/utils/analytics';

jest.mock('@/api/map', () => ({ fetchTravelsForMap: jest.fn() }));
jest.mock('@/utils/analytics', () => ({ queueAnalyticsEvent: jest.fn() }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: true }) }));

const fetchMap = jest.mocked(fetchTravelsForMap);
const queue = jest.mocked(queueAnalyticsEvent);
const points: TravelCoords[] = [{
  address: 'Место',
  categoryName: 'Достопримечательность',
  coord: '53.9,27.5',
  lat: '53.9',
  lng: '27.5',
  travelImageThumbUrl: '',
  urlTravel: '/travels/place',
}];
const options: Parameters<typeof useMapDataController>[0] = {
  anchor: { coordinates: { latitude: 53.9, longitude: 27.5 }, source: 'default' },
  filterValues: { categories: [], categoryTravelAddress: [], radius: '50', address: '', searchQuery: '' },
  filters: { categories: [], categoryTravelAddress: [], radius: [], address: '' },
  mode: 'radius',
  fullRouteCoords: [],
  isFocused: true,
  isMobile: true,
};

const setup = (term: string, initialMode: typeof options.mode = 'radius') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    ({ searchQuery, radius, isFocused, mode }) => useMapDataController({
      ...options,
      isFocused,
      mode,
      filterValues: { ...options.filterValues, searchQuery, radius },
    }),
    { wrapper, initialProps: { searchQuery: term, radius: '50', isFocused: true, mode: initialMode } },
  );
};

describe('settled map place search analytics', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'web' });
    fetchMap.mockReset();
    queue.mockClear();
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOS });
  });

  it('records zero matches and records a retry with a wider radius without duplicating on refocus', async () => {
    fetchMap.mockResolvedValueOnce([]).mockResolvedValueOnce(points);
    const { rerender } = await setup('Место');
    await waitFor(() => expect(queue).toHaveBeenCalledWith(
      'map_place_search', { outcome: 'empty', layout: 'mobile', radius_km: 50 },
    ));

    await rerender({ searchQuery: 'Место', radius: '100', isFocused: true, mode: 'radius' });
    await waitFor(() => expect(queue).toHaveBeenLastCalledWith(
      'map_place_search', { outcome: 'found', layout: 'mobile', radius_km: 100 },
    ));
    await rerender({ searchQuery: 'Место', radius: '100', isFocused: false, mode: 'radius' });
    await rerender({ searchQuery: 'Место', radius: '100', isFocused: true, mode: 'radius' });
    expect(queue).toHaveBeenCalledTimes(2);
  });

  it('does not report the radius fallback while building a route', async () => {
    fetchMap.mockResolvedValue(points);
    const { result, rerender } = await setup('Место', 'route');
    await waitFor(() => expect(result.current.total).toBe(1));
    expect(queue).not.toHaveBeenCalled();

    await rerender({ searchQuery: 'Место', radius: '50', isFocused: true, mode: 'radius' });
    expect(queue).toHaveBeenCalledWith(
      'map_place_search', { outcome: 'found', layout: 'mobile', radius_km: 50 },
    );
    expect(fetchMap).toHaveBeenCalledTimes(1);
  });

  it('leaves native radius searches on the existing request path', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
    fetchMap.mockResolvedValue(points);
    const { result } = await setup('Место');
    await waitFor(() => expect(result.current.total).toBe(1));
    expect(fetchMap.mock.calls[0][3]?.throwOnError).toBeUndefined();
    expect(queue).not.toHaveBeenCalled();
  });

  it('reports an explicit retry at the same radius after the initial request fails', async () => {
    fetchMap.mockRejectedValueOnce(new Error('HTTP 503')).mockResolvedValueOnce(points);
    const { result } = await setup('Место');
    await waitFor(() => expect(result.current.placeSearchStatus).toBe('error'));
    await act(() => result.current.retryPlaceSearch());
    await waitFor(() => expect(result.current.placeSearchStatus).toBe('found'));
    expect(queue.mock.calls).toEqual([
      ['map_place_search', { outcome: 'error', layout: 'mobile', radius_km: 50 }],
      ['map_place_search', { outcome: 'found', layout: 'mobile', radius_km: 50 }],
    ]);
  });

  it('keeps the settled search feedback while the next page loads', async () => {
    let finishNextPage: (value: Awaited<ReturnType<typeof fetchTravelsForMap>>) => void = () => {};
    fetchMap
      .mockResolvedValueOnce(Object.defineProperty({ 0: points[0] }, '__total', { value: 2 }))
      .mockImplementationOnce(() => new Promise(resolve => { finishNextPage = resolve; }));
    const { result } = await setup('Место');
    await waitFor(() => expect(result.current.placeSearchStatus).toBe('found'));

    await act(() => result.current.onLoadMore());
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(true));
    expect(result.current.placeSearchStatus).toBe('found');

    await act(async () => { finishNextPage([]); });
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
    expect(result.current.placeSearchStatus).toBe('found');
    expect(queue).toHaveBeenCalledTimes(1);
  });

  it('ignores a superseded result and distinguishes failure from an empty result', async () => {
    let finishFirst: (value: Awaited<ReturnType<typeof fetchTravelsForMap>>) => void = () => {};
    fetchMap
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
      .mockRejectedValueOnce(new Error('HTTP 503'));
    const { result, rerender } = await setup('Старый запрос');
    await waitFor(() => expect(fetchMap).toHaveBeenCalledTimes(1));
    expect(queue).not.toHaveBeenCalled();
    expect(fetchMap.mock.calls[0][3]?.throwOnError).toBe(true);

    await rerender({ searchQuery: 'Новый запрос', radius: '50', isFocused: true, mode: 'radius' });
    await act(async () => { finishFirst(points); });
    expect(queue).not.toHaveBeenCalledWith(
      'map_place_search', { outcome: 'found', layout: 'mobile', radius_km: 50 },
    );
    await waitFor(() => expect(queue.mock.calls).toEqual([
      ['map_place_search', { outcome: 'error', layout: 'mobile', radius_km: 50 }],
    ]));
    expect(result.current.mapError).toBe(false);
  });
});
