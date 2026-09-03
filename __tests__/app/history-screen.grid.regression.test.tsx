import { render, act, fireEvent } from '@testing-library/react-native';
import { FlashList } from '@shopify/flash-list';

import HistoryScreen from '@/app/(tabs)/history';

const mockUseAuth = jest.fn();
const mockUseFavorites = jest.fn();

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => mockUseFavorites(),
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

const tabTravelCardProps: any[] = [];

jest.mock('@/components/listTravel/TabTravelCard', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: (props: any) => {
      tabTravelCardProps.push(props);
      return React.createElement(View, { testID: `tab-travel-card-${String(props?.item?.id ?? 'unknown')}` });
    },
  };
});

describe('HistoryScreen grid regression', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    tabTravelCardProps.length = 0;

    mockUseAuth.mockReturnValue({ isAuthenticated: true, authReady: true, userId: '42' });
    mockUseFavorites.mockReturnValue({
      viewHistory: [
        {
          id: 1,
          type: 'travel',
          title: 'T1',
          url: '/travels/1',
          imageUrl: null,
          city: null,
          countryName: 'Belarus',
          viewedAt: 'now',
        },
      ],
      clearHistory: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    delete (global as any).__mockResponsive;
  });

  const renderLoaded = async () => {
    const utils = render(<HistoryScreen />);

    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    return utils;
  };

  it('uses 1 column on narrow widths', async () => {
    (global as any).__mockResponsive = { width: 500 };

    const utils = await renderLoaded();
    const list = utils.UNSAFE_getByType(FlashList);

    expect(list.props.numColumns).toBe(1);
  });

  it('uses 2 columns on medium widths', async () => {
    (global as any).__mockResponsive = { width: 700 };

    const utils = await renderLoaded();
    const list = utils.UNSAFE_getByType(FlashList);

    expect(list.props.numColumns).toBe(2);
  });

  it('uses up to 3 columns on wide widths and renders TabTravelCard with layout="grid"', async () => {
    (global as any).__mockResponsive = { width: 1100 };

    const utils = await renderLoaded();
    const list = utils.UNSAFE_getByType(FlashList);

    expect(list.props.numColumns).toBe(3);

    expect(tabTravelCardProps.length).toBeGreaterThan(0);
    expect(tabTravelCardProps[0]?.layout).toBe('grid');
  });

  it('renders the dynamic history subtitle for populated state', async () => {
    (global as any).__mockResponsive = { width: 900 };

    const utils = await renderLoaded();

    expect(utils.getByText('1 элемент в истории')).toBeTruthy();
    expect(utils.getByText('Последнее: T1')).toBeTruthy();
  });

  it('opens the latest viewed item from the summary CTA', async () => {
    const { router } = require('expo-router');
    (global as any).__mockResponsive = { width: 900 };

    const utils = await renderLoaded();

    fireEvent.press(utils.getByLabelText('Продолжить с последнего'));

    expect(router.push).toHaveBeenCalledWith('/travels/1');
  });
});
