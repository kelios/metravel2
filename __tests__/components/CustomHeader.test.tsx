import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { usePathname, useRouter } from 'expo-router';
import CustomHeader from '@/components/CustomHeader';

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

// Моки для react-native
jest.mock('react-native', () => {
    const RN = jest.requireActual('react-native');
    return {
        ...RN,
        useWindowDimensions: () => ({ width: 1024, height: 768 }),
    };
});

describe('CustomHeader', () => {
    const mockPush = jest.fn();
    const mockRouter = {
        push: mockPush,
    };
    let widthSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthContext.logout.mockClear();
        mockFavoritesContext.addFavorite.mockClear();
        mockFavoritesContext.removeFavorite.mockClear();
        mockFavoritesContext.isFavorite.mockClear();
        mockFiltersContext.updateFilters.mockClear();
        (useRouter as jest.Mock).mockReturnValue(mockRouter);
        const rn = require('react-native');
        widthSpy = jest.spyOn(rn, 'useWindowDimensions').mockReturnValue({ width: 1024, height: 768 });
    });

    afterEach(() => {
        widthSpy?.mockRestore();
    });

    const renderHeader = () => render(<CustomHeader />);

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
