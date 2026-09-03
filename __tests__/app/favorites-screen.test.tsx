import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';

import FavoritesScreen from '@/app/(tabs)/favorites';

const mockUseAuth = jest.fn();
const mockUseFavorites = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockRefreshFavoritesFromServer = jest.fn();

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => mockUseFavorites(),
}));

jest.mock('@/hooks/useFavoritesData', () => ({
  refreshFavoritesFromServer: (...args: unknown[]) => mockRefreshFavoritesFromServer(...args),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
  }),
}));

// Ширина реальная: от неё зависит не только сетка, но и владелец «Назад» —
// мобильную ветку HeaderContextBar выбирает isPhone/isLargePhone (#1726).
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => {
    const override = (global as any).__mockResponsive ?? { width: 390 };
    const width = override.width ?? 390;
    return {
      isPhone: width >= 360 && width < 480,
      isLargePhone: width >= 480 && width < 768,
      ...override,
    };
  },
}));

jest.mock('@/utils/authNavigation', () => ({
  buildLoginHref: jest.fn(() => '/login'),
}));

jest.mock('@/utils/confirmAction', () => ({
  confirmAction: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@/components/seo/LazyInstantSEO', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement(React.Fragment, null),
  };
});

jest.mock('@/components/listTravel/TabTravelCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, { testID: `tab-travel-card-${String(props?.item?.id ?? 'unknown')}` }),
  };
});

describe('FavoritesScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPush.mockClear();
    mockBack.mockClear();
    mockRefreshFavoritesFromServer.mockReset();

    mockUseAuth.mockReturnValue({ isAuthenticated: true, authReady: true, userId: '104' });
    mockUseFavorites.mockReturnValue({
      favorites: [],
      removeFavorite: jest.fn(),
      clearFavorites: jest.fn(),
    });
  });

  const prevOS = Platform.OS;
  const setPlatform = (os: string) => {
    (Platform.OS as any) = os;
  };

  afterEach(() => {
    (Platform.OS as any) = prevOS;
    jest.useRealTimers();
    jest.clearAllMocks();
    delete (global as any).__mockResponsive;
  });

  it('shows login prompt when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, authReady: true });

    const { getByText } = render(<FavoritesScreen />);

    expect(getByText('Войдите в аккаунт')).toBeTruthy();
  });

  it('shows empty state when favorites are empty', async () => {
    const utils = render(<FavoritesScreen />);

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    expect(utils.getByText('В «Хочу поехать» пока пусто')).toBeTruthy();
    expect(utils.getByText('Нажмите ♥ на карточке маршрута, чтобы добавить место, куда хотите поехать.')).toBeTruthy();
  });

  it('goes back when "Назад" is pressed', async () => {
    setPlatform('web');
    mockUseFavorites.mockReturnValue({
      favorites: [
        { id: 1, type: 'travel', title: 'T1', url: '/travels/1', imageUrl: null, city: null, countryName: 'Belarus' },
      ],
      removeFavorite: jest.fn(),
      clearFavorites: jest.fn(),
    });

    const utils = render(<FavoritesScreen />);

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    fireEvent.press(utils.getByText('Назад'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  // #1725: на прямом входе по ссылке истории нет, и голый router.back() на web
  // уводит с сайта — «Назад» обязан привести на /profile.
  it('falls back to the profile screen when there is no history to pop', async () => {
    setPlatform('web');
    mockCanGoBack.mockReturnValueOnce(false);
    mockUseFavorites.mockReturnValue({
      favorites: [
        { id: 1, type: 'travel', title: 'T1', url: '/travels/1', imageUrl: null, city: null, countryName: 'Belarus' },
      ],
      removeFavorite: jest.fn(),
      clearFavorites: jest.fn(),
    });

    const utils = render(<FavoritesScreen />);

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    fireEvent.press(utils.getByText('Назад'));

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/profile');
  });

  // #1726 / NATIVE-DUP-BACK-AFFORDANCE-001: на native «Назад» рисует глобальный
  // HeaderContextBar, и своя шапка обязана молчать во ВСЕХ состояниях экрана —
  // раньше загрузка и список рисовали второй «Назад».
  it.each(['android', 'ios'])('%s: ни в загрузке, ни в списке нет второго «Назад», «Очистить» остаётся', async (os) => {
    setPlatform(os);
    mockUseFavorites.mockReturnValue({
      favorites: [
        { id: 1, type: 'travel', title: 'T1', url: '/travels/1', imageUrl: null, city: null, countryName: 'Belarus' },
      ],
      removeFavorite: jest.fn(),
      clearFavorites: jest.fn(),
    });

    const utils = render(<FavoritesScreen />);
    // состояние загрузки — до таймера
    expect(utils.queryByText('Назад')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    // основной список
    expect(utils.queryByText('Назад')).toBeNull();
    expect(utils.getByTestId('favorites-native-clear')).toBeTruthy();
  });

  // Обратная сторона того же инварианта: на планшете и в ландшафте телефона
  // глобальный бар уходит в desktop-ветку и «Назад» не рисует вовсе, поэтому
  // своя шапка обязана остаться — иначе экран без навигации назад.
  it('android: в ландшафте/на планшете своя шапка остаётся единственной навигацией', async () => {
    setPlatform('android');
    (global as any).__mockResponsive = { width: 900 };
    mockUseFavorites.mockReturnValue({
      favorites: [
        { id: 1, type: 'travel', title: 'T1', url: '/travels/1', imageUrl: null, city: null, countryName: 'Belarus' },
      ],
      removeFavorite: jest.fn(),
      clearFavorites: jest.fn(),
    });

    const utils = render(<FavoritesScreen />);

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    expect(utils.getAllByText('Назад')).toHaveLength(1);
    expect(utils.queryByTestId('favorites-native-clear')).toBeNull();
  });

  it('web: в загрузке и в списке своя шапка с «Назад» есть', async () => {
    setPlatform('web');
    mockUseFavorites.mockReturnValue({
      favorites: [
        { id: 1, type: 'travel', title: 'T1', url: '/travels/1', imageUrl: null, city: null, countryName: 'Belarus' },
      ],
      removeFavorite: jest.fn(),
      clearFavorites: jest.fn(),
    });

    const utils = render(<FavoritesScreen />);
    expect(utils.getAllByText('Назад')).toHaveLength(1);

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    expect(utils.getAllByText('Назад')).toHaveLength(1);
    expect(utils.queryByTestId('favorites-native-clear')).toBeNull();
  });

  it('runs the real server refresh for native pull-to-refresh', async () => {
    mockUseFavorites.mockReturnValue({
      favorites: [
        { id: 1, type: 'travel', title: 'T1', url: '/travels/1', imageUrl: null, city: null, countryName: 'Belarus' },
      ],
      removeFavorite: jest.fn(),
      clearFavorites: jest.fn(),
    });
    mockRefreshFavoritesFromServer.mockRejectedValueOnce(new Error('offline'));

    const utils = render(<FavoritesScreen />);
    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    const list = utils.UNSAFE_getByType(FlashList);
    await act(async () => {
      await list.props.onRefresh();
    });

    expect(mockRefreshFavoritesFromServer).toHaveBeenCalledWith('104');
    expect(utils.UNSAFE_getByType(FlashList).props.refreshing).toBe(false);
  });
});
