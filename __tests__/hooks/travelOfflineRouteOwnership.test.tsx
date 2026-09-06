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
const SECOND_ID = 682;
const SECOND_SLUG = 'vtoroi-marshrut';
const SECOND_NAME = 'Второй маршрут';
const ENCODED_ID = 693;
const ENCODED_SLUG = 'маршрут-по-минску';
const ENCODED_NAME = 'Маршрут по Минску';

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
      const crumbs = useBreadcrumbModel();
      const details = useTravelDetails();
      return { crumbs, details };
    }, { wrapper });

  const openRoute = (pathname: string, param: string) => {
    usePathname.mockReturnValue(pathname);
    useLocalSearchParams.mockReturnValue({ param, returnTo: '/metravel' });
  };

  const crumbLabels = (crumbs: { items: Array<{ label: string }> }) =>
    crumbs.items.map((item) => item.label);

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
    openRoute(pathname, param);

    const { result } = renderRoute();

    await waitFor(() => expect(result.current.details.travel?.id).toBe(TRAVEL_ID));
    expect(result.current.details.isLoading).toBe(false);
    // Ключевая гарантия: загрузку ведут опции экрана деталей. Наблюдатель с
    // `networkMode: 'online'` припарковал бы её офлайн навсегда.
    expect(queryClient.getQueryCache().find({ queryKey: key })?.state.fetchStatus).not.toBe('paused');
    expect(fetchTravel).not.toHaveBeenCalled();
    expect(fetchTravelBySlug).not.toHaveBeenCalled();
  });

  it('повторный офлайн-переход на несохранённый маршрут даёт конечное состояние, а не бесконечную загрузку', async () => {
    openRoute('/travels/682', '682');

    const { result } = renderRoute();

    await waitFor(() => expect(result.current.details.isError).toBe(true));
    expect(result.current.details.error?.message).toBe('OFFLINE_CONTENT_NOT_SAVED');
    expect(result.current.details.isLoading).toBe(false);
  });
  it('повторный офлайн-переход на смонтированной шапке переключает крошку на новый маршрут', async () => {
    onlineManager.setOnline(true);
    await saveTravelOffline({
      ...travelFixture,
      id: SECOND_ID,
      slug: SECOND_SLUG,
      name: SECOND_NAME,
      url: `/travels/${SECOND_SLUG}`,
    } as unknown as Travel);
    onlineManager.setOnline(false);

    openRoute(`/travels/${TRAVEL_ID}`, String(TRAVEL_ID));
    const { result, rerender } = renderRoute();
    await waitFor(() => expect(result.current.details.travel?.id).toBe(TRAVEL_ID));
    expect(crumbLabels(result.current.crumbs)).toContain(travelFixture.name);

    // Шапка НЕ размонтируется между маршрутами: подписка обязана переехать на
    // новый ключ, иначе крошка навсегда останется на предыдущем маршруте.
    openRoute(`/travels/${SECOND_SLUG}`, SECOND_SLUG);
    rerender(undefined as never);

    await waitFor(() => expect(result.current.details.travel?.id).toBe(SECOND_ID));
    await waitFor(() => expect(crumbLabels(result.current.crumbs)).toContain(SECOND_NAME));
    expect(fetchTravel).not.toHaveBeenCalled();
    expect(fetchTravelBySlug).not.toHaveBeenCalled();
  });

  it('percent-encoded сегмент даёт крошке и экрану ОДИН ключ, а не два', async () => {
    onlineManager.setOnline(true);
    await saveTravelOffline({
      ...travelFixture,
      id: ENCODED_ID,
      slug: ENCODED_SLUG,
      name: ENCODED_NAME,
      url: `/travels/${ENCODED_SLUG}`,
    } as unknown as Travel);
    onlineManager.setOnline(false);

    // expo-router на web отдаёт сегмент пути закодированным.
    openRoute(`/travels/${encodeURIComponent(ENCODED_SLUG)}`, encodeURIComponent(ENCODED_SLUG));
    const { result } = renderRoute();

    await waitFor(() => expect(result.current.details.travel?.id).toBe(ENCODED_ID));
    // Крошка читает ключ владельца: разошедшаяся нормализация оставила бы её
    // без имени маршрута.
    await waitFor(() => expect(crumbLabels(result.current.crumbs)).toContain(ENCODED_NAME));
    expect(fetchTravelBySlug).not.toHaveBeenCalled();
  });
});
