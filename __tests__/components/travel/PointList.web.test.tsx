import { Platform, View, Text, Linking } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockUnifiedCard = jest.fn((props: any) => (
  <View testID="unified-card-mock">
    <Text testID="card-title">{props.title}</Text>
    <Text testID="card-meta">{props.metaText}</Text>
    {props.contentSlot}
  </View>
));

jest.mock('@/components/ui/UnifiedTravelCard', () => ({
  __esModule: true,
  default: (props: any) => mockUnifiedCard(props),
}));

jest.mock('@/context/AuthContext', () => ({
  __esModule: true,
  useAuth: () => ({
    isAuthenticated: true,
    authReady: true,
  }),
}));

const mockInvalidate = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidate,
  }),
}));

jest.mock('@/src/api/misc', () => ({
  fetchFilters: jest.fn(async () => ({
    categoryTravelAddress: [],
  })),
}));

jest.mock('@/src/api/userPoints', () => ({
  userPointsApi: {
    createPoint: jest.fn(async () => ({ id: 1 })),
  },
}));

import PointList from '@/components/travel/PointList';

jest.mock('expo-clipboard', () => ({
  __esModule: true,
  setStringAsync: jest.fn(async () => true),
}));

const basePoint = {
  id: '1',
  address: 'Test address',
  coord: '50.0,20.0',
  travelImageThumbUrl: 'https://example.com/img.jpg',
  categoryName: 'Category',
  description: 'desc',
};

describe('PointList (web coordinates list uses popup template)', () => {
  it('passes baseUrl as articleUrl to PopupContentComponent on web', () => {
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

    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false as any);
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as any);

    const baseUrl = 'https://example.com/travel-page';

    const { getByLabelText } = render(
      <PointList points={[basePoint as any]} baseUrl={baseUrl} />
    );

    const toggleButton = getByLabelText(/Показать координаты мест/);
    fireEvent.press(toggleButton);

    expect(getByLabelText('Скопировать координаты')).toBeTruthy();
    expect(getByLabelText('Поделиться в Telegram')).toBeTruthy();
    expect(getByLabelText('Открыть в Google Maps')).toBeTruthy();
    expect(getByLabelText('Открыть в Apple Maps')).toBeTruthy();
    expect(getByLabelText('Открыть в Яндекс Картах')).toBeTruthy();
    expect(getByLabelText('Открыть в OpenStreetMap')).toBeTruthy();
    expect(getByLabelText('Открыть статью')).toBeTruthy();

    fireEvent.press(getByLabelText('Открыть в Google Maps'));
    return waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        'https://www.google.com/maps/search/?api=1&query=50,20',
        '_blank',
        'noopener,noreferrer'
      );
    }).then(() => {
      fireEvent.press(getByLabelText('Открыть в Apple Maps'));
      return waitFor(() => {
        expect(openSpy).toHaveBeenCalledWith('https://maps.apple.com/?q=50%2C20', '_blank', 'noopener,noreferrer');
      });
    }).then(() => {
      fireEvent.press(getByLabelText('Открыть в Яндекс Картах'));
      return waitFor(() => {
        expect(openSpy).toHaveBeenCalledWith(
          'https://yandex.ru/maps/?pt=20%2C50&z=16&l=map',
          '_blank',
          'noopener,noreferrer'
        );
      });
    }).then(() => {
      fireEvent.press(getByLabelText('Открыть в OpenStreetMap'));
      return waitFor(() => {
        expect(openSpy).toHaveBeenCalledWith(
          'https://www.openstreetmap.org/?mlat=50&mlon=20#map=16/50/20',
          '_blank',
          'noopener,noreferrer'
        );
      });
    }).then(() => {
      fireEvent.press(getByLabelText('Скопировать координаты'));
      return waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(basePoint.coord);
      });
    }).then(() => {
      fireEvent.press(getByLabelText('Поделиться в Telegram'));
      return waitFor(() => {
        const calls = openSpy.mock.calls.map((c: any[]) => String(c?.[0] ?? ''));
        expect(calls.some((v: string) => /^(tg:\/\/|https:\/\/t\.me\/share\/url\?url=)/.test(v))).toBe(true);
      }).then(() => {
        fireEvent.press(getByLabelText('Открыть статью'));
        return waitFor(() => {
          expect(openSpy).toHaveBeenCalledWith(baseUrl, '_blank', 'noopener,noreferrer');
        }).then(() => {
          (Platform as any).OS = prevOs;
        });
      });
    });
  });

  it('sends photo in payload when adding point to user points', async () => {
    const prevOs = Platform.OS;
    (Platform as any).OS = 'web';

    const mockCreatePoint = require('@/src/api/userPoints').userPointsApi.createPoint as jest.Mock;
    mockCreatePoint.mockClear();

    const { getByLabelText, getAllByLabelText } = render(
      <PointList points={[basePoint as any]} baseUrl="https://example.com/travel-page" travelName="T" />
    );

    fireEvent.press(getByLabelText(/Показать координаты мест/));

    const addButtons = getAllByLabelText('Мои точки');
    fireEvent.press(addButtons[0]);

    await waitFor(() => {
      expect(mockCreatePoint).toHaveBeenCalledTimes(1);
    });

    const payload = mockCreatePoint.mock.calls[0][0];
    expect(payload.photo).toBe(basePoint.travelImageThumbUrl);

    (Platform as any).OS = prevOs;
  });
});
