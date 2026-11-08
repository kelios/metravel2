import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * #3161 — общий кэш `userPointsAll` держит лёгкие пины всех точек одним
 * запросом (`fields=pins`). Экран «Мои точки» и ♥-тоггл карты читают один и
 * тот же запрос (дедупликация React Query), а созданная через ♥ точка
 * ложится в коллекцию пином и сразу видна экрану.
 */

jest.mock('@/api/miscOptimized', () => ({
  fetchAllFiltersOptimized: jest.fn(async () => ({ categoryTravelAddress: [] })),
}));

const OWNER = '7';

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean; userId: string | null }) => unknown) =>
    selector({ isAuthenticated: true, userId: OWNER }),
}));

jest.mock('@/api/userPoints', () => ({
  userPointsApi: {
    getAllPins: jest.fn(),
    getPointsByIds: jest.fn(async () => []),
    createPoint: jest.fn(),
    deletePoint: jest.fn(),
  },
}));

import { userPointsApi } from '@/api/userPoints';
import { queryKeys } from '@/api/queryKeys';
import { usePointsDataModel } from '@/components/UserPoints/usePointsDataModel';
import { useSavedPointToggle } from '@/hooks/map/useSavedPointToggle';
import type { ImportedPoint, UserPointPin } from '@/types/userPoints';

const mockedApi = userPointsApi as jest.Mocked<typeof userPointsApi>;

const coordOf = (n: number) => ({ lat: 10 + n * 0.01, lng: 20 + n * 0.01 });

const PINS: UserPointPin[] = Array.from({ length: 450 }, (_, i) => {
  const n = i + 1;
  const { lat, lng } = coordOf(n);
  return { id: n, latitude: lat, longitude: lng, color: 'blue', status: 'planning' as const, category: 'other', category_ids: [] };
});

describe('общий кэш userPointsAll = пины одним запросом (#3161)', () => {
  let queryClient: QueryClient;
  let wrapper: React.FC<{ children: React.ReactNode }>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.getAllPins.mockResolvedValue(PINS);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  });

  afterEach(() => queryClient.clear());

  const renderPointsScreen = async () =>
    await renderHook(
      () =>
        usePointsDataModel({
          filters: { page: 1, perPage: 200 } as never,
          searchQuery: '',
          currentLocation: null,
          defaultPointColors: ['blue'],
        }),
      { wrapper },
    );

  const renderToggleFor = async (n: number) =>
    await renderHook(() => useSavedPointToggle({ coord: coordOf(n) }), { wrapper });

  it('экран и ♥-тоггл делят один запрос пинов; точка за прежним «префиксом» сохранена', async () => {
    const screen = await renderPointsScreen();
    await waitFor(() => expect(screen.result.current.points).toHaveLength(PINS.length));
    expect(screen.result.current.totalCount).toBe(PINS.length);

    const toggle = await renderToggleFor(450);
    await waitFor(() => expect(toggle.result.current.isSaved).toBe(true));
    expect(mockedApi.getAllPins).toHaveBeenCalledTimes(1);
    expect(mockedApi.getAllPins).toHaveBeenCalledWith();
  });

  it('созданная через ♥ точка ложится в коллекцию пином и видна экрану', async () => {
    const created = {
      id: 9001,
      name: 'Новая',
      address: 'Где-то',
      latitude: 55.5,
      longitude: 25.5,
      color: 'red',
      status: 'planning',
      categoryIds: ['7'],
      notes: 'длинная заметка, которой в пине быть не должно',
    } as unknown as ImportedPoint;
    mockedApi.createPoint.mockResolvedValue(created);

    const screen = await renderPointsScreen();
    await waitFor(() => expect(screen.result.current.points).toHaveLength(PINS.length));
    const toggle = await renderHook(() => useSavedPointToggle({ coord: { lat: 55.5, lng: 25.5 } }), { wrapper });
    await waitFor(() => expect(toggle.result.current.isReady).toBe(true));

    await act(async () => {
      await toggle.result.current.createPoint({ latitude: 55.5, longitude: 25.5 });
    });

    await waitFor(() => expect(screen.result.current.points).toHaveLength(PINS.length + 1));
    const stored = (queryClient.getQueryData(queryKeys.userPointsAll(OWNER)) as UserPointPin[]).find((p) => p.id === 9001);
    // Пин: восемь ключей контракта (#3185 — name), без заметок и адреса.
    expect(stored).toEqual({
      id: 9001,
      latitude: 55.5,
      longitude: 25.5,
      color: 'red',
      status: 'planning',
      category: null,
      category_ids: [7],
      name: 'Новая',
    });
    expect(toggle.result.current.isSaved).toBe(true);
  });
});
