/**
 * #1496 — панель импорта и исходный файл маршрута.
 *
 * Что держит тест:
 *  1. выбранный файл уходит наверх ВМЕСТЕ с точками — его грузит «Сохранить
 *     маршрут», поэтому оригинал и точки не расходятся;
 *  2. кэш-копия выбранного файла освобождается при отмене и при отказе парсера,
 *     иначе на устройстве копятся файлы до 20 МиБ;
 *  3. сохранённый у поездки оригинал показан с именем/размером и его можно убрать —
 *     только через подтверждение (#2054);
 *  4. ошибка загрузки оригинала видна отдельно от ошибок разбора файла;
 *  5. #2069: сохранённых файлов несколько — у каждого своя карточка, «Скачать» и
 *     «Удалить» работают с его routeId, а новый файл добавляется к ним: ни один
 *     режим применения прежние файлы не удаляет, и подсказка говорит это прямо.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';

import type { RoutePoint } from '@/api/plannedTrips';
import {
  GPX_SINGLE_WITH_WAYPOINTS,
  MALFORMED_GPX,
} from '@/__tests__/fixtures/tripRouteImportFixtures';
import { getThemedColors } from '@/hooks/useTheme';

let mockPickerProps: Record<string, any> = {};
const mockReleaseUpload = jest.fn();
const mockDownloadOriginal = jest.fn();

// Иконка видна тесту по имени: «Удалить» оригинала обязана нести `trash-2`.
jest.mock('@expo/vector-icons/Feather', () => (props: { name: string }) => {
  const { View: MockView } = require('react-native');
  return <MockView testID={`feather-${props.name}`} />;
});
jest.mock('@/components/trips/planning/TripRouteFilePicker', () => {
  function MockTripRouteFilePicker(props: Record<string, unknown>) {
    const { Pressable, Text } = require('react-native');
    mockPickerProps = props;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.label as string}
        testID="trip-route-import-picker"
      >
        <Text>{props.label as string}</Text>
      </Pressable>
    );
  }
  return {
    __esModule: true,
    default: MockTripRouteFilePicker,
    releasePickedTripRouteUpload: (upload: unknown) => mockReleaseUpload(upload),
  };
});
jest.mock('@/utils/travelRouteDownload', () => ({
  ...jest.requireActual('@/utils/travelRouteDownload'),
  downloadPlannedTripRouteFile: (...args: unknown[]) => mockDownloadOriginal(...args),
}));
jest.mock('@/components/MapPage/TravelMap', () => ({
  TravelMap: () => {
    const { View } = require('react-native');
    return <View testID="trip-route-import-map" />;
  },
}));

import TripRouteImportPanel from '@/components/trips/planning/TripRouteImportPanel';

const currentRoute: RoutePoint[] = [
  {
    id: 'current-a',
    type: 'custom',
    name: 'Current start',
    description: null,
    coordinates: [27.5, 53.9],
    placeId: null,
  },
  {
    id: 'current-b',
    type: 'custom',
    name: 'Current finish',
    description: null,
    coordinates: [27.7, 54.1],
    placeId: null,
  },
];

const upload = (name: string) => ({ kind: 'web' as const, file: { name } as unknown as File });

const file = (name: string, text: string) => ({
  name,
  text,
  size: text.length,
  upload: upload(name),
});

const storedFile = {
  id: 42,
  original_name: 'tatry.gpx',
  ext: 'gpx',
  size: 184392,
  created_at: '2026-08-18T21:45:00Z',
  updated_at: null,
};

describe('TripRouteImportPanel — исходный файл (#1496)', () => {
  beforeEach(() => {
    mockPickerProps = {};
    mockReleaseUpload.mockClear();
    mockDownloadOriginal.mockReset();
    mockDownloadOriginal.mockResolvedValue(true);
  });

  it('отдаёт выбранный оригинал наверх вместе с точками маршрута', () => {
    const onApply = jest.fn();
    const screen = render(<TripRouteImportPanel route={currentRoute} onApply={onApply} />);

    act(() => mockPickerProps.onPicked(file('tatry.gpx', GPX_SINGLE_WITH_WAYPOINTS)));
    fireEvent.press(screen.getByTestId('trip-route-import-replace'));

    expect(onApply).toHaveBeenCalledTimes(1);
    const [nextRoute, originalUpload] = onApply.mock.calls[0];
    expect(Array.isArray(nextRoute)).toBe(true);
    expect(originalUpload).toEqual(upload('tatry.gpx'));
    // Файл теперь принадлежит вызывающему — панель его не удаляет.
    expect(mockReleaseUpload).not.toHaveBeenCalled();
  });

  it('освобождает кэш-копию при отмене предпросмотра и при отказе парсера', () => {
    const onApply = jest.fn();
    const screen = render(<TripRouteImportPanel route={currentRoute} onApply={onApply} />);

    act(() => mockPickerProps.onPicked(file('tatry.gpx', GPX_SINGLE_WITH_WAYPOINTS)));
    fireEvent.press(screen.getByTestId('trip-route-import-cancel'));
    expect(mockReleaseUpload).toHaveBeenCalledWith(upload('tatry.gpx'));

    mockReleaseUpload.mockClear();
    act(() => mockPickerProps.onPicked(file('broken.gpx', MALFORMED_GPX)));
    expect(mockReleaseUpload).toHaveBeenCalledWith(upload('broken.gpx'));
    expect(onApply).not.toHaveBeenCalled();
  });

  // Окно здесь настоящее. В jest анимация скрытия Paper-диалога
  // (`useNativeDriver: true`) не завершается, и закрытое окно остаётся в дереве,
  // поэтому «Отмену», закрытие и повторы проверяет routeBuilder.removeOriginal.test.tsx.
  it('показывает сохранённый оригинал с размером и даёт его убрать через подтверждение', () => {
    const onRemove = jest.fn();
    const screen = render(
      <TripRouteImportPanel
        route={currentRoute}
        storedFiles={[storedFile] as never}
        onRemoveStoredFile={onRemove}
        onApply={jest.fn()}
      />,
    );

    expect(screen.getByTestId('trip-route-import-stored-original')).toBeTruthy();
    expect(screen.getByText('tatry.gpx')).toBeTruthy();
    fireEvent.press(screen.getByTestId('trip-route-import-remove-original'));
    expect(onRemove).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('trip-route-import-remove-original-confirm'));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(42);
  });

  // #2054: одно касание на телефоне безвозвратно стирало загруженный трек —
  // кнопка была нейтральной ghost и удаляла без вопроса.
  it('«Удалить» оформлена как опасное действие и только открывает подтверждение', () => {
    const onRemove = jest.fn();
    const screen = render(
      <TripRouteImportPanel
        route={currentRoute}
        storedFiles={[storedFile] as never}
        onRemoveStoredFile={onRemove}
        onApply={jest.fn()}
      />,
    );
    const colors = getThemedColors(false);

    const remove = screen.getByTestId('trip-route-import-remove-original');
    expect(within(remove).getByTestId('feather-trash-2')).toBeTruthy();
    const removeStyle = StyleSheet.flatten(remove.props.style);
    expect(removeStyle.borderColor).toBe(colors.danger);
    expect(Number(removeStyle.minHeight)).toBeGreaterThanOrEqual(44);
    expect(
      StyleSheet.flatten(within(remove).getByText('Удалить оригинал').props.style).color,
    ).toBe(colors.danger);
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();

    fireEvent.press(remove);

    const dialog = within(screen.getByTestId('confirm-dialog'));
    expect(dialog.getByText('Удалить оригинальный файл?')).toBeTruthy();
    expect(
      dialog.getByText(
        'Точки и построенный маршрут останутся. Скачать исходный файл после удаления будет нельзя.',
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('trip-route-import-remove-original-confirm')).getByText('Удалить'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('trip-route-import-remove-original-cancel')).getByText('Отмена'),
    ).toBeTruthy();
    expect(onRemove).not.toHaveBeenCalled();
  });

  // #2053: «Скачать» оригинала живёт в его карточке рядом с «Удалить», имя
  // файла — до двух строк, а не обрезанное «Mullerthal_Trail_Ro…».
  it('скачивает оригинал из его карточки, рядом с удалением', async () => {
    const screen = render(
      <TripRouteImportPanel
        route={currentRoute}
        tripId={77}
        storedFiles={[storedFile] as never}
        onRemoveStoredFile={jest.fn()}
        onApply={jest.fn()}
      />,
    );

    const card = within(screen.getByTestId('trip-route-import-stored-original'));
    expect(card.getByText('tatry.gpx').props.numberOfLines).toBe(2);
    expect(card.getByTestId('trip-route-import-remove-original')).toBeTruthy();
    const download = card.getByTestId('trip-route-import-download-original');
    expect(download.props.accessibilityLabel).toBe('Поделиться оригиналом');

    fireEvent.press(download);
    await waitFor(() => expect(mockDownloadOriginal).toHaveBeenCalledTimes(1));
    expect(mockDownloadOriginal).toHaveBeenCalledWith(77, storedFile);
  });

  it('без поездки скачать оригинал не предлагает, удаление остаётся', () => {
    const screen = render(
      <TripRouteImportPanel
        route={currentRoute}
        storedFiles={[storedFile] as never}
        onRemoveStoredFile={jest.fn()}
        onApply={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('trip-route-import-download-original')).toBeNull();
    expect(screen.getByTestId('trip-route-import-remove-original')).toBeTruthy();
  });

  it('ставит кнопки скачивания GPX/KML сразу под импортом, до карточки оригинала', () => {
    const screen = render(
      <TripRouteImportPanel
        route={currentRoute}
        tripId={77}
        storedFiles={[storedFile] as never}
        fileToolbarExtra={<View testID="route-file-download-row" />}
        onApply={jest.fn()}
      />,
    );

    const tree = screen.toJSON() as {
      children?: Array<string | { props: { testID?: string } }>;
    } | null;
    const order = tree?.children?.map((child) =>
      typeof child === 'string' ? child : child.props.testID,
    );
    expect(order?.slice(0, 3)).toEqual([
      'trip-route-import-picker',
      'route-file-download-row',
      'trip-route-import-stored-originals',
    ]);
    // Импорт тянется на ширину блока.
    expect(mockPickerProps.fill).toBe(true);
  });

  it('пока новый оригинал не загружен, показывает его ожидающим рядом с сохранёнными', () => {
    const screen = render(
      <TripRouteImportPanel
        route={currentRoute}
        storedFiles={[storedFile] as never}
        pendingUploadName="new-track.gpx"
        onApply={jest.fn()}
      />,
    );

    expect(screen.getByTestId('trip-route-import-pending-original')).toBeTruthy();
    // #2069: новый файл добавится к сохранённым, а не заменит их, поэтому
    // сохранённые остаются в списке и пока новый ждёт «Сохранить маршрут».
    expect(screen.getByTestId('trip-route-import-stored-original')).toBeTruthy();
  });

  describe('#2069: несколько сохранённых файлов', () => {
    const daysFile = {
      id: 11,
      original_name: 'Mullerthal_Trail_po_dnyam.gpx',
      ext: 'gpx',
      size: 412000,
      created_at: '2026-09-23T08:00:00Z',
      updated_at: null,
    };
    const renderTwo = (onRemove = jest.fn()) =>
      render(
        <TripRouteImportPanel
          route={currentRoute}
          tripId={77}
          storedFiles={[storedFile, daysFile] as never}
          onRemoveStoredFile={onRemove}
          onApply={jest.fn()}
        />,
      );
    const cardsOf = (screen: ReturnType<typeof render>) =>
      screen.getAllByTestId('trip-route-import-stored-original').map((card) => within(card));

    it('рисует карточку на каждый файл с его именем и размером', () => {
      const cards = cardsOf(renderTwo());

      expect(cards).toHaveLength(2);
      expect(cards[0].getByText('tatry.gpx')).toBeTruthy();
      expect(cards[1].getByText('Mullerthal_Trail_po_dnyam.gpx')).toBeTruthy();
      expect(cards[1].getByText(/^Оригинальный трек сохранён у поездки · 402/)).toBeTruthy();
    });

    it('«Скачать» второй карточки скачивает её файл, а не первый', async () => {
      const screen = renderTwo();

      fireEvent.press(cardsOf(screen)[1].getByTestId('trip-route-import-download-original'));

      await waitFor(() => expect(mockDownloadOriginal).toHaveBeenCalledTimes(1));
      expect(mockDownloadOriginal).toHaveBeenCalledWith(77, daysFile);
    });

    it('«Удалить» второй карточки после подтверждения отдаёт её routeId', () => {
      const onRemove = jest.fn();
      const screen = renderTwo(onRemove);

      fireEvent.press(cardsOf(screen)[1].getByTestId('trip-route-import-remove-original'));
      expect(onRemove).not.toHaveBeenCalled();
      fireEvent.press(screen.getByTestId('trip-route-import-remove-original-confirm'));

      expect(onRemove).toHaveBeenCalledTimes(1);
      expect(onRemove).toHaveBeenCalledWith(11);
    });

    it('«Только трек на карту» добавляет файл и ничего не удаляет, о чём говорит подсказка', () => {
      const onApply = jest.fn();
      const onRemove = jest.fn();
      const screen = render(
        <TripRouteImportPanel
          route={currentRoute}
          storedFiles={[storedFile, daysFile] as never}
          onRemoveStoredFile={onRemove}
          onApply={onApply}
        />,
      );

      act(() => mockPickerProps.onPicked(file('loops.gpx', GPX_SINGLE_WITH_WAYPOINTS)));
      expect(screen.getByTestId('trip-route-import-original-append-hint').props.children).toBe(
        'Файл добавится к уже сохранённым трекам — прежние останутся на карте. Лишний трек удалите кнопкой «Удалить оригинал» в его карточке.',
      );
      fireEvent.press(screen.getByTestId('trip-route-import-original-only'));

      expect(onApply).toHaveBeenCalledTimes(1);
      const [nextRoute, originalUpload] = onApply.mock.calls[0];
      expect(nextRoute).toEqual(currentRoute);
      expect(originalUpload).toEqual(upload('loops.gpx'));
      expect(onRemove).not.toHaveBeenCalled();
    });

    it('без сохранённых файлов подсказки о добавлении нет', () => {
      const screen = render(<TripRouteImportPanel route={currentRoute} onApply={jest.fn()} />);

      act(() => mockPickerProps.onPicked(file('loops.gpx', GPX_SINGLE_WITH_WAYPOINTS)));

      expect(screen.getByTestId('trip-route-import-original-hint')).toBeTruthy();
      expect(screen.queryByTestId('trip-route-import-original-append-hint')).toBeNull();
    });
  });

  it('показывает ошибку загрузки оригинала отдельно от ошибок разбора файла', () => {
    const screen = render(
      <TripRouteImportPanel
        route={currentRoute}
        uploadError="Маршрут сохранён, но оригинальный файл загрузить не удалось."
        onApply={jest.fn()}
      />,
    );

    const error = screen.getByTestId('trip-route-import-upload-error');
    expect(error.props.accessibilityLiveRegion).toBe('assertive');
    expect(screen.queryByTestId('trip-route-import-error')).toBeNull();
  });
});
