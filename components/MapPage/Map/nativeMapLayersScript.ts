// components/MapPage/Map/nativeMapLayersScript.ts
//
// #2453 — слои данных native-карты (WebView) как независимые каналы с diff по
// стабильному ключу вместо снимка «весь payload за раз».
//
// До #2453 RN на любое изменение (центр, токен замены маршрута, догрузка
// страницы списка, новые кластеры) пересериализовывал ВЕСЬ payload и звал
// `__metravelRenderPoints`, а WebView ещё раз делал `JSON.stringify(points)`
// для сравнения, безусловно чистил кластеры/маршрут и при любом отличии точек
// стирал и рисовал заново все маркеры. Теперь:
//   * `__metravelSetMarkers({add, removeKeys, reset?, pointsOnly?, usesServerClusters?})`
//     — патч по `placeKey`, маркеры живут в словаре key → L.Marker;
//   * `__metravelSetClusters({add, removeKeys, reset?})` — патч по ключу кластера;
//   * `__metravelSetRoute(route)` — маршрут планировщика / линия /map;
//   * `__metravelSetCenter({lat, lng})` — якорь стартового позиционирования.
// `__metravelRenderPoints(snapshot)` оставлен совместимой формой: раскладывает
// снимок на те же каналы (diff внутри WebView), его используют unit-тесты.
// Ни один канал не зовёт `__metravelScheduleInvalidate` — размер карты от
// данных не меняется (инвалидация только на rn-layout/resize/ready).
//
// Вставляется в bodyScript nativeMapHtml.ts после ESCAPE_HTML_FN_SCRIPT; ожидает
// в области видимости `L`, `map`, `markersLayer`, `clustersLayer`, `routeLayer`,
// `markerIcon`, `makeClusterIcon` и маршрутные хелперы
// (nativeRoutePointMarkersScript / nativeRouteClusterScript / drawRouteLines).
import { translate as i18nT } from '@/i18n';
import { serializeForInlineScript } from '@/utils/webViewBridge';

/** Маркеров за кадр: порционная отрисовка #1773 (тайлы успевают отрисоваться). */
export const NATIVE_MARKER_CHUNK = 100;

export const buildNativeMapLayersScript = (): string => `        window.__metravelRenderPoints = function(payload) {
          try {
            const data = payload || {};
            if (data.center) window.__metravelSetCenter(data.center);
            window.__metravelSetRoute(data);
            window.__metravelSetClusters({ replace: Array.isArray(data.clusters) ? data.clusters : [] });
            window.__metravelSetMarkers({
              replace: Array.isArray(data.points) ? data.points : [],
              pointsOnly: data.pointsOnly === true,
              usesServerClusters: data.usesServerClusters === true
            });
          } catch (e) {}
        };

        // ───── Маркеры мест: словарь placeKey → запись, патч вместо clearLayers ─────
        var __metravelMarkerEntries = {};   // key → { marker, circle }
        var __metravelMarkerDesired = {};   // key → { sig, latLng } (нарисован или в очереди)
        var __metravelMarkerDesiredCount = 0;
        var __metravelMarkerQueue = [];     // ключи в порядке добавления
        var __metravelMarkerQueued = {};    // key → точка, ждущая своего кадра
        var __metravelMarkerFrameScheduled = false;
        var __metravelMarkerVersion = 0;
        var __metravelMarkerMeta = { pointsOnly: false, usesServerClusters: false };
        // Radius-mode data updates can arrive after every zoom/pan through the
        // server-cluster query. Auto-fitting on each payload fights the user's
        // gesture and causes Android WebView to visibly pan back and redraw
        // clusters. Do one initial positioning pass only; user gestures and
        // explicit cluster/marker taps remain in control after that.
        var __metravelDidInitialRadiusPosition = false;
        var __metravelPointsFitVersion = -1;

        function __metravelMarkerKey(point) {
          if (point.placeKey != null && String(point.placeKey)) return String(point.placeKey);
          return 'c:' + String(point.coord);
        }
        function __metravelMarkerSig(point) {
          return String(point.coord) + '|' + String(point.categoryName || '') + '|' +
            String(point.sourceCount == null ? 1 : point.sourceCount) + '|' +
            (point.id == null ? '' : String(point.id));
        }
        function __metravelPointLatLng(point) {
          if (!point || !point.coord) return null;
          const parts = String(point.coord).split(',').map(Number);
          if (!isFinite(parts[0]) || !isFinite(parts[1])) return null;
          return [parts[0], parts[1]];
        }

        // points приходит уже сгруппированным по местам (#1573): один элемент —
        // одно физическое место, один Leaflet-маркер, один hit target. RN шлёт
        // сюда узкую проекцию (placeKey/id/coord/categoryName/sourceCount), а не
        // полные записи: массив источников места здесь не нужен и не сериализуется.
        function __metravelAddPointMarker(point) {
          const latLng = __metravelPointLatLng(point);
          if (!latLng) return null;
          const lat = latLng[0];
          const lng = latLng[1];
          var circle = null;
          // Зона кемпинга: рисуем полупрозрачный круг ПОД маркером для точек,
          // у которых categoryName содержит 'Кемпинг' или 'Лагерь'. Бэкенд не
          // отдаёт полигон-геометрию, поэтому зона — L.circle фиксированного
          // радиуса 250м (визуальная зона, НЕ search radius). Круг добавляется
          // в markersLayer и снимается вместе со своим маркером (#2453), поэтому
          // зоны не накапливаются при обновлении точек.
          const categoryName = String(point.categoryName || '');
          const isCamping = categoryName.indexOf('Кемпинг') !== -1 || categoryName.indexOf('Лагерь') !== -1;
          if (isCamping) {
            circle = L.circle([lat, lng], {
              radius: 250,
              color: '#2e7d32',
              weight: 2,
              opacity: 0.8,
              fillColor: '#4caf50',
              fillOpacity: 0.18,
              interactive: false
            }).addTo(markersLayer);
          }

          const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(markersLayer);

          // F-46 — на native НЕ открываем Leaflet-попап: тап только отдаёт выбор
          // в RN, экран показывает нижнюю карточку места (MapPlaceBottomCard).
          // Идентификатор выбора — placeKey физического места (#1573); id/coord
          // остаются legacy-fallback. Индекс в массиве больше не шлётся: с diff по
          // ключу (#2453) позиция маркера в исходном списке не отслеживается.
          marker.on('click', function(event) {
            try {
              // Leaflet bubbles marker clicks to the map. Without stopping
              // that event RN receives SELECT_PLACE followed by MAP_CLICK
              // and immediately dismisses the card it has just opened.
              if (event && L && L.DomEvent) L.DomEvent.stopPropagation(event);
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'SELECT_PLACE',
                  placeKey: point.placeKey == null ? null : String(point.placeKey),
                  id: point.id == null ? null : String(point.id),
                  coord: point.coord == null ? null : String(point.coord)
                }));
              }
            } catch (err) {}
          });
          return { marker: marker, circle: circle };
        }
        function __metravelRemoveMarkerEntry(key) {
          const entry = __metravelMarkerEntries[key];
          if (!entry) return;
          delete __metravelMarkerEntries[key];
          try { markersLayer.removeLayer(entry.marker); } catch (e) {}
          if (entry.circle) {
            try { markersLayer.removeLayer(entry.circle); } catch (e) {}
          }
        }
        function __metravelClearMarkers() {
          markersLayer.clearLayers();
          __metravelMarkerEntries = {};
          __metravelMarkerDesired = {};
          __metravelMarkerDesiredCount = 0;
          __metravelMarkerQueue = [];
          __metravelMarkerQueued = {};
        }
        // #1773 — «Мои точки» на iPhone открывались пустым серым холстом: 869
        // маркеров добавлялись в DOM одним синхронным проходом и держали JS
        // WebView ~10 с. Рисуем порциями и отдаём поток между ними: подложка
        // появляется сразу, маркеры дорисовываются следом. Очередь хранит ключи:
        // снятый до своего кадра маркер просто пропускается.
        function __metravelScheduleMarkerFrame() {
          if (__metravelMarkerFrameScheduled || !__metravelMarkerQueue.length) return;
          __metravelMarkerFrameScheduled = true;
          if (typeof window.requestAnimationFrame === 'function') {
            // rAF отдаёт кадр между порциями — тайлы успевают отрисоваться.
            window.requestAnimationFrame(__metravelRenderMarkerFrame);
            return;
          }
          setTimeout(__metravelRenderMarkerFrame, 0);
        }
        function __metravelRenderMarkerFrame() {
          __metravelMarkerFrameScheduled = false;
          var added = 0;
          while (__metravelMarkerQueue.length && added < ${NATIVE_MARKER_CHUNK}) {
            const key = __metravelMarkerQueue.shift();
            const point = __metravelMarkerQueued[key];
            if (!point) continue;
            delete __metravelMarkerQueued[key];
            __metravelRemoveMarkerEntry(key);
            try {
              const entry = __metravelAddPointMarker(point);
              if (entry) __metravelMarkerEntries[key] = entry;
            } catch (e) {}
            added += 1;
          }
          __metravelScheduleMarkerFrame();
        }
        function __metravelForgetMarker(key) {
          if (!__metravelMarkerDesired[key]) return false;
          delete __metravelMarkerDesired[key];
          __metravelMarkerDesiredCount -= 1;
          delete __metravelMarkerQueued[key];
          __metravelRemoveMarkerEntry(key);
          return true;
        }
        function __metravelQueueMarker(point) {
          if (!point || !point.coord) return false;
          const key = __metravelMarkerKey(point);
          if (!__metravelMarkerDesired[key]) __metravelMarkerDesiredCount += 1;
          __metravelMarkerDesired[key] = { sig: __metravelMarkerSig(point), latLng: __metravelPointLatLng(point) };
          if (!__metravelMarkerQueued[key]) __metravelMarkerQueue.push(key);
          __metravelMarkerQueued[key] = point;
          return true;
        }
        // Снимок → патч: используется совместимой формой __metravelRenderPoints.
        function __metravelDiffMarkers(points) {
          const nextKeys = {};
          const add = [];
          for (var i = 0; i < points.length; i += 1) {
            const point = points[i];
            if (!point || !point.coord) continue;
            const key = __metravelMarkerKey(point);
            nextKeys[key] = true;
            const desired = __metravelMarkerDesired[key];
            if (!desired || desired.sig !== __metravelMarkerSig(point)) add.push(point);
          }
          const removeKeys = [];
          for (var existing in __metravelMarkerDesired) {
            if (!nextKeys[existing]) removeKeys.push(existing);
          }
          return { add: add, removeKeys: removeKeys };
        }

        window.__metravelSetMarkers = function(patch) {
          try {
            const data = patch || {};
            if (typeof data.pointsOnly === 'boolean') __metravelMarkerMeta.pointsOnly = data.pointsOnly;
            if (typeof data.usesServerClusters === 'boolean') {
              __metravelMarkerMeta.usesServerClusters = data.usesServerClusters;
            }
            const diff = Array.isArray(data.replace)
              ? __metravelDiffMarkers(data.replace)
              : {
                add: Array.isArray(data.add) ? data.add : [],
                removeKeys: Array.isArray(data.removeKeys) ? data.removeKeys : []
              };
            var changed = false;
            if (data.reset === true ||
                (diff.removeKeys.length > 0 && diff.removeKeys.length >= __metravelMarkerDesiredCount)) {
              // Снимаются все маркеры — один clearLayers дешевле N removeLayer.
              changed = __metravelMarkerDesiredCount > 0;
              __metravelClearMarkers();
            } else {
              for (var r = 0; r < diff.removeKeys.length; r += 1) {
                if (__metravelForgetMarker(String(diff.removeKeys[r]))) changed = true;
              }
            }
            for (var a = 0; a < diff.add.length; a += 1) {
              if (__metravelQueueMarker(diff.add[a])) changed = true;
            }
            if (changed) __metravelMarkerVersion += 1;
            __metravelScheduleMarkerFrame();
            __metravelPositionAfterMarkers();
          } catch (e) {}
        };

        // Стартовое позиционирование (radius / каталог квестов). Маршрутный кадр
        // ставит __metravelSetRoute: при активном маршруте здесь ничего не делаем.
        // Зовётся только из канала маркеров: RN шлёт его последним (после центра,
        // маршрута и кластеров), поэтому одноразовая защёлка видит все данные.
        function __metravelPositionAfterMarkers() {
          if (window.__metravelRouteActive) return;
          const bounds = L.latLngBounds();
          // #1773 — границы считаем числовым проходом (без DOM), чтобы fitBounds
          // работал сразу, ещё до отрисовки самих маркеров.
          for (var key in __metravelMarkerDesired) {
            const latLng = __metravelMarkerDesired[key].latLng;
            if (latLng) bounds.extend(latLng);
          }
          for (var clusterKey in __metravelClusterEntries) {
            bounds.extend(__metravelClusterEntries[clusterKey].latLng);
          }
          if (__metravelMarkerMeta.pointsOnly) {
            // Каталог квестов (pointsOnly): рефит при СМЕНЕ набора точек — выбор
            // города меняет маркеры, карта обязана перелететь на них. Ручной пан
            // набор не меняет, поэтому карту не дёргает. Radius-режим сюда не
            // заходит и сохраняет одноразовую защёлку ниже.
            if (bounds.isValid() && __metravelPointsFitVersion !== __metravelMarkerVersion) {
              map.fitBounds(bounds, { padding: [50, 50] });
              __metravelPointsFitVersion = __metravelMarkerVersion;
              __metravelDidInitialRadiusPosition = true;
            } else if (!__metravelDidInitialRadiusPosition && !bounds.isValid() && map.__userCenter) {
              map.setView(map.__userCenter, map.getZoom ? map.getZoom() : 10);
              __metravelDidInitialRadiusPosition = true;
            }
          } else if (!__metravelDidInitialRadiusPosition && bounds.isValid() && !__metravelMarkerMeta.usesServerClusters) {
            map.fitBounds(bounds, { padding: [50, 50] });
            __metravelDidInitialRadiusPosition = true;
          } else if (!__metravelDidInitialRadiusPosition && map.__userCenter) {
            map.setView(map.__userCenter, map.getZoom ? map.getZoom() : 10);
            __metravelDidInitialRadiusPosition = true;
          }
        }

        // ───── Серверные кластеры: словарь key → маркер, патч по стабильному ключу ─────
        // Ключ геометрический (#1347): серверные id меняются между запросами с
        // перекрывающимися bbox, а тот же кластер не должен пересоздаваться.
        var __metravelClusterEntries = {};
        var __metravelClusterCount = 0;
        function __metravelClusterKey(cluster) {
          if (cluster.key != null) return String(cluster.key);
          return String(cluster.center[0]) + '|' + String(cluster.center[1]) + '|' + String(cluster.count);
        }
        function __metravelRemoveCluster(key) {
          const entry = __metravelClusterEntries[key];
          if (!entry) return;
          delete __metravelClusterEntries[key];
          __metravelClusterCount -= 1;
          try { clustersLayer.removeLayer(entry.marker); } catch (e) {}
        }
        function __metravelAddCluster(cluster) {
          if (!cluster || !Array.isArray(cluster.center) || cluster.center.length < 2) return;
          const lat = Number(cluster.center[0]);
          const lng = Number(cluster.center[1]);
          if (!isFinite(lat) || !isFinite(lng)) return;
          const key = __metravelClusterKey(cluster);
          __metravelRemoveCluster(key);
          const marker = L.marker([lat, lng], { icon: makeClusterIcon(cluster.count) }).addTo(clustersLayer);
          marker.on('click', function() {
            try {
              if (Array.isArray(cluster.bounds) && cluster.bounds.length >= 2) {
                map.fitBounds(cluster.bounds, { padding: [50, 50] });
                return;
              }
              map.setView([lat, lng], Math.min((map.getZoom ? map.getZoom() : 10) + 2, 18));
            } catch (err) {}
          });
          __metravelClusterEntries[key] = { marker: marker, latLng: [lat, lng] };
          __metravelClusterCount += 1;
        }
        window.__metravelSetClusters = function(patch) {
          try {
            const data = patch || {};
            var add = Array.isArray(data.add) ? data.add : [];
            var removeKeys = Array.isArray(data.removeKeys) ? data.removeKeys : [];
            if (Array.isArray(data.replace)) {
              const nextKeys = {};
              add = [];
              data.replace.forEach(function(cluster) {
                if (!cluster || !Array.isArray(cluster.center)) return;
                const key = __metravelClusterKey(cluster);
                nextKeys[key] = true;
                if (!__metravelClusterEntries[key]) add.push(cluster);
              });
              removeKeys = [];
              for (var existing in __metravelClusterEntries) {
                if (!nextKeys[existing]) removeKeys.push(existing);
              }
            }
            if (data.reset === true ||
                (removeKeys.length > 0 && removeKeys.length >= __metravelClusterCount)) {
              clustersLayer.clearLayers();
              __metravelClusterEntries = {};
              __metravelClusterCount = 0;
            } else {
              removeKeys.forEach(function(key) { __metravelRemoveCluster(String(key)); });
            }
            add.forEach(__metravelAddCluster);
          } catch (e) {}
        };

        window.__metravelSetCenter = function(center) {
          try {
            if (center && isFinite(center.lat) && isFinite(center.lng)) {
              map.__userCenter = [Number(center.lat), Number(center.lng)];
            }
          } catch (e) {}
        };

        // ───── Маршрут: свой канал, приходит только при изменении маршрута ─────
        window.__metravelSetRoute = function(payload) {
          try {
            const data = payload || {};
            const routePoints = Array.isArray(data.routePoints) ? data.routePoints : [];
            const routeLine = Array.isArray(data.routeLine) ? data.routeLine : routePoints;
            const routeApproximate = data.routeApproximate === true;
            // #1847 — оригинал приходит списком линий: по одной на каждый трек
            // файла. Склеенный плоский список рисовал между несмежными треками
            // прямую, которой в исходном файле нет.
            const originalTrackSegments = (Array.isArray(data.originalTrackSegments)
              ? data.originalTrackSegments
              : []).filter(function(segment) {
                return Array.isArray(segment) && segment.length >= 2;
              });
            const routeMode = data.mode || 'radius';
            // #1781 — точки маршрута планировщика тянутся и открывают действия
            // только у владельца поездки. У гостя маркеры остаются как были:
            // не перетаскиваются и не перехватывают тап.
            const routePointsInteractive = data.routePointsInteractive === true;
            // #2073 — подсказка о перетаскивании маркера: RN accessibilityHint до маркеров внутри этого WebView не доходит, поэтому строка ставится прямо на их DOM-узел.
            const routePointMarkerHint = ${serializeForInlineScript(i18nT('tripsStatic:plan.map.markerHint'))};
            // #1820 — счётчик оптовых замен маршрута (шаблон, импорт трека).
            // Его рост — единственный признак «маршрут заменили целиком».
            const routeReplacementToken = data.routeReplacementToken;
            // #2059 — номера точек планировщика и их отступы кадра (иначе null).
            const routePointMarkers = data.routePointMarkers || null;
            const routeFitPadding = routePointMarkers && routePointMarkers.fitPadding;
            window.__metravelMapMode = routeMode;
            routeLayer.clearLayers();
            // #2071 — проводка кластера точек маршрута целиком живёт в
            // nativeRouteClusterScript.ts (disposeRoutePointClusterGroup ниже
            // снимает прежнюю группу; ensureRoutePointClusterGroup создаёт новую
            // в route-ветке, если payload просит кластеры).
            disposeRoutePointClusterGroup(map);
            // #1851 — оригинальный трек не зависит от точек маршрута: файл
            // грузят раньше, чем расставляют точки. Условие линии маршрута не
            // меняется — она по-прежнему рисуется только от своих точек.
            window.__metravelRouteActive = routeMode === 'route' &&
              (routePoints.length >= 1 || originalTrackSegments.length > 0);
            if (window.__metravelRouteActive) {
              const routeBounds = L.latLngBounds();
              // #1820 — защёлку кадра снимает только явный сигнал оптовой замены
              // маршрута: счётчик применений шаблона и импортов трека из
              // RouteBuilder. Выводить замену из самих точек нельзя — повторное
              // применение ТОГО ЖЕ шаблона возвращает неперетащенные точки с
              // прежними координатами, и от частичной правки такая замена
              // неотличима. Снятие стоит до всех читателей флага ниже: подгонки
              // по линии, по оригинальному треку и по единственной точке.
              if (map.__metravelRouteReplacementToken !== routeReplacementToken) {
                map.__metravelRouteReplacementToken = routeReplacementToken;
                map.__metravelRouteFitLocked = false;
              }
              // #2071 P2-1 — renderPoints прилетает и на смену activeIndex
              // (открыть/закрыть точку в редакторе), которая геометрию не
              // трогает вовсе. Без этого ключа кадр перестраивался бы на
              // КАЖДЫЙ такой вызов, пока владелец не потянет маркер (тот
              // единственный момент, что раньше ставил fitLocked) — активная
              // точка прыгала бы к обзору всего маршрута и сбрасывала фокус
              // #2066/#2058. Тот же приём, что map.__lastPointsFitKey у
              // pointsOnly-ветки ниже: кадр трогаем только когда РЕАЛЬНО
              // изменились точки/линия/оригинал/оптовая замена.
              const routeFitKey = JSON.stringify([routePoints, routeLine, originalTrackSegments, routeReplacementToken]);
              const routeGeometryChanged = map.__metravelRouteFitKey !== routeFitKey;
              map.__metravelRouteFitKey = routeFitKey;
              if (routeLine.length >= 2) {
                // #2056 — маршрут с переездами рисуется по отрезкам (drawRouteLines), кадр — по всей routeLine.
                const routePolyline = drawRouteLines(routeLine, routeApproximate, routePointMarkers, routeLayer);
                routeLine.forEach(function(point) {
                  if (Array.isArray(point) && isFinite(point[0]) && isFinite(point[1])) {
                    routeBounds.extend(point);
                  }
                });
                try {
                  // #1781 — после ручного перетаскивания маркера кадр не двигаем:
                  // подгонка существует для формы маршрута, а не для того, чтобы
                  // отменять наведённый пользователем вид.
                  if (routeGeometryChanged && !map.__metravelRouteFitLocked) {
                    map.fitBounds(routePolyline.getBounds(), metravelFitOptions(routeFitPadding, [70, 70]));
                  }
                } catch (e) {}
              }
              // Оригинальный трек — отдельные полилинии поверх линии маршрута:
              // упрощённые точки и построенная по ним линия остаются на карте.
              if (originalTrackSegments.length) {
                originalTrackSegments.forEach(function(segment) {
                  L.polyline(segment, {
                    color: ORIGINAL_TRACK_COLOR,
                    weight: 3,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round'
                  }).addTo(routeLayer);
                  segment.forEach(function(point) {
                    if (Array.isArray(point) && isFinite(point[0]) && isFinite(point[1])) {
                      routeBounds.extend(point);
                    }
                  });
                });
              }
              // #2071 — кластеризация точек маршрута, паритет с web
              // (mapClusterGroup.ts + FOCUS_POINT_ZOOM): порог и радиус
              // приходят в payload (tripPlanMapMarkers.ts), а не задаются здесь
              // числом. null/undefined — маршрут короткий, точки остаются как
              // раньше, каждая своим маркером в routeLayer.
              ensureRoutePointClusterGroup(map, routePointMarkers && routePointMarkers.cluster);
              routePoints.forEach(function(point, index) {
                if (!Array.isArray(point) || !isFinite(point[0]) || !isFinite(point[1])) return;
                const isStart = index === 0;
                const isEnd = routePoints.length > 1 && index === routePoints.length - 1;
                // #2071 — активная точка остаётся крупнее и вне кластера (та же
                // логика, что у web: TripPlanRouteMarkers.tsx исключает
                // activeIndex из группы кластеров). Держанная (только что
                // брошенная, P2-2) — вне кластера тем же путём, что web решил
                // heldIndex/isDroppedAt.
                const isActive = !!(routePointMarkers && routePointMarkers.activeIndex === index);
                const isHeld = isRoutePointHeld(map.__metravelRouteHeldPoint, index, point);
                // #1781 — L.Draggable есть только у L.Marker, у circleMarker его нет
                // вовсе. Поэтому точка маршрута рисуется divIcon той же геометрии:
                // диаметр = 2*radius + weight, заливка и рамка — прежние цвета.
                const marker = L.marker(point, {
                  icon: routePointIcon(routePointMarkers, index, isStart, isEnd, isActive),
                  draggable: routePointsInteractive,
                  interactive: routePointsInteractive,
                  keyboard: false,
                  title: routePointsInteractive ? routePointMarkerHint : undefined,
                  zIndexOffset: isActive ? 1000 : 0
                });
                addRoutePointMarkerToLayer(marker, routeLayer, map.__metravelRoutePointClusterGroup, isActive || isHeld);
                if (routePointsInteractive) {
                  // #2073 — aria-description добавляет ту же подсказку в accessibility-дерево (title выше — только тултип Leaflet).
                  const routePointMarkerElement = marker.getElement ? marker.getElement() : null;
                  if (routePointMarkerElement) {
                    routePointMarkerElement.setAttribute('aria-description', routePointMarkerHint);
                  }
                  // #2071 — маркер в кластере не всегда получает DOM-узел сразу:
                  // пока точки свёрнуты в кластер, дочерний маркер не в DOM, и
                  // getElement() выше отдаёт null. add стреляет каждый раз, когда
                  // маркер реально появляется (первый показ, спайдерфай, зум выше
                  // порога) — тем же приёмом, что и web (TripPlanRouteMarkers.tsx).
                  marker.on('add', function() {
                    const element = marker.getElement ? marker.getElement() : null;
                    if (element) element.setAttribute('aria-description', routePointMarkerHint);
                  });
                  marker.on('dragstart', function() {
                    // Кадр перестаёт подгоняться под маршрут: дальше видом
                    // управляет пользователь, а не форма линии.
                    map.__metravelRouteFitLocked = true;
                  });
                  marker.on('dragend', function(event) {
                    try {
                      const position = event && event.target && event.target.getLatLng
                        ? event.target.getLatLng()
                        : null;
                      if (!position || !isFinite(position.lat) || !isFinite(position.lng)) return;
                      // #2071 P2-2 — держим точку вне кластера, пока она стоит
                      // там, куда её бросили: следующий renderPoints (тот же
                      // повод, что уже вызывает numbers/activeIndex-обновления)
                      // иначе вернул бы её в кластер соседа, и точка «пропала»
                      // бы там, где её оставил владелец.
                      map.__metravelRouteHeldPoint = { index: index, lat: position.lat, lng: position.lng };
                      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'ROUTE_POINT_MOVED',
                          index: index,
                          lat: position.lat,
                          lng: position.lng
                        }));
                      }
                    } catch (e) {}
                  });
                  marker.on('click', function(event) {
                    try {
                      // Без этого Leaflet поднимет клик до карты, и MAP_CLICK
                      // добавит новую точку прямо поверх выбранной.
                      if (event && event.originalEvent) L.DomEvent.stopPropagation(event);
                      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'ROUTE_POINT_TAP',
                          index: index
                        }));
                      }
                    } catch (e) {}
                  });
                }
                routeBounds.extend(point);
              });
              // #1858 — кадр считается ОДИН раз и после отрисовки маркеров:
              // раньше подгонка по треку стояла выше routePoints.forEach, а
              // центровка одиночной точки — ниже, и при «трек + первая точка»
              // побеждала последняя, отменяя наведение на трек зумом 14.
              // Теперь при наличии трека кадр берётся по объединению границ
              // трека, линии и точек (паритет с web: TripPlanRouteMap.web.tsx:390
              // подгоняется по объединению трека и точек), а центровка зумом 14 остаётся
              // ровно для маршрута без трека, где она единственный источник кадра.
              if (originalTrackSegments.length) {
                // Оригинал может выходить за пределы упрощённой линии: когда та
                // есть, кадр подогнался по ней выше — досаживаем его на общие
                // границы. Когда линии нет, эта подгонка кадр и ставит.
                try {
                  if (routeGeometryChanged && routeBounds.isValid() && !map.__metravelRouteFitLocked) {
                    map.fitBounds(routeBounds, metravelFitOptions(routeFitPadding, [70, 70]));
                  }
                } catch (e) {}
              } else if (routeGeometryChanged && routePoints.length >= 1 && routeLine.length < 2 && routeBounds.isValid() && !map.__metravelRouteFitLocked) {
                try {
                  map.setView(routeBounds.getCenter(), Math.max(map.getZoom ? map.getZoom() : 13, 14));
                } catch (e) {}
              }
            }
          } catch (e) {}
        };
`;
