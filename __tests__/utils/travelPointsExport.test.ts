import {
  buildGoogleMapsDirectionsUrl,
  buildTravelPointsExportInput,
  getExportableTravelPointWaypoints,
} from '@/utils/travelPointsExport';

describe('travelPointsExport', () => {
  it('normalizes travel address points into export waypoints', () => {
    const waypoints = getExportableTravelPointWaypoints([
      {
        address: 'Минск',
        coord: '53.9,27.56',
        categoryName: { name: 'Город' },
        description: 'Центр',
      },
      { address: 'Invalid', coord: 'not-a-coordinate' },
      { name: 'Брест', lat: 52.1, lng: 23.7 },
    ]);

    expect(waypoints).toEqual([
      {
        name: 'Минск',
        description: 'Город\nЦентр',
        coordinates: [27.56, 53.9],
      },
      {
        name: 'Брест',
        description: '',
        coordinates: [23.7, 52.1],
      },
    ]);
  });

  it('builds export input from travel data', () => {
    const input = buildTravelPointsExportInput({
      id: 1,
      slug: 'route',
      name: 'Weekend route',
      travelAddress: [{ address: 'Start', coord: '53,27' }],
    } as any);

    expect(input.name).toBe('Weekend route points');
    expect(input.description).toBe('Точки маршрута из Metravel: Weekend route');
    expect(input.sourceName).toBe('Weekend route');
    expect(input.waypoints).toHaveLength(1);
    expect(input.track).toBeUndefined();
  });

  it('includes the source article URL when present', () => {
    const input = buildTravelPointsExportInput({
      id: 1,
      slug: 'route',
      name: 'Weekend route',
      url: 'https://metravel.by/travels/weekend-route',
      travelAddress: [{ address: 'Start', coord: '53,27' }],
    } as any);

    expect(input.description).toContain('Источник: https://metravel.by/travels/weekend-route');
    expect(input.sourceUrl).toBe('https://metravel.by/travels/weekend-route');
  });

  it('builds a Google Maps directions URL from all exportable waypoints', () => {
    const url = buildGoogleMapsDirectionsUrl([
      { name: 'Start', coordinates: [27.56, 53.9] },
      { name: 'Finish', coordinates: [23.7, 52.1] },
    ]);

    expect(url).toBe('https://www.google.com/maps/dir/53.9,27.56/52.1,23.7');
  });
});
