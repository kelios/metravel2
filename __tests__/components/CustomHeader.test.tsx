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

jest.mock('../../components/layout/AccountMenu', () => () => null);
jest.mock('../../components/layout/HeaderContextBar', () => {
    const React = require('react');
    const { View } = require('react-native');
    return () => React.createElement(View, { testID: 'mock-header-context-bar' });
});

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
            expect(utils.getByLabelText('Идеи поездок')).toBeTruthy();
        });

        it('shows navigation items on desktop', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const utils = renderHeader();
            
            expect(utils.getByLabelText('Идеи поездок')).toBeTruthy();
            expect(utils.getByLabelText('Беларусь')).toBeTruthy();
            expect(utils.getByLabelText('Карта')).toBeTruthy();
            expect(utils.getByLabelText('Квесты')).toBeTruthy();
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

        it('correctly identifies active path for nested routes', () => {
            (usePathname as jest.Mock).mockReturnValue('/travels/some-travel');
            const utils = renderHeader();
            
            const homeItem = utils.getByLabelText('Идеи поездок');
            expect(homeItem.props.accessibilityState?.selected).toBe(true);
        });

        it('correctly identifies active path for quest routes', () => {
            (usePathname as jest.Mock).mockReturnValue('/quests/minsk');
            const utils = renderHeader();
            
            const questsItem = utils.getByLabelText('Квесты');
            expect(questsItem.props.accessibilityState?.selected).toBe(true);
        });

        it('does not render mobile burger button on desktop', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const utils = renderHeader();
            expect(utils.queryByTestId('mobile-menu-open')).toBeNull();
        });

        it('defers header context bar on web travel routes', async () => {
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
                    jest.advanceTimersByTime(4000);
                    await Promise.resolve();
                });

                expect(queryByTestId('mock-header-context-bar')).toBeTruthy();
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
                expect(utils.queryByLabelText('Идеи поездок')).toBeNull();
            } finally {
                headerNavigationModule.PRIMARY_HEADER_NAV_ITEMS = originalPrimary;
            }
        });
    });

    describe('Mobile menu modal', () => {
        beforeEach(() => {
            dimensionsSpy.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 } as ReactNative.ScaledSize);
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

            expect(utils.getByText('Политика конфиденциальности')).toBeTruthy();
            expect(utils.getByText('Настройки cookies')).toBeTruthy();
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
