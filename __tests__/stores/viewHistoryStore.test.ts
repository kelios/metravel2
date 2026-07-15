import { act } from '@testing-library/react';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/api/user', () => ({
  fetchUserHistory: jest.fn(),
  clearUserHistory: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  devError: jest.fn(),
}));

jest.mock('@/utils/safeJsonParse', () => ({
  safeJsonParseString: jest.fn((text: string, fallback: any) => {
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }),
}));

const { fetchUserHistory, clearUserHistory } = require('@/api/user') as {
  fetchUserHistory: jest.Mock;
  clearUserHistory: jest.Mock;
};

import { useViewHistoryStore } from '@/stores/viewHistoryStore';

const makeItem = (id: number | string, title = `Item ${id}`) => ({
  id,
  type: 'travel' as const,
  title,
  url: `/travels/${id}`,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  useViewHistoryStore.setState({
    viewHistory: [],
    _fetched: false,
    _userId: null,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('viewHistoryStore', () => {
  describe('initial state', () => {
    it('has correct defaults', () => {
      const s = useViewHistoryStore.getState();
      expect(s.viewHistory).toEqual([]);
      expect(s._fetched).toBe(false);
      expect(s._userId).toBeNull();
    });
  });

  describe('addToHistory', () => {
    it('adds item for unauthenticated user', async () => {
      await act(() =>
        useViewHistoryStore.getState().addToHistory(makeItem(1), {
          isAuthenticated: false,
          userId: null,
        }),
      );
      const history = useViewHistoryStore.getState().viewHistory;
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe(1);
      expect(history[0].viewedAt).toBeGreaterThan(0);
    });

    it('adds and caches item for authenticated user', async () => {
      await act(() =>
        useViewHistoryStore.getState().addToHistory(makeItem(1), {
          isAuthenticated: true,
          userId: '42',
        }),
      );
      expect(useViewHistoryStore.getState().viewHistory).toHaveLength(1);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'metravel_view_history_42',
        expect.any(String),
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'metravel_view_history_server_42',
        expect.any(String),
      );
    });

    it('deduplicates by id+type, keeping most recent first', async () => {
      const auth = { isAuthenticated: false, userId: null };
      await act(() => useViewHistoryStore.getState().addToHistory(makeItem(1, 'Old'), auth));
      await act(() => useViewHistoryStore.getState().addToHistory(makeItem(1, 'New'), auth));

      const history = useViewHistoryStore.getState().viewHistory;
      expect(history).toHaveLength(1);
      expect(history[0].title).toBe('New');
    });

    it('keeps the newest metadata when duplicate additions share a timestamp', async () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1234);
      const auth = { isAuthenticated: false, userId: null };

      await act(() => useViewHistoryStore.getState().addToHistory(makeItem(1, 'Old'), auth));
      await act(() =>
        useViewHistoryStore.getState().addToHistory(
          { ...makeItem(1, 'New'), imageUrl: '/new.jpg', url: '/travels/new' },
          auth,
        ),
      );

      expect(useViewHistoryStore.getState().viewHistory).toEqual([
        expect.objectContaining({
          id: 1,
          title: 'New',
          imageUrl: '/new.jpg',
          url: '/travels/new',
          viewedAt: 1234,
        }),
      ]);
      nowSpy.mockRestore();
    });

    it('keeps distinct history types even when ids and timestamps match', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(1234);
      const auth = { isAuthenticated: false, userId: null };

      await act(() => useViewHistoryStore.getState().addToHistory(makeItem(1), auth));
      await act(() =>
        useViewHistoryStore.getState().addToHistory(
          { ...makeItem(1, 'Article'), type: 'article', url: '/article/1' },
          auth,
        ),
      );

      expect(useViewHistoryStore.getState().viewHistory).toHaveLength(2);
      expect(useViewHistoryStore.getState().viewHistory.map((item) => item.type).sort()).toEqual([
        'article',
        'travel',
      ]);
    });

    it('limits history to 50 items', async () => {
      const auth = { isAuthenticated: false, userId: null };
      for (let i = 0; i < 55; i++) {
        await act(() =>
          useViewHistoryStore.getState().addToHistory(makeItem(i), auth),
        );
      }
      expect(useViewHistoryStore.getState().viewHistory).toHaveLength(50);
    });

    it('persists to AsyncStorage', async () => {
      await act(() =>
        useViewHistoryStore.getState().addToHistory(makeItem(1), {
          isAuthenticated: false,
          userId: null,
        }),
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'metravel_view_history',
        expect.any(String),
      );
    });

    it('uses user-scoped key when userId is present', async () => {
      await act(() =>
        useViewHistoryStore.getState().addToHistory(makeItem(1), {
          isAuthenticated: false,
          userId: '7',
        }),
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'metravel_view_history_7',
        expect.any(String),
      );
    });
  });

  describe('clearHistory', () => {
    it('clears local history for unauthenticated user', async () => {
      useViewHistoryStore.setState({ viewHistory: [{ ...makeItem(1), viewedAt: 1 }] });

      await act(() =>
        useViewHistoryStore.getState().clearHistory({
          isAuthenticated: false,
          userId: null,
        }),
      );

      expect(useViewHistoryStore.getState().viewHistory).toEqual([]);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'metravel_view_history',
        '[]',
      );
    });

    it('calls server clear for authenticated user', async () => {
      clearUserHistory.mockResolvedValue(undefined);

      await act(() =>
        useViewHistoryStore.getState().clearHistory({
          isAuthenticated: true,
          userId: '42',
        }),
      );

      expect(clearUserHistory).toHaveBeenCalledWith('42');
      expect(useViewHistoryStore.getState().viewHistory).toEqual([]);
    });
  });

  describe('loadLocal', () => {
    it('loads from AsyncStorage', async () => {
      const stored = JSON.stringify([{ ...makeItem(1), viewedAt: 100 }]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(stored);

      await act(() => useViewHistoryStore.getState().loadLocal(null));

      expect(useViewHistoryStore.getState().viewHistory).toHaveLength(1);
    });

    it('does nothing when storage is empty', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await act(() => useViewHistoryStore.getState().loadLocal(null));
      expect(useViewHistoryStore.getState().viewHistory).toEqual([]);
    });
  });

  describe('loadServerCached', () => {
    it('uses the first source deterministically when cache timestamps are equal', async () => {
      const server = { ...makeItem(1, 'Server'), viewedAt: 100 };
      const local = { ...makeItem(1, 'Local'), viewedAt: 100 };
      (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) =>
        key.includes('server') ? JSON.stringify([server]) : JSON.stringify([local]),
      );

      await act(() => useViewHistoryStore.getState().loadServerCached('42'));

      expect(useViewHistoryStore.getState().viewHistory).toEqual([server]);
    });
  });

  describe('refreshFromServer', () => {
    it('does nothing without userId', async () => {
      await act(() => useViewHistoryStore.getState().refreshFromServer(null));
      expect(fetchUserHistory).not.toHaveBeenCalled();
    });

    it('fetches and stores server history', async () => {
      fetchUserHistory.mockResolvedValue([
        { id: 10, name: 'Trip', slug: 'trip', updated_at: '2025-01-01T00:00:00Z' },
      ]);

      await act(() => useViewHistoryStore.getState().refreshFromServer('42'));

      const history = useViewHistoryStore.getState().viewHistory;
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe(10);
      expect(history[0].title).toBe('Trip');
    });

    it('merges server history with local article history', async () => {
      const article = {
        id: 'a-1',
        type: 'article' as const,
        title: 'Article',
        url: '/article/a-1',
        viewedAt: new Date('2025-01-02T00:00:00Z').getTime(),
      };
      useViewHistoryStore.setState({ viewHistory: [article] });
      fetchUserHistory.mockResolvedValue([
        { id: 10, name: 'Trip', slug: 'trip', updated_at: '2025-01-01T00:00:00Z' },
      ]);

      await act(() => useViewHistoryStore.getState().refreshFromServer('42'));

      const history = useViewHistoryStore.getState().viewHistory;
      expect(history).toHaveLength(2);
      expect(history.map((item) => item.type)).toEqual(['article', 'travel']);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'metravel_view_history_server_42',
        JSON.stringify(history),
      );
    });

    it('does not overwrite local data when server returns empty', async () => {
      useViewHistoryStore.setState({
        viewHistory: [{ ...makeItem(1), viewedAt: 100 }],
      });
      fetchUserHistory.mockResolvedValue([]);

      await act(() => useViewHistoryStore.getState().refreshFromServer('42'));

      expect(useViewHistoryStore.getState().viewHistory).toHaveLength(1);
    });

    it('persists adopted history (not empty) to cache when server returns empty', async () => {
      const kept = { ...makeItem(1), viewedAt: 100 };
      useViewHistoryStore.setState({ viewHistory: [kept] });
      fetchUserHistory.mockResolvedValue([]);

      await act(() => useViewHistoryStore.getState().refreshFromServer('42'));

      // Кеш должен совпадать с тем, что осталось в памяти, а не с пустым ответом.
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'metravel_view_history_server_42',
        JSON.stringify([kept]),
      );
    });
  });

  describe('ensureServerData', () => {
    it('does nothing without userId', async () => {
      await act(() => useViewHistoryStore.getState().ensureServerData(null));
      expect(fetchUserHistory).not.toHaveBeenCalled();
    });

    it('fetches only once per userId', async () => {
      fetchUserHistory.mockResolvedValue([]);

      await act(() => useViewHistoryStore.getState().ensureServerData('42'));
      await act(() => useViewHistoryStore.getState().ensureServerData('42'));

      expect(fetchUserHistory).toHaveBeenCalledTimes(1);
    });

    it('re-fetches when userId changes', async () => {
      fetchUserHistory.mockResolvedValue([]);

      await act(() => useViewHistoryStore.getState().ensureServerData('1'));
      await act(() => useViewHistoryStore.getState().ensureServerData('2'));

      expect(fetchUserHistory).toHaveBeenCalledTimes(2);
    });
  });

  describe('resetFetchState', () => {
    it('resets _fetched flag', () => {
      useViewHistoryStore.setState({ _fetched: true, _userId: '1' });
      act(() => useViewHistoryStore.getState().resetFetchState('1'));
      expect(useViewHistoryStore.getState()._fetched).toBe(false);
    });
  });
});
