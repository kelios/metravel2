jest.unmock('@/context/FavoritesContext');
jest.unmock('@/context/FavoritesProvider');

import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { QueryClient } from '@tanstack/react-query';
import type { FavoriteItem, ViewHistoryItem } from '@/context/FavoritesContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from '@/context/AuthContext';
import { FavoritesProvider } from '@/context/FavoritesProvider';
import { queryKeys } from '@/api/queryKeys';
import { setActiveQueryClient } from '@/api/activeQueryClient';

// viewHistory теперь читается из React Query (#994), поэтому провайдеру нужен
// QueryClient в дереве. Мок AuthProvider ниже оборачивает детей в него.
const mockQueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const mockToastShow = jest.fn();

jest.mock('@/api/user', () => ({
  fetchUserFavoriteTravels: jest.fn(async () => []),
  fetchUserHistory: jest.fn(async () => []),
  fetchUserRecommendedTravels: jest.fn(async () => []),
  clearUserHistory: jest.fn(async () => null),
  clearUserFavorites: jest.fn(async () => null),
}));

jest.mock('@/api/travelsFavorites', () => ({
  markTravelAsFavorite: jest.fn(async () => ({})),
  unmarkTravelAsFavorite: jest.fn(async () => ({})),
}));

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: {
    show: (...args: any[]) => mockToastShow(...args),
  },
}));

// Mock AuthContext
const mockAuthContext = {
  isAuthenticated: false,
  userId: null,
  username: null,
  user: null,
  login: jest.fn(),
  logout: jest.fn(),
  register: jest.fn(),
};

jest.mock('@/context/AuthContext', () => {
  const { QueryClientProvider } = require('@tanstack/react-query');
  return {
    AuthProvider: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={mockQueryClient}>{children}</QueryClientProvider>
    ),
    useAuth: () => mockAuthContext,
  };
});

const { useFavorites } = jest.requireActual('@/context/FavoritesContext');

// Test component that uses the hook
const TestComponent: React.FC<{ onContext?: (context: any) => void }> = ({ onContext }) => {
  const context = useFavorites();
  React.useEffect(() => {
    onContext?.(context);
  }, [context, onContext]);
  return null;
};

// favorites живут в RQ-кэше (#994), а не в AsyncStorage: сидируем прямо в кэш.
const seedFavorites = async (items: FavoriteItem[], userId: string | null = null) => {
  mockQueryClient.setQueryData(queryKeys.favorites(userId), items);
};

// viewHistory теперь живёт в RQ-кэше, а не в AsyncStorage: сидируем прямо в кэш.
const seedHistory = async (items: ViewHistoryItem[], userId: string | null = null) => {
  mockQueryClient.setQueryData(queryKeys.viewHistory(userId), items);
};

describe('FavoritesContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage as any).__reset?.();
    mockAuthContext.isAuthenticated = false;
    mockAuthContext.userId = null;

    // favorites + viewHistory живут в RQ-кэше (#994): чистим кэш и делаем его
    // активным, чтобы мутации (getActiveQueryClient) и чтение совпадали.
    mockQueryClient.clear();
    setActiveQueryClient(mockQueryClient);
  });

  it('clears favorites (guest/local)', async () => {
    const mockFavorites: FavoriteItem[] = [
      {
        id: '1',
        type: 'travel',
        title: 'Test Travel',
        url: '/travels/1',
        addedAt: Date.now(),
      },
    ];

    await seedFavorites(mockFavorites);
    jest.clearAllMocks();

    let contextValue: any;

    render(
      <AuthProvider>
        <FavoritesProvider>
          <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
        </FavoritesProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue.favorites).toHaveLength(1);
    });

    await act(async () => {
      await contextValue.clearFavorites();
    });

    await waitFor(() => {
      expect(contextValue.favorites).toHaveLength(0);
    });
  });

  it('clears favorites (authenticated/server)', async () => {
    const { clearUserFavorites, fetchUserFavoriteTravels } = require('@/api/user');

    mockAuthContext.isAuthenticated = true;
    mockAuthContext.userId = 'user123' as any;

    const cachedFavorites: FavoriteItem[] = [
      {
        id: 10,
        type: 'travel',
        title: 'Cached Travel',
        url: '/travels/10',
        addedAt: Date.now(),
      },
    ];

    // Восстановленное из persist серверное избранное = сид RQ-кэша (#994).
    await seedFavorites(cachedFavorites, 'user123');

    let contextValue: any;

    render(
      <AuthProvider>
        <FavoritesProvider>
          <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
        </FavoritesProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue.favorites).toHaveLength(1);
    });

    // Lazy fetching: should NOT hit backend just by mounting provider
    expect(fetchUserFavoriteTravels).not.toHaveBeenCalled();

    await act(async () => {
      await contextValue.clearFavorites();
    });

    await waitFor(() => {
      expect(clearUserFavorites).toHaveBeenCalledWith('user123');
      expect(contextValue.favorites).toHaveLength(0);
    });

    mockAuthContext.isAuthenticated = false;
    mockAuthContext.userId = null;
  });

  it('throws error when useFavorites is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useFavorites must be used within a FavoritesProvider');
    
    consoleSpy.mockRestore();
  });

  it('provides default empty arrays when no data in storage', async () => {
    let contextValue: any;
    
    render(
      <AuthProvider>
        <FavoritesProvider>
          <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
        </FavoritesProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue).toBeDefined();
      expect(contextValue.favorites).toEqual([]);
      expect(contextValue.viewHistory).toEqual([]);
    });
  });

  it('loads favorites from AsyncStorage', async () => {
    const mockFavorites: FavoriteItem[] = [
      {
        id: '1',
        type: 'travel',
        title: 'Test Travel',
        url: '/travels/1',
        addedAt: Date.now(),
        country: 'Belarus',
      },
    ];

    await seedFavorites(mockFavorites);
    jest.clearAllMocks();

    let contextValue: any;

    render(
      <AuthProvider>
        <FavoritesProvider>
          <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
        </FavoritesProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue.favorites).toHaveLength(1);
      expect(contextValue.favorites[0].id).toBe('1');
    });
  });

  it('adds favorite item', async () => {
    let contextValue: any;

    render(
      <AuthProvider>
        <FavoritesProvider>
          <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
        </FavoritesProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue).toBeDefined();
    });

    await act(async () => {
      await contextValue.addFavorite({
        id: '2',
        type: 'article',
        title: 'Test Article',
        url: '/article/2',
        country: 'Poland',
      });
    });

    await waitFor(() => {
      expect(contextValue.favorites).toHaveLength(1);
      expect(contextValue.favorites[0].id).toBe('2');
    });
  });

  it('removes favorite item', async () => {
    const mockFavorites: FavoriteItem[] = [
      {
        id: '1',
        type: 'travel',
        title: 'Test Travel',
        url: '/travels/1',
        addedAt: Date.now(),
      },
      {
        id: '2',
        type: 'article',
        title: 'Test Article',
        url: '/article/2',
        addedAt: Date.now(),
      },
    ];

    await seedFavorites(mockFavorites);
    jest.clearAllMocks();

    let contextValue: any;

    render(
      <AuthProvider>
        <FavoritesProvider>
          <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
        </FavoritesProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue.favorites).toHaveLength(2);
    });

    await act(async () => {
      await contextValue.removeFavorite('1', 'travel');
    });

    await waitFor(() => {
      expect(contextValue.favorites).toHaveLength(1);
      expect(contextValue.favorites[0].id).toBe('2');
    });
  });

  it('checks if item is favorite', async () => {
    const mockFavorites: FavoriteItem[] = [
      {
        id: '1',
        type: 'travel',
        title: 'Test Travel',
        url: '/travels/1',
        addedAt: Date.now(),
      },
    ];

    await seedFavorites(mockFavorites);
    jest.clearAllMocks();

    let contextValue: any;

    render(
      <AuthProvider>
        <FavoritesProvider>
          <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
        </FavoritesProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue.isFavorite('1', 'travel')).toBe(true);
      expect(contextValue.isFavorite('2', 'travel')).toBe(false);
      expect(contextValue.isFavorite('1', 'article')).toBe(false);
    });
  });

  it('adds item to view history', async () => {
    let contextValue: any;

    render(
      <AuthProvider>
        <FavoritesProvider>
          <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
        </FavoritesProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue).toBeDefined();
    });

    await act(async () => {
      await contextValue.addToHistory({
        id: '1',
        type: 'travel',
        title: 'Test Travel',
        url: '/travels/1',
      });
    });

    await waitFor(() => {
      expect(contextValue.viewHistory).toHaveLength(1);
      expect(contextValue.viewHistory[0].id).toBe('1');
    });
  });

  it('limits view history to MAX_HISTORY_ITEMS', async () => {
    const mockHistory: ViewHistoryItem[] = Array.from({ length: 50 }, (_, i) => ({
      id: `item-${i}`,
      type: 'travel' as const,
      title: `Travel ${i}`,
      url: `/travels/${i}`,
      viewedAt: Date.now() - i * 1000,
    }));

    await seedHistory(mockHistory);
    jest.clearAllMocks();

    let contextValue: any;

    render(
      <AuthProvider>
        <FavoritesProvider>
          <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
        </FavoritesProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue.viewHistory).toHaveLength(50);
    });

    await act(async () => {
      await contextValue.addToHistory({
        id: 'new-item',
        type: 'travel',
        title: 'New Travel',
        url: '/travels/new',
      });
    });

    await waitFor(() => {
      expect(contextValue.viewHistory).toHaveLength(50);
      expect(contextValue.viewHistory[0].id).toBe('new-item');
    });
  });

  it('clears view history', async () => {
    const mockHistory: ViewHistoryItem[] = [
      {
        id: '1',
        type: 'travel',
        title: 'Test Travel',
        url: '/travels/1',
        viewedAt: Date.now(),
      },
    ];

    await seedHistory(mockHistory);
    jest.clearAllMocks();

    let contextValue: any;

    render(
      <AuthProvider>
        <FavoritesProvider>
          <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
        </FavoritesProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextValue.viewHistory).toHaveLength(1);
    });

    await act(async () => {
      await contextValue.clearHistory();
    });

    await waitFor(() => {
      expect(contextValue.viewHistory).toHaveLength(0);
    });
  });

  // NB: guest «recommendations = favorites sorted by addedAt» удалено вместе с
  // recommendationsStore (#994). Рекомендации теперь только для авторизованных
  // (hooks/useRecommendedTravels, React Query); гостю UI показывает [].

  it('scopes favorites by userId (identity-isolation, #994)', async () => {
    // Кэш userA не виден гостю: сид для user123, монтируем как гость → пусто.
    await seedFavorites(
      [{ id: 10, type: 'travel', title: 'A', url: '/travels/10', addedAt: 1 }],
      'user123',
    );

    let contextValue: any;
    render(
      <AuthProvider>
        <FavoritesProvider>
          <TestComponent onContext={(ctx) => { contextValue = ctx; }} />
        </FavoritesProvider>
      </AuthProvider>
    );

    await waitFor(() => expect(contextValue).toBeDefined());
    // Гость (userId=null) читает свой ключ, не user123.
    expect(contextValue.favorites).toHaveLength(0);
    expect(contextValue.isFavorite(10, 'travel')).toBe(false);
  });
});
