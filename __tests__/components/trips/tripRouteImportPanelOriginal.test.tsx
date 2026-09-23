/**
 * #1496 — панель импорта и исходный файл маршрута.
 *
 * Что держит тест:
 *  1. выбранный файл уходит наверх ВМЕСТЕ с точками — его грузит «Сохранить
 *     маршрут», поэтому оригинал и точки не расходятся;
 *  2. кэш-копия выбранного файла освобождается при отмене и при отказе парсера,
 *     иначе на устройстве копятся файлы до 20 МиБ;
 *  3. сохранённый у поездки оригинал показан с именем/размером и его можно убрать;
 *  4. ошибка загрузки оригинала видна отдельно от ошибок разбора файла.
 */
import React from 'react';
import { View } from 'react-native';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';

import type { RoutePoint } from '@/api/plannedTrips';
import {
  GPX_SINGLE_WITH_WAYPOINTS,
  MALFORMED_GPX,
} from '@/__tests__/fixtures/tripRouteImportFixtures';

let mockPickerProps: Record<string, any> = {};
const mockReleaseUpload = jest.fn();
const mockDownloadOriginal = jest.fn();

jest.mock('@expo/vector-icons/Feather', () => () => null);
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

  it('показывает сохранённый оригинал с размером и даёт его убрать', () => {
    const onRemove = jest.fn();
    const screen = render(
      <TripRouteImportPanel
        route={currentRoute}
        storedFile={storedFile as never}
        onRemoveStoredFile={onRemove}
        onApply={jest.fn()}
      />,
    );

    expect(screen.getByTestId('trip-route-import-stored-original')).toBeTruthy();
    expect(screen.getByText('tatry.gpx')).toBeTruthy();
    fireEvent.press(screen.getByTestId('trip-route-import-remove-original'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  // #2053: «Скачать» оригинала живёт в его карточке рядом с «Удалить», имя
  // файла — до двух строк, а не обрезанное «Mullerthal_Trail_Ro…».
  it('скачивает оригинал из его карточки, рядом с удалением', async () => {
    const screen = render(
      <TripRouteImportPanel
        route={currentRoute}
        tripId={77}
        storedFile={storedFile as never}
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
        storedFile={storedFile as never}
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
        storedFile={storedFile as never}
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
      'trip-route-import-stored-original',
    ]);
    // Импорт тянется на ширину блока.
    expect(mockPickerProps.fill).toBe(true);
  });

  it('пока оригинал не загружен, показывает его как ожидающий сохранения', () => {
    const screen = render(
      <TripRouteImportPanel
        route={currentRoute}
        storedFile={storedFile as never}
        pendingUploadName="new-track.gpx"
        onApply={jest.fn()}
      />,
    );

    expect(screen.getByTestId('trip-route-import-pending-original')).toBeTruthy();
    // Пока новый файл ждёт сохранения, старый как «текущий» не показывается.
    expect(screen.queryByTestId('trip-route-import-stored-original')).toBeNull();
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
