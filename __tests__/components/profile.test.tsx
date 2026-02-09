import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';

jest.mock('@/context/AuthContext');

jest.setTimeout(15000);


const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

jest.mock('@/api/user', () => ({
  fetchUserProfile: jest.fn().mockResolvedValue({
    id: '123',
    first_name: 'Test',
    last_name: 'User',
    avatar: null,
  }),
  uploadUserProfileAvatarFile: jest.fn(),
  normalizeAvatar: (raw: unknown) => {
    const str = String(raw ?? '').trim();
    if (!str) return null;
    const lower = str.toLowerCase();
    if (lower === 'null' || lower === 'undefined') return null;
    return str;
  },
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
  fetchMyTravels: jest.fn().mockResolvedValue([
    { id: 101, title: 'My Travel 1' },
    { id: 102, title: 'My Travel 2' },
    { id: 103, title: 'My Travel 3' },
  ]),
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

  const FlashList = ({ ListHeaderComponent, ...props } /* : any */) => {
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
  mockUseAuth.mockReturnValue({
    isAuthenticated: true,
    authReady: true,
    logout: jest.fn().mockResolvedValue(undefined),
    userId: '123',
    username: 'Test User',
    isSuperuser: false,
    user: { id: '123', name: 'Test User', email: 'user@example.com' },
    setUserAvatar: jest.fn(),
    triggerProfileRefresh: jest.fn(),
    setIsAuthenticated: jest.fn(),
    setUsername: jest.fn(),
    setIsSuperuser: jest.fn(),
    setUserId: jest.fn(),
    login: jest.fn(),
    sendPassword: jest.fn(),
    setNewPassword: jest.fn(),
    ...(overrides || {}),
  } as any);
};

const setupFavorites = (favoritesLen = 2, historyLen = 5) => {
  mockUseFavorites.mockReturnValue({
    favorites: new Array(favoritesLen).fill(null).map((_, i) => ({
      id: i + 1,
      type: 'travel',
      title: `Fav ${i + 1}`,
      url: `/travels/${i + 1}`,
      addedAt: Date.now(),
    })),
    viewHistory: new Array(historyLen).fill(null).map((_, i) => ({
      id: i + 1,
      type: 'travel',
      title: `History ${i + 1}`,
      url: `/travels/${i + 1}`,
      viewedAt: Date.now(),
    })),
    addFavorite: jest.fn(),
    removeFavorite: jest.fn(),
    isFavorite: jest.fn(),
    addToHistory: jest.fn(),
    clearHistory: jest.fn(),
    getRecommendations: jest.fn(),
  } as any);
};

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows EmptyState when user is not authenticated', async () => {
    setupAuth({ isAuthenticated: false });
    setupFavorites(0, 0);

    const { findByText } = render(<ProfileScreen />);

    expect(await findByText('Войдите в аккаунт')).toBeTruthy();
    expect(await findByText('Войдите, чтобы открыть профиль и управлять своими данными.')).toBeTruthy();
  });

  it('shows profile info, quick actions and stats', async () => {
    setupAuth({ isAuthenticated: true });
    setupFavorites(2, 5);

    const { findByText, getAllByText } = render(<ProfileScreen />);

    expect(await findByText('Test User')).toBeTruthy();
    expect(await findByText('user@example.com')).toBeTruthy();

    // Quick actions
    expect(await findByText('Чаты')).toBeTruthy();
    expect(await findByText('Подписки')).toBeTruthy();

    // Header actions
    expect(await findByText('Редактировать')).toBeTruthy();

    await waitFor(() => {
      const travelsCounts = getAllByText('3');
      expect(travelsCounts.length).toBeGreaterThan(0);

      const favCounts = getAllByText('2');
      expect(favCounts.length).toBeGreaterThan(0);

      const viewCounts = getAllByText('5');
      expect(viewCounts.length).toBeGreaterThan(0);
    });
  });

  it('logout works', async () => {
    const logoutMock = jest.fn().mockResolvedValue(undefined);
    setupAuth({ isAuthenticated: true, logout: logoutMock });
    setupFavorites(0, 0);

    const { getByLabelText, getByText } = render(<ProfileScreen />);

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

    const { getAllByText } = render(<ProfileScreen />);

    await waitFor(() => {
      expect(getAllByText('My Travel 1').length).toBeGreaterThan(0);
    });

    const favCandidates = getAllByText('Избранное');
    fireEvent.press(favCandidates[favCandidates.length - 1]);
    await waitFor(() => expect(getAllByText('Fav 1').length).toBeGreaterThan(0));

    const historyCandidates = getAllByText('История');
    fireEvent.press(historyCandidates[historyCandidates.length - 1]);
    await waitFor(() => expect(getAllByText('History 1').length).toBeGreaterThan(0));
  });
});
