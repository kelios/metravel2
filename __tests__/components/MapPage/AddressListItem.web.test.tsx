import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Platform, Pressable, View, Text } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/context/AuthContext', () => ({
  __esModule: true,
  useAuth: () => ({ isAuthenticated: true, authReady: true }),
}));

const mockPlaceListCard = jest.fn((props: any) => {
  const [overflowVisible, setOverflowVisible] = React.useState(false);
  const visibleMapActions = props.compact ? props.mapActions.slice(0, 1) : props.mapActions;
  const overflowActions = props.compact ? props.mapActions.slice(1) : [];

  return (
  <View testID="place-list-card-mock">
    <Text testID="card-title">{props.title}</Text>
    <Text testID="card-meta">{props.categoryLabel}</Text>
    {props.onShare ? (
      <Pressable accessibilityLabel="Поделиться в Telegram" onPress={props.onShare}>
        <Text>Telegram</Text>
      </Pressable>
    ) : null}
    {visibleMapActions.map((action: any) => (
      <Pressable
        key={action.key}
        accessibilityLabel={action.title ?? action.label}
        onPress={action.onPress}
      >
        <Text>{action.label}</Text>
      </Pressable>
    ))}
    {props.inlineActions?.map((action: any) => (
      <Pressable
        key={action.key}
        accessibilityLabel={action.accessibilityLabel ?? action.title ?? action.label}
        onPress={action.onPress}
      >
        <Text>{action.label}</Text>
      </Pressable>
    ))}
    {overflowActions.length > 0 ? (
      <>
        <Pressable
          accessibilityLabel="Ещё действия"
          onPress={() => setOverflowVisible((value) => !value)}
        >
          <Text>Ещё</Text>
        </Pressable>
        {overflowVisible
          ? overflowActions.map((action: any) => (
              <Pressable
                key={action.key}
                accessibilityLabel={action.title ?? action.label}
                onPress={() => {
                  setOverflowVisible(false);
                  action.onPress();
                }}
              >
                <Text>{action.label}</Text>
              </Pressable>
            ))
          : null}
      </>
    ) : null}
    {props.onAddPoint ? (
      <Pressable accessibilityLabel={props.addLabel} onPress={props.onAddPoint}>
        <Text>{props.addLabel}</Text>
      </Pressable>
    ) : null}
  </View>
  );
});

// Mock the web card boundary used by AddressListItem, without coupling to card internals.
jest.mock('@/components/places/PlaceListCard', () => {
  return {
    __esModule: true,
    default: (props: any) => mockPlaceListCard(props),
  };
});

jest.mock('@/ui/paper', () => {
  const actual = jest.requireActual('@/ui/paper');
  const { Pressable, Text, View } = require('react-native');

  const Menu = ({ visible, anchor, children }: any) => (
    <View>
      {anchor}
      {visible ? (
        <View accessibilityRole="menu">
          {children}
        </View>
      ) : null}
    </View>
  );

  Menu.Item = ({ title, onPress }: any) => (
    <Pressable accessibilityLabel={title} accessibilityRole="button" onPress={onPress}>
      <Text>{title}</Text>
    </Pressable>
  );

  return {
    ...actual,
    Menu,
  };
});

import AddressListItem from '@/components/MapPage/AddressListItem';

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

const baseTravel: any = {
  id: 1,
  address: 'Kraków, Poland',
  coord: '50.0619474, 19.9368564',
  travelImageThumbUrl: 'https://example.com/image.jpg',
  categoryName: 'Category 1, Category 2',
  articleUrl: 'https://example.com/article',
  urlTravel: 'https://example.com/quest',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('AddressListItem (web right panel)', () => {
  it('renders UnifiedTravelCard with travel data on web', () => {
    const prevOs = Platform.OS;
    (Platform as any).OS = 'web';

    const { getByTestId } = renderWithProviders(<AddressListItem travel={baseTravel} isMobile={false} />);

    const card = getByTestId('place-list-card-mock');
    expect(card).toBeTruthy();

    const title = getByTestId('card-title');
    expect((title as any).props.children).toContain('Kraków');

    const meta = getByTestId('card-meta');
    expect((meta as any).props.children).toContain('Category 1');

    expect(mockPlaceListCard).toHaveBeenCalled();
    // #224 — the card title is the clean POI/first-segment name («Kraków»), and
    // the rest of the reverse-geocoded address («Poland») moves to the secondary
    // badges line instead of being shown raw as the title.
    expect(mockPlaceListCard).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Kraków',
        badges: expect.arrayContaining(['Poland']),
        categoryLabel: baseTravel.categoryName,
      }),
    );

    (Platform as any).OS = prevOs;
  });

  it('shows the same popup-like navigation action set on web', async () => {
    const prevOs = Platform.OS;
    (Platform as any).OS = 'web';

    const openSpy = jest.fn();
    (globalThis as any).window = (globalThis as any).window || {};
    (globalThis as any).window.open = openSpy;

    const RN = require('react-native');
    jest.spyOn(RN.Linking, 'canOpenURL').mockResolvedValue(false);
    jest.spyOn(RN.Linking, 'openURL').mockResolvedValue(undefined);

    const { getAllByLabelText, queryByLabelText } = renderWithProviders(
      <AddressListItem travel={baseTravel} isMobile={false} />
    );

    expect(queryByLabelText('Скопировать координаты')).toBeNull();
    expect(getAllByLabelText('Открыть страницу').length).toBeGreaterThan(0);
    expect(getAllByLabelText('Открыть в Google Maps').length).toBeGreaterThan(0);
    expect(queryByLabelText('Открыть в Apple Maps')).toBeNull();
    expect(queryByLabelText('Открыть в Organic Maps')).toBeNull();
    expect(queryByLabelText('Проложить маршрут в Waze')).toBeNull();
    expect(queryByLabelText('Открыть в Яндекс Картах')).toBeNull();
    expect(queryByLabelText('Проложить маршрут в Яндекс.Навигаторе')).toBeNull();
    expect(queryByLabelText('Открыть в OpenStreetMap')).toBeNull();
    expect(getAllByLabelText('Поделиться в Telegram').length).toBeGreaterThan(0);
    expect(getAllByLabelText('Сохранить').length).toBeGreaterThan(0);

    fireEvent.press(getAllByLabelText('Ещё действия')[0]);

    expect(getAllByLabelText('Открыть в Apple Maps').length).toBeGreaterThan(0);
    expect(getAllByLabelText('Открыть в Organic Maps').length).toBeGreaterThan(0);
    expect(getAllByLabelText('Проложить маршрут в Waze').length).toBeGreaterThan(0);
    expect(getAllByLabelText('Открыть в Яндекс Картах').length).toBeGreaterThan(0);
    expect(getAllByLabelText('Проложить маршрут в Яндекс.Навигаторе').length).toBeGreaterThan(0);
    expect(getAllByLabelText('Открыть в OpenStreetMap').length).toBeGreaterThan(0);

    fireEvent.press(getAllByLabelText('Открыть в Google Maps')[0]);
    await waitFor(() => {
      const calls = openSpy.mock.calls.map((c: any[]) => String(c?.[0] ?? ''));
      expect(calls.some((v) => v.includes('google.com/maps/search'))).toBe(true);
    });

    fireEvent.press(getAllByLabelText('Открыть в Apple Maps')[0]);
    await waitFor(() => {
      const calls = openSpy.mock.calls.map((c: any[]) => String(c?.[0] ?? ''));
      expect(calls.some((v) => v.includes('maps.apple.com'))).toBe(true);
    });

    fireEvent.press(getAllByLabelText('Открыть страницу')[0]);
    await waitFor(() => {
      const calls = openSpy.mock.calls.map((c: any[]) => String(c?.[0] ?? ''));
      expect(calls.some((v) => v.includes('example.com/article'))).toBe(true);
    });

    fireEvent.press(getAllByLabelText('Ещё действия')[0]);

    fireEvent.press(getAllByLabelText('Открыть в Organic Maps')[0]);
    await waitFor(() => {
      const calls = openSpy.mock.calls.map((c: any[]) => String(c?.[0] ?? ''));
      expect(calls.some((v) => v.includes('omaps.app'))).toBe(true);
    });

    fireEvent.press(getAllByLabelText('Ещё действия')[0]);

    fireEvent.press(getAllByLabelText('Проложить маршрут в Waze')[0]);
    await waitFor(() => {
      const calls = openSpy.mock.calls.map((c: any[]) => String(c?.[0] ?? ''));
      expect(calls.some((v) => v.includes('waze.com/ul'))).toBe(true);
    });

    fireEvent.press(getAllByLabelText('Ещё действия')[0]);

    fireEvent.press(getAllByLabelText('Открыть в Яндекс Картах')[0]);
    await waitFor(() => {
      const calls = openSpy.mock.calls.map((c: any[]) => String(c?.[0] ?? ''));
      expect(calls.some((v) => v.includes('yandex.ru/maps'))).toBe(true);
    });

    fireEvent.press(getAllByLabelText('Ещё действия')[0]);

    fireEvent.press(getAllByLabelText('Проложить маршрут в Яндекс.Навигаторе')[0]);
    await waitFor(() => {
      const calls = openSpy.mock.calls.map((c: any[]) => String(c?.[0] ?? ''));
      expect(calls.some((v) => v.includes('yandex.ru/navi'))).toBe(true);
    });

    fireEvent.press(getAllByLabelText('Ещё действия')[0]);

    fireEvent.press(getAllByLabelText('Открыть в OpenStreetMap')[0]);
    await waitFor(() => {
      const calls = openSpy.mock.calls.map((c: any[]) => String(c?.[0] ?? ''));
      expect(calls.some((v) => v.includes('openstreetmap.org'))).toBe(true);
    });

    fireEvent.press(getAllByLabelText('Поделиться в Telegram')[0]);
    await waitFor(() => {
      const calls = openSpy.mock.calls.map((c: any[]) => String(c?.[0] ?? ''));
      expect(calls.some((v) => /^(tg:\/\/|https:\/\/t\.me\/share\/url)/.test(v))).toBe(true);
    });

    (Platform as any).OS = prevOs;
  });
});
