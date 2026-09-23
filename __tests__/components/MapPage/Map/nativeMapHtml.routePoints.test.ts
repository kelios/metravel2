/**
 * #1781 — точки маршрута планировщика на native-карте.
 *
 * Экран поездки на iPhone рисует маршрут в WebView, и до этой задачи точки там
 * были `L.circleMarker` без единого обработчика: тянуть маркер было нечем, а тап
 * по нему проваливался в карту и добавлял НОВУЮ точку поверх выбранной. Тест
 * исполняет РЕАЛЬНЫЙ код из сгенерированного HTML (тот же приём, что в
 * `nativeMapHtml.renderPoints.test.ts`) и держит четыре инварианта:
 *   1. у владельца точка маршрута — перетаскиваемый маркер;
 *   2. дроп и тап уходят в RN отдельными сообщениями моста, тап не всплывает;
 *   3. у гостя маркеры остаются неинтерактивными;
 *   4. после ручного перетаскивания кадр больше не подгоняется под маршрут, и
 *      снимает защёлку только счётчик оптовых замен маршрута (#1820).
 */
import { buildNativeMapHtml } from '@/components/MapPage/Map/nativeMapHtml';

const themeColorsStub = {
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
} as any;

const html = buildNativeMapHtml({
  themeColors: themeColorsStub,
  markerShadowColor: 'rgba(0,0,0,0.2)',
});

/**
 * Берём весь блок от цветов маршрута до оверлеев: так в тест попадают и
 * настоящая фабрика иконки точки, и настоящий `__metravelRenderPoints`.
 */
const sliceRouteRenderCode = (): string => {
  const start = html.indexOf('const ROUTE_COLOR =');
  const end = html.indexOf('// ───────────────────────── Оверлеи (web-parity)', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
};

type Handler = (event?: unknown) => void;

interface FakeMarker {
  position: [number, number];
  options: Record<string, unknown>;
  handlers: Record<string, Handler>;
  element: { attrs: Record<string, string> };
}

interface FakeClusterGroup {
  options: Record<string, unknown>;
  members: FakeMarker[];
  addLayer: (marker: FakeMarker) => void;
  addTo: (map: unknown) => FakeClusterGroup;
}

const createHarness = () => {
  const posted: Array<Record<string, unknown>> = [];
  const routeMarkers: FakeMarker[] = [];
  const stopPropagationCalls: unknown[] = [];
  const fitBoundsCalls: unknown[] = [];
  const setViewCalls: unknown[] = [];
  // #2071 — кластер-группы точек маршрута, созданные за время жизни harness (по
  // одной на каждый renderPoints с routePointMarkers.cluster).
  const clusterGroups: FakeClusterGroup[] = [];
  const removedLayers: unknown[] = [];

  const makeLayer = () => {
    const layer = {
      added: [] as unknown[],
      clearLayers() {
        layer.added.length = 0;
      },
    };
    return layer;
  };

  const markersLayer = makeLayer();
  const clustersLayer = makeLayer();
  const routeLayer = makeLayer();

  const bounds = {
    extend: () => bounds,
    isValid: () => true,
    getCenter: () => [53.9, 27.5],
  };

  const makeShape = (kind: string, coordinates: unknown) => {
    const shape: Record<string, unknown> = {
      kind,
      coordinates,
      on: () => shape,
      bindPopup: () => shape,
      addTo: (layer: { added: unknown[] }) => {
        layer.added.push(shape);
        return shape;
      },
      getBounds: () => bounds,
    };
    return shape;
  };

  const L = {
    latLngBounds: () => bounds,
    divIcon: (options: unknown) => options,
    polyline: (coordinates: unknown) => makeShape('polyline', coordinates),
    circle: (coordinates: unknown) => makeShape('circle', coordinates),
    circleMarker: (coordinates: unknown) => makeShape('circleMarker', coordinates),
    DomEvent: {
      stopPropagation: (event: unknown) => {
        stopPropagationCalls.push(event);
      },
    },
    // #2071 — фейковая группа кластеров: реального разбиения на кластеры не
    // делает (это код leaflet.markercluster, инлайненный отдельно и покрытый
    // `nativeRouteClusterScript.test.ts`), но фиксирует, КАКИЕ маркеры и с
    // какими опциями в неё попали — этого достаточно, чтобы отличить
    // «замаркерена вручную в routeLayer» от «отдана кластер-группе».
    markerClusterGroup: (options: Record<string, unknown>) => {
      const group: FakeClusterGroup = {
        options,
        members: [],
        addLayer(marker: FakeMarker) {
          group.members.push(marker);
        },
        addTo() {
          return group;
        },
      };
      clusterGroups.push(group);
      return group;
    },
    marker: (position: [number, number], options: Record<string, unknown> = {}) => {
      const attrs: Record<string, string> = {};
      const marker: FakeMarker & Record<string, unknown> = {
        position,
        options,
        handlers: {},
        element: { attrs },
        on(name: string, handler: Handler) {
          marker.handlers[name] = handler;
          return marker;
        },
        addTo(layer: { added: unknown[] }) {
          layer.added.push(marker);
          if (layer === routeLayer) routeMarkers.push(marker);
          return marker;
        },
        getLatLng: () => ({ lat: position[0], lng: position[1] }),
        // #2073 — реальный код на интерактивных точках вызывает
        // `marker.getElement()` и ставит `aria-description` подсказки прямо на
        // DOM-узел; фейк отдаёт тот же объект, что хранит `element.attrs`.
        getElement: () => ({
          setAttribute: (key: string, value: string) => {
            attrs[key] = value;
          },
        }),
      };
      return marker;
    },
  };

  const map: Record<string, unknown> = {
    fitBounds: (value: unknown) => {
      fitBoundsCalls.push(value);
    },
    setView: (value: unknown) => {
      setViewCalls.push(value);
    },
    removeLayer: (layer: unknown) => {
      removedLayers.push(layer);
    },
    getZoom: () => 10,
    __userCenter: null,
  };

  const windowStub: Record<string, unknown> = {
    __metravelScheduleInvalidate: () => undefined,
    requestAnimationFrame: (callback: () => void) => {
      callback();
      return 1;
    },
    ReactNativeWebView: {
      postMessage: (raw: string) => {
        posted.push(JSON.parse(raw));
      },
    },
  };

  const renderPoints = new Function(
    'L',
    'map',
    'window',
    'markersLayer',
    'clustersLayer',
    'routeLayer',
    'markerIcon',
    'makeClusterIcon',
    '__metravelPostViewport',
    `var __metravelDidInitialRadiusPosition = false;
     ${sliceRouteRenderCode()}
     return window.__metravelRenderPoints;`,
  )(
    L,
    map,
    windowStub,
    markersLayer,
    clustersLayer,
    routeLayer,
    {},
    () => ({}),
    () => undefined,
  ) as (payload: unknown) => void;

  return {
    renderPoints,
    routeMarkers,
    posted,
    stopPropagationCalls,
    fitBoundsCalls,
    map,
    clusterGroups,
    removedLayers,
  };
};

const routePayload = (interactive: boolean) => ({
  points: [],
  clusters: [],
  routePoints: [
    [53.9, 27.56],
    [53.91, 27.6],
  ],
  routeLine: [
    [53.9, 27.56],
    [53.905, 27.58],
    [53.91, 27.6],
  ],
  originalTrackSegments: [],
  mode: 'route',
  center: { lat: 53.9, lng: 27.5 },
  usesServerClusters: false,
  pointsOnly: true,
  routePointsInteractive: interactive,
  // #1820 — счётчик оптовых замен маршрута из RouteBuilder.
  routeReplacementToken: 0,
});

describe('#1781 native-карта — точки маршрута правятся с карты', () => {
  it('делает точки владельца перетаскиваемыми маркерами', () => {
    const harness = createHarness();
    harness.renderPoints(routePayload(true));

    expect(harness.routeMarkers).toHaveLength(2);
    harness.routeMarkers.forEach((marker) => {
      expect(marker.options.draggable).toBe(true);
      expect(marker.options.interactive).toBe(true);
      // #2071: `add` переставляет aria-description, когда markercluster создаёт
      // DOM-узел маркера заново (см. тест ниже про подсказку).
      expect(Object.keys(marker.handlers).sort()).toEqual(['add', 'click', 'dragend', 'dragstart']);
    });
  });

  // #2073: `accessibilityHint` на RN-контейнере карты (TripPlanRouteMap.tsx)
  // не доходит до маркеров — они рисуются внутри этого WebView, вне RN-дерева.
  // Подсказка ставится прямо на DOM-узел маркера: Leaflet `title` (нативный
  // тултип) и `aria-description` (accessibility-дерево, которое WebView
  // прокидывает в TalkBack/VoiceOver).
  it('#2073 у владельца маркер точки получает подсказку title и aria-description', () => {
    const harness = createHarness();
    harness.renderPoints(routePayload(true));

    const hint = 'Маркер точки можно перетащить по карте, а по тапу открыть изменение или удаление.';
    harness.routeMarkers.forEach((marker) => {
      expect(marker.options.title).toBe(hint);
      expect(marker.element.attrs['aria-description']).toBe(hint);
    });
  });

  it('#2073 у гостя маркер точки не получает подсказку', () => {
    const harness = createHarness();
    harness.renderPoints(routePayload(false));

    harness.routeMarkers.forEach((marker) => {
      expect(marker.options.title).toBeUndefined();
      expect(marker.element.attrs['aria-description']).toBeUndefined();
    });
  });

  it('отдаёт дроп и тап отдельными сообщениями, гася всплытие тапа', () => {
    const harness = createHarness();
    harness.renderPoints(routePayload(true));

    const second = harness.routeMarkers[1];
    second.handlers.dragend({ target: { getLatLng: () => ({ lat: 53.95, lng: 27.7 }) } });
    second.handlers.click({ originalEvent: { type: 'click' } });

    expect(harness.posted).toEqual([
      { type: 'ROUTE_POINT_MOVED', index: 1, lat: 53.95, lng: 27.7 },
      { type: 'ROUTE_POINT_TAP', index: 1 },
    ]);
    // Без этого MAP_CLICK добавил бы новую точку поверх выбранной.
    expect(harness.stopPropagationCalls).toHaveLength(1);
  });

  it('не отправляет дроп с нефинитной позицией', () => {
    const harness = createHarness();
    harness.renderPoints(routePayload(true));

    harness.routeMarkers[0].handlers.dragend({
      target: { getLatLng: () => ({ lat: Number.NaN, lng: 27.6 }) },
    });

    expect(harness.posted).toHaveLength(0);
  });

  it('оставляет точки гостя неинтерактивными', () => {
    const harness = createHarness();
    harness.renderPoints(routePayload(false));

    expect(harness.routeMarkers).toHaveLength(2);
    harness.routeMarkers.forEach((marker) => {
      expect(marker.options.draggable).toBe(false);
      expect(marker.options.interactive).toBe(false);
      expect(Object.keys(marker.handlers)).toHaveLength(0);
    });
  });

  it('после начала перетаскивания больше не подгоняет кадр под маршрут', () => {
    const harness = createHarness();
    harness.renderPoints(routePayload(true));
    expect(harness.fitBoundsCalls).toHaveLength(1);

    harness.routeMarkers[0].handlers.dragstart();
    harness.renderPoints({ ...routePayload(true), routeLine: [[53.8, 27.4], [53.95, 27.7]] });

    expect(harness.map.__metravelRouteFitLocked).toBe(true);
    expect(harness.fitBoundsCalls).toHaveLength(1);
  });

  it('снимает защёлку кадра, когда маршрут заменён целиком', () => {
    const harness = createHarness();
    harness.renderPoints(routePayload(true));
    harness.routeMarkers[0].handlers.dragstart();
    harness.routeMarkers[0].handlers.dragend({
      target: { getLatLng: () => ({ lat: 53.95, lng: 27.7 }) },
    });
    // Тот же маршрут со сдвинутой точкой кадр не трогает.
    harness.renderPoints({
      ...routePayload(true),
      routePoints: [[53.95, 27.7], [53.91, 27.6]],
    });
    expect(harness.fitBoundsCalls).toHaveLength(1);

    // Импортированный трек: RouteBuilder увеличил счётчик замен, и без снятия
    // защёлки новый маршрут остался бы за пределами кадра до пересоздания карты.
    harness.renderPoints({
      ...routePayload(true),
      routePoints: [[50.07, 14.43], [49.19, 16.6]],
      routeLine: [[50.07, 14.43], [49.19, 16.6]],
      routeReplacementToken: 1,
    });

    expect(harness.map.__metravelRouteFitLocked).toBe(false);
    expect(harness.fitBoundsCalls).toHaveLength(2);
  });

  it('#1820 снимает защёлку на повторном применении ТОГО ЖЕ шаблона', () => {
    const harness = createHarness();
    harness.renderPoints(routePayload(true));
    harness.routeMarkers[0].handlers.dragstart();
    harness.routeMarkers[0].handlers.dragend({
      target: { getLatLng: () => ({ lat: 53.95, lng: 27.7 }) },
    });
    harness.renderPoints({
      ...routePayload(true),
      routePoints: [[53.95, 27.7], [53.91, 27.6]],
      routeLine: [[53.95, 27.7], [53.91, 27.6]],
    });
    expect(harness.map.__metravelRouteFitLocked).toBe(true);
    expect(harness.fitBoundsCalls).toHaveLength(1);

    // Шаблон применён ещё раз: неперетащенная точка возвращается с теми же
    // координатами, поэтому по самим точкам замена неотличима от правки —
    // защёлку снимает только счётчик.
    harness.renderPoints({ ...routePayload(true), routeReplacementToken: 1 });

    expect(harness.map.__metravelRouteFitLocked).toBe(false);
    expect(harness.fitBoundsCalls).toHaveLength(2);
  });

  it('не снимает защёлку, когда перетащили единственную точку маршрута', () => {
    const harness = createHarness();
    const single = {
      ...routePayload(true),
      routePoints: [[53.9, 27.56]],
      routeLine: [],
    };
    harness.renderPoints(single);
    harness.routeMarkers[0].handlers.dragstart();
    // Маршрут из одной точки после дропа не сохраняет ни одной прежней
    // координаты — ровно тот случай, на котором эвристика по точкам снимала бы
    // защёлку сама (#1820). Счётчик замен не рос: кадр остаётся наведённым.
    harness.routeMarkers[0].handlers.dragend({
      target: { getLatLng: () => ({ lat: 53.90123456789012, lng: 27.56789123456789 }) },
    });
    harness.renderPoints({ ...single, routePoints: [[53.901235, 27.567891]] });

    expect(harness.map.__metravelRouteFitLocked).toBe(true);
  });
});

// #2071 — паритет с web: близкие точки маршрута собираются в кластер
// (`leaflet.markercluster`, порог/радиус приходят из payload), активная точка
// крупнее и остаётся вне кластера.
const clusterIcon = { className: 'metravel-trip-plan-marker', html: '<div>{{n}}</div>', size: [36, 36], anchor: [18, 36] };
const activeClusterIcon = {
  className: 'metravel-trip-plan-marker-active',
  html: '<div class="active">{{n}}</div>',
  size: [44, 44],
  anchor: [22, 44],
};

const routePointsPayload = (options: {
  count: number;
  activeIndex?: number | null;
  cluster?: { maxClusterRadius: number; disableClusteringAtZoom: number } | null;
  interactive?: boolean;
}) => ({
  points: [],
  clusters: [],
  routePoints: Array.from({ length: options.count }, (_, index) => [53.9 + index * 0.001, 27.5 + index * 0.001]),
  routeLine: [],
  originalTrackSegments: [],
  mode: 'route',
  center: { lat: 53.9, lng: 27.5 },
  usesServerClusters: false,
  pointsOnly: true,
  routePointsInteractive: options.interactive ?? false,
  routeReplacementToken: 0,
  routePointMarkers: {
    labels: Array.from({ length: options.count }, (_, index) => String(index + 1)),
    icon: clusterIcon,
    activeIcon: activeClusterIcon,
    activeIndex: options.activeIndex ?? null,
    fontSizes: [8],
    cluster: options.cluster ?? null,
  },
});

describe('#2071 native-карта — кластеризация точек маршрута и активный маркер', () => {
  it('короткий маршрут (cluster: null) остаётся без кластер-группы — точки как раньше в routeLayer', () => {
    const harness = createHarness();
    harness.renderPoints(routePointsPayload({ count: 3, cluster: null }));

    expect(harness.clusterGroups).toHaveLength(0);
    expect(harness.routeMarkers).toHaveLength(3);
  });

  it('крупный маршрут оборачивает точки в markerClusterGroup с порогом из payload (паритет с web)', () => {
    const harness = createHarness();
    harness.renderPoints(
      routePointsPayload({ count: 5, cluster: { maxClusterRadius: 80, disableClusteringAtZoom: 14 } }),
    );

    expect(harness.clusterGroups).toHaveLength(1);
    expect(harness.clusterGroups[0].options).toMatchObject({
      maxClusterRadius: 80,
      disableClusteringAtZoom: 14,
    });
    // Все 5 маркеров ушли в кластер-группу, ни один не осел в routeLayer.
    expect(harness.clusterGroups[0].members).toHaveLength(5);
    expect(harness.routeMarkers).toHaveLength(0);
  });

  it('активная точка крупнее (activeIcon) и остаётся вне кластера, остальные — в кластере с обычной иконкой', () => {
    const harness = createHarness();
    harness.renderPoints(
      routePointsPayload({
        count: 4,
        activeIndex: 2,
        cluster: { maxClusterRadius: 80, disableClusteringAtZoom: 14 },
      }),
    );

    // Активная точка (index 2) — единственный маркер в routeLayer, не в кластере.
    expect(harness.routeMarkers).toHaveLength(1);
    expect(harness.routeMarkers[0].options.icon).toMatchObject({ className: activeClusterIcon.className });
    expect(harness.routeMarkers[0].options.zIndexOffset).toBe(1000);

    // Остальные 3 точки — в кластере, с обычной (не активной) иконкой.
    expect(harness.clusterGroups[0].members).toHaveLength(3);
    harness.clusterGroups[0].members.forEach((marker) => {
      expect(marker.options.icon).toMatchObject({ className: clusterIcon.className });
      expect(marker.options.zIndexOffset).toBe(0);
    });
  });

  it('пересоздаёт кластер-группу на каждый renderPoints и снимает прежнюю с карты', () => {
    const harness = createHarness();
    const cluster = { maxClusterRadius: 80, disableClusteringAtZoom: 14 };
    harness.renderPoints(routePointsPayload({ count: 5, cluster }));
    const firstGroup = harness.clusterGroups[0];

    harness.renderPoints(routePointsPayload({ count: 6, cluster }));

    expect(harness.clusterGroups).toHaveLength(2);
    expect(harness.removedLayers).toContain(firstGroup);
  });

  // #2071 P2-1 (code review 2026-09-24) — открытие/закрытие точки в редакторе
  // (setEditingIndex → activeIndex) не должно перестраивать уже наведённый
  // владельцем кадр: раньше ЛЮБОЙ renderPoints звал fitBounds заново, пока
  // владелец не потянет маркер (единственное, что раньше ставило fitLocked).
  it('#2071 P2-1 смена activeIndex не перестраивает кадр, смена геометрии — перестраивает', () => {
    const harness = createHarness();
    const geometry = {
      routePoints: [
        [53.9, 27.56], [53.901, 27.561], [53.902, 27.562],
        [53.903, 27.563], [53.904, 27.564], [53.905, 27.565],
      ],
      routeLine: [[53.9, 27.56], [53.902, 27.562], [53.905, 27.565]],
    };
    const withActive = (activeIndex: number | null) => ({
      ...routePayload(false),
      ...geometry,
      routePointMarkers: {
        labels: ['1', '2', '3', '4', '5', '6'],
        icon: clusterIcon,
        activeIcon: activeClusterIcon,
        activeIndex,
        fontSizes: [8],
        cluster: null,
      },
    });

    harness.renderPoints(withActive(null));
    expect(harness.fitBoundsCalls).toHaveLength(1); // первичная подгонка кадра (routeLine >= 2)

    harness.renderPoints(withActive(5));
    expect(harness.fitBoundsCalls).toHaveLength(1); // открыли точку в редакторе — кадр не тронут

    harness.renderPoints(withActive(null));
    expect(harness.fitBoundsCalls).toHaveLength(1); // закрыли редактор — кадр всё ещё не тронут

    // Геометрия реально изменилась (маршрут пересчитан/перенесён) — кадр перестраивается.
    harness.renderPoints({
      ...withActive(null),
      routePoints: [[50.07, 14.43], [49.19, 16.6]],
      routeLine: [[50.07, 14.43], [49.19, 16.6]],
    });
    expect(harness.fitBoundsCalls).toHaveLength(2);
  });

  // #2071 P2-2 (code review 2026-09-24) — брошенный рядом с соседом маркер не
  // должен «пропадать» в кластере на следующий renderPoints (то же решение,
  // что web даёт heldIndex/isDroppedAt в TripPlanRouteMarkers.tsx).
  it('#2071 P2-2 брошенная точка остаётся вне кластера, пока стоит там, куда её бросили', () => {
    const harness = createHarness();
    const cluster = { maxClusterRadius: 80, disableClusteringAtZoom: 14 };
    harness.renderPoints(routePointsPayload({ count: 5, cluster, interactive: true }));
    expect(harness.clusterGroups[0].members).toHaveLength(5);
    expect(harness.routeMarkers).toHaveLength(0); // ни одна точка не активна — все в кластере

    // Владелец бросил вторую точку (index 1) рядом с соседом — dragend.
    // members — те же FakeMarker, что и routeMarkers: dragend доступен независимо
    // от того, в какой слой маркер физически попал.
    const dropped = harness.clusterGroups[0].members[1];
    dropped.handlers.dragend({ target: { getLatLng: () => ({ lat: 53.901, lng: 27.501 }) } });

    // Тот же payload, но координата второй точки теперь совпадает с местом броска.
    const afterDrop = routePointsPayload({ count: 5, cluster, interactive: true });
    afterDrop.routePoints[1] = [53.901, 27.501];
    harness.renderPoints(afterDrop);

    // Брошенная точка — единственный маркер в routeLayer, не в новой кластер-группе.
    expect(harness.routeMarkers).toHaveLength(1);
    expect(harness.routeMarkers[0].position).toEqual([53.901, 27.501]);
    expect(harness.clusterGroups[1].members).toHaveLength(4);
  });
});
