// #1496 — фаза 2 импорта: оригинальная геометрия трека для карты планировщика.
// Ключевой инвариант задачи: форма из файла НЕ упрощается до точек маршрута
// (фаза 1 сводит трек к ≤50 точкам), а переносится на карту как есть.
import {
  ORIGINAL_TRACK_MAX_DISPLAY_POINTS,
  ORIGINAL_TRACK_MAX_SEGMENTS,
  buildOriginalTrackGeometry,
  routeFileExtension,
} from '@/components/trips/planning/tripOriginalTrack';
import { TRIP_ROUTE_IMPORT_DRAFT_MAX_POINTS } from '@/components/trips/planning/tripRouteImport';
import { calculateRouteDistanceKm, parseRouteFilePreviews } from '@/utils/routeFileParser';

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
    expect(track!.segments).toHaveLength(1);
    expect(track!.segments[0]).toHaveLength(458);
    expect(track!.thinnedForDisplay).toBe(false);
    // Именно это и отличает фазу 2 от фазы 1: черновик маршрута ограничен
    // TRIP_ROUTE_IMPORT_DRAFT_MAX_POINTS, а оригинальная линия — нет.
    expect(track!.segments[0].length).toBeGreaterThan(TRIP_ROUTE_IMPORT_DRAFT_MAX_POINTS);
    expect(track!.distanceKm).toBeGreaterThan(0);
  });

  it('returns [lng, lat] pairs in the planned-trip geometry format', () => {
    const previews = parseRouteFilePreviews(gpxWithPoints(3), 'gpx');

    const track = buildOriginalTrackGeometry(previews)!;

    expect(track.segments[0][0][0]).toBeCloseTo(23.7, 5);
    expect(track.segments[0][0][1]).toBeCloseTo(52, 5);
  });

  // #1847 — регресс-контроль: возврат к склейке `flatMap` снова провёл бы между
  // двумя несмежными кольцами похода прямую, которой в файле нет.
  it('keeps every track of one file as its own map line', () => {
    const track = buildOriginalTrackGeometry([
      { linePoints: [{ coord: '52,23' }, { coord: '52.1,23.1' }], elevationProfile: [] },
      { linePoints: [{ coord: '53,24' }, { coord: '53.1,24.1' }], elevationProfile: [] },
    ])!;

    expect(track.segments).toHaveLength(2);
    expect(track.segments[0]).toEqual([[23, 52], [23.1, 52.1]]);
    expect(track.segments[1]).toEqual([[24, 53], [24.1, 53.1]]);
    // Ни один сегмент не унёс координату соседа — шва между треками нет.
    expect(track.segments[0]).not.toContainEqual([24, 53]);
    expect(track.segments[1]).not.toContainEqual([23.1, 52.1]);
    expect(track.sourcePointCount).toBe(4);
  });

  // #1847 — тот же фальшивый перегон приезжает и внутри ОДНОГО `<trk>`: парсер
  // собирает все `<trkpt>` трека подряд, не разделяя `<trkseg>`, поэтому пауза
  // записи между двумя кольцами похода приходит сюда обычным разрывом в списке
  // точек. Разрез по границе `<trk>` такой файл не спасает.
  it('breaks the line on a recording gap inside a single track', () => {
    const ring = (lat: number, lng: number): string =>
      Array.from({ length: 10 }, (_, index) =>
        `<trkpt lat="${(lat + index * 0.0005).toFixed(6)}" lon="${lng.toFixed(6)}"/>`,
      ).join('');
    // Кольца стоят в ~8,6 км друг от друга — ровно тот разрыв из карточки.
    const gpx = `<?xml version="1.0"?><gpx version="1.1"><trk>`
      + `<trkseg>${ring(49.8136, 6.4212)}</trkseg>`
      + `<trkseg>${ring(49.7909, 6.3065)}</trkseg>`
      + `</trk></gpx>`;

    const previews = parseRouteFilePreviews(gpx, 'gpx');
    expect(previews).toHaveLength(1);

    const track = buildOriginalTrackGeometry(previews)!;

    expect(track.segments).toHaveLength(2);
    expect(track.segments[0]).toHaveLength(10);
    expect(track.segments[1]).toHaveLength(10);
    // Ни одна линия не соединяет кольца: у первой все долготы от первого кольца.
    expect(track.segments[0].every(([lng]) => lng === 6.4212)).toBe(true);
    expect(track.segments[1].every(([lng]) => lng === 6.3065)).toBe(true);
    expect(track.sourcePointCount).toBe(20);
  });

  it('measures each track on its own instead of adding the jump between them', () => {
    const first = { linePoints: [{ coord: '52,23' }, { coord: '52.1,23.1' }], elevationProfile: [] };
    // Разрыв между треками намеренно короткий. Перелёт в сотни километров
    // `calculateRouteDistanceKm` отбрасывает сама как «телепорт», и на таком
    // разрыве тест прошёл бы даже после возврата к склейке; на коротком —
    // склеенный список честно прибавляет перегон, которого в треках нет.
    const second = { linePoints: [{ coord: '52.2,23.2' }, { coord: '52.3,23.3' }], elevationProfile: [] };

    const apart = buildOriginalTrackGeometry([first])!.distanceKm
      + buildOriginalTrackGeometry([second])!.distanceKm;
    const glued = calculateRouteDistanceKm([...first.linePoints, ...second.linePoints]);

    expect(buildOriginalTrackGeometry([first, second])!.distanceKm).toBeCloseTo(apart, 6);
    expect(glued).toBeGreaterThan(apart + 10);
  });

  it('spreads the display ceiling over the tracks so a short one never disappears', () => {
    const long = Array.from({ length: 100 }, (_, index) => ({
      coord: `${(52 + index * 0.001).toFixed(4)},${(23 + index * 0.001).toFixed(4)}`,
    }));
    const short = Array.from({ length: 10 }, (_, index) => ({
      coord: `${(55 + index * 0.001).toFixed(4)},${(29 + index * 0.001).toFixed(4)}`,
    }));

    const track = buildOriginalTrackGeometry(
      [
        { linePoints: long, elevationProfile: [] },
        { linePoints: short, elevationProfile: [] },
      ],
      22,
    )!;

    const displayed = track.segments.reduce((sum, segment) => sum + segment.length, 0);
    expect(displayed).toBeLessThanOrEqual(22);
    expect(track.segments).toHaveLength(2);
    // Короткий трек остаётся рисуемой линией, а не схлопывается в точку.
    expect(track.segments[1].length).toBeGreaterThanOrEqual(2);
    expect(track.segments[0].length).toBeGreaterThan(track.segments[1].length);
    expect(track.thinnedForDisplay).toBe(true);
    // Концы каждого трека сохраняются точно.
    expect(track.segments[0][0]).toEqual([23, 52]);
    expect(track.segments[1][track.segments[1].length - 1]).toEqual([29.009, 55.009]);
  });

  it('caps the number of map lines so a pathological file cannot outgrow the ceiling', () => {
    // Патологический KML: тысячи коротких `<LineString>`. Точечный бюджет такой
    // файл не сдерживает — резерв в две точки на сегмент сам выносит сумму за
    // потолок, а Leaflet и React получают по объекту на каждую линию.
    const long = {
      linePoints: Array.from({ length: 40 }, (_, index) => ({
        coord: `${(52 + index * 0.001).toFixed(4)},${(23 + index * 0.001).toFixed(4)}`,
      })),
      elevationProfile: [],
    };
    const shortTracks = Array.from({ length: ORIGINAL_TRACK_MAX_SEGMENTS + 100 }, (_, index) => ({
      linePoints: [
        { coord: `${(50 + index * 0.001).toFixed(4)},23` },
        { coord: `${(50 + index * 0.001).toFixed(4)},23.001` },
      ],
      elevationProfile: [],
    }));

    const track = buildOriginalTrackGeometry([long, ...shortTracks])!;

    expect(track.segments).toHaveLength(ORIGINAL_TRACK_MAX_SEGMENTS);
    const displayed = track.segments.reduce((sum, segment) => sum + segment.length, 0);
    expect(displayed).toBeLessThanOrEqual(ORIGINAL_TRACK_MAX_DISPLAY_POINTS);
    // Уцелели самые длинные линии: форму несёт трек, а не хвост из двух точек.
    expect(track.segments[0]).toHaveLength(40);
    // Счёт точек и длина остаются по всему файлу, поэтому потеря видна флагом.
    expect(track.sourcePointCount).toBe(40 + shortTracks.length * 2);
    expect(track.thinnedForDisplay).toBe(true);
  });

  it('thins only above the display ceiling and keeps exact start and finish', () => {
    const linePoints = Array.from({ length: 40 }, (_, index) => ({
      coord: `${(52 + index * 0.01).toFixed(4)},${(23 + index * 0.01).toFixed(4)}`,
    }));

    const track = buildOriginalTrackGeometry([{ linePoints, elevationProfile: [] }], 10)!;

    expect(track.segments[0]).toHaveLength(10);
    expect(track.sourcePointCount).toBe(40);
    expect(track.thinnedForDisplay).toBe(true);
    expect(track.segments[0][0]).toEqual([23, 52]);
    expect(track.segments[0][track.segments[0].length - 1]).toEqual([23.39, 52.39]);
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
    // Вырожденный трек уходит один, остальные треки файла остаются на карте.
    expect(
      buildOriginalTrackGeometry([
        { linePoints: [{ coord: '52,23' }], elevationProfile: [] },
        { linePoints: [{ coord: '53,24' }, { coord: '53.1,24.1' }], elevationProfile: [] },
      ])!.segments,
    ).toEqual([[[24, 53], [24.1, 53.1]]]);
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
