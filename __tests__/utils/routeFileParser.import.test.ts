import {
  parseRouteFileGeometry,
  parseRouteFileMetadata,
  parseRouteFilePreviews,
} from '@/utils/routeFileParser';
import {
  GPX_SINGLE_WITH_WAYPOINTS,
  KML_WITH_NAMED_POINTS,
  MALFORMED_GPX,
  UNSAFE_GPX,
} from '@/__tests__/fixtures/tripRouteImportFixtures';

describe('routeFileParser import metadata', () => {
  it('extracts trimmed valid GPX waypoints without changing track geometry parsing', () => {
    const geometryBefore = parseRouteFilePreviews(GPX_SINGLE_WITH_WAYPOINTS, 'gpx');
    const metadata = parseRouteFileMetadata(GPX_SINGLE_WITH_WAYPOINTS, '.GPX');
    const geometryAfter = parseRouteFilePreviews(GPX_SINGLE_WITH_WAYPOINTS, 'gpx');

    expect(metadata).toEqual({
      ok: true,
      format: 'gpx',
      hasIndependentPoints: true,
      namedPoints: [
        { coord: '52.1,23.7', name: 'Start camp' },
        { coord: '52.15,23.75', name: 'Viewpoint' },
      ],
    });
    expect(geometryAfter).toEqual(geometryBefore);
    expect(geometryAfter).toHaveLength(1);
    expect(geometryAfter[0].linePoints.map((point) => point.coord)).toEqual([
      '52.1,23.7',
      '52.15,23.75',
      '52.2,23.8',
    ]);
  });

  it('extracts only named valid KML Point Placemarks', () => {
    expect(parseRouteFileMetadata(KML_WITH_NAMED_POINTS, 'kml')).toEqual({
      ok: true,
      format: 'kml',
      hasIndependentPoints: true,
      namedPoints: [
        { coord: '52.2,23.8', name: 'Finish' },
        { coord: '52.15,23.75', name: 'Lunch' },
      ],
    });

    const geometry = parseRouteFileGeometry(KML_WITH_NAMED_POINTS, 'kml');
    expect(geometry.points).toEqual([
      { coord: '52.2,23.8', name: 'Finish' },
      { coord: '52.15,23.75', name: 'Lunch' },
    ]);
    expect(geometry.lines).toHaveLength(1);
    expect(geometry.lines[0].map((point) => point.coord)).toEqual([
      '52.1,23.7',
      '52.15,23.75',
      '52.2,23.8',
    ]);
  });

  it.each([
    ['unsupported extension', GPX_SINGLE_WITH_WAYPOINTS, 'geojson', 'unsupported'],
    ['mismatching root', GPX_SINGLE_WITH_WAYPOINTS, 'kml', 'damaged'],
    ['malformed XML', MALFORMED_GPX, 'gpx', 'damaged'],
    ['unsafe declaration', UNSAFE_GPX, 'gpx', 'damaged'],
  ])('rejects %s', (_label, text, extension, reason) => {
    expect(parseRouteFileMetadata(text, extension)).toEqual({ ok: false, reason });
  });
});
