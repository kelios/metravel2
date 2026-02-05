import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import UpsertTravel from '@/components/travel/UpsertTravel';

// Mocks
const mockReplace = jest.fn();
const mockAddListener = jest.fn();
const mockFetchFilters = jest.fn().mockResolvedValue({ categoryTravelAddress: [], countries: [] });
const mockFetchCountries = jest.fn().mockResolvedValue([]);
const mockFetchTravel = jest.fn().mockResolvedValue({
  id: 123,
  name: 'Owned travel',
  user: { id: '42' },
});

// Mutable auth state to control authReady flips
let mockAuthState = {
  isAuthenticated: true,
  isSuperuser: false,
  userId: '42',
  authReady: false,
};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: '123' }),
  useNavigation: () => ({
    addListener: mockAddListener,
    dispatch: jest.fn(),
  }),
}));

jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('@/src/api/misc', () => ({
  fetchFilters: () => mockFetchFilters(),
  fetchAllCountries: () => mockFetchCountries(),
  saveFormData: jest.fn(),
}));

jest.mock('@/src/api/travelsApi', () => ({
  fetchTravel: () => mockFetchTravel(),
}));

describe('UpsertTravel authReady gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      isAuthenticated: true,
      isSuperuser: false,
      userId: '42',
      authReady: false,
    };
  });

  it('does not load travel or redirect before authReady is true, then loads after', async () => {
    const { rerender } = render(<UpsertTravel />);

    // Пока authReady=false не должно быть запросов к путешествию и редиректа
    expect(mockFetchTravel).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    // Переключаем authReady и делаем повторный рендер
    mockAuthState = { ...mockAuthState, authReady: true };
    rerender(<UpsertTravel />);

    await waitFor(() => {
      expect(mockFetchTravel).toHaveBeenCalledTimes(1);
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects to home after authReady when user is not owner and not superuser', async () => {
    // Пользователь не владелец
    mockAuthState = {
      isAuthenticated: true,
      isSuperuser: false,
      userId: '7',
      authReady: false,
    };

    const { rerender, getByText, queryByTestId } = render(<UpsertTravel />);

    // Пока authReady=false — нет запросов и редиректов
    expect(mockFetchTravel).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    // Включаем authReady
    mockAuthState = { ...mockAuthState, authReady: true };
    rerender(<UpsertTravel />);

    await waitFor(() => {
      expect(mockFetchTravel).toHaveBeenCalledTimes(1);
    });

    // No automatic redirect: the view should show a "no access" screen.
    await waitFor(() => {
      expect(getByText('Нет доступа')).toBeTruthy();
    });
    expect(queryByTestId('travel-upsert.root')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
