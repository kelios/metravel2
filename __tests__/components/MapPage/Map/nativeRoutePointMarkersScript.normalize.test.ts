/**
 * #2071 — `normalizeRoutePointsWithMarkers` переводит `markers.activeIndex` из
 * нумерации входного `routePoints` (совпадает с `labels`) в нумерацию уже
 * отфильтрованных `latLngs` — ровно ту, по которой WebView-скрипт
 * (`routePoints.forEach` в `nativeMapHtml.ts`) сверяет activeIndex при отрисовке.
 * `sourceIndices`/`labels` уже покрыты `Map.ios.test.tsx` (#2059); здесь —
 * только новая часть контракта (#2071).
 */
import { normalizeRoutePointsWithMarkers } from '@/components/MapPage/Map/nativeRoutePointMarkersScript';

const markers = (activeIndex: number | null) => ({
  labels: ['1', '2', '3', '4'],
  icon: { className: 'metravel-trip-plan-marker', html: '<div>{{n}}</div>', size: [36, 36] as [number, number], anchor: [18, 36] as [number, number] },
  activeIndex,
  fontSizes: [8],
});

describe('#2071 normalizeRoutePointsWithMarkers — activeIndex remap', () => {
  it('без разрывов activeIndex совпадает с исходным индексом', () => {
    const routePoints: Array<[number, number]> = [
      [27.5, 53.9],
      [27.6, 53.91],
      [27.7, 53.92],
      [27.8, 53.93],
    ];
    const result = normalizeRoutePointsWithMarkers(routePoints, markers(2));

    expect(result.markers?.activeIndex).toBe(2);
  });

  it('точка с невалидными координатами перед активной сдвигает её итоговый индекс', () => {
    const routePoints: Array<[number, number] | [number, number]> = [
      [27.5, 53.9],
      [Number.NaN, Number.NaN], // #1683: normalizeRoutePoint отбрасывает эту пару.
      [27.7, 53.92],
      [27.8, 53.93],
    ];
    // Активная — точка «4» (исходный индекс 3, как и labels[3] = '4').
    const result = normalizeRoutePointsWithMarkers(routePoints, markers(3));

    // После фильтра битой пары итоговых точек — 3, активная встаёт на позицию 2.
    expect(result.latLngs).toHaveLength(3);
    expect(result.markers?.activeIndex).toBe(2);
    expect(result.markers?.labels).toEqual(['1', '3', '4']);
  });

  it('activeIndex сам указывает на отброшенную точку — null (активной точки в итоговом наборе нет)', () => {
    const routePoints: Array<[number, number]> = [
      [27.5, 53.9],
      [Number.NaN, Number.NaN],
      [27.7, 53.92],
    ];
    const result = normalizeRoutePointsWithMarkers(routePoints, markers(1));

    expect(result.markers?.activeIndex).toBeNull();
  });

  it('null activeIndex (нет открытой точки) остаётся null', () => {
    const routePoints: Array<[number, number]> = [[27.5, 53.9], [27.6, 53.91]];
    const result = normalizeRoutePointsWithMarkers(routePoints, markers(null));

    expect(result.markers?.activeIndex).toBeNull();
  });

  it('без markers (маршрут /map) остаётся null-payload, как раньше', () => {
    const routePoints: Array<[number, number]> = [[27.5, 53.9]];
    const result = normalizeRoutePointsWithMarkers(routePoints, undefined);

    expect(result.markers).toBeNull();
  });
});
