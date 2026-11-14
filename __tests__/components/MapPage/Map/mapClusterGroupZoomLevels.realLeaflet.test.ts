/**
 * Регресс: одиночная точка «Моих точек» не рисовалась на карте, хотя была в
 * списке (e2e `user-points.spec.ts`, полный прогон 14.11.2026).
 *
 * Механизм — leaflet.markercluster 1.5.3: дерево кластеров строится под
 * `getMinZoom()` карты в момент постановки группы, а отрисовка обходит его от
 * ТЕКУЩЕГО `getMinZoom() - 1`. «Мои точки» поднимают minZoom под размер
 * контейнера (`applyWorldMinZoom`) уже после постановки группы — корень дерева
 * выпадал из обхода, и лежащий в нём одиночный маркер не появлялся никогда.
 * `createMapClusterGroup` перестраивает дерево по `zoomlevelschange`; тест
 * идёт на РЕАЛЬНОМ Leaflet + markercluster, моки этот механизм не воспроизводят.
 */
// Корневой авто-мок `__mocks__/leaflet.markercluster.js` снимаем явно (см.
// `tripPlanRouteMarkerAccessibility.realLeaflet.test.ts`).
jest.unmock('leaflet.markercluster');

import * as leafletNamespace from 'leaflet';
import 'leaflet.markercluster';

import { createMapClusterGroup } from '@/components/MapPage/Map/mapClusterGroup';

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

const createMap = () =>
  L.map(createSizedContainer(800, 600), {
    zoomControl: false,
    fadeAnimation: false,
    zoomAnimation: false,
    markerZoomAnimation: false,
    maxZoom: 19,
  }).setView([50.06143, 19.93658], 14);

const deterministic = { animate: false, chunkedLoading: false } as any;

describe('createMapClusterGroup: смена уровней зума карты после постановки группы', () => {
  it('одиночный маркер виден после того, как карта подняла minZoom', () => {
    const map = createMap();
    const { group, dispose } = createMapClusterGroup(L, map, { overrides: deterministic });
    map.addLayer(group);
    const marker = L.marker([50.06143, 19.93658]);
    group.addLayers([marker]);
    expect(map.hasLayer(marker)).toBe(true);

    // Как applyWorldMinZoom: потолок мира под размер контейнера.
    map.setMinZoom(2);
    // Страховка самой перестройки (clearLayers + addLayers): уже показанный
    // маркер не теряется ни после неё, ни после смены зума. Красным без фикса
    // этот кейс не становится — регресс ловят два следующих.
    map.setZoom(10);
    map.setZoom(14);

    expect(map.hasLayer(marker)).toBe(true);
    expect(group.getLayers()).toEqual([marker]);

    dispose();
    map.remove();
  });

  it('маркер, добавленный уже после смены minZoom, тоже виден', () => {
    const map = createMap();
    const { group, dispose } = createMapClusterGroup(L, map, { overrides: deterministic });
    map.addLayer(group);
    map.setMinZoom(2);

    const marker = L.marker([50.06143, 19.93658]);
    group.addLayers([marker]);

    expect(map.hasLayer(marker)).toBe(true);

    dispose();
    map.remove();
  });

  it('боевые настройки: зум ниже нового minZoom — отрисовка как у группы, поставленной сразу под него', () => {
    // Телефон (#3131): стартовый fitBounds дал zoom 1, затем minZoom поднят до 3 —
    // Leaflet сам подтягивает зум уже после `zoomlevelschange`.
    const points: Array<[number, number]> = [[50.06, 19.93], [10, 100], [10.0001, 100.0001], [-30, -60]];
    const shown = (g: any): string[] =>
      g._featureGroup
        .getLayers()
        .map((l: any) => (l.getChildCount ? `cluster:${l.getChildCount()}@${l._zoom}` : `marker:${l.getLatLng().lat}`))
        .sort();

    const map = L.map(createSizedContainer(800, 600), { zoomControl: false, maxZoom: 19 }).setView([20, 20], 1);
    const { group, dispose } = createMapClusterGroup(L, map, {});
    map.addLayer(group);
    group.addLayers(points.map((p) => L.marker(p)));
    map.setMinZoom(3);
    map.fire('moveend');

    const fresh = L.map(createSizedContainer(800, 600), { zoomControl: false, maxZoom: 19, minZoom: 3 }).setView([20, 20], 3);
    const freshCluster = createMapClusterGroup(L, fresh, {});
    fresh.addLayer(freshCluster.group);
    freshCluster.group.addLayers(points.map((p) => L.marker(p)));

    expect(map.getZoom()).toBe(3);
    expect(shown(group)).toEqual(shown(freshCluster.group));

    dispose();
    freshCluster.dispose();
    map.remove();
    fresh.remove();
  });

  it('без смены уровней дерево не перестраивается, после dispose слушатель снят', () => {
    const map = createMap();
    const { group, dispose } = createMapClusterGroup(L, map, { overrides: deterministic });
    map.addLayer(group);
    group.addLayers([L.marker([50.06143, 19.93658])]);
    const clearSpy = jest.spyOn(group, 'clearLayers');

    map.fire('zoomlevelschange');
    expect(clearSpy).not.toHaveBeenCalled();

    dispose();
    map.setMinZoom(3);
    expect(clearSpy).not.toHaveBeenCalled();

    map.remove();
  });
});
