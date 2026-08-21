import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import type { RoutePoint } from '@/api/plannedTrips';
import TripRouteImportPanel from '@/components/trips/planning/TripRouteImportPanel';
import { TRIP_ROUTE_IMPORT_MAX_BYTES } from '@/components/trips/planning/tripRouteImport';
import {
  EMPTY_GPX,
  GPX_MULTIPLE_ROUTES,
  GPX_SINGLE_WITH_WAYPOINTS,
  MALFORMED_GPX,
} from '@/__tests__/fixtures/tripRouteImportFixtures';

let mockPickerProps: Record<string, any> = {};
let mockMapProps: Record<string, any> = {};

jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@/components/trips/planning/TripRouteFilePicker', () => {
  return function MockTripRouteFilePicker(props: Record<string, unknown>) {
    const { Pressable, Text } = require('react-native');
    mockPickerProps = props;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.label as string}
        accessibilityState={{ disabled: Boolean(props.disabled), busy: Boolean(props.loading) }}
        testID="trip-route-import-picker"
      >
        <Text>{props.label as string}</Text>
      </Pressable>
    );
  };
});
jest.mock('@/components/MapPage/TravelMap', () => ({
  TravelMap: (props: Record<string, unknown>) => {
    const { Text, View } = require('react-native');
    mockMapProps = props;
    const routeLines = props.routeLines as Array<{ coords: unknown[] }>;
    return (
      <View testID="trip-route-import-map">
        <Text testID="trip-route-import-map-lines">{String(routeLines.length)}</Text>
      </View>
    );
  },
}));

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

const file = (name: string, text: string, size = text.length) => ({ name, text, size });

describe('TripRouteImportPanel', () => {
  beforeEach(() => {
    mockPickerProps = {};
    mockMapProps = {};
  });

  it('shows a two-line preview, localized statistics, names, and explicit actions', () => {
    const onApply = jest.fn();
    const screen = render(
      <TripRouteImportPanel
        route={currentRoute}
        routeGeometry={[[27.5, 53.9], [27.6, 54], [27.7, 54.1]]}
        onApply={onApply}
      />,
    );

    expect(screen.getByTestId('trip-route-import-picker').props.accessibilityLabel).toBe(
      'Загрузить трек (GPX/KML)',
    );
    act(() => mockPickerProps.onPicked(file('weekend.gpx', GPX_SINGLE_WITH_WAYPOINTS)));

    expect(screen.getByText('Предпросмотр импорта')).toBeTruthy();
    expect(screen.getByText('Точек: 3')).toBeTruthy();
    expect(screen.getByText(/Расстояние:/)).toBeTruthy();
    expect(screen.getByText('Start camp')).toBeTruthy();
    expect(screen.getByText('Viewpoint')).toBeTruthy();
    expect(screen.getByText('Текущий маршрут')).toBeTruthy();
    expect(screen.getByText('Загруженный трек')).toBeTruthy();
    expect(screen.getByTestId('trip-route-import-map-lines').props.children).toBe('2');
    expect(mockMapProps.showRouteLine).toBe(true);
    expect(mockMapProps.routeLines[0].coords).toEqual([
      [53.9, 27.5],
      [54, 27.6],
      [54.1, 27.7],
    ]);
    expect(mockMapProps.routeLines[1].coords[0]).toEqual([52.1, 23.7]);
    expect(screen.getByTestId('trip-route-import-replace').props.accessibilityLabel).toBe(
      'Заменить маршрут',
    );
    expect(screen.getByTestId('trip-route-import-append').props.accessibilityLabel).toBe(
      'Добавить к маршруту',
    );
    expect(onApply).not.toHaveBeenCalled();
  });

  it('switches preview geometry and statistics without applying the draft', () => {
    const onApply = jest.fn();
    const screen = render(<TripRouteImportPanel route={currentRoute} onApply={onApply} />);
    act(() => mockPickerProps.onPicked(file('multi.gpx', GPX_MULTIPLE_ROUTES)));

    expect(screen.getByText('Выберите маршрут из файла')).toBeTruthy();
    expect(screen.getByLabelText('Маршрут 1').props.accessibilityState.checked).toBe(true);
    expect(mockMapProps.routeLines[1].coords[0]).toEqual([52.1, 23.7]);

    fireEvent.press(screen.getByLabelText('Маршрут 2'));

    expect(screen.getByLabelText('Маршрут 2').props.accessibilityState.checked).toBe(true);
    expect(mockMapProps.routeLines[1].coords[0]).toEqual([53.1, 24.7]);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('applies replace and append only after their explicit actions', () => {
    const onReplace = jest.fn();
    const replaceScreen = render(
      <TripRouteImportPanel route={currentRoute} onApply={onReplace} />,
    );
    act(() => mockPickerProps.onPicked(file('replace.gpx', GPX_SINGLE_WITH_WAYPOINTS)));
    expect(onReplace).not.toHaveBeenCalled();
    fireEvent.press(replaceScreen.getByTestId('trip-route-import-replace'));
    expect(onReplace).toHaveBeenCalledTimes(1);
    expect(onReplace.mock.calls[0][0][0]).toMatchObject({
      name: 'Start camp',
      coordinates: [23.7, 52.1],
    });
    expect(replaceScreen.queryByTestId('trip-route-import-preview')).toBeNull();
    replaceScreen.unmount();

    const onAppend = jest.fn();
    const appendScreen = render(
      <TripRouteImportPanel route={currentRoute} onApply={onAppend} />,
    );
    act(() => mockPickerProps.onPicked(file('append.gpx', GPX_SINGLE_WITH_WAYPOINTS)));
    fireEvent.press(appendScreen.getByTestId('trip-route-import-append'));
    expect(onAppend).toHaveBeenCalledTimes(1);
    expect(onAppend.mock.calls[0][0].slice(0, currentRoute.length)).toEqual(currentRoute);
  });

  it('announces reading and parser errors while leaving the draft unchanged', () => {
    const onApply = jest.fn();
    const screen = render(<TripRouteImportPanel route={currentRoute} onApply={onApply} />);

    act(() => mockPickerProps.onBusyChange(true));
    expect(screen.getByTestId('trip-route-import-reading').props.accessibilityLiveRegion).toBe(
      'polite',
    );
    act(() => mockPickerProps.onBusyChange(false));
    act(() => mockPickerProps.onPicked(file('broken.gpx', MALFORMED_GPX)));

    expect(screen.getByText('Файл повреждён или содержит некорректный GPX/KML.')).toBeTruthy();
    expect(screen.getByTestId('trip-route-import-error').props.accessibilityLiveRegion).toBe(
      'assertive',
    );
    expect(screen.queryByTestId('trip-route-import-preview')).toBeNull();
    expect(onApply).not.toHaveBeenCalled();
  });

  it.each([
    ['unsupported', file('route.txt', 'not xml'), 'Поддерживаются только файлы GPX и KML.'],
    [
      'tooLarge',
      file('huge.gpx', GPX_SINGLE_WITH_WAYPOINTS, TRIP_ROUTE_IMPORT_MAX_BYTES + 1),
      'Файл слишком большой. Выберите GPX или KML размером до 20 МиБ.',
    ],
    ['empty', file('empty.gpx', EMPTY_GPX), 'В файле нет трека минимум с двумя точками.'],
  ])('shows the %s validation error non-destructively', (_code, selectedFile, message) => {
    const onApply = jest.fn();
    const screen = render(<TripRouteImportPanel route={currentRoute} onApply={onApply} />);

    act(() => mockPickerProps.onPicked(selectedFile));

    expect(screen.getByText(message)).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('maps native/web read failures and capacity failures to localized errors', () => {
    const fullRoute = Array.from({ length: 50 }, (_, index): RoutePoint => ({
      id: `point-${index}`,
      type: 'custom',
      name: `Point ${index + 1}`,
      description: null,
      coordinates: [20 + index * 0.001, 50],
      placeId: null,
    }));
    const onApply = jest.fn();
    const screen = render(<TripRouteImportPanel route={fullRoute} onApply={onApply} />);

    act(() => mockPickerProps.onError('read'));
    expect(screen.getByText('Не удалось прочитать файл. Выберите его ещё раз.')).toBeTruthy();

    act(() => mockPickerProps.onPicked(file('route.gpx', GPX_SINGLE_WITH_WAYPOINTS)));
    fireEvent.press(screen.getByTestId('trip-route-import-append'));
    expect(screen.getByText(
      'Маршрут не помещается в доступный лимит точек. Удалите часть текущих или именованных точек.',
    )).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('cancels pending preview without changing the current route', () => {
    const onApply = jest.fn();
    const screen = render(<TripRouteImportPanel route={currentRoute} onApply={onApply} />);
    act(() => mockPickerProps.onPicked(file('route.gpx', GPX_SINGLE_WITH_WAYPOINTS)));

    fireEvent.press(screen.getByTestId('trip-route-import-cancel'));

    expect(screen.queryByTestId('trip-route-import-preview')).toBeNull();
    expect(onApply).not.toHaveBeenCalled();
  });
});
