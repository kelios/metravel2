import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { FavoritesProvider, useFavorites, FavoriteItem, ViewHistoryItem } from '@/context/FavoritesContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from '@/context/AuthContext';

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

jest.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => mockAuthContext,
}));

// Test component that uses the hook
const TestComponent: React.FC<{ onContext?: (context: any) => void }> = ({ onContext }) => {
  const context = useFavorites();
  React.useEffect(() => {
    onContext?.(context);
  }, [context, onContext]);
  return null;
};

const seedFavorites = async (items: FavoriteItem[], userId: string | null = null) => {
  const key = userId ? `metravel_favorites_${userId}` : 'metravel_favorites';
  await AsyncStorage.setItem(key, JSON.stringify(items));
};

const seedHistory = async (items: ViewHistoryItem[], userId: string | null = null) => {
  const key = userId ? `metravel_view_history_${userId}` : 'metravel_view_history';
  await AsyncStorage.setItem(key, JSON.stringify(items));
};

describe('FavoritesContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage as any).__reset?.();
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
      expect(AsyncStorage.setItem).toHaveBeenCalled();
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

  it('gets recommendations based on favorites', async () => {
    const mockFavorites: FavoriteItem[] = [
      {
        id: '1',
        type: 'travel',
        title: 'Travel 1',
        url: '/travels/1',
        addedAt: Date.now() - 2000,
        country: 'Belarus',
      },
      {
        id: '2',
        type: 'travel',
        title: 'Travel 2',
        url: '/travels/2',
        addedAt: Date.now() - 1000,
        country: 'Poland',
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
      const recommendations = contextValue.getRecommendations();
      expect(recommendations).toHaveLength(2);
      // Should be sorted by addedAt descending (newest first)
      expect(recommendations[0].id).toBe('2');
      expect(recommendations[1].id).toBe('1');
    });
  });

  it('uses user-specific storage key when authenticated', async () => {
    mockAuthContext.isAuthenticated = true;
    mockAuthContext.userId = 'user123';

    render(
      <AuthProvider>
        <FavoritesProvider>
          <TestComponent />
        </FavoritesProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      const firstCall = (AsyncStorage.multiGet as jest.Mock).mock.calls[0]?.[0] || [];
      expect(firstCall).toEqual(
        expect.arrayContaining(['metravel_favorites_user123', 'metravel_view_history_user123'])
      );
    });

    mockAuthContext.isAuthenticated = false;
    mockAuthContext.userId = null;
  });
});
