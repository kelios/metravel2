import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { usePathname, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CustomHeader from '@/components/layout/CustomHeader';
import * as ReactNative from 'react-native';
import { Platform, StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { NativeMenuAccessibilityProvider, NativeMenuBackground } from '@/components/ui/NativeMenuAccessibilityScope';
import { registerDockMoreOpener } from '@/components/layout/bottomDockItemDefs';

jest.mock('react-native-paper', () => jest.requireActual('react-native-paper'));

let mockSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

const mockAuthContext = {
    authReady: true,
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

// #2119: в приложении вход в PDF-книгу зависит от модуля печати (expo-print).
let mockPrintAvailable = false;
jest.mock('@/utils/printAvailability', () => ({
    isPrintAvailable: () => mockPrintAvailable,
}));

jest.mock('@/context/AuthContext', () => ({
    useAuth: () => mockAuthContext,
}));

jest.mock('@/context/FavoritesContext', () => ({
    useFavorites: () => mockFavoritesContext,
}));

jest.mock('@/i18n/LocaleProvider', () => ({
    ...jest.requireActual('@/i18n/LocaleProvider'),
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
  useResponsive: () => (global as any).__mockResponsive ?? { width: 1440, height: 900, isPhone: false, isLargePhone: false, isTablet: false, isDesktop: true, isMobile: false, isHydrated: true },
  useResponsiveWidth: () => (global as any).__mockResponsive?.width ?? 1440,
}));

jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({
    useSafeAreaInsetsSafe: () => mockSafeAreaInsets,
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
        dimensionsSpy.mockReturnValue({ width: 1440, height: 900, scale: 1, fontScale: 1 } as ReactNative.ScaledSize);
        mockSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
    });

    afterEach(() => {
        Object.defineProperty(Platform, 'OS', { value: originalPlatformOS });
    });

    const renderHeader = (props: React.ComponentProps<typeof CustomHeader> = {}) => {
        const client = createTestQueryClient();
        return render(
            <QueryClientProvider client={client}>
                <NativeMenuAccessibilityProvider>
                    <PaperProvider>
                        <NativeMenuBackground>
                            <CustomHeader {...props} />
                        </NativeMenuBackground>
                    </PaperProvider>
                </NativeMenuAccessibilityProvider>
            </QueryClientProvider>
        );
    };

    it.each([960, 1024, 1279, 1440])('quest detail at %d has exactly one site/quest identity owner', width => {
        Object.defineProperty(Platform, 'OS', { value: 'web' });
        (global as any).__mockResponsive = { width, height: 768, isPhone: false, isLargePhone: false, isDesktop: width >= 1280, isMobile: false, isHydrated: true };
        (usePathname as jest.Mock).mockReturnValue('/pl/quests/35/istanbul');
        try {
            const view = renderHeader();
            expect(Boolean(view.queryByTestId('main-header-row'))).toBe(width >= 1280);
            expect(Boolean(view.queryByTestId('mock-header-context-bar'))).toBe(width < 1280);
            if (width >= 1280) expect(view.getByTestId('header-language-switcher')).toBeTruthy();
        } finally {
            (global as any).__mockResponsive = undefined;
        }
    });

    it.each(['android', 'ios'])('keeps %s seasonal decoration inside the brand row without changing safe-area geometry', platform => {
        Object.defineProperty(Platform, 'OS', { value: platform });
        mockSafeAreaInsets = { top: 59, right: 0, bottom: 34, left: 0 };
        (global as any).__mockResponsive = {
            width: 390, height: 844, isPhone: true, isLargePhone: false,
            isTablet: false, isDesktop: false, isMobile: true, isHydrated: true,
        };
        (usePathname as jest.Mock).mockReturnValue('/search');
        const themeModule = require('@/hooks/useTheme') as typeof import('@/hooks/useTheme');
        const baselineTheme = themeModule.useTheme();
        const baseline = renderHeader();
        const baselineRow = StyleSheet.flatten(baseline.getByTestId('main-header-row').props.style);
        baseline.unmount();
        const themeSpy = jest.spyOn(themeModule, 'useTheme').mockReturnValue({ ...baselineTheme, activeSeasonalTheme: 'spring' });

        try {
            const view = renderHeader();
            const row = view.getByTestId('main-header-row');
            expect(row.findByProps({ testID: 'seasonal-theme-decoration' })).toBeTruthy();
            expect(StyleSheet.flatten(row.props.style)).toEqual(baselineRow);
            expect(StyleSheet.flatten(view.getByTestId('main-header').props.style).paddingTop).toBe(59);
            view.unmount();
            (usePathname as jest.Mock).mockReturnValue('/contact');
            expect(renderHeader().queryByTestId('seasonal-theme-decoration', { includeHiddenElements: true })).toBeNull();
        } finally {
            themeSpy.mockRestore();
            (global as any).__mockResponsive = undefined;
        }
    });

    describe('iPhone safe area', () => {
        it('places the header row below the top inset exactly once', () => {
            Object.defineProperty(Platform, 'OS', { value: 'ios' });
            mockSafeAreaInsets = { top: 59, right: 0, bottom: 34, left: 0 };
            const onHeightChange = jest.fn();
            (global as any).__mockResponsive = {
                width: 393,
                height: 852,
                isPhone: true,
                isLargePhone: false,
                isTablet: false,
                isDesktop: false,
                isMobile: true,
                isHydrated: true,
            };
            (usePathname as jest.Mock).mockReturnValue('/');

            try {
                const { getByTestId } = renderHeader({ onHeightChange });
                const header = getByTestId('main-header');
                const headerStyle = StyleSheet.flatten(header.props.style);
                const rowStyle = StyleSheet.flatten(getByTestId('main-header-row').props.style);

                expect(headerStyle.paddingTop).toBe(59);
                expect(rowStyle.paddingTop).toBe(8);

                fireEvent(header, 'layout', { nativeEvent: { layout: { height: 119 } } });
                fireEvent(header, 'layout', { nativeEvent: { layout: { height: 119 } } });
                expect(onHeightChange).toHaveBeenCalledTimes(1);
                expect(onHeightChange).toHaveBeenCalledWith(119);
            } finally {
                (global as any).__mockResponsive = undefined;
            }
        });

        // #2100: вложенный экран телефона — одна строка «←», бренд-строки нет;
        // safe-area сверху остаётся на контейнере, раздел дока строку сохраняет.
        it.each([
            ['/trips/my', false],
            ['/contact', false],
            ['/search', true],
        ] as const)('iPhone %s: бренд-строка = %s', (path, hasBrandRow) => {
            Object.defineProperty(Platform, 'OS', { value: 'ios' });
            mockSafeAreaInsets = { top: 59, right: 0, bottom: 34, left: 0 };
            (global as any).__mockResponsive = {
                width: 393,
                height: 852,
                isPhone: true,
                isLargePhone: false,
                isTablet: false,
                isDesktop: false,
                isMobile: true,
                isHydrated: true,
            };
            (usePathname as jest.Mock).mockReturnValue(path);

            try {
                const { getByTestId, queryByTestId } = renderHeader();
                expect(Boolean(queryByTestId('main-header-row'))).toBe(hasBrandRow);
                expect(StyleSheet.flatten(getByTestId('main-header').props.style).paddingTop).toBe(59);
            } finally {
                (global as any).__mockResponsive = undefined;
            }
        });

        it('does not apply the native top inset on web', () => {
            Object.defineProperty(Platform, 'OS', { value: 'web' });
            mockSafeAreaInsets = { top: 59, right: 0, bottom: 34, left: 0 };
            (usePathname as jest.Mock).mockReturnValue('/');

            const { getByTestId } = renderHeader();
            const headerStyle = StyleSheet.flatten(getByTestId('main-header').props.style);

            expect(headerStyle.paddingTop).toBe(0);
        });
    });

    // #2234: на Android верхний инсет тоже принадлежит контейнеру шапки. Прежде его
    // нёс стиль бренд-строки, и на вложенном экране (#2100, строки нет) строка «←»
    // вставала под статус-бар: Pixel 10 Pro, кнопки y=11–126 px при инсете 172 px.
    describe('Android safe area (#2234)', () => {
        it.each([
            ['/trips/my', false],
            ['/quests/minsk/q1', false],
            ['/search', true],
        ] as const)('Android %s: инсет на контейнере, бренд-строка = %s', (path, hasBrandRow) => {
            Object.defineProperty(Platform, 'OS', { value: 'android' });
            mockSafeAreaInsets = { top: 63, right: 0, bottom: 24, left: 0 };
            (global as any).__mockResponsive = {
                width: 412,
                height: 915,
                isPhone: false,
                isLargePhone: true,
                isTablet: false,
                isDesktop: false,
                isMobile: true,
                isHydrated: true,
            };
            (usePathname as jest.Mock).mockReturnValue(path);

            try {
                const { getByTestId, queryByTestId } = renderHeader();
                expect(Boolean(queryByTestId('main-header-row'))).toBe(hasBrandRow);
                expect(StyleSheet.flatten(getByTestId('main-header').props.style).paddingTop).toBe(63);
            } finally {
                (global as any).__mockResponsive = undefined;
            }
        });
    });

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

        it('uses compact navigation on tablet-width web screens', () => {
            Object.defineProperty(Platform, 'OS', { value: 'web' });
            (global as any).__mockResponsive = {
                width: 1024,
                height: 768,
                isPhone: false,
                isLargePhone: false,
                isTablet: false,
                isLargeTablet: true,
                isDesktop: false,
                isMobile: false,
                isHydrated: true,
            };
            (usePathname as jest.Mock).mockReturnValue('/');

            try {
                const utils = renderHeader();
                expect(utils.getByTestId('mobile-menu-open')).toBeTruthy();
                expect(utils.queryByLabelText('Случайный маршрут')).toBeNull();
            } finally {
                (global as any).__mockResponsive = undefined;
            }
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
            const originalBar = headerNavigationModule.DESKTOP_BAR_NAV_ITEMS;
            headerNavigationModule.DESKTOP_BAR_NAV_ITEMS = undefined;

            try {
                (usePathname as jest.Mock).mockReturnValue('/');
                const utils = renderHeader();
                expect(utils.queryByLabelText('Маршруты')).toBeNull();
            } finally {
                headerNavigationModule.DESKTOP_BAR_NAV_ITEMS = originalBar;
            }
        });
    });

    describe('Mobile header row (#2779: одно меню на телефоне)', () => {
        beforeEach(() => {
            dimensionsSpy.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 } as ReactNative.ScaledSize);
            (global as any).__mockResponsive = { width: 390, height: 844, isPhone: true, isLargePhone: false, isTablet: false, isDesktop: false, isMobile: true, isHydrated: true };
        });

        afterEach(() => {
            (global as any).__mockResponsive = undefined;
            Object.assign(mockAuthContext, { isAuthenticated: false, username: '', userId: null, authReady: true });
        });

        it('menu button opens the shared «Ещё» sheet instead of a header menu of its own', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const opener = jest.fn();
            const unregister = registerDockMoreOpener(opener);
            try {
                const utils = renderHeader();
                fireEvent.press(utils.getByTestId('mobile-menu-open'));
                expect(opener).toHaveBeenCalledTimes(1);
                expect(utils.queryByTestId('mobile-menu-panel')).toBeNull();
                expect(mockPush).not.toHaveBeenCalled();
            } finally {
                unregister();
            }
        });

        it('falls back to the /more page when the sheet controller is not mounted', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const utils = renderHeader();
            fireEvent.press(utils.getByTestId('mobile-menu-open'));
            expect(mockPush).toHaveBeenCalledWith('/more');
        });

        it('shows a visible 44 px «Войти» to a guest in the header row', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const utils = renderHeader();
            const login = utils.getByTestId('mobile-header-login');
            expect(login.props.accessibilityLabel).toBe('Войти');
            expect(utils.getByText('Войти')).toBeTruthy();
            expect(StyleSheet.flatten(login.props.style).minHeight).toBeGreaterThanOrEqual(44);
            fireEvent.press(login);
            expect(mockPush).toHaveBeenCalledWith('/login?redirect=%2F&intent=menu');
        });

        it('does not show «Войти» before the session is read', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            Object.assign(mockAuthContext, { authReady: false });
            const utils = renderHeader();
            expect(utils.queryByTestId('mobile-header-login')).toBeNull();
            expect(utils.getByTestId('mobile-menu-open')).toBeTruthy();
        });

        it('shows the profile pill instead of «Войти» to a signed-in user', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            Object.assign(mockAuthContext, { isAuthenticated: true, username: 'Юля', userId: 1 });
            const utils = renderHeader();
            expect(utils.queryByTestId('mobile-header-login')).toBeNull();
            fireEvent.press(utils.getByLabelText('Открыть профиль Юля'));
            expect(mockPush).toHaveBeenCalledWith('/profile');
        });
    });
});
