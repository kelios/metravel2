import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { Platform } from 'react-native';

import { useBreadcrumbModel } from '@/hooks/useBreadcrumbModel';

jest.mock('expo-router', () => ({
  usePathname: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/api/travelDetailsQueries', () => ({
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

  const { fetchTravelBySlug } = jest.requireMock('@/api/travelDetailsQueries') as {
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
    (global as any).window = undefined;
    (Platform.OS as any) = 'ios';
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

  it('uses static travel preload for travel breadcrumbs without fetching by slug', async () => {
    (Platform.OS as any) = 'web';
    (global as any).window = {
      __metravelTravelPreload: {
        data: {
          id: 566,
          slug: 'test-slug',
          name: 'Статический маршрут',
          description: '<p>Описание маршрута</p>',
          gallery: [],
          travelAddress: [{ id: 1, name: 'Точка' }],
          coordsMeTravel: [],
        },
        slug: 'test-slug',
        isId: false,
      },
    };
    usePathname.mockReturnValue('/travels/test-slug');
    useLocalSearchParams.mockReturnValue({ returnTo: '/travelsby' });

    const { result } = renderHook(() => useBreadcrumbModel(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentTitle).toBe('Статический маршрут');
    });

    expect(fetchTravelBySlug).not.toHaveBeenCalled();
    expect((global as any).window.__metravelTravelPreload?.data?.id).toBe(566);
  });

  it('should not show Belarus return context for non-Belarus travel from travelsby', async () => {
    usePathname.mockReturnValue('/travels/croatia-slug');
    useLocalSearchParams.mockReturnValue({ returnTo: '/travelsby' });

    fetchTravelBySlug.mockResolvedValue({ name: 'Маршрут по Велебиту', countryName: 'Хорватия' });

    const { result } = renderHook(() => useBreadcrumbModel(), { wrapper });

    await waitFor(() => {
      expect(result.current.items.length).toBeGreaterThan(0);
    });

    expect(result.current.backToPath).toBe('/search');
    expect(result.current.pageContextTitle).toBe('Хорватия');
    expect(result.current.items).toEqual([
      { label: 'Хорватия', path: '/search' },
      { label: 'Маршрут по Велебиту', path: '/travels/croatia-slug' },
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

  it.each([
    ['/community-rules', 'Правила сообщества'],
    ['/trip-rules', 'Правила участия в поездках'],
    ['/terms', 'Пользовательское соглашение'],
    ['/disclaimer', 'Отказ от ответственности'],
  ])('localizes the header title for legal route %s', async (pathname, expectedTitle) => {
    usePathname.mockReturnValue(pathname);
    useLocalSearchParams.mockReturnValue({});

    const { result } = renderHook(() => useBreadcrumbModel(), { wrapper });

    await waitFor(() => {
      expect(result.current).toBeTruthy();
    });

    expect(result.current.currentTitle).toBe(expectedTitle);
  });

  it('builds nested breadcrumbs for export under profile', async () => {
    usePathname.mockReturnValue('/export');
    useLocalSearchParams.mockReturnValue({});

    const { result } = renderHook(() => useBreadcrumbModel(), { wrapper });

    await waitFor(() => {
      expect(result.current).toBeTruthy();
    });

    expect(result.current.showBreadcrumbs).toBe(true);
    expect(result.current.backToPath).toBe('/profile');
    expect(result.current.items).toEqual([
      { label: 'Профиль', path: '/profile' },
      { label: 'Экспорт', path: '/export' },
    ]);
    expect(result.current.currentTitle).toBe('Экспорт');
  });

  it('does not build a breadcrumb trail for self-headed cabinet pages', async () => {
    // /favorites, /history, /calendar render their own
    // ProfileCollectionHeader — the model must not add a redundant trail.
    for (const path of ['/favorites', '/history', '/calendar']) {
      usePathname.mockReturnValue(path);
      useLocalSearchParams.mockReturnValue({});
      const { result } = renderHook(() => useBreadcrumbModel(), { wrapper });
      await waitFor(() => expect(result.current).toBeTruthy());
      expect(result.current.showBreadcrumbs).toBe(false);
      expect(result.current.items).toEqual([]);
    }
  });

  it('builds breadcrumbs for /userpoints under profile (own header removed)', async () => {
    usePathname.mockReturnValue('/userpoints');
    useLocalSearchParams.mockReturnValue({});

    const { result } = renderHook(() => useBreadcrumbModel(), { wrapper });

    await waitFor(() => expect(result.current).toBeTruthy());
    expect(result.current.showBreadcrumbs).toBe(true);
    expect(result.current.items).toEqual([
      { label: 'Профиль', path: '/profile' },
      { label: 'Мои точки', path: '/userpoints' },
    ]);
    expect(result.current.currentTitle).toBe('Мои точки');
  });

  it('builds three-level breadcrumbs for security-journal under profile › settings', async () => {
    usePathname.mockReturnValue('/security-journal');
    useLocalSearchParams.mockReturnValue({});

    const { result } = renderHook(() => useBreadcrumbModel(), { wrapper });

    await waitFor(() => {
      expect(result.current).toBeTruthy();
    });

    expect(result.current.showBreadcrumbs).toBe(true);
    expect(result.current.backToPath).toBe('/settings');
    expect(result.current.items).toEqual([
      { label: 'Профиль', path: '/profile' },
      { label: 'Настройки', path: '/settings' },
      { label: 'Журнал безопасности', path: '/security-journal' },
    ]);
    expect(result.current.currentTitle).toBe('Журнал безопасности');
  });

  it('builds a single breadcrumb under home for info pages', async () => {
    usePathname.mockReturnValue('/about');
    useLocalSearchParams.mockReturnValue({});

    const { result } = renderHook(() => useBreadcrumbModel(), { wrapper });

    await waitFor(() => {
      expect(result.current).toBeTruthy();
    });

    expect(result.current.showBreadcrumbs).toBe(true);
    expect(result.current.pageContextTitle).toBe('Главная');
    expect(result.current.backToPath).toBe('/');
    expect(result.current.items).toEqual([{ label: 'О сайте', path: '/about' }]);
  });

  it('does not show breadcrumbs on top-level navigation pages', async () => {
    usePathname.mockReturnValue('/map');
    useLocalSearchParams.mockReturnValue({});

    const { result } = renderHook(() => useBreadcrumbModel(), { wrapper });

    await waitFor(() => {
      expect(result.current).toBeTruthy();
    });

    expect(result.current.showBreadcrumbs).toBe(false);
    expect(result.current.items).toEqual([]);
    expect(result.current.currentTitle).toBe('Карта');
  });

  it('exports default hook alias for module interop stability', () => {
    const mod = require('@/hooks/useBreadcrumbModel');
    expect(mod.default).toBe(mod.useBreadcrumbModel);
  });
});
