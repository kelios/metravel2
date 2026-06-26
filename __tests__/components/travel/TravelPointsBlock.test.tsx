import { createRef } from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { TravelPointsBlock } from '@/components/travel/details/sections/TravelPointsBlock';

jest.mock('@/components/travel/PointList', () => ({
  __esModule: true,
  default: ({ points }: { points: unknown[] }) => {
    const { Text, View } = require('react-native');
    return (
      <View testID="point-list-mock">
        <Text>{points.length} route points</Text>
      </View>
    );
  },
}));

jest.mock('@/components/travel/TravelDetailSkeletons', () => ({
  PointListSkeleton: () => {
    const { View } = require('react-native');
    return <View testID="point-list-skeleton" />;
  },
}));

jest.mock('@/utils/routeExport', () => {
  const actual = jest.requireActual('@/utils/routeExport');
  return {
    ...actual,
    saveRouteExportFile: jest.fn(),
  };
});

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrlInNewTab: jest.fn(),
}));

jest.mock('@/utils/toast', () => ({
  showToast: jest.fn(),
}));

const { saveRouteExportFile } = require('@/utils/routeExport');
const { openExternalUrlInNewTab } = require('@/utils/externalLinks');

const styles = {
  sectionContainer: {},
  contentStable: {},
  webDeferredSection: {},
  pointsHeaderRow: {},
  sectionHeaderText: {},
  pointsExportWrap: {},
  pointsExportActions: {},
  pointsExportButton: {},
  pointsExportButtonText: {},
  pointsExportHint: {},
  fallback: {},
};

const travel = {
  id: 22,
  slug: 'gomel-route',
  name: 'Гомельский маршрут',
  url: 'https://metravel.by/travels/gomel-route',
  travelAddress: [
    {
      id: 1,
      address: 'Дворец Румянцевых-Паскевичей',
      coord: '52.4242,31.0148',
      categoryName: 'Дворец',
      description: 'Главная точка маршрута',
    },
    {
      id: 2,
      address: 'Парк над Сожем',
      coord: '52.4238,31.017',
    },
  ],
} as any;

describe('TravelPointsBlock', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    saveRouteExportFile.mockResolvedValue(true);
    (Platform as { OS: string }).OS = 'android';
  });

  afterEach(() => {
    (Platform as { OS: string }).OS = originalOS;
  });

  it('shows all route-point export actions on native and shares KML with Metravel source styling', async () => {
    const { getByLabelText } = render(
      <TravelPointsBlock
        anchors={{ points: createRef() } as any}
        handlePointCardPress={jest.fn()}
        styles={styles}
        travel={travel}
      />,
    );

    expect(getByLabelText('Скачать все точки в GPX')).toBeTruthy();
    expect(getByLabelText('Скачать все точки в KML для Organic Maps и MAPS.ME')).toBeTruthy();
    expect(getByLabelText('Открыть все точки в Google Maps')).toBeTruthy();

    fireEvent.press(getByLabelText('Скачать все точки в KML для Organic Maps и MAPS.ME'));

    await waitFor(() => expect(saveRouteExportFile).toHaveBeenCalledTimes(1));
    const [file, dialogTitle] = saveRouteExportFile.mock.calls[0];

    expect(dialogTitle).toBe('Сохранить точки для офлайн-карт');
    expect(file.filename).toMatch(/Gomelskiy-marshrut-points\.kml$/);
    expect(file.content).toContain('<Style id="metravelPoint">');
    expect(file.content).toContain('<styleUrl>#metravelPoint</styleUrl>');
    expect(file.content).toContain('<color>ff2b7cff</color>');
    expect(file.content).toContain('Гомельский маршрут');
    expect(file.content).toContain('https://metravel.by/travels/gomel-route');
  });

  it('opens all exportable points in Google Maps on native', () => {
    const { getByLabelText } = render(
      <TravelPointsBlock
        anchors={{ points: createRef() } as any}
        handlePointCardPress={jest.fn()}
        styles={styles}
        travel={travel}
      />,
    );

    fireEvent.press(getByLabelText('Открыть все точки в Google Maps'));

    expect(openExternalUrlInNewTab).toHaveBeenCalledWith(
      'https://www.google.com/maps/dir/52.4242,31.0148/52.4238,31.017',
    );
  });
});
