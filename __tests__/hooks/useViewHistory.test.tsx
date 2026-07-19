// FE-ARCH D1 #994 — «недавно просмотренные» на React Query (замена viewHistoryStore).
// Портирует поведенческое покрытие старого стора на RQ-модуль: локальная запись,
// дедуп/MAX 50, серверный merge + empty-guard, ленивый fetch-once, identity-isolation.

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/api/user', () => ({
  fetchUserHistory: jest.fn(),
  clearUserHistory: jest.fn(),
}));

const authRef = { isAuthenticated: true, userId: 'user-1' as string | null };
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => authRef,
}));

import {
  useViewHistory,
  addViewHistoryItem,
  clearViewHistory,
  ensureViewHistoryServerData,
  viewHistoryQueryFn,
  mergeHistoryItems,
  type ViewHistoryItem,
} from '@/hooks/useViewHistory';
import { fetchUserHistory, clearUserHistory } from '@/api/user';
import { queryKeys } from '@/api/queryKeys';
import { setActiveQueryClient } from '@/api/activeQueryClient';

const mockFetch = fetchUserHistory as jest.MockedFunction<typeof fetchUserHistory>;
const mockClear = clearUserHistory as jest.MockedFunction<typeof clearUserHistory>;

const item = (id: number | string, extra: Partial<ViewHistoryItem> = {}): Omit<ViewHistoryItem, 'viewedAt'> => ({
  id,
  type: 'travel',
  title: `Item ${id}`,
  url: `/travels/${id}`,
  ...extra,
});

let qc: QueryClient;
const read = (userId: string | null) =>
  qc.getQueryData<ViewHistoryItem[]>(queryKeys.viewHistory(userId)) ?? [];

beforeEach(() => {
  jest.clearAllMocks();
  authRef.isAuthenticated = true;
  authRef.userId = 'user-1';
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  setActiveQueryClient(qc);
});

afterEach(() => {
  setActiveQueryClient(null);
});

describe('addViewHistoryItem', () => {
  it('records a view into the userId-scoped cache (no server write)', async () => {
    await addViewHistoryItem('user-1', item(1));
    expect(read('user-1')).toHaveLength(1);
    expect(read('user-1')[0].viewedAt).toBeGreaterThan(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('dedupes by id+type keeping the newest metadata', async () => {
    await addViewHistoryItem('user-1', item(1, { title: 'Old' }));
    await addViewHistoryItem('user-1', item(1, { title: 'New', imageUrl: '/n.jpg' }));
    const h = read('user-1');
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ title: 'New', imageUrl: '/n.jpg' });
  });

  it('keeps distinct types with the same id', async () => {
    await addViewHistoryItem('user-1', item(1));
    await addViewHistoryItem('user-1', { ...item(1, { title: 'Article' }), type: 'article', url: '/article/1' });
    expect(read('user-1').map((i) => i.type).sort()).toEqual(['article', 'travel']);
  });

  it('caps history to 50 items', async () => {
    for (let i = 0; i < 55; i++) await addViewHistoryItem('user-1', item(i));
    expect(read('user-1')).toHaveLength(50);
  });

  it('isolates guest (null) history from an authed user', async () => {
    await addViewHistoryItem(null, item(1));
    await addViewHistoryItem('user-1', item(2));
    expect(read(null).map((i) => i.id)).toEqual([1]);
    expect(read('user-1').map((i) => i.id)).toEqual([2]);
  });
});

describe('clearViewHistory', () => {
  it('guest: clears only the cache, no server call', async () => {
    await addViewHistoryItem(null, item(1));
    await clearViewHistory(null);
    expect(read(null)).toEqual([]);
    expect(mockClear).not.toHaveBeenCalled();
  });

  it('auth: calls server clear then empties the cache', async () => {
    mockClear.mockResolvedValue(null as any);
    await addViewHistoryItem('user-1', item(1));
    await clearViewHistory('user-1');
    expect(mockClear).toHaveBeenCalledWith('user-1');
    expect(read('user-1')).toEqual([]);
  });
});

// Логику merge/empty-guard тестируем на самом queryFn — так она не маскируется
// staleTime-дедупом fetchQuery (в реале ensureServerData зовётся при пустом кэше).
describe('viewHistoryQueryFn (auth merge)', () => {
  it('merges server history with local article history', async () => {
    const article: ViewHistoryItem = {
      id: 'a-1', type: 'article', title: 'Article', url: '/article/a-1',
      viewedAt: new Date('2025-01-02T00:00:00Z').getTime(),
    };
    qc.setQueryData(queryKeys.viewHistory('user-1'), [article]);
    mockFetch.mockResolvedValue([
      { id: 10, name: 'Trip', slug: 'trip', updated_at: '2025-01-01T00:00:00Z' },
    ] as any);

    const h = await viewHistoryQueryFn('user-1')();
    expect(h).toHaveLength(2);
    expect(h.map((i) => i.type)).toEqual(['article', 'travel']);
  });

  it('does not overwrite non-empty local history with an empty server response', async () => {
    qc.setQueryData(queryKeys.viewHistory('user-1'), [{ ...item(1), viewedAt: 100 } as ViewHistoryItem]);
    mockFetch.mockResolvedValue([] as any);

    const h = await viewHistoryQueryFn('user-1')();
    expect(h).toHaveLength(1);
  });
});

describe('ensureViewHistoryServerData', () => {
  it('fetches once per userId within the stale window', async () => {
    mockFetch.mockResolvedValue([] as any);
    await ensureViewHistoryServerData('user-1');
    await ensureViewHistoryServerData('user-1');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('re-fetches for a different userId', async () => {
    mockFetch.mockResolvedValue([] as any);
    await ensureViewHistoryServerData('user-1');
    await ensureViewHistoryServerData('user-2');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('is a no-op for guests', async () => {
    await ensureViewHistoryServerData(null);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('useViewHistory (reactive read)', () => {
  it('reflects cache writes without auto-fetching the server', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useViewHistory(), { wrapper });

    expect(result.current).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();

    await act(async () => {
      await addViewHistoryItem('user-1', item(7));
    });

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].id).toBe(7);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('mergeHistoryItems', () => {
  it('sorts by viewedAt desc and caps at 50', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ ...item(i), viewedAt: i } as ViewHistoryItem));
    const merged = mergeHistoryItems(many);
    expect(merged).toHaveLength(50);
    expect(merged[0].viewedAt).toBe(59);
  });
});
