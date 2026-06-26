import { Platform, View, Text, Linking } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import PointListRow from '@/components/travel/PointListRow';

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
  useQuery: jest.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidate,
  }),
}));

jest.mock('@/api/misc', () => ({
  fetchFilters: jest.fn(async () => ({
    categoryTravelAddress: [],
  })),
}));

jest.mock('@/api/userPoints', () => ({
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

const rowStyles = {
  listRow: {},
  listRowPressable: {},
  listRowThumb: {},
  listRowThumbPlaceholder: {},
  listRowInfo: {},
  listRowHeader: {},
  listRowBullet: {},
  listRowBulletText: {},
  listRowTitle: {},
  listRowCoordChip: {},
  listRowCoordText: {},
  listRowCategory: {},
  listRowActions: {},
  listRowIconBtn: {},
  listRowNavigationMenu: {},
  listRowAddBtn: {},
  listRowAddBtnText: {},
  addButtonPressed: {},
  addButtonDisabled: {},
};

describe('PointList (web coordinates list uses popup template)', () => {
  it('shows point cards by default and keeps preview available after collapse', () => {
    const prevOs = Platform.OS;
    (Platform as any).OS = 'web';

    const points = [
      { ...basePoint, id: '1', address: 'A', coord: '50.0,20.0' },
      { ...basePoint, id: '2', address: 'B', coord: '51.0,21.0' },
      { ...basePoint, id: '3', address: 'C', coord: '52.0,22.0' },
      { ...basePoint, id: '4', address: 'D', coord: '53.0,23.0' },
    ];

    const { getByLabelText, getByText, queryByText } = render(
      <PointList points={points as any} baseUrl="https://example.com/travel-page" />
    );

    expect(getByText('4 точки')).toBeTruthy();
    expect(getByText('Карточки точек')).toBeTruthy();
    expect(getByLabelText('Карточки')).toBeTruthy();
    expect(getByLabelText('Список')).toBeTruthy();
    expect(queryByText('+ ещё 1')).toBeNull();

    fireEvent.press(getByLabelText('Список'));
    expect(getByText('Быстрый список точек')).toBeTruthy();
    expect(getByText('A')).toBeTruthy();

    fireEvent.press(getByLabelText(/Скрыть карточки точек/));
    expect(getByText('+ ещё 1')).toBeTruthy();
    expect(getByText('Открыть список: 4 точки')).toBeTruthy();

    (Platform as any).OS = prevOs;
  });

  it('uses non-button web row semantics while preserving row activation', () => {
    const prevOs = Platform.OS;
    (Platform as any).OS = 'web';

    const onOpenMap = jest.fn();
    const onCardPress = jest.fn();

    const { getByLabelText } = render(
      <PointListRow
        point={{ id: '1', address: 'A', coord: '50.0,20.0' }}
        index={0}
        colors={{ primary: '#f97316', textMuted: '#64748b' }}
        onCopy={jest.fn()}
        onShare={jest.fn()}
        onOpenMap={onOpenMap}
        onCardPress={onCardPress}
        styles={rowStyles}
      />,
    );

    const row = getByLabelText('Открыть место: A');
    expect(row.type).toBe('View');
    expect(row.props.role).toBeUndefined();
    expect(row.props.accessibilityRole).toBeUndefined();
    expect(row.props['aria-label']).toBe('Открыть место: A');
    expect(row.props.tabIndex).toBe(0);

    const currentTarget = { nodeType: 1 };
    fireEvent(row, 'click', {
      currentTarget,
      target: { closest: () => null },
    });
    expect(onCardPress).toHaveBeenCalledTimes(1);

    fireEvent(row, 'keyDown', {
      key: 'Enter',
      preventDefault: jest.fn(),
      currentTarget,
      target: { closest: () => null },
    });
    expect(onCardPress).toHaveBeenCalledTimes(2);

    fireEvent(row, 'click', {
      currentTarget,
      target: { closest: () => ({ nodeType: 1 }) },
    });
    expect(onCardPress).toHaveBeenCalledTimes(2);
    expect(onOpenMap).not.toHaveBeenCalled();

    (Platform as any).OS = prevOs;
  });

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
        'noopener'
      );
    }).then(() => {
      fireEvent.press(getByLabelText('Открыть в Apple Maps'));
      return waitFor(() => {
        expect(openSpy).toHaveBeenCalledWith('https://maps.apple.com/?q=50%2C20', '_blank', 'noopener');
      });
    }).then(() => {
      fireEvent.press(getByLabelText('Открыть в Яндекс Картах'));
      return waitFor(() => {
        expect(openSpy).toHaveBeenCalledWith(
          'https://yandex.ru/maps/?pt=20%2C50&z=16&l=map',
          '_blank',
          'noopener'
        );
      });
    }).then(() => {
      fireEvent.press(getByLabelText('Открыть в OpenStreetMap'));
      return waitFor(() => {
        expect(openSpy).toHaveBeenCalledWith(
          'https://www.openstreetmap.org/?mlat=50&mlon=20#map=16/50/20',
          '_blank',
          'noopener'
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
          expect(openSpy).toHaveBeenCalledWith(baseUrl, '_blank', 'noopener');
        }).then(() => {
          (Platform as any).OS = prevOs;
        });
      });
    });
  });

  it('sends photo in payload when adding point to user points', async () => {
    const prevOs = Platform.OS;
    (Platform as any).OS = 'web';

    const mockCreatePoint = require('@/api/userPoints').userPointsApi.createPoint as jest.Mock;
    mockCreatePoint.mockClear();

    const { getByLabelText, getAllByLabelText } = render(
      <PointList points={[basePoint as any]} baseUrl="https://example.com/travel-page" travelName="T" />
    );

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
