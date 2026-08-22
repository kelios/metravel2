// #1496 — фаза 2 импорта: оригинальная геометрия трека для карты планировщика.
// Ключевой инвариант задачи: форма из файла НЕ упрощается до точек маршрута
// (фаза 1 сводит трек к ≤50 точкам), а переносится на карту как есть.
import {
  ORIGINAL_TRACK_MAX_DISPLAY_POINTS,
  buildOriginalTrackGeometry,
  routeFileExtension,
} from '@/components/trips/planning/tripOriginalTrack';
import { TRIP_ROUTE_IMPORT_DRAFT_MAX_POINTS } from '@/components/trips/planning/tripRouteImport';
import { parseRouteFilePreviews } from '@/utils/routeFileParser';

const gpxWithPoints = (count: number): string => {
  const points = Array.from({ length: count }, (_, index) => {
    const lat = (52 + index * 0.0005).toFixed(6);
    const lng = (23.7 + index * 0.0007).toFixed(6);
    return `<trkpt lat="${lat}" lon="${lng}"><ele>${150 + (index % 25)}</ele></trkpt>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1"><trk><trkseg>${points}</trkseg></trk></gpx>`;
};

describe('buildOriginalTrackGeometry', () => {
  it('keeps every point of a real-sized track instead of simplifying it to route points', () => {
    const previews = parseRouteFilePreviews(gpxWithPoints(458), 'gpx');

    const track = buildOriginalTrackGeometry(previews);

    expect(track).not.toBeNull();
    expect(track!.sourcePointCount).toBe(458);
    expect(track!.geometry).toHaveLength(458);
    expect(track!.thinnedForDisplay).toBe(false);
    // Именно это и отличает фазу 2 от фазы 1: черновик маршрута ограничен
    // TRIP_ROUTE_IMPORT_DRAFT_MAX_POINTS, а оригинальная линия — нет.
    expect(track!.geometry.length).toBeGreaterThan(TRIP_ROUTE_IMPORT_DRAFT_MAX_POINTS);
    expect(track!.distanceKm).toBeGreaterThan(0);
  });

  it('returns [lng, lat] pairs in the planned-trip geometry format', () => {
    const previews = parseRouteFilePreviews(gpxWithPoints(3), 'gpx');

    const track = buildOriginalTrackGeometry(previews)!;

    expect(track.geometry[0][0]).toBeCloseTo(23.7, 5);
    expect(track.geometry[0][1]).toBeCloseTo(52, 5);
  });

  it('joins several tracks of one file into a single map line', () => {
    const track = buildOriginalTrackGeometry([
      { linePoints: [{ coord: '52,23' }, { coord: '52.1,23.1' }], elevationProfile: [] },
      { linePoints: [{ coord: '53,24' }, { coord: '53.1,24.1' }], elevationProfile: [] },
    ])!;

    expect(track.geometry).toHaveLength(4);
    expect(track.sourcePointCount).toBe(4);
  });

  it('thins only above the display ceiling and keeps exact start and finish', () => {
    const linePoints = Array.from({ length: 40 }, (_, index) => ({
      coord: `${(52 + index * 0.01).toFixed(4)},${(23 + index * 0.01).toFixed(4)}`,
    }));

    const track = buildOriginalTrackGeometry([{ linePoints, elevationProfile: [] }], 10)!;

    expect(track.geometry).toHaveLength(10);
    expect(track.sourcePointCount).toBe(40);
    expect(track.thinnedForDisplay).toBe(true);
    expect(track.geometry[0]).toEqual([23, 52]);
    expect(track.geometry[track.geometry.length - 1]).toEqual([23.39, 52.39]);
  });

  it('has a display ceiling far above a real track so normal files are never thinned', () => {
    expect(ORIGINAL_TRACK_MAX_DISPLAY_POINTS).toBeGreaterThan(458);
  });

  it('drops broken coordinates and refuses a track shorter than a line', () => {
    expect(
      buildOriginalTrackGeometry([
        { linePoints: [{ coord: '52,23' }, { coord: 'nope' }], elevationProfile: [] },
      ]),
    ).toBeNull();
    expect(buildOriginalTrackGeometry([])).toBeNull();
    expect(
      buildOriginalTrackGeometry([
        { linePoints: [{ coord: '95,23' }, { coord: '52,23' }, { coord: '52.1,23.1' }], elevationProfile: [] },
      ])!.sourcePointCount,
    ).toBe(2);
  });
});

describe('routeFileExtension', () => {
  it('prefers the backend ext and falls back to the file name', () => {
    expect(routeFileExtension({ ext: 'GPX', original_name: 'a.kml' })).toBe('gpx');
    expect(routeFileExtension({ ext: null, original_name: 'weekend-route.KML' })).toBe('kml');
    expect(routeFileExtension({ ext: '.gpx', original_name: null })).toBe('gpx');
    expect(routeFileExtension({ ext: null, original_name: null })).toBe('');
  });
});
