/**
 * #2056 — переезды на native-карте планировщика. Отрезки линии уезжают в
 * WebView внутри payload планировщика (`routePointMarkers.lineSegments`),
 * `normalizeRoutePointsWithMarkers` переводит их в [lat, lng], а
 * `drawRouteLines` рисует прогоны и пунктирную дугу переезда. Без отрезков —
 * одна полилиния с прежним стилем.
 */
import { buildNativeMapHtml } from '@/components/MapPage/Map/nativeMapHtml';
import {
  NATIVE_ROUTE_POINT_MARKERS_SCRIPT,
  normalizeRoutePointsWithMarkers,
} from '@/components/MapPage/Map/nativeRoutePointMarkersScript';
import { nativeRoutePointMarkers } from '@/components/trips/planning/tripPlanMapMarkers';
import { ROUTE_TRANSFER_DASH_ARRAY } from '@/components/trips/planning/tripRouteLegs';

const markerColors = { primary: '#0a84ff', primaryDark: '#0060df', warning: '#f0a020', textOnPrimary: '#ffffff' };

type Shape = { coordinates: unknown; options: Record<string, unknown>; added: boolean };

const loadDrawRouteLines = () => {
  const shapes: Shape[] = [];
  const L = {
    divIcon: (options: unknown) => options,
    polyline: (coordinates: unknown, options: Record<string, unknown>) => {
      const shape: Shape & { addTo: (layer: unknown) => unknown } = {
        coordinates,
        options,
        added: false,
        addTo: () => {
          shape.added = true;
          return shape;
        },
      };
      shapes.push(shape);
      return shape;
    },
  };
  const drawRouteLines = new Function(
    'L',
    'map',
    'ROUTE_COLOR',
    'ROUTE_WARNING',
    'ROUTE_SURFACE',
    'ROUTE_START',
    'escapeHtml',
    `${NATIVE_ROUTE_POINT_MARKERS_SCRIPT}\nreturn drawRouteLines;`,
  )(L, {}, '#route', '#warning', '#fff', '#start', (value: string) => value) as (
    routeLine: unknown,
    approximate: boolean,
    spec: unknown,
    layer: unknown,
  ) => Shape;
  return { drawRouteLines, shapes };
};

describe('#2056 native transfer lines', () => {
  it('the WebView route block draws its line through drawRouteLines', () => {
    const html = buildNativeMapHtml({
      themeColors: {
        surface: '#ffffff',
        text: '#111111',
        textOnDark: '#ffffff',
        primary: '#0a84ff',
        primaryDark: '#0060df',
        success: '#34c759',
        warning: '#f0a020',
        warningDark: '#b87513',
        textOnPrimary: '#ffffff',
        accent: '#ff6a00',
        accentDark: '#c25100',
      } as never,
      markerShadowColor: 'rgba(0,0,0,0.2)',
    });
    expect(html).toContain('drawRouteLines(routeLine, routeApproximate, routePointMarkers, routeLayer)');
  });

  it('normalizes planner line segments into WebView [lat, lng] pairs', () => {
    const markers = nativeRoutePointMarkers(['1', '2'], markerColors, {
      lines: {
        segments: [
          { style: 'route', line: [[6.42, 49.81], [6.35, 49.82]] },
          { style: 'transfer', line: [[6.35, 49.82], [Number.NaN, 0], [11.78, 48.35]] },
        ],
        transferColor: '#1d4ed8',
      },
    });
    const { markers: normalized } = normalizeRoutePointsWithMarkers([[6.42, 49.81], [11.78, 48.35]], markers);
    expect(normalized?.lineSegments).toEqual([
      { style: 'route', line: [[49.81, 6.42], [49.82, 6.35]] },
      { style: 'transfer', line: [[49.82, 6.35], [48.35, 11.78]] },
    ]);
    expect(normalized?.transferColor).toBe('#1d4ed8');
    expect(normalized?.transferDashArray).toBe(ROUTE_TRANSFER_DASH_ARRAY);
  });

  it('keeps the single polyline with the old style when there are no segments', () => {
    const { drawRouteLines, shapes } = loadDrawRouteLines();
    const line = [[49.81, 6.42], [48.35, 11.78]];
    const outline = drawRouteLines(line, true, null, {});
    expect(shapes).toHaveLength(1);
    expect(outline.added).toBe(true);
    expect(outline.options).toEqual({
      color: '#warning',
      weight: 4,
      opacity: 0.58,
      dashArray: '8 8',
      lineCap: 'round',
      lineJoin: 'round',
    });
  });

  it('draws runs and a dashed transfer arc, and frames by the full line without drawing it', () => {
    const { drawRouteLines, shapes } = loadDrawRouteLines();
    const spec = {
      lineSegments: [
        { style: 'route', line: [[0, 0], [0, 1]] },
        { style: 'transfer', line: [[0, 1], [0.5, 3], [0, 5]] },
        { style: 'approximate', line: [[0, 5], [0, 6]] },
      ],
      transferColor: '#info',
      transferDashArray: ROUTE_TRANSFER_DASH_ARRAY,
    };
    const outline = drawRouteLines([[0, 0], [0, 1], [0, 5], [0, 6]], false, spec, {});
    expect(outline.added).toBe(false);
    const drawn = shapes.filter((shape) => shape.added);
    expect(drawn.map((shape) => [shape.options.color, shape.options.dashArray])).toEqual([
      ['#route', null],
      ['#info', ROUTE_TRANSFER_DASH_ARRAY],
      ['#warning', '8 8'],
    ]);
  });
});
