// components/MapPage/Map/nativeRouteClusterScript.ts
// #2071: клиентская кластеризация точек маршрута планировщика в native WebView —
// паритет с web (`components/trips/planning/TripPlanRouteMarkers.tsx` +
// `mapClusterGroup.ts`). Соседний модуль-скрипт `nativeRoutePointMarkersScript.ts`
// уже собирает капли с номером; этот модуль владеет ВСЕЙ проводкой кластера
// (создание/снятие группы, held-точка, распределение маркера по слою) — так
// легаси `nativeMapHtml.ts` растёт минимально, только вызовами этих функций.
// `L.markerClusterGroup()` заводится, когда `routePointMarkers.cluster` пришёл
// из payload (`tripPlanMapMarkers.ts`, тот же порог и тот же
// `disableClusteringAtZoom = FOCUS_POINT_ZOOM`, что на web — числа не
// копируются, а приходят с RN-стороны). Библиотека `leaflet.markercluster`
// инлайнится тем же приёмом, что ядро Leaflet (`utils/leafletInlineAsset.ts`) —
// `utils/leafletMarkerClusterInlineAsset.ts`, без внешнего CDN.
// Вставляется в bodyScript после `NATIVE_ROUTE_POINT_MARKERS_SCRIPT` (использует
// её `makeClusterIcon`-совместимый счётчик через переданную иконку /map,
// см. `nativeMapHtml.ts`).

/**
 * `animate: false` — то же решение, что у web-кластера конструктора маршрута
 * (#2059, `mapClusterGroup.ts`): анимация разбиения кластера ~300 мс держит
 * улетающие маркеры кликабельными на прежнем месте, и хват/тап в этот момент
 * попадает не в ту точку. `zoomToBoundsOnClick: true` — здесь, в отличие от
 * web, не нужен ручной clamp отступов (`runClusterClick`): у native-карты нет
 * плавающей панели, перекрывающей нижнюю часть карты, поэтому дефолтный клик
 * плагина (zoom-to-bounds/spiderfy на maxZoom) достаточен.
 *
 * Порог «кластеризовать» на native — число ОТРИСОВАННЫХ маркеров
 * (`labels.length` в `tripPlanMapMarkers.ts`, точки с валидными координатами),
 * на web — `route.length` (весь список, включая точки без координат). Тот же
 * `ROUTE_DAY_COLLAPSE_THRESHOLD`, расхождение только на точках без координат —
 * они и так не рисуются, а лишний маркер в счётчике web правее нуля не сдвигает
 * решение «кластеризовать» на реалистичных маршрутах.
 */
/*
 * Функции шаблона ниже (комментарии вынесены из рантайм-строки: она уходит в
 * WebView, и кириллица в ней красит uiLiteralGovernance):
 * - disposeRoutePointClusterGroup снимает прежнюю кластер-группу целиком —
 *   .clearLayers() не меняет maxClusterRadius/disableClusteringAtZoom прежней
 *   сборки, поэтому группа пересоздаётся; живёт на map (как
 *   __metravelRouteFitLocked/__userCenter), так её видит любой срез HTML.
 * - ensureRoutePointClusterGroup создаёт группу, если payload просит кластеры;
 *   иначе no-op (routeLayer — единственный слой точек).
 * - isRoutePointHeld (#2071 P2-2): брошенный рядом с соседом маркер
 *   markercluster перекластеризует на следующий renderPoints
 *   (_childMarkerDragEnd → _moveChild), и точка «пропадает». Как web
 *   heldIndex/isDroppedAt (TripPlanRouteMarkers.tsx), маркер держится вне группы,
 *   пока координаты совпадают с местом броска; допуск 1e-6 = 6 знаков
 *   ROUTE_POINT_COORDINATE_PRECISION (tripPlanRouteMap.types.ts).
 * - addRoutePointMarkerToLayer: активная (в редакторе) и держанная (только что
 *   брошенная) точки остаются вне кластера — видны на любом масштабе, как на web.
 */
export const NATIVE_ROUTE_CLUSTER_SCRIPT = `        function buildRoutePointClusterGroup(cluster) {
          if (!cluster || typeof L.markerClusterGroup !== 'function') return null;
          return L.markerClusterGroup({
            maxClusterRadius: isFinite(cluster.maxClusterRadius) ? cluster.maxClusterRadius : 80,
            disableClusteringAtZoom: isFinite(cluster.disableClusteringAtZoom) ? cluster.disableClusteringAtZoom : null,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            animate: false,
            iconCreateFunction: function(clusterLayer) {
              return makeClusterIcon(clusterLayer && clusterLayer.getChildCount ? clusterLayer.getChildCount() : 0);
            }
          });
        }
        function disposeRoutePointClusterGroup(map) {
          if (!map.__metravelRoutePointClusterGroup) return;
          try { map.removeLayer(map.__metravelRoutePointClusterGroup); } catch (e) {}
          map.__metravelRoutePointClusterGroup = null;
        }
        function ensureRoutePointClusterGroup(map, cluster) {
          if (!cluster) return null;
          var group = buildRoutePointClusterGroup(cluster);
          if (group) {
            map.__metravelRoutePointClusterGroup = group;
            group.addTo(map);
          }
          return group;
        }
        function isRoutePointHeld(heldPoint, index, point) {
          var tolerance = 1e-6;
          return !!(heldPoint && heldPoint.index === index && Array.isArray(point)
            && isFinite(point[0]) && isFinite(point[1])
            && Math.abs(point[0] - heldPoint.lat) <= tolerance
            && Math.abs(point[1] - heldPoint.lng) <= tolerance);
        }
        function addRoutePointMarkerToLayer(marker, routeLayer, clusterGroup, keepOutOfCluster) {
          if (clusterGroup && !keepOutOfCluster) {
            clusterGroup.addLayer(marker);
          } else {
            marker.addTo(routeLayer);
          }
        }`;
