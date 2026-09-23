/**
 * #2071 — фабрика кластер-группы точек маршрута планировщика в native WebView.
 * Тот же приём, что `tripPlanMapMarkers.test.ts` использует для
 * `NATIVE_ROUTE_POINT_MARKERS_SCRIPT`: исполняем РЕАЛЬНЫЙ код скрипта через
 * `new Function`, а не переписываем его логику в моке.
 */
import { NATIVE_ROUTE_CLUSTER_SCRIPT } from '@/components/MapPage/Map/nativeRouteClusterScript';

type ClusterOptions = Record<string, unknown>;

const buildFactory = (
  L: Record<string, unknown>,
  makeClusterIcon: (count: number) => unknown,
): ((cluster: unknown) => unknown) =>
  new Function(
    'L',
    'makeClusterIcon',
    `${NATIVE_ROUTE_CLUSTER_SCRIPT}\nreturn buildRoutePointClusterGroup;`,
  )(L, makeClusterIcon) as (cluster: unknown) => unknown;

describe('#2071 buildRoutePointClusterGroup (native WebView)', () => {
  it('возвращает null, когда payload не просит кластеры', () => {
    const L = { markerClusterGroup: jest.fn() };
    const factory = buildFactory(L, () => ({}));

    expect(factory(null)).toBeNull();
    expect(factory(undefined)).toBeNull();
    expect(L.markerClusterGroup).not.toHaveBeenCalled();
  });

  it('возвращает null, если leaflet.markercluster не подключен (нет L.markerClusterGroup)', () => {
    const L = {};
    const factory = buildFactory(L, () => ({}));

    expect(factory({ maxClusterRadius: 80, disableClusteringAtZoom: 14 })).toBeNull();
  });

  it('паритет с web: maxClusterRadius/disableClusteringAtZoom берутся из payload, не хардкодятся', () => {
    let capturedOptions: ClusterOptions | null = null;
    const fakeGroup = { kind: 'group' };
    const L = {
      markerClusterGroup: (options: ClusterOptions) => {
        capturedOptions = options;
        return fakeGroup;
      },
    };
    const factory = buildFactory(L, () => ({}));

    const group = factory({ maxClusterRadius: 80, disableClusteringAtZoom: 14 });

    expect(group).toBe(fakeGroup);
    expect(capturedOptions).toMatchObject({
      maxClusterRadius: 80,
      disableClusteringAtZoom: 14,
      // #2059 в памяти проекта: анимация разбиения ловит хват/тап — на native
      // выключена тем же приёмом, что и у web-кластера маршрута.
      animate: false,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    });
  });

  it('иконка кластера — тот же счётчик, что у серверных кластеров /map (makeClusterIcon)', () => {
    const makeClusterIcon = jest.fn((count: number) => ({ count }));
    let capturedOptions: ClusterOptions | null = null;
    const L = {
      markerClusterGroup: (options: ClusterOptions) => {
        capturedOptions = options;
        return {};
      },
    };
    const factory = buildFactory(L, makeClusterIcon);
    factory({ maxClusterRadius: 80, disableClusteringAtZoom: 14 });

    const icon = (capturedOptions!.iconCreateFunction as (cluster: unknown) => unknown)({
      getChildCount: () => 7,
    });
    expect(makeClusterIcon).toHaveBeenCalledWith(7);
    expect(icon).toEqual({ count: 7 });
  });
});
