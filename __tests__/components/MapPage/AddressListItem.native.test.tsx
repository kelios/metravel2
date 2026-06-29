import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import AddressListItem from '@/components/MapPage/AddressListItem';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/context/AuthContext', () => ({
  __esModule: true,
  useAuth: () => ({ isAuthenticated: true, authReady: true }),
}));

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: {
    show: jest.fn(),
  },
}));

jest.mock('expo-clipboard', () => ({
  __esModule: true,
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

// Keep AddressListItem on native path and simplify hover behavior
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: {
      ...RN.Platform,
      OS: 'ios',
      select: (obj: any) => obj.ios ?? obj.default,
    },
  };
});

describe('AddressListItem (native list card)', () => {
  it('does not render coordinates row on mobile', () => {
    const travel: any = {
      id: 1,
      address: 'Test place',
      coord: '50.0619474, 19.9368564',
      travelImageThumbUrl: 'https://example.com/image.jpg',
      categoryName: 'Category 1, Category 2',
      articleUrl: 'https://example.com/article',
      urlTravel: 'https://example.com/quest',
      updated_at: '2024-01-01T00:00:00Z',
    };

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { queryByText } = render(
      <QueryClientProvider client={queryClient}>
        <AddressListItem travel={travel} isMobile={true} />
      </QueryClientProvider>
    );

    // Coordinate value must not be shown on mobile
    expect(queryByText(travel.coord)).toBeNull();
  });

  it('renders a visible route action on mobile', () => {
    const travel: any = {
      id: 1,
      address: 'Test place',
      coord: '50.0619474, 19.9368564',
      travelImageThumbUrl: 'https://example.com/image.jpg',
      categoryName: 'Category',
      updated_at: '2024-01-01T00:00:00Z',
    };
    const onBuildRoute = jest.fn();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { getAllByLabelText, queryByLabelText } = render(
      <QueryClientProvider client={queryClient}>
        <AddressListItem travel={travel} isMobile={true} onBuildRoute={onBuildRoute} />
      </QueryClientProvider>
    );

    const routeActions = getAllByLabelText('Построить маршрут сюда');
    expect(routeActions).toHaveLength(1);
    // Nav apps are folded into the «Навигация и действия» sheet, not inline.
    expect(queryByLabelText('Открыть в Google Maps')).toBeNull();
    expect(queryByLabelText('Открыть в Organic Maps')).toBeNull();
    expect(queryByLabelText('Проложить маршрут в Waze')).toBeNull();
    expect(queryByLabelText('Проложить маршрут в Яндекс.Навигаторе')).toBeNull();

    // …but the «Навигация» tile is present so the user can open that full list.
    expect(getAllByLabelText('Навигация и действия').length).toBeGreaterThan(0);

    fireEvent.press(routeActions[0]);
    expect(onBuildRoute).toHaveBeenCalledTimes(1);
  });

  it('pins native mobile card width to the sheet width minus card margins', () => {
    const travel: any = {
      id: 1,
      address: 'Test place',
      coord: '50.0619474, 19.9368564',
      travelImageThumbUrl: 'https://example.com/image.jpg',
      categoryName: 'Category',
      updated_at: '2024-01-01T00:00:00Z',
    };
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { getByTestId } = render(
      <QueryClientProvider client={queryClient}>
        <AddressListItem travel={travel} isMobile={true} screenWidth={390} />
      </QueryClientProvider>
    );

    const cardStyle = StyleSheet.flatten(getByTestId('map-travel-card').props.style);
    expect(cardStyle.width).toBe(374);
  });
});
