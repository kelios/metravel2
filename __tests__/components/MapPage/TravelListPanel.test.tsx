import { render, fireEvent } from '@testing-library/react-native';
import { View, Text } from 'react-native';

// Переопределяем react-native для десктопного web-контекста
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: {
      ...RN.Platform,
      OS: 'web',
      select: (obj: any) => obj.web ?? obj.default,
    },
    useWindowDimensions: () => ({ width: 1024, height: 768 }),
  };
});

const mockAddressListItem = jest.fn((props: any) => {
  // Имитируем простую RN-карту с поддержкой testID и onPress
  return (
    <View testID={`address-item-${props.travel.id}`}>
      <Text onPress={props.onPress}>{props.travel.address}</Text>
    </View>
  );
});

const mockAddFavorite = jest.fn();
const mockRemoveFavorite = jest.fn();
const mockIsFavorite = jest.fn(() => false);
const mockRequireAuth = jest.fn(() => true);
const mockShowToast = jest.fn();
const mockUseRequireAuth = jest.fn(() => ({
  isAuthenticated: true,
  authReady: true,
  loginHref: '/login',
  requireAuth: mockRequireAuth,
}));

jest.mock('@/components/MapPage/AddressListItem', () => {
  return {
    __esModule: true,
    default: (props: any) => mockAddressListItem(props),
  };
});

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({
    addFavorite: mockAddFavorite,
    removeFavorite: mockRemoveFavorite,
    isFavorite: mockIsFavorite,
    favorites: [],
  }),
}));

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: (params: any) => mockUseRequireAuth(params),
}));

jest.mock('@/utils/toast', () => ({
  showToast: (payload: any) => mockShowToast(payload),
}));

import TravelListPanel, {
  buildTravelListSummaryHint,
} from '@/components/MapPage/TravelListPanel';

const travelsData = [
  {
    id: 1,
    address: 'Place 1',
    coord: '50.0, 19.0',
  },
  {
    id: 2,
    address: 'Place 2',
    coord: '51.0, 20.0',
  },
];

describe('TravelListPanel (right list on map page)', () => {
  beforeEach(() => {
    mockAddressListItem.mockClear();
    mockAddFavorite.mockClear();
    mockRemoveFavorite.mockClear();
    mockIsFavorite.mockReset();
    mockIsFavorite.mockReturnValue(false);
    mockRequireAuth.mockClear();
    mockShowToast.mockClear();
    mockUseRequireAuth.mockClear();
    mockUseRequireAuth.mockReturnValue({
      isAuthenticated: true,
      authReady: true,
      loginHref: '/login',
      requireAuth: mockRequireAuth,
    });
  });

  it('renders AddressListItem for each travel', () => {
    const noop = () => {};

    const { getByTestId } = render(
      <TravelListPanel
        travelsData={travelsData}
        buildRouteTo={noop}
        isMobile={false}
        isLoading={false}
      />
    );

    expect(mockAddressListItem).toHaveBeenCalledTimes(travelsData.length);

    // Проверяем, что карточки действительно отрисованы
    travelsData.forEach((item) => {
      expect(getByTestId(`address-item-${item.id}`)).toBeTruthy();
    });
  });

  it('calls buildRouteTo when item is pressed', () => {
    const buildRouteTo = jest.fn();

    const { getByTestId } = render(
      <TravelListPanel
        travelsData={travelsData}
        buildRouteTo={buildRouteTo}
        isMobile={false}
        isLoading={false}
      />
    );

    const firstItem = getByTestId('address-item-1');
    fireEvent.press(firstItem);

    expect(buildRouteTo).toHaveBeenCalledTimes(1);
    expect(buildRouteTo).toHaveBeenCalledWith(travelsData[0]);
  });

  it('uses favorite auth intent and context favorite lookup for web card actions', () => {
    mockIsFavorite.mockImplementation((id: string | number, type: string) => id === 1 && type === 'travel');

    render(
      <TravelListPanel
        travelsData={travelsData}
        buildRouteTo={jest.fn()}
        isMobile={false}
        isLoading={false}
      />
    );

    expect(mockUseRequireAuth).toHaveBeenCalledWith({ intent: 'favorite' });
    expect(mockIsFavorite).toHaveBeenCalledWith(1, 'travel');
    expect(mockAddressListItem.mock.calls[0][0].isFavorite).toBe(true);
  });

  it('shows feedback when web favorite toggle fails', async () => {
    mockAddFavorite.mockRejectedValueOnce(new Error('failed'));

    render(
      <TravelListPanel
        travelsData={travelsData}
        buildRouteTo={jest.fn()}
        isMobile={false}
        isLoading={false}
      />
    );

    await mockAddressListItem.mock.calls[0][0].onToggleFavorite();

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text1: 'Не удалось обновить избранное',
      })
    );
  });

  it('keeps the mobile list header free of legacy filter and map buttons', () => {
    const { getByText, queryByTestId } = render(
      <TravelListPanel
        travelsData={travelsData}
        buildRouteTo={jest.fn()}
        isMobile={true}
        isLoading={false}
        onOpenFilters={jest.fn()}
        onClosePanel={jest.fn()}
        onExpandList={jest.fn()}
        compactPreview={true}
      />
    );

    expect(getByText('Place 1')).toBeTruthy();
    expect(queryByTestId('travel-list-mobile-summary')).toBeNull();
    expect(queryByTestId('travel-list-expand-all')).toBeNull();
    expect(queryByTestId('travel-list-open-filters')).toBeNull();
    expect(queryByTestId('travel-list-back-to-map')).toBeNull();
  });

  it('builds explicit mobile results context with radius and user location', () => {
    expect(
      buildTravelListSummaryHint({
        travelsCount: 2,
        compactPreview: false,
        currentRadiusKm: 60,
        userLocation: { latitude: 53.9, longitude: 27.56 },
      })
    ).toBe(
      '2 места в радиусе 60 км рядом с вами. Нажмите на карточку, чтобы сфокусировать карту.'
    );
  });
});
