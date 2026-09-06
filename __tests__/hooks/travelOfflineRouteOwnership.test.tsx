/**
 * #1801: офлайн-переход внутри загруженного web-приложения на уже сохранённый
 * маршрут обязан открыть локальный пакет, а не остаться на skeleton.
 *
 * Дефект был не в адаптере и не в алиасе id/slug: ключом `travel:<id|slug>`
 * владели ДВА наблюдателя. Крошки в шапке держали на том же ключе собственный
 * сетевой `queryFn` с дефолтным `networkMode: 'online'` и монтировались раньше
 * содержимого маршрута, поэтому офлайн загрузку стартовали их опции —
 * query-core парковал retryer в `fetchStatus: 'paused'`, и офлайн-ветка
 * `useTravelDetails` не исполнялась уже никогда.
 *
 * Поэтому проверка идёт на настоящем стеке (реальный OfflineCatalog, реальный
 * packageStore, оба настоящих хука) и в том же порядке монтирования: сначала
 * шапка, потом экран. Сетевые фетчеры при этом обязаны остаться нетронутыми.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { Platform } from 'react-native';

import { useBreadcrumbModel } from '@/hooks/useBreadcrumbModel';
import { useTravelDetails } from '@/hooks/useTravelDetails';
import { saveTravelOffline } from '@/services/offline/travelOfflineAdapter';
import { queryKeys } from '@/queryKeys';
import type { Travel } from '@/types/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Настоящая запись пакета вместо файлового стаба: проверка обязана ходить в тот
// же OfflineCatalog, который читает продакшен-адаптер.
jest.mock('@/services/offline/packageStore', () =>
  jest.requireActual('@/services/offline/packageStore.ts'),
);

jest.mock('expo-router', () => ({
  usePathname: jest.fn(),
  useLocalSearchParams: jest.fn(),
  useGlobalSearchParams: jest.fn(),
}));

jest.mock('@/api/travelDetailsQueries', () => ({
  fetchTravel: jest.fn(),
  fetchTravelBySlug: jest.fn(),
}));

jest.mock('@/api/quests', () => ({
  fetchQuestByQuestId: jest.fn(),
  fetchQuestsList: jest.fn(async () => []),
}));
jest.mock('@/api/plannedTrips', () => ({ fetchPlannedTrip: jest.fn() }));
jest.mock('@/api/publicTrips', () => ({ fetchPublicTrip: jest.fn() }));

const TRAVEL_ID = 672;
const TRAVEL_SLUG = 'marshruty-vykhodnogo-dnia-iz-minska-13-poezdok';

const travelFixture = {
  id: TRAVEL_ID,
  slug: TRAVEL_SLUG,
  name: 'Маршруты выходного дня из Минска',
  description: '<p>Сохранённое описание маршрута</p>',
  url: `/travels/${TRAVEL_SLUG}`,
  userName: 'Юля',
  countryName: 'Беларусь',
  travelAddress: [],
} as unknown as Travel;

describe('#1801 офлайн-переход на сохранённый маршрут в загруженном приложении', () => {
  const { usePathname, useLocalSearchParams, useGlobalSearchParams } =
    jest.requireMock('expo-router') as {
      usePathname: jest.Mock;
      useLocalSearchParams: jest.Mock;
      useGlobalSearchParams: jest.Mock;
    };
  const { fetchTravel, fetchTravelBySlug } = jest.requireMock('@/api/travelDetailsQueries') as {
    fetchTravel: jest.Mock;
    fetchTravelBySlug: jest.Mock;
  };

  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  // Порядок вызова повторяет дерево: шапка с крошками рендерится раньше
  // содержимого маршрута и подписывается на ключ первой.
  const renderRoute = () =>
    renderHook(() => {
      useBreadcrumbModel();
      return useTravelDetails();
    }, { wrapper });

  beforeEach(async () => {
    jest.clearAllMocks();
    (Platform.OS as string) = 'web';
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    fetchTravel.mockRejectedValue(new Error('OFFLINE_NETWORK_MUST_NOT_BE_USED'));
    fetchTravelBySlug.mockRejectedValue(new Error('OFFLINE_NETWORK_MUST_NOT_BE_USED'));
    useGlobalSearchParams.mockReturnValue({});
    onlineManager.setOnline(true);
    await saveTravelOffline(travelFixture);
    onlineManager.setOnline(false);
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    queryClient.clear();
  });

  it.each([
    ['slug → id', `/travels/${TRAVEL_ID}`, String(TRAVEL_ID), queryKeys.travel(TRAVEL_ID)],
    ['id → slug', `/travels/${TRAVEL_SLUG}`, TRAVEL_SLUG, queryKeys.travel(TRAVEL_SLUG)],
  ])('%s: отдаёт сохранённый пакет, а не зависает на загрузке', async (_label, pathname, param, key) => {
    usePathname.mockReturnValue(pathname);
    useLocalSearchParams.mockReturnValue({ param, returnTo: '/metravel' });

    const { result } = renderRoute();

    await waitFor(() => expect(result.current.travel?.id).toBe(TRAVEL_ID));
    expect(result.current.isLoading).toBe(false);
    // Ключевая гарантия: загрузку ведут опции экрана деталей. Наблюдатель с
    // `networkMode: 'online'` припарковал бы её офлайн навсегда.
    expect(queryClient.getQueryCache().find({ queryKey: key })?.state.fetchStatus).not.toBe('paused');
    expect(fetchTravel).not.toHaveBeenCalled();
    expect(fetchTravelBySlug).not.toHaveBeenCalled();
  });

  it('повторный офлайн-переход на несохранённый маршрут даёт конечное состояние, а не бесконечную загрузку', async () => {
    usePathname.mockReturnValue('/travels/682');
    useLocalSearchParams.mockReturnValue({ param: '682', returnTo: '/metravel' });

    const { result } = renderRoute();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('OFFLINE_CONTENT_NOT_SAVED');
    expect(result.current.isLoading).toBe(false);
  });
});
