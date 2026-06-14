import { buildQuestOfflineMapGpx, getQuestOfflineMapPoints } from '@/components/quests/questOfflineMapExport';

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

    expect(file.filename).toBe('quest-offline-map.gpx');
    expect(file.mimeType).toBe('application/gpx+xml');
    expect(file.content).toContain('<name>Минский квест</name>');
    expect(file.content).toContain('<wpt lat="53.9023" lon="27.5619">');
    expect(file.content).toContain('<name>Старт</name>');
    expect(file.content).toContain('<wpt lat="53.9041" lon="27.5556">');
    expect(file.content).toContain('<trkpt lat="53.9023" lon="27.5619"></trkpt>');
    expect(file.content).toContain('<trkpt lat="53.9041" lon="27.5556"></trkpt>');
    expect(file.content).not.toContain('Без координат');
  });
});
