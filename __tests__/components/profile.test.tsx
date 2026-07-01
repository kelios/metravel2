import type { ComponentProps, ComponentType, ReactElement } from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import type { MyAchievements, UserRank } from '@/api/achievements';
import { mockPush, mockReplace, mockUseRouter, resetExpoRouterMocks } from '../helpers/expoRouterMock';
import { createQueryWrapper } from '../helpers/testQueryClient';
import { mockFetchMyTravels, mockUnwrapMyTravelsPayload, resetTravelsApiMocks } from '../helpers/mockTravelsApi';
import {
  createAuthValue,
  createFavoriteItem,
  createFavoritesValue,
  createHistoryItem,
} from '../helpers/mockContextValues';

jest.mock('@/context/AuthContext');

jest.setTimeout(15000);

let mockMyAchievementsData: MyAchievements | null = null;

jest.mock('@/hooks/useAchievementsApi', () => ({
  useMyAchievements: jest.fn(() => ({
    data: mockMyAchievementsData,
    isFetching: false,
    isSuccess: Boolean(mockMyAchievementsData),
  })),
}));

jest.mock('expo-router', () => ({
  useRouter: mockUseRouter,
  usePathname: jest.fn().mockReturnValue('/profile'),
  useIsFocused: jest.fn().mockReturnValue(true),
}));

const mockFetchUserCountryProgress = jest.fn();

jest.mock('@/api/user', () => ({
  fetchUserProfile: jest.fn().mockResolvedValue({
    id: '123',
    first_name: 'Test',
    last_name: 'User',
    avatar: null,
  }),
  uploadUserProfileAvatarFile: jest.fn(),
  fetchUserTravelStatuses: jest.fn().mockResolvedValue([]),
  fetchUserCountryProgress: mockFetchUserCountryProgress,
  normalizeAvatar: (raw: unknown) => {
    const str = String(raw ?? '').trim();
    if (!str) return null;
    const lower = str.toLowerCase();
    if (lower === 'null' || lower === 'undefined') return null;
    return str;
  },
}));

const mockLoadTravelStatuses = jest.fn(() => Promise.resolve());
const mockFetchAllCountries = jest.fn();
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

jest.mock('@/api/misc', () => ({
  fetchAllCountries: mockFetchAllCountries,
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

// Профиль тянет подписки и непрочитанные сообщения через React Query — мокаем,
// чтобы не требовать сетевых queryFn в тесте.
jest.mock('@/hooks/useSubscriptionsData', () => ({
  useSubscriptionsData: () => ({ subscriptions: [], subscribers: [], isLoading: false }),
}));

jest.mock('@/hooks/useMessages', () => ({
  useUnreadCount: () => ({ count: 0 }),
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

const makeRank = (overrides: Partial<UserRank> = {}): UserRank => ({
  level: 1,
  title: 'Новичок',
  totalPoints: 0,
  badgesCount: 0,
  currentLevelMinPoints: 0,
  nextLevelMinPoints: 100,
  nextLevelTitle: 'Путешественник',
  isMaxLevel: false,
  ...overrides,
});

const makeAchievements = (rankOverrides: Partial<UserRank> = {}): MyAchievements => ({
  rank: makeRank(rankOverrides),
  earned: [],
  locked: [],
  recentlyEarned: [],
});

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
    mockFetchAllCountries.mockResolvedValue([
      { country_id: '1', title_ru: 'Польша', title_en: 'Poland', country_code: 'PL' },
      { country_id: '2', title_ru: 'Литва', title_en: 'Lithuania', country_code: 'LT' },
      { country_id: '3', title_ru: 'Беларусь', title_en: 'Belarus', country_code: 'BY' },
      { country_id: '4', title_ru: 'Германия', title_en: 'Germany', country_code: 'DE' },
    ]);
    mockFetchUserCountryProgress.mockResolvedValue({
      total_count: 4,
      visited_count: 3,
      remaining_count: 1,
      countries: [
        {
          country_id: 1,
          country_code: 'PL',
          region: 'europe',
          title_ru: 'Польша',
          title_en: 'Poland',
          visited: true,
          visited_travels_count: 2,
          first_visited_date: '2024-05-12',
        },
        {
          country_id: 2,
          country_code: 'LT',
          region: 'europe',
          title_ru: 'Литва',
          title_en: 'Lithuania',
          visited: true,
          visited_travels_count: 1,
          first_visited_date: '2024-05-12',
        },
        {
          country_id: 3,
          country_code: 'BY',
          region: 'europe',
          title_ru: 'Беларусь',
          title_en: 'Belarus',
          visited: true,
          visited_travels_count: 1,
          first_visited_date: '2024-05-12',
        },
        {
          country_id: 4,
          country_code: 'DE',
          region: 'europe',
          title_ru: 'Германия',
          title_en: 'Germany',
          visited: false,
          visited_travels_count: 0,
          first_visited_date: null,
        },
      ],
    });
    mockMyAchievementsData = null;
    mockTravelStatusEntries = [];
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

    const { findByText, findByLabelText, findAllByLabelText, findAllByText, getByLabelText, getAllByLabelText, queryByText } = renderProfile();

    expect(await findByText('Test User')).toBeTruthy();
    expect(await findByText('user@example.com')).toBeTruthy();

    // Вкладка "Обзор" (по умолчанию): быстрые действия + пилюли + кнопка edit
    expect(await findByText('Чаты')).toBeTruthy();
    expect(await findByText('Подписки')).toBeTruthy(); // пилюля-счётчик
    expect(await findByLabelText('Меню профиля')).toBeTruthy();
    expect(await findByText('Календарь')).toBeTruthy();

    // Счётчики во вкладках
    await waitFor(() => {
      expect(getByLabelText('Мои маршруты: 3')).toBeTruthy();
      expect(getByLabelText('Сохранённое: 2')).toBeTruthy();
      expect(getByLabelText('Недавно смотрел: 5')).toBeTruthy();
    });
    expect(getAllByLabelText('Мои маршруты: 3')).toHaveLength(1);
    expect(getAllByLabelText('Сохранённое: 2')).toHaveLength(1);
    expect(getAllByLabelText('Недавно смотрел: 5')).toHaveLength(1);

    // Статистика автора и личный календарь живут во вкладке "Статистика"
    fireEvent.press(getByLabelText('Статистика профиля'));
    expect(await findByText('Личный календарь')).toBeTruthy();
    expect(await findByText('Мои статусы поездок')).toBeTruthy();
    expect((await findAllByText('Были')).length).toBeGreaterThan(0);
    expect(await findByText('Планируют')).toBeTruthy();
    expect(queryByText('По каждому путешествию')).toBeNull();
    expect(queryByText(/Когда backend начнёт отдавать/i)).toBeNull();

    expect(await findByLabelText('Сохранили: 8')).toBeTruthy();
    expect((await findAllByLabelText('Были: 3')).length).toBeGreaterThan(0);
    expect((await findAllByLabelText('Планируют: 7')).length).toBeGreaterThan(0);
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

    const { getByLabelText, findByLabelText } = renderProfile();

    // По умолчанию активна вкладка "Обзор"; переключаемся на "Маршруты"
    fireEvent.press(await findByLabelText('Мои маршруты: 3'));
    expect(await findByLabelText(/My Travel 1/)).toBeTruthy();

    fireEvent.press(getByLabelText('Сохранённое: 1'));
    expect(await findByLabelText(/Fav 1/)).toBeTruthy();

    fireEvent.press(getByLabelText('Недавно смотрел: 1'));
    expect(await findByLabelText(/History 1/)).toBeTruthy();
  });

  it('shows countries progress with visited and remaining countries', async () => {
    setupAuth({ isAuthenticated: true });
    setupFavorites(0, 0);
    mockTravelStatusEntries = [
      {
        id: 501,
        type: 'travel',
        title: 'Минск',
        url: '/travels/minsk',
        country: 'Беларусь',
        status: 'visited',
        addedAt: 1,
      },
      {
        id: 502,
        type: 'travel',
        title: 'Берлин',
        url: '/travels/berlin',
        country: 'Германия',
        status: 'wishlist',
        addedAt: 2,
      },
    ];

    const { findByLabelText, findByText, findAllByText, getAllByText } = renderProfile();

    fireEvent.press(await findByLabelText('Страны профиля'));

    expect((await findAllByText('Посетили')).length).toBeGreaterThan(0);
    expect(await findByText('Статистика по странам')).toBeTruthy();
    expect((await findAllByText('12 мая 2024')).length).toBeGreaterThan(0);
    expect(getAllByText('2 раза').length).toBeGreaterThan(0);
    expect(await findByText('Прогресс по регионам')).toBeTruthy();
    expect(getAllByText('Европа').length).toBeGreaterThan(0);
    expect(await findByText('75%')).toBeTruthy();
    expect(await findByLabelText('Польша: посещена')).toBeTruthy();
    expect(await findByLabelText('Литва: посещена')).toBeTruthy();
    expect(await findByLabelText('Беларусь: посещена')).toBeTruthy();
    expect(await findByLabelText('Германия: не посещена')).toBeTruthy();
    expect(mockFetchUserCountryProgress).toHaveBeenCalledWith('123');
    expect(mockFetchAllCountries).not.toHaveBeenCalled();
  });

  it('filters profile list by clicked author engagement metric', async () => {
    setupAuth({ isAuthenticated: true });
    setupFavorites(0, 0);

    const { getByLabelText, findAllByLabelText, findByLabelText, queryByLabelText } = renderProfile();

    // Метрики статистики автора живут во вкладке "Статистика".
    // Клик по метрике — drill-down: переключает на "Маршруты" с фильтром.
    fireEvent.press(await findByLabelText('Статистика профиля'));
    fireEvent.press((await findAllByLabelText('Были: 3'))[0]);

    expect(await findByLabelText(/My Travel 1/)).toBeTruthy();
    expect(queryByLabelText(/My Travel 2/)).toBeNull();
    expect(queryByLabelText(/My Travel 3/)).toBeNull();

    // Смена метрики — возврат на "Статистика" и выбор другой метрики.
    fireEvent.press(getByLabelText('Статистика профиля'));
    fireEvent.press((await findAllByLabelText('Планируют: 7'))[0]);

    expect(await findByLabelText(/My Travel 1/)).toBeTruthy();
    expect(await findByLabelText(/My Travel 2/)).toBeTruthy();
    expect(queryByLabelText(/My Travel 3/)).toBeNull();
  });

  it('shows first-step CTAs for a zero-progress profile and navigates from them', async () => {
    setupAuth({ isAuthenticated: true });
    setupFavorites(0, 0);
    mockFetchMyTravels.mockResolvedValue({ total: 0, count: 0, data: [], results: [] });
    mockMyAchievementsData = makeAchievements();

    const { findByLabelText, findByText } = renderProfile();

    fireEvent.press(await findByLabelText('Обзор профиля'));
    expect(await findByText('С чего начать')).toBeTruthy();

    fireEvent.press(await findByLabelText('Создать первый маршрут'));
    expect(mockPush).toHaveBeenCalledWith('/travel/new');

    fireEvent.press(await findByLabelText('Начать первый квест'));
    expect(mockPush).toHaveBeenCalledWith('/quests');
  });

  it('hides first-step CTAs when achievements already have progress', async () => {
    setupAuth({ isAuthenticated: true });
    setupFavorites(0, 0);
    mockFetchMyTravels.mockResolvedValue({ total: 0, count: 0, data: [], results: [] });
    mockMyAchievementsData = makeAchievements({ totalPoints: 25, badgesCount: 1 });

    const { queryByText } = renderProfile();

    await waitFor(() => {
      expect(queryByText('С чего начать')).toBeNull();
    });
  });
});
