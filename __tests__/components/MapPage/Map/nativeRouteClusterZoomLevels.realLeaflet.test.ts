/**
 * Native WebView-скрипт кластеров маршрута (`NATIVE_ROUTE_CLUSTER_SCRIPT`) на
 * РЕАЛЬНОМ Leaflet + leaflet.markercluster 1.5.3: после `setMinZoom` (его зовёт
 * `nativeTileBridgeScript` по размеру WebView) дерево кластеров перестраивается.
 * Без перестройки опущенный minZoom оставлял дерево без сеток новых уровней, и
 * `addLayer` следующей точки падал с TypeError (`getNearObject` у undefined) —
 * точка маршрута не добавлялась. Web-аналог — `mapClusterGroupZoomLevels.realLeaflet.test.ts`.
 */
jest.unmock('leaflet.markercluster');

import * as leafletNamespace from 'leaflet';
import 'leaflet.markercluster';

import { NATIVE_ROUTE_CLUSTER_SCRIPT } from '@/components/MapPage/Map/nativeRouteClusterScript';

const L = ((leafletNamespace as any).default ?? leafletNamespace) as typeof import('leaflet');

const createSizedContainer = (width: number, height: number): HTMLElement => {
  const el = document.createElement('div');
  const define = (prop: string, value: number) =>
    Object.defineProperty(el, prop, { get: () => value, configurable: true });
  define('clientWidth', width);
  define('clientHeight', height);
  define('offsetWidth', width);
  define('offsetHeight', height);
  el.getBoundingClientRect = () =>
    ({ x: 0, y: 0, width, height, top: 0, left: 0, right: width, bottom: height, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(el);
  return el;
};

const loadEnsure = () =>
  new Function(
    'L',
    'makeClusterIcon',
    `${NATIVE_ROUTE_CLUSTER_SCRIPT}\nreturn ensureRoutePointClusterGroup;`,
  )(L, () => L.divIcon({ html: '' })) as (map: any, cluster: unknown) => any;

describe('NATIVE_ROUTE_CLUSTER_SCRIPT: смена minZoom карты после постановки группы', () => {
  it('после опускания minZoom точка добавляется без исключения и видна; слушатель вешается один раз', () => {
    const map = L.map(createSizedContainer(390, 700), {
      zoomControl: false,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false,
      maxZoom: 19,
      minZoom: 6,
    }).setView([53.9, 27.56], 14);
    const ensure = loadEnsure();
    const onSpy = jest.spyOn(map, 'on');

    ensure(map, { maxClusterRadius: 80, disableClusteringAtZoom: 15 });
    const group = ensure(map, { maxClusterRadius: 80, disableClusteringAtZoom: 15 });
    expect(onSpy.mock.calls.filter(([event]) => event === 'zoomlevelschange')).toHaveLength(1);

    map.setMinZoom(2);
    const marker = L.marker([53.9, 27.56]);
    expect(() => group.addLayer(marker)).not.toThrow();

    expect(map.hasLayer(marker)).toBe(true);
    map.remove();
  });
});
