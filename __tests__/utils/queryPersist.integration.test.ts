/**
 * #1015 — интеграционный тест реального wired-пути setupQueryPersistence:
 * поверх настоящего QueryClient персистится ТОЛЬКО whitelist-домен (favorites),
 * а не-списочный (travels) исключается из снапшота. Проверяет не предикат, а
 * фактическую дегидрацию через persistQueryClient (mock AsyncStorage).
 */
import { QueryClient } from '@tanstack/react-query';

// Штатный in-memory jest-мок AsyncStorage — фиксируем что реально пишет persister.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { setupQueryPersistence } from '@/utils/queryPersist';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('setupQueryPersistence wired dehydrate (#1015)', () => {
  beforeEach(() => AsyncStorage.clear());

  it('персистит favorites, но НЕ travels в реальном снапшоте', async () => {
    const client = new QueryClient();
    setupQueryPersistence(client);
    // persistQueryClient подписывается на save ТОЛЬКО после async restore —
    // ждём, чтобы последующие мутации реально попали в persist-подписку.
    await wait(50);

    client.setQueryData(['favorites', '42'], [{ id: 1 }]);
    client.setQueryData(['travels'], [{ id: 999 }]);
    // throttleTime=1000 у persister → ждём реального flush записи в storage.
    await wait(1300);

    const raw = await AsyncStorage.getItem('metravel-rq-cache');
    expect(raw).toBeTruthy();
    const snapshot = JSON.parse(raw as string);
    const keys = (snapshot.clientState?.queries || []).map((q: any) => q.queryKey);
    expect(keys).toContainEqual(['favorites', '42']);
    expect(keys).not.toContainEqual(['travels']);
    expect(snapshot.buster).toBe('v1');

    client.clear();
  });
});
