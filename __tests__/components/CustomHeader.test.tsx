import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { usePathname, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CustomHeader from '@/components/layout/CustomHeader';
import * as ReactNative from 'react-native';
import { Platform } from 'react-native';

const mockAuthContext = {
    isAuthenticated: false,
    username: '',
    logout: jest.fn(),
    userAvatar: null,
    profileRefreshToken: 0,
    userId: null,
};

const mockFavoritesContext = {
    favorites: [],
    viewHistory: [],
    addFavorite: jest.fn(),
    removeFavorite: jest.fn(),
    isFavorite: jest.fn(),
    getRecommendations: jest.fn(() => []),
};

const mockFiltersContext = {
    updateFilters: jest.fn(),
};

jest.mock('@/context/AuthContext', () => ({
    useAuth: () => mockAuthContext,
}));

jest.mock('@/context/FavoritesContext', () => ({
    useFavorites: () => mockFavoritesContext,
}));

jest.mock('@/context/FiltersProvider', () => ({
    useFilters: () => mockFiltersContext,
}));

jest.mock('@/i18n/LocaleProvider', () => ({
    useLocale: () => ({
        locale: 'ru',
        preference: { version: 1, mode: 'explicit', locale: 'ru' },
        supportedLocales: ['ru', 'be', 'uk', 'pl', 'en'],
        isHydrated: true,
        setLocale: jest.fn(),
        useSystemLocale: jest.fn(),
    }),
}));

jest.mock('../../components/layout/AccountMenu', () => () => null);
jest.mock('../../components/layout/HeaderContextBar', () => {
    const React = require('react');
    const { View } = require('react-native');
    return () => React.createElement(View, { testID: 'mock-header-context-bar' });
});

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => (global as any).__mockResponsive ?? { width: 1024, height: 768, isPhone: false, isLargePhone: false, isTablet: false, isDesktop: true, isMobile: false, isHydrated: true },
  useResponsiveWidth: () => (global as any).__mockResponsive?.width ?? 1024,
}));

// Моки для expo-router
jest.mock('expo-router', () => ({
    usePathname: jest.fn(),
    useRouter: jest.fn(),
}));

describe('CustomHeader', () => {
    const mockPush = jest.fn();
    const mockRouter = {
        push: mockPush,
    };
    const originalPlatformOS = Platform.OS;

    const dimensionsSpy = jest.spyOn(ReactNative, 'useWindowDimensions');

    const createTestQueryClient = () =>
        new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });

    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthContext.logout.mockClear();
        mockFavoritesContext.addFavorite.mockClear();
        mockFavoritesContext.removeFavorite.mockClear();
        mockFavoritesContext.isFavorite.mockClear();
        mockFiltersContext.updateFilters.mockClear();
        (useRouter as jest.Mock).mockReturnValue(mockRouter);
        dimensionsSpy.mockReturnValue({ width: 1024, height: 768, scale: 1, fontScale: 1 } as ReactNative.ScaledSize);
    });

    afterEach(() => {
        Object.defineProperty(Platform, 'OS', { value: originalPlatformOS });
    });

    const renderHeader = () => {
        const client = createTestQueryClient();
        return render(
            <QueryClientProvider client={client}>
                <CustomHeader />
            </QueryClientProvider>
        );
    };

    describe('Desktop navigation', () => {
        it('renders desktop navigation by default', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const utils = renderHeader();
            expect(utils.getByLabelText('Маршруты')).toBeTruthy();
        });

        it('removes the shared skip-link id from an inactive transition header', () => {
            (usePathname as jest.Mock).mockReturnValue('/trips/plan');
            const client = createTestQueryClient();
            const { getByTestId } = render(
                <QueryClientProvider client={client}>
                    <CustomHeader isNavigationTarget={false} />
                </QueryClientProvider>,
            );

            expect(getByTestId('main-header').props.nativeID).toBeUndefined();
        });

        it('shows navigation items on desktop', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const utils = renderHeader();
            
            expect(utils.getByLabelText('Маршруты')).toBeTruthy();
            expect(utils.getByLabelText('Беларусь')).toBeTruthy();
            expect(utils.getByLabelText('Карта')).toBeTruthy();
            expect(utils.getByLabelText('Места')).toBeTruthy();
            expect(utils.getByLabelText('Случайный маршрут')).toBeTruthy();
            expect(utils.getByLabelText('Квесты')).toBeTruthy();
            expect(utils.queryByLabelText('Попутчики')).toBeNull();
        });

        it('highlights active navigation item', () => {
            (usePathname as jest.Mock).mockReturnValue('/map');
            const utils = renderHeader();
            
            const mapItem = utils.getByLabelText('Карта');
            expect(mapItem.props.accessibilityState?.selected).toBe(true);
        });

        it('navigates when navigation item is pressed', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const utils = renderHeader();
            
            const mapItem = utils.getByLabelText('Карта');
            fireEvent.press(mapItem);
            
            expect(mockPush).toHaveBeenCalledWith('/map');
        });

        it('navigates to places from desktop navigation', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const utils = renderHeader();

            fireEvent.press(utils.getByLabelText('Места'));

            expect(mockPush).toHaveBeenCalledWith('/places');
        });

        it('does not highlight ideas navigation item on travel details routes', () => {
            (usePathname as jest.Mock).mockReturnValue('/travels/some-travel');
            const utils = renderHeader();
            
            const homeItem = utils.getByLabelText('Маршруты');
            expect(homeItem.props.accessibilityState?.selected).toBe(false);
        });

        it('correctly identifies active path for quest routes', () => {
            (usePathname as jest.Mock).mockReturnValue('/quests/minsk');
            const utils = renderHeader();
            
            const questsItem = utils.getByLabelText('Квесты');
            expect(questsItem.props.accessibilityState?.selected).toBe(true);
        });

        it('correctly identifies active path for roulette routes', () => {
            (usePathname as jest.Mock).mockReturnValue('/roulette');
            const utils = renderHeader();

            const rouletteItem = utils.getByLabelText('Случайный маршрут');
            expect(rouletteItem.props.accessibilityState?.selected).toBe(true);
        });

        it('does not render mobile burger button on desktop', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const utils = renderHeader();
            expect(utils.queryByTestId('mobile-menu-open')).toBeNull();
        });

        it('renders desktop account anchor and guest login CTA without eager account menu mount', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const utils = renderHeader();

            expect(utils.getByTestId('account-menu-anchor')).toBeTruthy();
            expect(utils.getByTestId('header-login-cta')).toBeTruthy();
        });

        it('opens guest login CTA in the current tab', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const utils = renderHeader();

            fireEvent.press(utils.getByTestId('header-login-cta'));

            expect(mockPush).toHaveBeenCalledWith('/login?redirect=%2F&intent=menu');
        });

        it('keeps header context bar hidden on web travel routes without interaction', async () => {
            jest.useFakeTimers();
            const restoreWindow = global.window;
            Object.defineProperty(Platform, 'OS', { value: 'web' });
            (global as any).window = {
                ...restoreWindow,
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
            };

            try {
                (usePathname as jest.Mock).mockReturnValue('/travels/test-slug');
                const { queryByTestId } = render(
                    <QueryClientProvider client={createTestQueryClient()}>
                        <CustomHeader />
                    </QueryClientProvider>
                );

                expect(queryByTestId('mock-header-context-bar')).toBeNull();

                await act(async () => {
                    jest.advanceTimersByTime(12000);
                    await Promise.resolve();
                });

                expect(queryByTestId('mock-header-context-bar')).toBeNull();
            } finally {
                jest.runOnlyPendingTimers();
                jest.useRealTimers();
                (global as any).window = restoreWindow;
            }
        });

        it('does not crash when primary navigation config is unavailable', () => {
            const headerNavigationModule = require('@/constants/headerNavigation');
            const originalPrimary = headerNavigationModule.PRIMARY_HEADER_NAV_ITEMS;
            headerNavigationModule.PRIMARY_HEADER_NAV_ITEMS = undefined;

            try {
                (usePathname as jest.Mock).mockReturnValue('/');
                const utils = renderHeader();
                expect(utils.queryByLabelText('Маршруты')).toBeNull();
            } finally {
                headerNavigationModule.PRIMARY_HEADER_NAV_ITEMS = originalPrimary;
            }
        });
    });

    describe('Mobile menu modal', () => {
        beforeEach(() => {
            dimensionsSpy.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 } as ReactNative.ScaledSize);
            (global as any).__mockResponsive = { width: 390, height: 844, isPhone: true, isLargePhone: false, isTablet: false, isDesktop: false, isMobile: true, isHydrated: true };
        });

        afterEach(() => {
            (global as any).__mockResponsive = undefined;
        });

        it('opens and closes mobile menu modal', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const utils = renderHeader();

            const open = utils.getByTestId('mobile-menu-open');
            fireEvent.press(open);
            expect(utils.getByTestId('mobile-menu-panel')).toBeTruthy();

            const close = utils.getByTestId('mobile-menu-close');
            fireEvent.press(close);
            expect(utils.queryByTestId('mobile-menu-panel')).toBeNull();
        });

        it('closes when overlay is pressed', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const utils = renderHeader();

            fireEvent.press(utils.getByTestId('mobile-menu-open'));
            expect(utils.getByTestId('mobile-menu-panel')).toBeTruthy();

            fireEvent.press(utils.getByTestId('mobile-menu-overlay'));
            expect(utils.queryByTestId('mobile-menu-panel')).toBeNull();
        });

        it('shows navigation and documents sections in mobile modal', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const utils = renderHeader();

            fireEvent.press(utils.getByTestId('mobile-menu-open'));

            expect(utils.getByText('Навигация')).toBeTruthy();
            expect(utils.getByText('Аккаунт')).toBeTruthy();
            expect(utils.getByText('Документы')).toBeTruthy();

            expect(utils.getByLabelText('Попутчики')).toBeTruthy();
            expect(utils.getByText('Политика конфиденциальности')).toBeTruthy();
            expect(utils.getByText('Настройки cookies')).toBeTruthy();

            // secondary nav items (e.g. Instagram article link) render under Навигация
            expect(utils.getByLabelText('Travel-блогеры Беларуси')).toBeTruthy();
        });

        it('does not crash when mobile navigation and document configs are unavailable', () => {
            const headerNavigationModule = require('@/constants/headerNavigation');
            const originalPrimary = headerNavigationModule.PRIMARY_HEADER_NAV_ITEMS;
            const originalDocuments = headerNavigationModule.DOCUMENT_NAV_ITEMS;
            headerNavigationModule.PRIMARY_HEADER_NAV_ITEMS = undefined;
            headerNavigationModule.DOCUMENT_NAV_ITEMS = undefined;

            try {
                (usePathname as jest.Mock).mockReturnValue('/');
                const utils = renderHeader();

                fireEvent.press(utils.getByTestId('mobile-menu-open'));

                expect(utils.getByText('Навигация')).toBeTruthy();
                expect(utils.getByText('Документы')).toBeTruthy();
                expect(utils.queryByText('Политика конфиденциальности')).toBeNull();
                expect(utils.queryByText('Настройки cookies')).toBeNull();
            } finally {
                headerNavigationModule.PRIMARY_HEADER_NAV_ITEMS = originalPrimary;
                headerNavigationModule.DOCUMENT_NAV_ITEMS = originalDocuments;
            }
        });
    });
});
