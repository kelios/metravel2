/**
 * Web parity of the route file parser (#2389): web parses GPX/KML with the
 * browser DOMParser (`routeFileXmlDocument.web.ts`) instead of xmldom, and must
 * give the same results as the native xmldom path on the shared fixtures.
 */
import {
  GPX_MULTIPLE_ROUTES,
  GPX_SINGLE_WITH_WAYPOINTS,
  KML_WITH_NAMED_POINTS,
  MALFORMED_GPX,
  POINT_ONLY_KML_78,
  UNSAFE_GPX,
} from '@/__tests__/fixtures/tripRouteImportFixtures';

const loadParser = (variant: 'web' | 'native') => {
  let parser: typeof import('@/utils/routeFileParser') | undefined;
  jest.isolateModules(() => {
    jest.doMock('@/utils/routeFileXmlDocument', () =>
      variant === 'web'
        ? jest.requireActual('@/utils/routeFileXmlDocument.web')
        : jest.requireActual('@/utils/routeFileXmlDocument'),
    );
    parser = require('@/utils/routeFileParser');
  });
  return parser!;
};

describe('routeFileParser on web (browser DOMParser)', () => {
  const web = loadParser('web');
  const native = loadParser('native');

  it.each([
    ['gpx with waypoints', GPX_SINGLE_WITH_WAYPOINTS, 'gpx'],
    ['gpx with several routes', GPX_MULTIPLE_ROUTES, 'gpx'],
    ['kml with named points', KML_WITH_NAMED_POINTS, 'kml'],
    ['kml with 78 points', POINT_ONLY_KML_78, 'kml'],
  ])('matches the native result for %s', (_name, text, ext) => {
    expect(web.parseRouteFileMetadata(text, ext)).toEqual(native.parseRouteFileMetadata(text, ext));
    expect(web.parseRouteFileGeometry(text, ext)).toEqual(native.parseRouteFileGeometry(text, ext));
    expect(web.parseRouteFilePreviews(text, ext)).toEqual(native.parseRouteFilePreviews(text, ext));
    expect(web.parseRouteFileMetadata(text, ext).ok).toBe(true);
  });

  it.each([
    ['malformed XML', MALFORMED_GPX, 'gpx'],
    ['unsafe declaration', UNSAFE_GPX, 'gpx'],
    ['mismatching root', GPX_SINGLE_WITH_WAYPOINTS, 'kml'],
  ])('reports %s as damaged, like native', (_name, text, ext) => {
    expect(web.parseRouteFileMetadata(text, ext)).toEqual({ ok: false, reason: 'damaged' });
    expect(native.parseRouteFileMetadata(text, ext)).toEqual({ ok: false, reason: 'damaged' });
  });

  // xmldom tolerates some non-well-formed input that a browser (and the backend's
  // expat upload check) rejects. Web follows the strict parser: such a file is
  // "damaged" in the preview instead of failing later on upload. This case also
  // proves the two loaders really run different implementations.
  it.each([
    ['a bare ampersand', '<gpx><wpt lat="1" lon="2"><name>Tom & Jerry</name></wpt></gpx>'],
    ['an unbound namespace prefix', '<gpx><wpt lat="1" lon="2"><name>a</name><gpxx:x>1</gpxx:x></wpt></gpx>'],
    ['text after the root element', '<gpx><wpt lat="1" lon="2"><name>a</name></wpt></gpx>junk'],
  ])('rejects %s on web as the backend does, where xmldom is lenient', (_name, text) => {
    expect(web.parseRouteFileMetadata(text, 'gpx')).toEqual({ ok: false, reason: 'damaged' });
    expect(native.parseRouteFileMetadata(text, 'gpx').ok).toBe(true);
  });

  it('keeps xmldom out of the web parser module', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'utils', 'routeFileXmlDocument.web.ts'), 'utf8');
    expect(source).not.toMatch(/(from\s*|require\()\s*['"]@xmldom\/xmldom['"]/);
    const parserSource = fs.readFileSync(path.join(__dirname, '..', '..', 'utils', 'routeFileParser.ts'), 'utf8');
    expect(parserSource).not.toMatch(/from ['"]@xmldom\/xmldom['"]/);
  });
});
