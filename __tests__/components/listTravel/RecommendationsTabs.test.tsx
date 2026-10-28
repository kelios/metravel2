import { getOnlyHost } from '@/__tests__/helpers/hostQueries'
import React from 'react';
import { Animated, Platform } from 'react-native';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import { getTabRoles } from '@/utils/a11yTabRoles';
import RecommendationsTabs from '@/components/listTravel/RecommendationsTabs';
import {
  getConfirmDialogRequest,
  resolveConfirmDialog,
  subscribeConfirmDialog,
} from '@/components/ui/confirmDialogStore';

const mockPush = jest.fn();
const mockUseResponsive: jest.Mock<any, any> = jest.fn(() => ({ isMobile: false }));

const mockUseAuth: jest.Mock<any, any> = jest.fn(() => ({ isAuthenticated: false }));
const mockUseFavorites: jest.Mock<any, any> = jest.fn(() => ({
  favorites: [] as any[],
  viewHistory: [] as any[],
  clearFavorites: jest.fn(),
  clearHistory: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => mockUseFavorites(),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockUseResponsive(),
}));

jest.mock('@/components/travel/WeeklyHighlights', () => ({
  __esModule: true,
  default: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'WeeklyHighlights');
  },
}));

jest.mock('@/components/travel/PersonalizedRecommendations', () => ({
  __esModule: true,
  default: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, 'PersonalizedRecommendations');
  },
}));

const mockTabTravelCard = jest.fn(({ item, onPress }: any) => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return React.createElement(
    Pressable,
    { accessibilityRole: 'button', onPress },
    React.createElement(Text, null, String(item?.title ?? 'card'))
  );
});

jest.mock('@/components/listTravel/TabTravelCard', () => ({
  __esModule: true,
  default: (props: any) => mockTabTravelCard(props),
}));

describe('RecommendationsTabs', () => {
  const originalPlatform = Platform.OS;

  // #1556: подтверждение очистки больше не идёт через нативный `window.confirm`
  // (он морозил вкладку) — запрос уходит в общий `ConfirmDialogHost`. В тесте
  // подписчик стора играет роль смонтированного хоста.
  let unmountConfirmHost: (() => void) | null = null;
  const mountConfirmHost = () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    unmountConfirmHost = subscribeConfirmDialog(() => {});
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    mockUseResponsive.mockReturnValue({ isMobile: false });
    mockUseFavorites.mockReturnValue({
      favorites: [] as any[],
      viewHistory: [] as any[],
      clearFavorites: jest.fn(),
      clearHistory: jest.fn(),
    });

    jest.spyOn(Animated, 'spring').mockReturnValue({
      start: (cb?: any) => cb?.(),
    } as any);
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true });
    unmountConfirmHost?.();
    unmountConfirmHost = null;
    // Хвост незакрытого диалога не должен утекать в соседний тест.
    resolveConfirmDialog(false);
    jest.restoreAllMocks();
  });


  it.each(['web', 'ios', 'android'] as const)('the expanded consumer row owns its tabs and selection on %s', async os => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
    mockUseResponsive.mockReturnValue({ isMobile: false });
    const view = await render(<RecommendationsTabs forceVisible={true} />);
    await screen.findByText('WeeklyHighlights');
    const roles = getTabRoles();
    const getRow = () => getOnlyHost(view.container, node => node.props.accessibilityRole === roles.tablist && node.type === 'RCTScrollView');
    const row = getRow();
    expect(row).toBeDefined();
    expect(within(row).getAllByRole(roles.tab)).toHaveLength(4);
    expect(within(row).getAllByRole(roles.tab).filter(tab => tab.props.accessibilityState?.selected)).toHaveLength(1);
    await fireEvent.press(view.getByLabelText('Хочу поехать'));
    expect(within(getRow()).getAllByRole(roles.tab).filter(tab => tab.props.accessibilityState?.selected).map(tab => tab.props.accessibilityLabel)).toEqual(['Хочу поехать']);
  });

  it('renders default tab (highlights) content', async () => {
    const { getByTestId } = await render(<RecommendationsTabs forceVisible={true} />);

    expect(await screen.findByText('WeeklyHighlights')).toBeTruthy();
    expect(getByTestId('recommendations-tabpanel-highlights')).toBeTruthy();
  });

  it('shows auth gate for favorites when user is not authenticated and navigates to login', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });

    await render(<RecommendationsTabs forceVisible={true} />);

    await fireEvent.press(screen.getByLabelText('Хочу поехать'));

    expect(
      await screen.findByText(/«Хочу поехать» будет доступно после регистрации или авторизации/i)
    ).toBeTruthy();

    await fireEvent.press(screen.getByText('Войти'));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/login'));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('intent=favorites'));
  });

  it('shows empty favorites state when authenticated but favorites are empty', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseFavorites.mockReturnValue({
      favorites: [],
      viewHistory: [],
      clearFavorites: jest.fn(),
      clearHistory: jest.fn(),
    });

    await render(<RecommendationsTabs forceVisible={true} />);

    await fireEvent.press(screen.getByLabelText('Хочу поехать'));

    expect(await screen.findByText('В «Хочу поехать» пока пусто')).toBeTruthy();
  });

  it('renders favorites list and clears favorites after confirmation', async () => {
    const clearFavorites = jest.fn(async () => undefined);

    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseFavorites.mockReturnValue({
      favorites: [
        {
          id: 1,
          type: 'travel',
          title: 'Fav 1',
          url: '/travels/1',
          imageUrl: 'https://example.com/1.jpg',
        },
      ],
      viewHistory: [],
      clearFavorites,
      clearHistory: jest.fn(),
    });

    const nativeConfirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    mountConfirmHost();

    await render(<RecommendationsTabs forceVisible={true} />);

    await fireEvent.press(screen.getByLabelText('Хочу поехать'));

    expect(await screen.findByText('Fav 1')).toBeTruthy();
    expect(screen.getByTestId('recommendations-tabpanel-favorites')).toBeTruthy();
    expect(screen.getByTestId('recommendations-favorites-rail')).toBeTruthy();
    expect(screen.getByText('Смотреть все')).toBeTruthy();
    expect(screen.getByText('Очистить')).toBeTruthy();

    // onPress ждёт confirmAction. Ответ хоста должен прийти до await, иначе press не завершится.
    const clearPress = fireEvent.press(screen.getByLabelText('Очистить «Хочу поехать»'));
    expect(getConfirmDialogRequest()).toMatchObject({
      message: 'Очистить «Хочу поехать»?',
    });
    expect(nativeConfirm).not.toHaveBeenCalled();
    expect(clearFavorites).not.toHaveBeenCalled();

    resolveConfirmDialog(true);
    await clearPress;
    expect(clearFavorites).toHaveBeenCalledTimes(1);
  });

  it('does not clear favorites when the confirmation is dismissed', async () => {
    const clearFavorites = jest.fn();
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseFavorites.mockReturnValue({
      favorites: [
        {
          id: 1,
          type: 'travel',
          title: 'Fav 1',
          url: '/travels/1',
          imageUrl: 'https://example.com/1.jpg',
        },
      ],
      viewHistory: [],
      clearFavorites,
      clearHistory: jest.fn(),
    });

    mountConfirmHost();
    await render(<RecommendationsTabs forceVisible={true} />);

    await fireEvent.press(screen.getByLabelText('Хочу поехать'));
    expect(await screen.findByText('Fav 1')).toBeTruthy();

    const clearPress = fireEvent.press(screen.getByLabelText('Очистить «Хочу поехать»'));
    expect(getConfirmDialogRequest()).not.toBeNull();

    // Отмена и Escape резолвят `false` — список остаётся нетронутым.
    resolveConfirmDialog(false);
    await clearPress;

    expect(getConfirmDialogRequest()).toBeNull();
    expect(clearFavorites).not.toHaveBeenCalled();
  });

  it('renders both favorites and history shelves on mobile with definite-width cards', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseResponsive.mockReturnValue({ isMobile: true });
    mockUseFavorites.mockReturnValue({
      favorites: [
        {
          id: 1,
          type: 'travel',
          title: 'Fav 1',
          url: '/travels/1',
          imageUrl: 'https://example.com/1.jpg',
        },
      ],
      viewHistory: [
        {
          id: 2,
          type: 'travel',
          title: 'Hist 1',
          url: '/travels/2',
          imageUrl: 'https://example.com/2.jpg',
          viewedAt: 1700000000000,
        },
      ],
      clearFavorites: jest.fn(),
      clearHistory: jest.fn(),
    });

    await render(<RecommendationsTabs forceVisible={true} />);

    // Mobile renders shelves directly (no chip-tabs): both shelves must appear up
    // front whenever the user actually has favorites + history.
    expect(await screen.findByTestId('recommendations-favorites-shelf')).toBeTruthy();
    expect(await screen.findByTestId('recommendations-history-shelf')).toBeTruthy();
    expect(await screen.findByText('Fav 1')).toBeTruthy();
    expect(await screen.findByText('Hist 1')).toBeTruthy();
    expect(screen.getByTestId('recommendations-favorites-rail')).toBeTruthy();
    expect(screen.getByTestId('recommendations-history-rail')).toBeTruthy();

    // Native regression: shelf rail is a horizontal ScrollView whose height comes
    // from card intrinsic size. Cards must carry a definite numeric width (not the
    // grid `width:'100%'` that collapses to 0 inside a horizontal ScrollView).
    const railCalls = mockTabTravelCard.mock.calls.map((c) => c[0]);
    expect(railCalls.length).toBeGreaterThanOrEqual(2);
    for (const props of railCalls) {
      expect(props?.layout).toBe('horizontal');
      expect(typeof props?.width).toBe('number');
      expect(props?.width).toBeGreaterThan(0);
    }
  });

  it('does not render favorites/history shelves on mobile when collections are empty', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockUseResponsive.mockReturnValue({ isMobile: true });
    mockUseFavorites.mockReturnValue({
      favorites: [] as any[],
      viewHistory: [] as any[],
      clearFavorites: jest.fn(),
      clearHistory: jest.fn(),
    });

    await render(<RecommendationsTabs forceVisible={true} />);

    expect(await screen.findByText('WeeklyHighlights')).toBeTruthy();
    expect(screen.queryByTestId('recommendations-favorites-shelf')).toBeNull();
    expect(screen.queryByTestId('recommendations-history-shelf')).toBeNull();
  });

  it('collapses and expands and calls onVisibilityChange', async () => {
    const onVisibilityChange = jest.fn();

    const { getByTestId } = await render(
      <RecommendationsTabs forceVisible={false} onVisibilityChange={onVisibilityChange} />
    );
    const collapseTrigger = getByTestId('recommendations-tabs-collapse');
    await fireEvent.press(collapseTrigger);

    await waitFor(() => {
      expect(onVisibilityChange).toHaveBeenCalledWith(false);
    });

    expect(await screen.findByText('Показать рекомендации')).toBeTruthy();

    await fireEvent.press(screen.getByText('Показать рекомендации'));

    await waitFor(() => {
      expect(onVisibilityChange).toHaveBeenCalledWith(true);
    });
  });
});
