import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { usePathname, useRouter } from 'expo-router';
import CustomHeader from '@/components/CustomHeader';
import * as ReactNative from 'react-native';

const mockAuthContext = {
    isAuthenticated: false,
    user: null,
    logout: jest.fn(),
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

jest.mock('@/providers/FiltersProvider', () => ({
    useFilters: () => mockFiltersContext,
}));

jest.mock('../../components/RenderRightMenu', () => () => null);
jest.mock('../../components/Breadcrumbs', () => () => null);

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

    const dimensionsSpy = jest.spyOn(ReactNative, 'useWindowDimensions');

    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthContext.logout.mockClear();
        mockFavoritesContext.addFavorite.mockClear();
        mockFavoritesContext.removeFavorite.mockClear();
        mockFavoritesContext.isFavorite.mockClear();
        mockFiltersContext.updateFilters.mockClear();
        (useRouter as jest.Mock).mockReturnValue(mockRouter);
        dimensionsSpy.mockReturnValue({ width: 1024, height: 768 });
    });

    const renderHeader = () => render(<CustomHeader />);

    describe('Desktop navigation', () => {
        it('renders desktop navigation by default', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const utils = renderHeader();
            expect(utils.getByText('Путешествия')).toBeTruthy();
        });

        it('shows navigation items on desktop', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const utils = renderHeader();
            
            expect(utils.getByText('Путешествия')).toBeTruthy();
            expect(utils.getByText('Беларусь')).toBeTruthy();
            expect(utils.getByText('Карта')).toBeTruthy();
            expect(utils.getByText('Квесты')).toBeTruthy();
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
            
            const travelsItem = utils.getByLabelText('Путешествия');
            expect(travelsItem.props.accessibilityState?.selected).toBe(true);
        });

        it('correctly identifies active path for quest routes', () => {
            (usePathname as jest.Mock).mockReturnValue('/quests/minsk');
            const utils = renderHeader();
            
            const questsItem = utils.getByLabelText('Квесты');
            expect(questsItem.props.accessibilityState?.selected).toBe(true);
        });
    });

    describe.skip('Mobile navigation', () => {
        beforeEach(() => {
            dimensionsSpy.mockReturnValue({ width: 375, height: 667 });
        });

        it('renders mobile menu button on mobile', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const { getByLabelText } = renderHeader();
            expect(getByLabelText('Открыть меню')).toBeTruthy();
        });

        it('shows mobile menu when button is pressed', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const { getByLabelText, getByText } = renderHeader();
            const menuButton = getByLabelText('Открыть меню');
            fireEvent.press(menuButton);
            expect(getByText('Меню')).toBeTruthy();
        });

        it('navigates when mobile menu item is pressed', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const { getByLabelText, getByText } = renderHeader();
            const menuButton = getByLabelText('Открыть меню');
            fireEvent.press(menuButton);
            const mapItem = getByText('Карта');
            fireEvent.press(mapItem);
            expect(mockPush).toHaveBeenCalledWith('/map');
        });

        it('closes menu when close button is pressed', () => {
            (usePathname as jest.Mock).mockReturnValue('/');
            const { getByLabelText, queryByText } = renderHeader();
            const menuButton = getByLabelText('Открыть меню');
            fireEvent.press(menuButton);
            expect(queryByText('Меню')).toBeTruthy();
            const closeButton = getByLabelText('Закрыть меню');
            fireEvent.press(closeButton);
            expect(queryByText('Меню')).toBeNull();
        });
    });
});
