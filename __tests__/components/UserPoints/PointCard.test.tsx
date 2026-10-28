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
  });

  it('renders user point through the shared PlaceListCard template', async () => {
    await render(<PointCard point={mockPoint} />);

    expect(mockPlaceListCard).toHaveBeenCalled();
    const props = mockPlaceListCard.mock.calls[0]?.[0];
    expect(props.popupAligned).toBe(true);
    expect(props.titleLayout).toBe('content');
    expect(props.compact).toBe(true);
    expect(props.showAddButton).toBe(false);
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

  it('телефон (#2101): правка и удаление уходят в «⋯», удаление последним и destructive, из ряда убраны', async () => {
    mockViewportWidth = 390;
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    await render(<PointCard point={mockPoint} onEdit={onEdit} onDelete={onDelete} />);

    const props = mockPlaceListCard.mock.calls[mockPlaceListCard.mock.calls.length - 1][0];
    expect(props.menuActions.map((a: any) => a.key)).toEqual(['edit', 'delete']);
    expect(props.menuActions[1].destructive).toBe(true);
    expect((props.inlineActions ?? []).map((a: any) => a.key)).not.toContain('edit');
    expect((props.inlineActions ?? []).map((a: any) => a.key)).not.toContain('delete');

    await fireEvent.press(screen.getByTestId('menu-delete'));
    expect(onDelete).toHaveBeenCalledWith(mockPoint);
    await fireEvent.press(screen.getByTestId('menu-edit'));
    expect(onEdit).toHaveBeenCalledWith(mockPoint);
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
});
