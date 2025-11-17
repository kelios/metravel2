import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
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

jest.mock('expo-router', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock('../../components/RenderRightMenu', () => {
  return function MockRenderRightMenu() {
    return null;
  };
});

jest.mock('../../components/Breadcrumbs', () => {
  return function MockBreadcrumbs() {
    return null;
  };
});

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    useWindowDimensions: () => ({ width: 375, height: 667 }),
    Modal: ({ children, visible }: any) => (visible ? children : null),
  };
});

describe('CustomHeader - Improved', () => {
  const mockPush = jest.fn();
  const mockRouter = {
    push: mockPush,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthContext.logout.mockClear();
    mockFavoritesContext.addFavorite.mockClear();
    mockFavoritesContext.removeFavorite.mockClear();
    mockFavoritesContext.isFavorite.mockClear();
    mockFiltersContext.updateFilters.mockClear();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  it('should render mobile menu button on mobile', () => {
    (usePathname as jest.Mock).mockReturnValue('/');
    const { getByLabelText } = render(<CustomHeader />);
    expect(getByLabelText('Открыть меню')).toBeTruthy();
  });

  it('should show mobile menu when button is pressed', () => {
    (usePathname as jest.Mock).mockReturnValue('/');
    const { getByLabelText, getByText } = render(<CustomHeader />);
    const menuButton = getByLabelText('Открыть меню');
    fireEvent.press(menuButton);
    expect(getByText('Меню')).toBeTruthy();
  });

  it('should navigate when menu item is pressed', () => {
    (usePathname as jest.Mock).mockReturnValue('/');
    const { getByLabelText, getByText } = render(<CustomHeader />);
    const menuButton = getByLabelText('Открыть меню');
    fireEvent.press(menuButton);
    const mapItem = getByText('Карта');
    fireEvent.press(mapItem);
    expect(mockPush).toHaveBeenCalledWith('/map');
  });

  it('should close menu when close button is pressed', () => {
    (usePathname as jest.Mock).mockReturnValue('/');
    const { getByLabelText, queryByText } = render(<CustomHeader />);
    const menuButton = getByLabelText('Открыть меню');
    fireEvent.press(menuButton);
    expect(queryByText('Меню')).toBeTruthy();
    const closeButton = getByLabelText('Закрыть меню');
    fireEvent.press(closeButton);
    expect(queryByText('Меню')).toBeNull();
  });
});

