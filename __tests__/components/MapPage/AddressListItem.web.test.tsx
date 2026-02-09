import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Platform, View, Text } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/context/AuthContext', () => ({
  __esModule: true,
  useAuth: () => ({ isAuthenticated: true, authReady: true }),
}));

const mockUnifiedCard = jest.fn((props: any) => (
  <View testID="unified-card-mock">
    <Text testID="card-title">{props.title}</Text>
    <Text testID="card-meta">{props.metaText}</Text>
    <View testID="card-content">{props.contentSlot}</View>
  </View>
));

// Мокаем UnifiedTravelCard, чтобы проверить, что он используется AddressListItem
jest.mock('@/components/ui/UnifiedTravelCard', () => {
  return {
    __esModule: true,
    default: (props: any) => mockUnifiedCard(props),
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

    const card = getByTestId('unified-card-mock');
    expect(card).toBeTruthy();

    const title = getByTestId('card-title');
    expect((title as any).props.children).toContain('Kraków');

    const meta = getByTestId('card-meta');
    expect((meta as any).props.children).toContain('Category 1');

    expect(mockUnifiedCard).toHaveBeenCalled();
    expect(mockUnifiedCard).toHaveBeenCalledWith(
      expect.objectContaining({
        title: baseTravel.address,
        metaText: baseTravel.categoryName,
      }),
    );

    (Platform as any).OS = prevOs;
  });

  it('shows coordinates and supports copy/share actions on web', async () => {
    const prevOs = Platform.OS;
    (Platform as any).OS = 'web';

    const openSpy = jest.fn();
    (globalThis as any).window = (globalThis as any).window || {};
    (globalThis as any).window.open = openSpy;

    const writeText = jest.fn(() => Promise.resolve());
    Object.defineProperty(global, 'navigator', {
      value: { clipboard: { writeText } },
      writable: true,
    });

    const RN = require('react-native');
    jest.spyOn(RN.Linking, 'canOpenURL').mockResolvedValue(false);
    jest.spyOn(RN.Linking, 'openURL').mockResolvedValue(undefined);

    const { getAllByLabelText } = renderWithProviders(
      <AddressListItem travel={baseTravel} isMobile={false} />
    );

    expect(getAllByLabelText('Скопировать координаты').length).toBeGreaterThan(0);

    fireEvent.press(getAllByLabelText('Скопировать координаты')[0]);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(baseTravel.coord);
    });

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

    fireEvent.press(getAllByLabelText('Открыть в Яндекс Картах')[0]);
    await waitFor(() => {
      const calls = openSpy.mock.calls.map((c: any[]) => String(c?.[0] ?? ''));
      expect(calls.some((v) => v.includes('yandex.ru/maps'))).toBe(true);
    });

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

    fireEvent.press(getAllByLabelText('Открыть статью')[0]);
    await waitFor(() => {
      const calls = openSpy.mock.calls.map((c: any[]) => String(c?.[0] ?? ''));
      expect(calls.some((v) => v === baseTravel.articleUrl || v === baseTravel.urlTravel)).toBe(true);
    });

    (Platform as any).OS = prevOs;
  });
});
