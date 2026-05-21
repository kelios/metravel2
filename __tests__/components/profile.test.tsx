import type { ComponentProps, ComponentType, ReactElement } from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import { mockReplace, mockUseRouter, resetExpoRouterMocks } from '../helpers/expoRouterMock';
import { createQueryWrapper } from '../helpers/testQueryClient';
import { mockFetchMyTravels, mockUnwrapMyTravelsPayload, resetTravelsApiMocks } from '../helpers/mockTravelsApi';
import {
  createAuthValue,
  createFavoriteItem,
  createFavoritesValue,
  createHistoryItem,
} from '../helpers/mockContextValues';

jest.mock('@/context/AuthContext');

jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn().mockReturnValue(true),
}));

jest.setTimeout(15000);

jest.mock('expo-router', () => ({
  useRouter: mockUseRouter,
  usePathname: jest.fn().mockReturnValue('/profile'),
}));

jest.mock('@/api/user', () => ({
  fetchUserProfile: jest.fn().mockResolvedValue({
    id: '123',
    first_name: 'Test',
    last_name: 'User',
    avatar: null,
  }),
  uploadUserProfileAvatarFile: jest.fn(),
  fetchUserTravelStatuses: jest.fn().mockResolvedValue([]),
  normalizeAvatar: (raw: unknown) => {
    const str = String(raw ?? '').trim();
    if (!str) return null;
    const lower = str.toLowerCase();
    if (lower === 'null' || lower === 'undefined') return null;
    return str;
  },
}));

const mockLoadTravelStatuses = jest.fn(() => Promise.resolve());
let mockTravelStatusEntries: Array<{
  id: number;
  type: 'travel';
  title: string;
  url: string;
  country?: string;
  status: 'visited' | 'planned' | 'wishlist';
  addedAt: number;
}> = [];

jest.mock('@/stores/travelStatusStore', () => ({
  useTravelStatusStore: jest.fn((selector?: (state: any) => unknown) => {
    const state = {
      entries: mockTravelStatusEntries,
      loadLocal: mockLoadTravelStatuses,
      getStatus: jest.fn(),
      setStatus: jest.fn(() => Promise.resolve()),
      removeStatus: jest.fn(() => Promise.resolve()),
      getByStatus: jest.fn(() => []),
      getByMonth: jest.fn(() => []),
    };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    profile: {
      id: '123',
      first_name: 'Test',
      last_name: 'User',
      avatar: null,
      youtube: '',
      instagram: '',
      twitter: '',
      vk: '',
      user: 123,
    },
    setProfile: jest.fn(),
    isLoading: false,
    loadProfile: jest.fn(),
    syncAvatar: jest.fn(),
    fullName: 'Test User',
  }),
}));

jest.mock('@/hooks/useAvatarUpload', () => ({
  useAvatarUpload: () => ({
    avatarFile: null,
    avatarPreviewUrl: '',
    setAvatarPreviewUrl: jest.fn(),
    isUploading: false,
    pickAvatar: jest.fn(),
    uploadAvatar: jest.fn(),
    pickAndUpload: jest.fn(),
    handleWebFileSelected: jest.fn(),
    webFileInputRef: { current: null },
  }),
}));

jest.mock('@/api/travelsApi', () => ({
  fetchMyTravels: mockFetchMyTravels,
  unwrapMyTravelsPayload: mockUnwrapMyTravelsPayload,
}));

jest.mock('@/utils/storageBatch', () => ({
  getStorageBatch: jest.fn().mockResolvedValue({
    userName: 'Test User',
    userId: '123',
    userEmail: 'user@example.com',
  }),
  setStorageBatch: jest.fn().mockResolvedValue(undefined),
  removeStorageBatch: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-image-picker', () => ({
    launchImageLibraryAsync: jest.fn(),
    MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { FlatList } = require('react-native');

  type MockFlashListProps = ComponentProps<typeof FlatList> & {
    ListHeaderComponent?: ComponentType<unknown> | ReactElement | null;
  };

  const FlashList = ({ ListHeaderComponent, ...props }: MockFlashListProps) => {
    const header = ListHeaderComponent
      ? React.isValidElement(ListHeaderComponent)
        ? ListHeaderComponent
        : React.createElement(ListHeaderComponent)
      : null;

    return React.createElement(FlatList, {
      ...props,
      ListHeaderComponent: header,
    });
  };

  return { FlashList };
});

const ProfileScreen = require('@/app/(tabs)/profile').default;

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseFavorites = useFavorites as jest.MockedFunction<typeof useFavorites>;

const setupAuth = (overrides?: Partial<ReturnType<typeof useAuth>>) => {
  mockUseAuth.mockReturnValue(createAuthValue(overrides));
};

const setupFavorites = (favoritesLen = 2, historyLen = 5) => {
  mockUseFavorites.mockReturnValue(
    createFavoritesValue({
      favorites: Array.from({ length: favoritesLen }, (_, i) => createFavoriteItem(i + 1)),
      viewHistory: Array.from({ length: historyLen }, (_, i) => createHistoryItem(i + 1)),
    })
  );
};

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetExpoRouterMocks();
    resetTravelsApiMocks();
    mockFetchMyTravels.mockResolvedValue(require('../fixtures/travelFixtures').MY_TRAVELS_FIXTURE);
    mockTravelStatusEntries = [
      {
        id: 201,
        type: 'travel',
        title: 'Visited status route',
        url: '/travels/visited-status-route',
        country: 'Беларусь',
        status: 'visited',
        addedAt: 1,
      },
      {
        id: 202,
        type: 'travel',
        title: 'Wishlist status route',
        url: '/travels/wishlist-status-route',
        country: 'Армения',
        status: 'wishlist',
        addedAt: 2,
      },
      {
        id: 203,
        type: 'travel',
        title: 'Planned status route',
        url: '/travels/planned-status-route',
        country: 'Польша',
        status: 'planned',
        addedAt: 3,
      },
      {
        id: 204,
        type: 'travel',
        title: 'Second planned status route',
        url: '/travels/second-planned-status-route',
        country: 'Грузия',
        status: 'planned',
        addedAt: 4,
      },
    ];
  });

  const renderProfile = () => {
    return render(<ProfileScreen />, { wrapper: createQueryWrapper().Wrapper });
  };

  it('shows EmptyState when user is not authenticated', async () => {
    setupAuth({ isAuthenticated: false });
    setupFavorites(0, 0);

    const { findByText } = renderProfile();

    expect(await findByText('Войдите в аккаунт')).toBeTruthy();
    expect(await findByText('Войдите, чтобы открыть профиль и управлять своими данными.')).toBeTruthy();
  });

  it('shows profile info, quick actions and stats', async () => {
    setupAuth({ isAuthenticated: true });
    setupFavorites(2, 5);

    const { findByText, findByLabelText, getByLabelText, getAllByLabelText, queryByText } = renderProfile();

    expect(await findByText('Test User')).toBeTruthy();
    expect(await findByText('user@example.com')).toBeTruthy();

    // Quick actions
    expect(await findByText('Чаты')).toBeTruthy();
    expect(await findByText('Подписки')).toBeTruthy();

    // Header actions
    expect(await findByText('Редактировать')).toBeTruthy();
    expect(await findByText('Календарь путешествий')).toBeTruthy();
    expect(await findByText('Был')).toBeTruthy();
    expect(await findByText('Планирую')).toBeTruthy();
    expect(queryByText('По каждому путешествию')).toBeNull();

    await waitFor(() => {
      expect(getByLabelText('Маршруты: 3')).toBeTruthy();
      expect(getByLabelText('Избранное: 2')).toBeTruthy();
      expect(getByLabelText('История: 5')).toBeTruthy();
    });
    expect(getAllByLabelText('Маршруты: 3')).toHaveLength(1);
    expect(getAllByLabelText('Избранное: 2')).toHaveLength(1);
    expect(getAllByLabelText('История: 5')).toHaveLength(1);

    expect(await findByLabelText('Сохранили: 7')).toBeTruthy();
    expect(await findByLabelText('Хочу: 3')).toBeTruthy();
    expect(await findByLabelText('Планируют: 2')).toBeTruthy();
    expect(await findByLabelText('Сохранили: 0')).toBeTruthy();
  });

  it('logout works', async () => {
    const logoutMock = jest.fn().mockResolvedValue(undefined);
    setupAuth({ isAuthenticated: true, logout: logoutMock });
    setupFavorites(0, 0);

    const { getByLabelText, getByText } = renderProfile();

    // Открываем меню профиля
    await waitFor(() => getByLabelText('Меню профиля'));
    fireEvent.press(getByLabelText('Меню профиля'));

    // Ждем появления кнопки выхода (ищем по тексту)
    await waitFor(() => getByText('Выйти'));
    fireEvent.press(getByText('Выйти'));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('switches tabs and shows content', async () => {
    setupAuth({ isAuthenticated: true });
    setupFavorites(1, 1);

    const { getByLabelText, getAllByLabelText, findByLabelText } = renderProfile();

    // По умолчанию активна вкладка "Маршруты" и показываются путешествия пользователя
    expect(await findByLabelText(/My Travel 1/)).toBeTruthy();

    fireEvent.press(getByLabelText('Избранное: 1'));
    expect(await findByLabelText(/Fav 1/)).toBeTruthy();
    expect(getAllByLabelText('Хочу: 0').length).toBeGreaterThan(0);
    expect(getAllByLabelText('Планируют: 0').length).toBeGreaterThan(0);

    fireEvent.press(getByLabelText('История: 1'));
    expect(await findByLabelText(/History 1/)).toBeTruthy();
  });

  it('filters profile list by clicked calendar status metric', async () => {
    setupAuth({ isAuthenticated: true });
    setupFavorites(0, 0);

    const { getByLabelText, findByLabelText, queryByLabelText } = renderProfile();

    expect(await findByLabelText(/My Travel 1/)).toBeTruthy();

    fireEvent.press(getByLabelText('Хочу: 1'));

    expect(await findByLabelText(/Wishlist status route/)).toBeTruthy();
    expect(queryByLabelText(/Visited status route/)).toBeNull();
    expect(queryByLabelText(/Planned status route/)).toBeNull();

    fireEvent.press(getByLabelText('Планирую: 2'));

    expect(await findByLabelText(/Planned status route/)).toBeTruthy();
    expect(await findByLabelText(/Second planned status route/)).toBeTruthy();
    expect(queryByLabelText(/Wishlist status route/)).toBeNull();
  });
});
