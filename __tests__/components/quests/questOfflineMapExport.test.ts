import {
  buildQuestOfflineMapGeoJSON,
  buildQuestOfflineMapGpx,
  getQuestOfflineMapPoints,
} from '@/components/quests/questOfflineMapExport';

describe('questOfflineMapExport', () => {
  const steps = [
    { lat: 53.9023, lng: 27.5619, title: 'Старт', location: 'Площадь' },
    { lat: 0, lng: 0, title: 'Без координат' },
    { lat: 53.9041, lng: 27.5556, title: 'Финиш', location: 'Парк' },
  ];

  it('keeps only steps with real coordinates', () => {
    expect(getQuestOfflineMapPoints(steps)).toEqual([steps[0], steps[2]]);
  });

  it('builds GPX with waypoints and route track for offline map import', () => {
    const file = buildQuestOfflineMapGpx({ title: 'Минский квест', steps });

    // Filename is transliterated Cyrillic→Latin so the title doesn't collapse
    // to the generic fallback; GPX <name> keeps the original Cyrillic title.
    expect(file.filename).toBe('minskiy-kvest.gpx');
    expect(file.mimeType).toBe('application/gpx+xml');
    expect(file.content).toContain('<name>Минский квест</name>');
    expect(file.content).toContain('<wpt lat="53.9023" lon="27.5619">');
    expect(file.content).toContain('<name>Старт</name>');
    expect(file.content).toContain('<wpt lat="53.9041" lon="27.5556">');
    expect(file.content).toContain('<trkpt lat="53.9023" lon="27.5619"></trkpt>');
    expect(file.content).toContain('<trkpt lat="53.9041" lon="27.5556"></trkpt>');
    expect(file.content).not.toContain('Без координат');
  });

  it('uses routed geometry for GPX track while keeping quest waypoints', () => {
    const routedTrack: Array<[number, number]> = [
      [27.5619, 53.9023],
      [27.5601, 53.9031],
      [27.5556, 53.9041],
    ];

    const file = buildQuestOfflineMapGpx({
      title: 'Минский квест',
      steps,
      routeTrack: routedTrack,
      routeSource: 'routed',
    });

    expect(file.content).toContain('<wpt lat="53.9023" lon="27.5619">');
    expect(file.content).toContain('<wpt lat="53.9041" lon="27.5556">');
    expect(file.content).toContain('<trkpt lat="53.9031" lon="27.5601"></trkpt>');
  });

  it('builds GeoJSON LineString from routed geometry and marks it as real route', () => {
    const routedTrack: Array<[number, number]> = [
      [27.5619, 53.9023],
      [27.5601, 53.9031],
      [27.5556, 53.9041],
    ];

    const geojson = JSON.parse(buildQuestOfflineMapGeoJSON({
      title: 'Минский квест',
      steps,
      routeTrack: routedTrack,
      routeSource: 'routed',
    }));

    const line = geojson.features.find((feature: any) => feature.geometry.type === 'LineString');
    expect(line.geometry.coordinates).toEqual(routedTrack);
    expect(line.properties).toMatchObject({ routeSource: 'routed', approximate: false });
  });

  it('falls back to a generic filename when the title has no latinizable chars', () => {
    const file = buildQuestOfflineMapGpx({ title: '«»—', steps });

    expect(file.filename).toBe('quest-offline-map.gpx');
  });

  describe('loop closure (кольцевые велоквесты)', () => {
    // Три точки кольца: финиш далеко от старта — прямой fallback-трек должен
    // замыкаться сегментом «финиш → старт», а waypoint-маркеры не дублироваться.
    const loopSteps = [
      { lat: 50.0533, lng: 19.9333, title: 'Старт' },
      { lat: 50.0184, lng: 19.8029, title: 'Середина' },
      { lat: 50.0520, lng: 19.9145, title: 'Финиш' },
    ];

    it('closes the direct GPX track back to the start when closeLoop is set', () => {
      const file = buildQuestOfflineMapGpx({ title: 'Велокольцо', steps: loopSteps, closeLoop: true });

      const trackPoints = file.content.match(/<trkpt /g) ?? [];
      expect(trackPoints).toHaveLength(4);
      // Замыкающая точка = координаты старта, но waypoint старта один.
      expect(file.content.match(/<trkpt lat="50.0533" lon="19.9333">/g)).toHaveLength(2);
      expect(file.content.match(/<wpt lat="50.0533" lon="19.9333">/g)).toHaveLength(1);
    });

    it('closes the GeoJSON fallback LineString when closeLoop is set', () => {
      const geojson = JSON.parse(buildQuestOfflineMapGeoJSON({
        title: 'Велокольцо',
        steps: loopSteps,
        closeLoop: true,
      }));

      const line = geojson.features.find((feature: any) => feature.geometry.type === 'LineString');
      expect(line.geometry.coordinates).toHaveLength(4);
      expect(line.geometry.coordinates[0]).toEqual(line.geometry.coordinates[3]);
      const pointFeatures = geojson.features.filter((feature: any) => feature.geometry.type === 'Point');
      expect(pointFeatures).toHaveLength(3);
    });

    it('does not close the track without closeLoop', () => {
      const file = buildQuestOfflineMapGpx({ title: 'Линейный', steps: loopSteps });
      expect(file.content.match(/<trkpt /g)).toHaveLength(3);
    });
  });
});
