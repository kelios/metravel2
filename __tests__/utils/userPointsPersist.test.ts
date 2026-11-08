/**
 * #3130/#3161 — коллекция пинов «Моих точек» персистится отдельным ключом storage:
 * запись только на события самой коллекции, потолок размера; серверный поиск и
 * общий снимок `metravel-rq-cache` её не содержат.
 */
import { QueryClient } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  USER_POINTS_PERSIST_MAX_POINTS,
  USER_POINTS_PERSIST_STORAGE_KEY,
  shouldPersistUserPointsQuery,
  userPointsPersistence,
} from '@/utils/userPointsPersist';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const points = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));
const readSnapshotKeys = async () => {
  const raw = await AsyncStorage.getItem(USER_POINTS_PERSIST_STORAGE_KEY);
  if (!raw) return null;
  return (JSON.parse(raw).clientState?.queries || []).map((q: any) => q.queryKey);
};

describe('shouldPersistUserPointsQuery', () => {
  const query = (key: unknown[], data: unknown, status = 'success') =>
    ({ queryKey: key, state: { status, data } }) as any;

  it('персистит коллекцию пинов, пока она в потолке', () => {
    expect(shouldPersistUserPointsQuery(query(['userPointsAll', '1'], points(10)))).toBe(true);
    expect(shouldPersistUserPointsQuery(query(['userPointsAll', '1'], points(USER_POINTS_PERSIST_MAX_POINTS)))).toBe(true);
  });

  it('НЕ персистит чужие домены, серверный поиск, не-success и коллекцию выше потолка', () => {
    expect(shouldPersistUserPointsQuery(query(['favorites', '1'], []))).toBe(false);
    expect(shouldPersistUserPointsQuery(query(['userPointsSearch', '1', 'озеро'], points(1)))).toBe(false);
    expect(shouldPersistUserPointsQuery(query(['userPointsAll', '1', 'pagination'], { complete: true }))).toBe(false);
    expect(shouldPersistUserPointsQuery(query(['userPointsAll', '1'], points(1), 'pending'))).toBe(false);
    expect(shouldPersistUserPointsQuery(query(['userPointsAll', '2'], points(USER_POINTS_PERSIST_MAX_POINTS + 1)))).toBe(false);
  });
});

describe('userPointsPersistence (свой ключ, запись на свои события)', () => {
  beforeEach(() => AsyncStorage.clear());

  it('пишет коллекцию и отметку своим ключом и восстанавливает их', async () => {
    const client = new QueryClient();
    await userPointsPersistence.restore(client);
    const unsubscribe = userPointsPersistence.subscribe(client);

    client.setQueryData(['userPointsAll', '1'], points(3));
    client.setQueryData(['userPointsSearch', '1', 'озеро'], points(1));
    client.setQueryData(['favorites', '1'], [{ id: 7 }]);
    await wait(1300);

    const keys = await readSnapshotKeys();
    expect(keys).toContainEqual(['userPointsAll', '1']);
    expect(keys).not.toContainEqual(['userPointsSearch', '1', 'озеро']);
    expect(keys).not.toContainEqual(['favorites', '1']);
    expect(await AsyncStorage.getItem('metravel-rq-cache')).toBeNull();
    unsubscribe();

    const fresh = new QueryClient();
    await userPointsPersistence.restore(fresh);
    expect(fresh.getQueryData(['userPointsAll', '1'])).toEqual(points(3));
  });

  it('не пишет на события чужих запросов и очищает снимок при удалении коллекции (смена владельца)', async () => {
    const client = new QueryClient();
    client.setQueryData(['userPointsAll', '1'], points(2));
    const unsubscribe = userPointsPersistence.subscribe(client);
    const setItem = jest.spyOn(AsyncStorage, 'setItem');

    client.setQueryData(['favorites', '1'], [{ id: 1 }]);
    client.setQueryData(['travels'], [{ id: 2 }]);
    await wait(1300);
    expect(setItem).not.toHaveBeenCalled();

    client.removeQueries({ queryKey: ['userPointsAll'] });
    await wait(1300);
    expect(setItem).toHaveBeenCalled();
    expect(await readSnapshotKeys()).toEqual([]);
    setItem.mockRestore();
    unsubscribe();
  });
});
