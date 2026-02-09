import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { useBreadcrumbModel } from '@/hooks/useBreadcrumbModel';

jest.mock('expo-router', () => ({
  usePathname: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/api/travelsApi', () => ({
  fetchTravel: jest.fn(),
  fetchTravelBySlug: jest.fn(),
}));

jest.mock('@/api/quests', () => ({
  fetchQuestByQuestId: jest.fn(),
}));

describe('useBreadcrumbModel', () => {
  const { usePathname, useLocalSearchParams } = jest.requireMock('expo-router') as {
    usePathname: jest.Mock;
    useLocalSearchParams: jest.Mock;
  };

  const { fetchTravelBySlug } = jest.requireMock('@/api/travelsApi') as {
    fetchTravelBySlug: jest.Mock;
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should build breadcrumbs and backToPath from returnTo on travel details', async () => {
    usePathname.mockReturnValue('/travels/test-slug');
    useLocalSearchParams.mockReturnValue({ returnTo: '/metravel' });

    fetchTravelBySlug.mockResolvedValue({ name: 'Длинное описание' });

    const { result } = renderHook(() => useBreadcrumbModel(), { wrapper });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    expect(result.current.backToPath).toBe('/metravel');
    expect(result.current.showBreadcrumbs).toBe(true);
    expect(result.current.items).toEqual([
      { label: 'Мои путешествия', path: '/metravel' },
      { label: 'Длинное описание', path: '/travels/test-slug' },
    ]);
  });

  it('should build breadcrumbs for single-level profile page', async () => {
    usePathname.mockReturnValue('/profile');
    useLocalSearchParams.mockReturnValue({});

    const { result } = renderHook(() => useBreadcrumbModel(), { wrapper });

    await waitFor(() => {
      expect(result.current).toBeTruthy();
    });

    expect(result.current.showBreadcrumbs).toBe(true);
    expect(result.current.backToPath).toBe('/');
    expect(result.current.items).toEqual([{ label: 'Профиль', path: '/profile' }]);
    expect(result.current.currentTitle).toBe('Профиль');
  });

  it('should build nested breadcrumbs for subscriptions under profile', async () => {
    usePathname.mockReturnValue('/subscriptions');
    useLocalSearchParams.mockReturnValue({});

    const { result } = renderHook(() => useBreadcrumbModel(), { wrapper });

    await waitFor(() => {
      expect(result.current).toBeTruthy();
    });

    expect(result.current.showBreadcrumbs).toBe(true);
    expect(result.current.backToPath).toBe('/profile');
    expect(result.current.items).toEqual([
      { label: 'Профиль', path: '/profile' },
      { label: 'Подписки', path: '/subscriptions' },
    ]);
    expect(result.current.currentTitle).toBe('Подписки');
  });
});
