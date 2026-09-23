/**
 * #2073 P2 — регресс из ревью #2059: маркер точки маршрута внутри
 * `leaflet.markercluster` теряет `aria-description`, потому что Leaflet
 * пересобирает его DOM-узел (`_initIcon`) на каждый zoom/pan, который меняет
 * группировку — мемо-эффект по `title`/`hint` (`TripPlanRouteMarkers.tsx`) на
 * это не реагирует, его deps не меняются.
 *
 * Компонентные тесты в `tripPlanRouteMarkers.web.test.tsx` мокают
 * `react-leaflet`/`leaflet` целиком и не воспроизводят это Leaflet-поведение.
 * Здесь — РЕАЛЬНЫЙ Leaflet 1.9.4 + `leaflet.markercluster` 1.5.3 (тот же движок,
 * что грузит `utils/leafletVendor.ts`) и та же фабрика группы кластеров
 * (`createMapClusterGroup`), что использует `TripPlanRouteMarkers.tsx`.
 * Маркеры ставят `aria-description` в обработчике `add` (тот же механизм, что
 * в `RouteMarker`) — тест доказывает, что Leaflet действительно зовёт `add` на
 * каждое повторное присоединение маркера к карте, а не только на первое.
 */
// `__mocks__/leaflet.markercluster.js` — корневой авто-мок (`module.exports = {}`),
// который Jest подставляет вместо пакета ВСЕМ тестам без явного `jest.mock`
// (#765: реальный плагин при импорте падал на замоканном Leaflet других
// тестов). Этому файлу нужен настоящий плагин на настоящем Leaflet — снимаем
// мок явно, до всех импортов (`jest.unmock` хойстится так же, как `jest.mock`).
jest.unmock('leaflet.markercluster');

import * as leafletNamespace from 'leaflet';
import 'leaflet.markercluster';

import { createMapClusterGroup } from '@/components/MapPage/Map/mapClusterGroup';
import { FOCUS_POINT_ZOOM } from '@/components/trips/planning/tripPlanRouteMap.types';

// `leaflet.markercluster` — легаси UMD-плагин, мутирующий сам объект
// `leaflet`, а не свежую копию babel-интеропа `import * as`. `loadLeafletRuntime.ts`
// в проде разворачивает namespace тем же приёмом (`.default ?? namespace`) —
// повторяем его, иначе `L.markerClusterGroup` не резолвится в тестах.
const L = ((leafletNamespace as any).default ?? leafletNamespace) as typeof import('leaflet');

const HINT = 'Маркер точки можно перетащить по карте, а по тапу открыть изменение или удаление.';
const POINT_COUNT = 20;

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

// Тот же приём, что `RouteMarker` (`applyMarkerAccessibility`): `title` через
// Leaflet-опцию (он сам переносит её на новый узел при пересоздании), а
// `aria-description` — вручную на DOM-узле, потому что Leaflet о нём не знает.
const applyMarkerAccessibility = (marker: L.Marker): void => {
  const element = marker.getElement();
  if (!element) return;
  element.title = HINT;
  element.setAttribute('aria-description', HINT);
};

describe('#2073 P2 — реальный Leaflet + markercluster: aria-description переживает регруппировку', () => {
  it('применяет aria-description на каждом показе маркера, включая пересозданный после zoom out/in DOM-узел', () => {
    const container = createSizedContainer(800, 600);
    const map = L.map(container, {
      zoomControl: false,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false,
      // markercluster требует конечный maxZoom (без тайлового слоя карта его
      // не выводит сама и падает на "Map has no maxZoom specified").
      maxZoom: 19,
    }).setView([47.5, 12.0], 5);

    const { group, dispose } = createMapClusterGroup(L, map, {
      // Та же конфигурация, что карта конструктора: без анимации разбиения
      // (#2059) и без пакетной подгрузки — детерминированный синхронный тест.
      overrides: { disableClusteringAtZoom: FOCUS_POINT_ZOOM, animate: false, chunkedLoading: false } as any,
    });

    const markers = Array.from({ length: POINT_COUNT }, (_, index) =>
      L.marker([47.5 + index * 0.001, 12.0 + index * 0.001], { title: HINT }).on('add', (event) => {
        applyMarkerAccessibility(event.target as L.Marker);
      }),
    );
    markers.forEach((marker) => group.addLayer(marker));
    map.addLayer(group);

    // Низкий зум: все точки в одном кластере, индивидуальных маркеров на
    // карте (и их DOM-узлов) ещё нет.
    expect(markers.filter((marker) => marker.getElement())).toHaveLength(0);

    // Приближение до порога кластеризации — Leaflet реально добавляет каждый
    // маркер на карту (`onAdd` → `_initIcon` → событие `add`), создавая DOM
    // впервые.
    map.setZoom(FOCUS_POINT_ZOOM);
    const firstElements = markers.map((marker) => marker.getElement());
    expect(firstElements.every(Boolean)).toBe(true);
    firstElements.forEach((element) => {
      expect(element?.getAttribute('aria-description')).toBe(HINT);
    });

    // Отдаление — маркеры уходят обратно в кластер (их DOM снимается),
    // повторное приближение — Leaflet создаёт НОВЫЕ DOM-узлы. Мемо-эффект по
    // `title`/`hint` тут не перезапустился бы (deps не менялись); только
    // событие `add` гарантированно стреляет и здесь.
    map.setZoom(5);
    map.setZoom(FOCUS_POINT_ZOOM);
    const secondElements = markers.map((marker) => marker.getElement());
    expect(secondElements.every(Boolean)).toBe(true);
    secondElements.forEach((element, index) => {
      expect(element?.getAttribute('aria-description')).toBe(HINT);
      // Действительно новый узел, а не переиспользованный прежний.
      expect(element).not.toBe(firstElements[index]);
    });

    dispose();
    map.remove();
  });
});
