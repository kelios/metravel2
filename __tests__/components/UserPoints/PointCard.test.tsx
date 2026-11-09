import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { PointCard } from '@/components/UserPoints/PointCard';
import { PointStatus } from '@/types/userPoints';
import type { ImportedPoint } from '@/types/userPoints';
import { __resetViewportMetricsForTests } from '@/utils/viewportMetrics';
import { restoreWindowStubs, stubWindowProperty } from '../../helpers/windowStubs';

const mockPlaceListCard = jest.fn((props: any) => {
  const React = require('react');
  return (
    <View testID={props.testID ?? 'mock-place-list-card'}>
      <Text>{props.title}</Text>
      {props.categoryLabel ? <Text>{props.categoryLabel}</Text> : null}
      {props.coord ? <Text>{props.coord}</Text> : null}
      <Text testID="image-height">{String(props.imageHeight)}</Text>
      <Text testID="image-url">{String(props.imageUrl ?? '')}</Text>
      {(props.badges ?? []).map((badge: string) => <Text key={badge}>{badge}</Text>)}
      {props.onCopyCoord ? (
        <Text accessibilityRole="button" accessibilityLabel="Копировать координаты" onPress={props.onCopyCoord}>
          copy
        </Text>
      ) : null}
      {(props.mapActions ?? []).map((action: any) => (
        <Text key={action.key} onPress={action.onPress}>{action.label}</Text>
      ))}
      {(props.menuActions ?? []).map((action: any) => (
        <Text key={`menu-${action.key}`} testID={`menu-${action.key}`} accessibilityLabel={`menu ${action.label}`} onPress={action.onPress}>
          {action.label}{action.destructive ? ' (destructive)' : ''}
        </Text>
      ))}
      {(props.inlineActions ?? []).map((action: any) => (
        <Text key={action.key} accessibilityLabel={action.accessibilityLabel} onPress={action.onPress}>
          {action.label}
        </Text>
      ))}
    </View>
  );
});

// #3161: карточка заказывает полную запись у store — сеть в тесте не нужна.
// #3135: время в пути — общий хук на React Query; карточке в тесте провайдер не нужен.
const mockUseDriveInfoQuery = jest.fn(() => null as any);
jest.mock('@/components/UserPoints/useDriveInfoQuery', () => ({
  useDriveInfoQuery: (args: any) => mockUseDriveInfoQuery(args),
}));

jest.mock('@/api/userPoints', () => ({
  userPointsApi: { getPointsByIds: jest.fn(async () => []) },
}));

// #3142: строка телефона — свой мок, ловим пропсы и рисуем пункты «⋯».
const mockPlaceListRow = jest.fn((props: any) => {
  const { Text, View } = require('react-native');
  return (
    <View testID={props.testID ?? 'mock-place-list-row'}>
      <Text>{props.title}</Text>
      {props.subtitle ? <Text testID="row-subtitle">{props.subtitle}</Text> : null}
      <Text accessibilityRole="button" accessibilityLabel="row-main" onPress={props.onPress}>main</Text>
      {(props.actions ?? []).map((action: any) => (
        <Text key={`row-${action.key}`} testID={`row-${action.key}`} onPress={action.onPress}>
          {action.label}{action.destructive ? ' (destructive)' : ''}
        </Text>
      ))}
    </View>
  );
});
jest.mock('@/components/places/PlaceListRow', () => ({
  __esModule: true,
  default: (props: any) => mockPlaceListRow(props),
}));

jest.mock('@/components/places/PlaceListCard', () => ({
  __esModule: true,
  default: (props: any) => mockPlaceListCard(props),
}));

let mockViewportWidth = 1280;
jest.mock('@/hooks/useResponsive', () => ({
  ...jest.requireActual('@/hooks/useResponsive'),
  useResponsiveWidth: () => mockViewportWidth,
}));

jest.mock('expo-clipboard', () => ({
  __esModule: true,
  setStringAsync: jest.fn(async () => true),
}));

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrlInNewTab: jest.fn(async () => true),
}));

describe('PointCard', () => {
  const mockPoint: ImportedPoint = {
    id: 1,
    name: 'Test Restaurant',
    latitude: 50.4501,
    longitude: 30.5234,
    color: '#4CAF50',
    category: 'Ресторан',
    status: PointStatus.VISITED,
    description: 'A great place to eat',
    address: 'Main Street 123, Kyiv',
    rating: 4.5,
    source: 'google_maps',
    imported_at: '2024-01-15T10:00:00Z',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  };

  beforeEach(() => {
    mockPlaceListCard.mockClear();
    mockPlaceListRow.mockClear();
    mockUseDriveInfoQuery.mockReturnValue(null);
    mockViewportWidth = 1280;
  });

  it('renders user point through the shared PlaceListCard template', async () => {
    await render(<PointCard point={mockPoint} />);

    expect(mockPlaceListCard).toHaveBeenCalled();
    const props = mockPlaceListCard.mock.calls[0]?.[0];
    expect(props.popupAligned).toBe(true);
    expect(props.titleLayout).toBe('content');
    expect(props.compact).toBe(true);
    // Своя точка уже в «Мои точки»: сохранения (♥ = точка) на карточке нет.
    expect(props.onAddPoint).toBeUndefined();
    expect(screen.getByText('Test Restaurant')).toBeTruthy();
  });

  it('passes point metadata as content props and badges', async () => {
    await render(<PointCard point={mockPoint} />);

    const props = mockPlaceListCard.mock.calls[0]?.[0];
    expect(props.categoryLabel).toBe('Ресторан');
    expect(props.coord).toBe('50.450100, 30.523400');
    expect(props.badges).toEqual([
      'Main Street 123, Kyiv',
      'A great place to eat',
      // #1459: дробную часть оценки печатает локаль (дефолт — русский)
      '4,5',
    ]);
    expect(screen.getByText('Ресторан')).toBeTruthy();
    expect(screen.getByText('Main Street 123, Kyiv')).toBeTruthy();
  });

  it('shows a clean title when name is a raw reverse-geocode address', async () => {
    const geocoded = {
      ...mockPoint,
      name: '3, Рыночная площадь, Old Town, Краков, Малопольское воеводство, Польша',
      address: '3, Рыночная площадь, Old Town, Краков, Малопольское воеводство, Польша',
      description: null,
    };
    await render(<PointCard point={geocoded} />);

    expect(screen.getByText('3, Рыночная площадь')).toBeTruthy();
    expect(
      screen.getByText('3, Рыночная площадь, Old Town, Краков, Малопольское воеводство, Польша')
    ).toBeTruthy();
  });

  it('does not render status label', async () => {
    await render(<PointCard point={mockPoint} />);
    expect(screen.queryByText('Посещено')).toBeNull();
  });

  it('does not pass coordinates when coordinates are missing', async () => {
    const pointWithoutCoords = { ...mockPoint, latitude: Number.NaN, longitude: Number.NaN };
    await render(<PointCard point={pointWithoutCoords} />);

    const props = mockPlaceListCard.mock.calls[0]?.[0];
    expect(props.coord).toBeUndefined();
    expect(props.mapActions).toEqual([]);
    expect(screen.queryByText('50.450100, 30.523400')).toBeNull();
  });

  it('copies coordinates to clipboard on native', async () => {
    const Clipboard = require('expo-clipboard');
    await render(<PointCard point={mockPoint} />);

    await fireEvent.press(screen.getByLabelText('Копировать координаты'));

    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('50.450100, 30.523400');
    });
  });

  it('copies coordinates via navigator.clipboard on web when available', async () => {
    const originalPlatform = require('react-native').Platform.OS;
    (require('react-native').Platform as any).OS = 'web';

    const writeText = jest.fn(async () => true);
    // Подменяется только `navigator` настоящего jsdom-окна (глобал `window` в jsdom 26
    // заменить нельзя, #2735): addEventListener/resize остаются настоящими, как и требует
    // web-ветка вьюпорт-стора (#1814). Платформа и стаб восстанавливаются в `finally` —
    // иначе первая же ошибка внутри теста оставляет глобалы сломанными для следующих кейсов.
    stubWindowProperty(
      'navigator',
      Object.create(window.navigator, { clipboard: { value: { writeText } } }),
    );

    try {
      await render(<PointCard point={mockPoint} />);
      await fireEvent.press(screen.getByLabelText('Копировать координаты'));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith('50.450100, 30.523400');
      });
    } finally {
      (require('react-native').Platform as any).OS = originalPlatform;
      restoreWindowStubs();
      // Модульное состояние `viewportMetrics` тоже глобал: на web-ветке оно
      // повесило слушатели инвалидации и запомнило это флагом.
      // Без сброса кэш вьюпорта остаётся привязан к состоянию этого кейса — и
      // следующий web-кейс этого файла читал бы ширину, которая уже никогда не
      // инвалидируется.
      __resetViewportMetricsForTests();
    }
  });

  it('passes navigation actions into the shared card overflow model', async () => {
    await render(<PointCard point={mockPoint} />);

    const props = mockPlaceListCard.mock.calls[0]?.[0];
    expect(props.mapActions.map((action: any) => action.key)).toEqual([
      'google',
      'apple',
      'organic',
      'waze',
      'yandex-maps',
      'yandex',
      'osm',
    ]);
  });

  it('desktop: правка и удаление — подписанные чипы ряда, «⋯» без них', async () => {
    mockViewportWidth = 1280;
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    await render(<PointCard point={mockPoint} onEdit={onEdit} onDelete={onDelete} />);

    await fireEvent.press(screen.getByLabelText('Редактировать'));
    await fireEvent.press(screen.getByLabelText('Удалить'));
    expect(onEdit).toHaveBeenCalledWith(mockPoint);
    expect(onDelete).toHaveBeenCalledWith(mockPoint);
    expect(screen.queryByTestId('menu-edit')).toBeNull();
    expect(screen.queryByTestId('menu-delete')).toBeNull();
  });

  it('телефон (#3142): компактная строка, все действия в «⋯», удаление последним и destructive', async () => {
    mockViewportWidth = 390;
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const onPress = jest.fn();
    await render(<PointCard point={{ ...mockPoint, tags: { articleUrl: '/travels/x' } } as any} onPress={onPress} onEdit={onEdit} onDelete={onDelete} />);

    expect(mockPlaceListCard).not.toHaveBeenCalled();
    const props = mockPlaceListRow.mock.calls.at(-1)[0];
    expect(props.title).toBe('Test Restaurant');
    expect(props.categoryLabel).toBe('Ресторан');
    expect(props.subtitle).toBe('Main Street 123, Kyiv');
    const keys = props.actions.map((a: any) => a.key);
    expect(keys[0]).toBe('copy-coord');
    expect(keys).toEqual(expect.arrayContaining(['google', 'share', 'article']));
    expect(keys.slice(-2)).toEqual(['edit', 'delete']);
    expect(props.actions.at(-1).destructive).toBe(true);

    await fireEvent.press(screen.getByTestId('row-delete'));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    await fireEvent.press(screen.getByTestId('row-edit'));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    await fireEvent.press(screen.getByLabelText('row-main'));
    expect(onPress).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('телефон (#3142): режим выбора — без «⋯», нажатие на строку переключает выбор', async () => {
    mockViewportWidth = 390;
    const onToggleSelect = jest.fn();
    await render(<PointCard point={mockPoint} selectionMode selected onToggleSelect={onToggleSelect} />);
    const props = mockPlaceListRow.mock.calls.at(-1)[0];
    expect(props.actions).toEqual([]);
    expect(props.selectionMode).toBe(true);
    expect(props.selected).toBe(true);
    await fireEvent.press(screen.getByLabelText('row-main'));
    expect(onToggleSelect).toHaveBeenCalledWith(mockPoint);
  });

  it('телефон (#3142): у активной точки подзаголовок — время в пути', async () => {
    mockViewportWidth = 390;
    mockUseDriveInfoQuery.mockReturnValue({ status: 'ok', distanceKm: 12.5, durationMin: 20 });
    await render(<PointCard point={mockPoint} active driveFrom={{ lat: 50, lng: 30 }} />);
    expect(String(screen.getByTestId('row-subtitle').props.children)).toMatch(/12,5 км|12\.5 км/);
  });

  it('телефон (#3142): пин без карточки — каркас строки', async () => {
    mockViewportWidth = 390;
    const { userPointDetailsStore } = require('@/components/UserPoints/userPointDetailsStore');
    userPointDetailsStore.setOwner('t-row');
    userPointDetailsStore.clear();
    const pin = { id: 778, latitude: 50.06, longitude: 19.94, color: 'blue', status: 'planning', category: 'other' } as any;
    const utils = await render(<PointCard point={pin} />);
    expect(utils.getByTestId('userpoints-point-card-skeleton-778', { includeHiddenElements: true })).toBeTruthy();
    expect(mockPlaceListRow).not.toHaveBeenCalled();
  });

  it('passes selection action in selection mode', async () => {
    const onToggleSelect = jest.fn();
    await render(<PointCard point={mockPoint} selectionMode selected onToggleSelect={onToggleSelect} />);

    await fireEvent.press(screen.getByLabelText('Точка выбрана'));
    expect(onToggleSelect).toHaveBeenCalledWith(mockPoint);
  });

  it('renders without description or address', async () => {
    const pointWithoutDetails = { ...mockPoint, description: undefined, address: undefined };
    await render(<PointCard point={pointWithoutDetails} />);
    expect(screen.getByText('Test Restaurant')).toBeTruthy();
  });

  it('uses the shared card media area for points without and with photos', async () => {
    await render(<PointCard point={mockPoint} />);
    expect(Number(screen.getByTestId('image-height').props.children)).toBeGreaterThan(0);

    mockPlaceListCard.mockClear();
    const pointWithPhoto = { ...mockPoint, photo: 'https://example.com/p.jpg' } as any;
    await render(<PointCard point={pointWithPhoto} />);

    expect(screen.getByTestId('image-url').props.children).toBe('https://example.com/p.jpg');
  });

  it('pin without a loaded card renders the skeleton card, then the card once details arrive (#3161)', async () => {
    const { userPointDetailsStore } = require('@/components/UserPoints/userPointDetailsStore');
    const { act } = require('@testing-library/react-native');
    userPointDetailsStore.setOwner('t');
    userPointDetailsStore.clear();
    const pin = { id: 777, latitude: 50.06, longitude: 19.94, color: 'blue', status: 'planning', category: 'other' } as any;
    const utils = await render(<PointCard point={pin} />);
    // Каркас скрыт от a11y-дерева — ищем с includeHiddenElements.
    expect(utils.getByTestId('userpoints-point-card-skeleton-777', { includeHiddenElements: true })).toBeTruthy();
    expect(utils.queryByTestId('userpoints-point-card-777')).toBeNull();

    await act(async () => {
      userPointDetailsStore.upsert({ ...pin, name: 'Рыночная площадь', address: 'Краков' });
    });
    expect(utils.queryByTestId('userpoints-point-card-skeleton-777', { includeHiddenElements: true })).toBeNull();
    expect(utils.getByTestId('userpoints-point-card-777')).toBeTruthy();
  });

  it('asks for drive info only when active and a location is known, and shows it as a badge (#3135)', async () => {
    mockUseDriveInfoQuery.mockReturnValue(null);
    await render(<PointCard point={mockPoint} driveFrom={{ lat: 50, lng: 19.9 }} />);
    expect(mockUseDriveInfoQuery).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));

    mockUseDriveInfoQuery.mockReturnValue({ status: 'ok', distanceKm: 12.5, durationMin: 20 });
    await render(<PointCard point={mockPoint} active driveFrom={{ lat: 50, lng: 19.9 }} />);
    expect(mockUseDriveInfoQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true, from: { lat: 50, lng: 19.9 }, to: { lat: mockPoint.latitude, lng: mockPoint.longitude } }),
    );
    expect(screen.getByText(/12,5 км|12\.5 км/)).toBeTruthy();
  });

  it('≥ 768 (#3142, #2253): каркас карточки в ячейке берёт вертикальный отступ карточки — без прыжка при загрузке', async () => {
    mockViewportWidth = 1280;
    const { PLACE_CARD_STYLE } = require('@/components/MapPage/AddressListItem/constants');
    const { StyleSheet } = require('react-native');
    const { userPointDetailsStore } = require('@/components/UserPoints/userPointDetailsStore');
    userPointDetailsStore.setOwner('t-card');
    userPointDetailsStore.clear();
    const pin = { id: 779, latitude: 50.06, longitude: 19.94, color: 'blue', status: 'planning', category: 'other' } as any;
    const utils = await render(<PointCard point={pin} />);
    const skeleton = utils.getByTestId('userpoints-point-card-skeleton-779', { includeHiddenElements: true });
    const flat = StyleSheet.flatten(skeleton.props.style);
    expect(flat.marginVertical).toBe(PLACE_CARD_STYLE.margin);
    expect(flat.marginBottom).toBeUndefined();
  });
});
