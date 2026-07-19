import { DESIGN_COLORS, DESIGN_TOKENS } from '@/constants/designSystem';
import { getActiveOverlayLayers, getThemedBaseAttribution, getThemedBaseMaxZoom } from '@/config/mapWebLayers';
import type { ThemedColors } from '@/hooks/useTheme';
import { getActiveLocaleDefinition, translate as i18nT } from '@/i18n';
import { serializeForInlineScript } from '@/utils/webViewBridge';
import {
  buildInvalidateSchedulerScript,
  buildLeafletWebViewHtml,
  ESCAPE_HTML_FN_SCRIPT,
} from '@/components/map-core/leafletWebViewHtml';
import { buildBirdMarkerHtml } from './mapMarkerStyles';

const DEFAULT_LAT = 53.8828449;
const DEFAULT_LNG = 27.7273595;
const OVERPASS_ENDPOINT =
  process.env.EXPO_PUBLIC_OVERPASS_ENDPOINT || 'https://overpass-api.de/api/interpreter';

const NATIVE_OVERLAY_LAYERS = getActiveOverlayLayers()
  .filter((layer) => layer.kind !== 'weather-temp-labels')
  .map((layer) => ({
    id: layer.id,
    kind: layer.kind,
    url: layer.url,
    opacity: layer.opacity ?? 1,
    minZoom: layer.minZoom ?? 0,
    maxZoom: layer.maxZoom ?? 19,
    zIndex: layer.zIndex ?? 400,
    markerColor: layer.markerColor ?? '',
    overpassFilters: Array.isArray(layer.overpassFilters) ? layer.overpassFilters : [],
    wfsTypeName: layer.wfsParams?.typeName ?? '',
    wfsVersion: layer.wfsParams?.version ?? '2.0.0',
    wfsSrs: layer.wfsParams?.srsName ?? 'EPSG:4326',
    wfsBboxOrder: layer.wfsParams?.bboxOrder ?? 'lonlat',
  }));

const USER_LOCATION_COLOR = DESIGN_TOKENS.colors.accent;
const BIRD_MARKER_HTML = buildBirdMarkerHtml();
export const buildNativeMapHtml = ({
  themeColors,
  markerShadowColor,
}: {
  themeColors: ThemedColors;
  markerShadowColor: string;
}) =>
  buildLeafletWebViewHtml({
    headStyles: `        .leaflet-popup-content-wrapper { background-color: ${themeColors.surface}; border-radius: 8px; padding: 0; }
        .leaflet-popup-content { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; }
        .popup-text { padding: 12px; font-size: 13px; line-height: 1.45; }
        .popup-title {
          font-weight: 700;
          color: ${themeColors.text};
          font-size: 14px;
          line-height: 1.35;
          margin-bottom: 8px;
        }
        .metravel-marker { background: transparent; border: 0; }
        .metravel-cluster {
          width: 44px;
          height: 44px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${themeColors.primary};
          color: ${themeColors.textOnDark};
          border: 3px solid ${themeColors.surface};
          box-shadow: 0 4px 12px ${markerShadowColor};
          font-weight: 700;
          font-size: 14px;
          line-height: 1;
        }`,
    bodyScript: `        const MAP_LANGUAGE = ${serializeForInlineScript(getActiveLocaleDefinition().geocoderLanguage)};
        // zoomControl: false — встроенные кнопки +/− Leaflet (верхний левый угол)
        // перекрывали номерной/стартовый маркер маршрута. Зум доступен через
        // плавающие нативные контролы (__metravelMapZoomIn/Out).
        const map = L.map('map', {
          zoomControl: false,
          preferCanvas: true,
          fadeAnimation: false,
          zoomAnimation: false,
          markerZoomAnimation: false
        }).setView([${DEFAULT_LAT}, ${DEFAULT_LNG}], 10);
        map.__userCenter = [${DEFAULT_LAT}, ${DEFAULT_LNG}];
        // Текущий режим карты ('radius' | 'route'); обновляется при каждом рендере точек.
        // В route-режиме тап по карте отправляется в RN для добавления точки маршрута (#111).
        window.__metravelMapMode = 'radius';
        map.on('click', function(e) {
          try {
            if (window.__metravelMapMode !== 'route') return;
            if (!e || !e.latlng) return;
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'MAP_CLICK', lat: e.latlng.lat, lng: e.latlng.lng
              }));
            }
          } catch (err) {}
        });

        // F-49 — сообщаем RN центр карты (с дебаунсом) после панорамирования/зума,
        // чтобы экран мог предложить «Искать в этой области». Не шлём, если центр
        // почти не сдвинулся относительно последнего отправленного (jitter-гард).
        var __metravelMoveTimer = null;
        var __metravelLastSentCenter = null;
        var __metravelUserGesturePending = false;
        var __metravelProgrammaticMoveUntil = 0;
        function __metravelMarkUserGesture() {
          try {
            if (Date.now() < __metravelProgrammaticMoveUntil) return;
            __metravelUserGesturePending = true;
          } catch (e) {}
        }
        function __metravelViewportPayload(type) {
          try {
            var c = map.getCenter ? map.getCenter() : null;
            var b = map.getBounds ? map.getBounds() : null;
            var sw = b && b.getSouthWest ? b.getSouthWest() : null;
            var ne = b && b.getNorthEast ? b.getNorthEast() : null;
            var zoom = map.getZoom ? Number(map.getZoom()) : NaN;
            if (!c || !isFinite(c.lat) || !isFinite(c.lng) || !sw || !ne || !isFinite(zoom)) return null;
            var payload = {
              type: type,
              lat: c.lat,
              lng: c.lng,
              zoom: zoom,
              bbox: {
                south: Math.min(sw.lat, ne.lat),
                west: Math.min(sw.lng, ne.lng),
                north: Math.max(sw.lat, ne.lat),
                east: Math.max(sw.lng, ne.lng)
              }
            };
            if (type === 'MAP_MOVED' && __metravelUserGesturePending) {
              payload.userInitiated = true;
            }
            return payload;
          } catch (e) { return null; }
        }
        function __metravelPostViewport(type) {
          try {
            var payload = __metravelViewportPayload(type);
            if (!payload) return;
            if (type === 'MAP_MOVED') {
              if (__metravelLastSentCenter &&
                  Math.abs(__metravelLastSentCenter.lat - payload.lat) < 0.0001 &&
                  Math.abs(__metravelLastSentCenter.lng - payload.lng) < 0.0001) {
                return;
              }
              __metravelLastSentCenter = { lat: payload.lat, lng: payload.lng };
            }
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify(payload));
            }
            if (type === 'MAP_MOVED') {
              __metravelUserGesturePending = false;
            }
          } catch (e) {}
        }
        function __metravelEmitMapMove() { __metravelPostViewport('MAP_MOVED'); }
        map.on('dragstart', __metravelMarkUserGesture);
        map.on('zoomstart', __metravelMarkUserGesture);
        map.on('moveend', function() {
          try {
            window.__metravelScheduleInvalidate('moveend');
            if (__metravelMoveTimer) clearTimeout(__metravelMoveTimer);
            __metravelMoveTimer = setTimeout(__metravelEmitMapMove, 300);
          } catch (e) {}
        });
        map.on('zoomend', function() {
          try {
            window.__metravelScheduleInvalidate('zoomend');
            __metravelPostViewport('MAP_VIEWPORT');
          } catch (e) {}
        });

        window.__metravelMapZoomIn = function() {
          try { map.zoomIn(); } catch (e) {}
        };
        window.__metravelMapZoomOut = function() {
          try { map.zoomOut(); } catch (e) {}
        };
        // Центрируем только на реальной точке пользователя, если она есть
        // (__metravelRenderUserLocation её выставляет). Дефолтный/viewport center
        // не должен выглядеть как текущее положение пользователя.
        map.__realUserLocation = null;
        window.__metravelMapCenterOnUser = function() {
          try {
            const target = map.__realUserLocation;
            if (!target) return;
            __metravelProgrammaticMoveUntil = Date.now() + 700;
            map.setView(target, Math.max(map.getZoom ? map.getZoom() : 10, 13));
          } catch (e) {}
        };

        // Базовая подложка всегда светлая (OSM-прокси, без {s}), независимо от
        // темы приложения — обычный цвет карты. Тёмными остаются только панели/
        // контролы/маркеры.
        //
        // Офлайн-карта (Фаза 0): вместо прямого L.tileLayer (который грузит <img>
        // из сети) используем мост TileBridge → RN. Каждый тайл createTile постит
        // TILE_REQ наружу; RN читает дисковый кэш (офлайн-показ), а при онлайн-
        // промахе качает реальный тайл через прокси И кэширует его. Онлайн-картинка
        // не меняется — те же тайлы, просто через RN-мост (прозрачный кэш).
        window.__metravelTilePending = {};
        var TileBridge = L.GridLayer.extend({
          createTile: function(coords, done) {
            var img = document.createElement('img');
            img.alt = '';
            var key = coords.z + '/' + coords.x + '/' + coords.y;
            window.__metravelTilePending[key] = { img: img, done: done };
            try {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'TILE_REQ', z: coords.z, x: coords.x, y: coords.y, key: key
                }));
              }
            } catch (e) {}
            return img;
          }
        });
        // RN отдаёт результат сюда: data-URL → рисуем тайл; пусто → прозрачный
        // тайл (офлайн + не в кэше), карта не виснет в ожидании.
        window.__metravelSetTile = function(key, dataUrl) {
          try {
            var pending = window.__metravelTilePending[key];
            if (!pending) return;
            delete window.__metravelTilePending[key];
            var img = pending.img, done = pending.done;
            if (dataUrl) {
              img.onload = function() { try { done(null, img); } catch (e) {} };
              img.onerror = function() { try { done(null, img); } catch (e) {} };
              img.src = dataUrl;
            } else {
              try { done(null, img); } catch (e) {}
            }
          } catch (e) {}
        };
        new TileBridge({
          attribution: ${serializeForInlineScript(getThemedBaseAttribution())},
          maxZoom: ${getThemedBaseMaxZoom()},
          tileSize: 256,
          updateWhenIdle: false,
          updateWhenZooming: false,
          keepBuffer: 1
        }).addTo(map);

${buildInvalidateSchedulerScript({
  schedulerName: '__metravelScheduleInvalidate',
  helperName: '__metravelInvalidateMapSize',
  mode: 'window-prop',
})}

        const markersLayer = L.layerGroup().addTo(map);
        const clustersLayer = L.layerGroup().addTo(map);
        const routeLayer = L.layerGroup().addTo(map);
        // Radius-mode data updates can arrive after every zoom/pan through the
        // server-cluster query. Auto-fitting on each payload fights the user's
        // gesture and causes Android WebView to visibly pan back and redraw
        // clusters. Do one initial positioning pass only; user gestures and
        // explicit cluster/marker taps remain in control after that.
        var __metravelDidInitialRadiusPosition = false;
        // Отдельный слой для маркера «вы здесь». НЕ чистится в __metravelRenderPoints
        // (где clearLayers зовётся только для markersLayer/routeLayer), поэтому синяя
        // точка не мигает при ре-рендере travel-маркеров. Добавлен последним —
        // лежит поверх travel-маркеров.
        const userLayer = L.layerGroup().addTo(map);

        const USER_LOCATION_COLOR = ${serializeForInlineScript(USER_LOCATION_COLOR)};
        const USER_LOCATION_RING = ${serializeForInlineScript(themeColors.textOnDark)};

        // Рисует синюю точку пользователя (accent-цвет, как на web) + полупрозрачный
        // accuracy-круг под ней. Перед отрисовкой чистит userLayer, чтобы точка не
        // дублировалась при обновлении гео.
        window.__metravelRenderUserLocation = function(lat, lng) {
          try {
            if (!isFinite(lat) || !isFinite(lng)) return;
            map.__realUserLocation = [lat, lng];
            userLayer.clearLayers();
            L.circle([lat, lng], {
              radius: 60,
              color: USER_LOCATION_COLOR,
              weight: 1,
              opacity: 0.4,
              fillColor: USER_LOCATION_COLOR,
              fillOpacity: 0.12,
              interactive: false
            }).addTo(userLayer);
            const dot = L.circleMarker([lat, lng], {
              radius: 8,
              color: USER_LOCATION_RING,
              weight: 3,
              fillColor: USER_LOCATION_COLOR,
              fillOpacity: 1
            }).addTo(userLayer);
            dot.bindPopup(${serializeForInlineScript(i18nT('map:components.MapPage.Map.nativeWebView.currentLocation'))});
            try { dot.bringToFront(); } catch (e) {}
          } catch (e) {}
        };

        window.__metravelClearUserLocation = function() {
          try { userLayer.clearLayers(); map.__realUserLocation = null; } catch (e) {}
        };

        // #843 — shared brand «bird» divIcon. Inline HTML renders reliably in Android
        // WebView (SVG data-URI markers can render invisible). Size/anchor mirror the
        // web useLeafletIcons bird so the tip points at the coordinate and the popup/
        // bottom-card offset is unchanged.
        const markerIcon = L.divIcon({
          className: 'metravel-marker',
          html: ${serializeForInlineScript(BIRD_MARKER_HTML)},
          iconSize: [48, 58],
          iconAnchor: [24, 54],
          popupAnchor: [0, -46]
        });
        function makeClusterIcon(count) {
          var label = Number(count);
          var text = isFinite(label) && label > 999 ? '999+' : String(isFinite(label) && label > 0 ? label : '');
          return L.divIcon({
            className: '',
            html: '<div class="metravel-cluster" aria-hidden="true">' + escapeHtml(text) + '</div>',
            iconSize: [44, 44],
            iconAnchor: [22, 22]
          });
        }

        const ROUTE_COLOR = ${serializeForInlineScript(DESIGN_COLORS.routeLine)};
        const ROUTE_SURFACE = ${serializeForInlineScript(themeColors.surface)};
        const ROUTE_START = ${serializeForInlineScript(themeColors.success || themeColors.primary)};

        // Экранируем значения точек перед вставкой в HTML popup: поля приходят с бэка
        // и могут содержать <, >, ", ' и & — без эскейпа это XSS в WebView (#113).
${ESCAPE_HTML_FN_SCRIPT}

        window.__metravelRenderPoints = function(payload) {
          try {
            const data = payload || {};
            const points = Array.isArray(data.points) ? data.points : [];
            const clusters = Array.isArray(data.clusters) ? data.clusters : [];
            const routePoints = Array.isArray(data.routePoints) ? data.routePoints : [];
            const routeLine = Array.isArray(data.routeLine) ? data.routeLine : routePoints;
            const routeMode = data.mode || 'radius';
            const usesServerClusters = data.usesServerClusters === true;
            const pointsOnly = data.pointsOnly === true;
            window.__metravelMapMode = routeMode;
            if (data.center && isFinite(data.center.lat) && isFinite(data.center.lng)) {
              map.__userCenter = [data.center.lat, data.center.lng];
            }

            markersLayer.clearLayers();
            clustersLayer.clearLayers();
            routeLayer.clearLayers();
            const bounds = L.latLngBounds();

            clusters.forEach(function(cluster) {
              if (!cluster || !Array.isArray(cluster.center) || cluster.center.length < 2) return;
              const lat = Number(cluster.center[0]);
              const lng = Number(cluster.center[1]);
              if (!isFinite(lat) || !isFinite(lng)) return;
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
              bounds.extend([lat, lng]);
            });

            points.forEach(function(point, pointIndex) {
              if (!point || !point.coord) return;
              const parts = String(point.coord).split(',').map(Number);
              const lat = parts[0];
              const lng = parts[1];
              if (!isFinite(lat) || !isFinite(lng)) return;

              // Зона кемпинга: рисуем полупрозрачный круг ПОД маркером для точек,
              // у которых categoryName содержит 'Кемпинг' или 'Лагерь'. Бэкенд не
              // отдаёт полигон-геометрию, поэтому зона — L.circle фиксированного
              // радиуса 250м (визуальная зона, НЕ search radius). Круг добавляется
              // в markersLayer, который чистится в начале __metravelRenderPoints,
              // поэтому зоны не накапливаются при ре-рендере точек.
              const categoryName = String(point.categoryName || '');
              const isCamping = categoryName.indexOf('Кемпинг') !== -1 || categoryName.indexOf('Лагерь') !== -1;
              if (isCamping) {
                L.circle([lat, lng], {
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

              // F-46 — на native НЕ открываем Leaflet-попап (зеркало web-фикса):
              // тап по маркеру только отдаёт выбор в RN, экран показывает нижнюю
              // карточку места (MapPlaceBottomCard), где есть вся навигация попапа.
              // Шлём стабильные id/coord + индекс как fallback: при server clusters
              // массив points может пересоздаться между zoom/re-render, и один индекс
              // уже недостаточно надёжен для открытия карточки.
              marker.on('click', function() {
                try {
                  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'SELECT_PLACE',
                      index: pointIndex,
                      id: point.id == null ? null : String(point.id),
                      coord: point.coord == null ? null : String(point.coord)
                    }));
                  }
                } catch (err) {}
              });

              bounds.extend([lat, lng]);
            });

            if (routeMode === 'route' && routePoints.length >= 1) {
              const routeBounds = L.latLngBounds();
              if (routeLine.length >= 2) {
                const routePolyline = L.polyline(routeLine, {
                  color: ROUTE_COLOR,
                  weight: 5,
                  opacity: 0.9,
                  lineCap: 'round',
                  lineJoin: 'round'
                }).addTo(routeLayer);
                routeLine.forEach(function(point) {
                  if (Array.isArray(point) && isFinite(point[0]) && isFinite(point[1])) {
                    routeBounds.extend(point);
                  }
                });
                try {
                  map.fitBounds(routePolyline.getBounds(), { padding: [70, 70] });
                } catch (e) {}
              }
              routePoints.forEach(function(point, index) {
                if (!Array.isArray(point) || !isFinite(point[0]) || !isFinite(point[1])) return;
                const isStart = index === 0;
                const isEnd = routePoints.length > 1 && index === routePoints.length - 1;
                L.circleMarker(point, {
                  radius: isStart || isEnd ? 8 : 6,
                  color: ROUTE_SURFACE,
                  weight: 3,
                  fillColor: isStart ? ROUTE_START : ROUTE_COLOR,
                  fillOpacity: 1
                }).addTo(routeLayer);
                routeBounds.extend(point);
              });
              if (routeLine.length < 2 && routeBounds.isValid()) {
                try {
                  map.setView(routeBounds.getCenter(), Math.max(map.getZoom ? map.getZoom() : 13, 14));
                } catch (e) {}
              }
            } else if (pointsOnly) {
              // Каталог квестов (pointsOnly): рефит при СМЕНЕ набора точек — выбор
              // города меняет маркеры, карта обязана перелететь на них. Зеркало web
              // keyed-рефита (dataKey по id/coord): ручной пан не меняет набор точек,
              // поэтому не дёргает карту. Radius-режим сюда не заходит и сохраняет
              // одноразовую защёлку ниже.
              var dataKey = points
                .map(function (p) { return p && p.id != null ? ('id:' + p.id) : ('c:' + (p && p.coord)); })
                .join('|');
              if (bounds.isValid() && map.__lastPointsFitKey !== dataKey) {
                map.fitBounds(bounds, { padding: [50, 50] });
                map.__lastPointsFitKey = dataKey;
                __metravelDidInitialRadiusPosition = true;
              } else if (!__metravelDidInitialRadiusPosition && !bounds.isValid() && map.__userCenter) {
                map.setView(map.__userCenter, map.getZoom ? map.getZoom() : 10);
                __metravelDidInitialRadiusPosition = true;
              }
            } else if (!__metravelDidInitialRadiusPosition && bounds.isValid() && !usesServerClusters) {
              map.fitBounds(bounds, { padding: [50, 50] });
              __metravelDidInitialRadiusPosition = true;
            } else if (!__metravelDidInitialRadiusPosition && map.__userCenter) {
              map.setView(map.__userCenter, map.getZoom ? map.getZoom() : 10);
              __metravelDidInitialRadiusPosition = true;
            }
            window.__metravelScheduleInvalidate('renderPoints');
            setTimeout(function() { __metravelPostViewport('MAP_VIEWPORT'); }, 0);
          } catch (e) {}
        };

        // ───────────────────────── Оверлеи (web-parity) ─────────────────────────
        // На web эти слои рисует useMapApi (Overpass/WFS/tile). На native повторяем
        // тот же контракт mapUiApi.setOverlayEnabled(id, enabled) — но рендерим
        // внутри WebView. Overpass/WFS — bbox-driven с дебаунсом по moveend.
        var OVERLAY_DEFS = ${serializeForInlineScript(NATIVE_OVERLAY_LAYERS)};
        var OVERPASS_ENDPOINT = ${serializeForInlineScript(OVERPASS_ENDPOINT)};
        var overlayLayers = {};      // id -> L.layerGroup/L.tileLayer
        var overlayControllers = {}; // id -> { start, stop } для bbox-driven слоёв
        var overlayEnabled = {};     // id -> bool

        function overlayBBox() {
          try {
            var b = map.getBounds();
            var sw = b.getSouthWest();
            var ne = b.getNorthEast();
            // Ограничиваем площадь, чтобы Overpass/WFS не падали на «весь мир».
            var south = Math.min(sw.lat, ne.lat);
            var north = Math.max(sw.lat, ne.lat);
            var west = Math.min(sw.lng, ne.lng);
            var east = Math.max(sw.lng, ne.lng);
            return { south: south, west: west, north: north, east: east };
          } catch (e) { return null; }
        }

        function bboxKey(b) {
          var r = function(n) { return Math.round(n * 100) / 100; };
          return r(b.south) + '|' + r(b.west) + '|' + r(b.north) + '|' + r(b.east);
        }

        function makeBboxController(layerGroup, buildQuery, renderFn, debounceMs, opts) {
          var timer = null, lastKey = null, busy = false, ctrl = null, on = false;
          var minZoom = (opts && isFinite(opts.minZoom)) ? opts.minZoom : 0;
          var logId = (opts && opts.logId) ? opts.logId : 'overlay';
          function load() {
            if (busy || !on) return;
            // minZoom-гейт: ниже порога Overpass-запрос пропускаем (с логом).
            var z = (typeof map.getZoom === 'function') ? Number(map.getZoom()) : NaN;
            if (isFinite(z) && z < minZoom) {
              try { console.warn('[Map.ios overlay:' + logId + '] Skipped load: zoom ' + z + ' < minZoom ' + minZoom); } catch (e) {}
              try { layerGroup.clearLayers(); } catch (e) {}
              lastKey = null;
              return;
            }
            var b = overlayBBox();
            if (!b) return;
            var key = bboxKey(b);
            if (key === lastKey) return;
            lastKey = key;
            if (ctrl) { try { ctrl.abort(); } catch (e) {} }
            ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
            busy = true;
            var url = buildQuery(b);
            var opts = ctrl ? { signal: ctrl.signal } : {};
            fetch(url, opts)
              .then(function(res) { return res.ok ? res.json() : null; })
              .then(function(data) { if (data && on) { try { renderFn(layerGroup, data, b); } catch (e) {} } })
              .catch(function() {})
              .then(function() { busy = false; });
          }
          function schedule() { if (timer) clearTimeout(timer); timer = setTimeout(load, debounceMs || 650); }
          function onMove() { schedule(); }
          return {
            start: function() { on = true; lastKey = null; map.on('moveend', onMove); schedule(); },
            stop: function() {
              on = false;
              map.off('moveend', onMove);
              if (ctrl) { try { ctrl.abort(); } catch (e) {} }
              if (timer) clearTimeout(timer);
              lastKey = null;
              try { layerGroup.clearLayers(); } catch (e) {}
            }
          };
        }

        function overpassUrl(ql) {
          return OVERPASS_ENDPOINT + '?data=' + encodeURIComponent(ql);
        }

        function overpassCampingQL(b) {
          return '[out:json][timeout:25];(' +
            'way["amenity"="shelter"](' + b.south + ',' + b.west + ',' + b.north + ',' + b.east + ');' +
            'node["amenity"="shelter"](' + b.south + ',' + b.west + ',' + b.north + ',' + b.east + ');' +
            'way["tourism"="wilderness_hut"](' + b.south + ',' + b.west + ',' + b.north + ',' + b.east + ');' +
            'node["tourism"="wilderness_hut"](' + b.south + ',' + b.west + ',' + b.north + ',' + b.east + ');' +
            'way["tourism"="camp_pitch"](' + b.south + ',' + b.west + ',' + b.north + ',' + b.east + ');' +
            'node["tourism"="camp_pitch"](' + b.south + ',' + b.west + ',' + b.north + ',' + b.east + ');' +
            'relation["tourism"="camp_site"](' + b.south + ',' + b.west + ',' + b.north + ',' + b.east + ');' +
            'way["tourism"="camp_site"](' + b.south + ',' + b.west + ',' + b.north + ',' + b.east + ');' +
            'node["tourism"="camp_site"](' + b.south + ',' + b.west + ',' + b.north + ',' + b.east + ');' +
            ');out center tags;';
        }

        function overpassPoiQL(b) {
          return '[out:json][timeout:25];(' +
            'node["tourism"~"^(attraction|museum|viewpoint|zoo|theme_park)$"](' + b.south + ',' + b.west + ',' + b.north + ',' + b.east + ');' +
            'way["tourism"~"^(attraction|museum|viewpoint|zoo|theme_park)$"](' + b.south + ',' + b.west + ',' + b.north + ',' + b.east + ');' +
            'node["historic"~"^(castle|manor|fort|ruins|archaeological_site|monument|memorial)$"](' + b.south + ',' + b.west + ',' + b.north + ',' + b.east + ');' +
            'way["historic"~"^(castle|manor|fort|ruins|archaeological_site|monument|memorial)$"](' + b.south + ',' + b.west + ',' + b.north + ',' + b.east + ');' +
            'node["amenity"="place_of_worship"](' + b.south + ',' + b.west + ',' + b.north + ',' + b.east + ');' +
            'way["amenity"="place_of_worship"](' + b.south + ',' + b.west + ',' + b.north + ',' + b.east + ');' +
            ');out center tags;';
        }

        // Универсальный features-QL по фильтрам из конфигурации (зеркалит
        // buildOsmFeaturesOverpassQL). Каждый фильтр key/value(+regex) → строки
        // по типам элементов, объединённые ИЛИ. out center tags → точки.
        function overpassFeaturesQL(b, filters) {
          var box = b.south + ',' + b.west + ',' + b.north + ',' + b.east;
          var lines = [];
          var list = Array.isArray(filters) ? filters : [];
          for (var i = 0; i < list.length; i++) {
            var f = list[i];
            if (!f || !f.key || !f.value) continue;
            var selector = f.regex ? ('["' + f.key + '"~"' + f.value + '"]') : ('["' + f.key + '"="' + f.value + '"]');
            var els = (Array.isArray(f.elements) && f.elements.length) ? f.elements : ['node', 'way'];
            for (var j = 0; j < els.length; j++) {
              lines.push(els[j] + selector + '(' + box + ');');
            }
          }
          return '[out:json][timeout:25];(' + lines.join('') + ');out center tags;';
        }

        function overpassRoutesQL(b) {
          return '[out:json][timeout:25];(' +
            'relation["type"="route"]["route"~"^(hiking|bicycle)$"](' + b.south + ',' + b.west + ',' + b.north + ',' + b.east + ');' +
            ');(._;>;);out geom tags;';
        }

        // Overpass node/way с center → точечные маркеры.
        function renderOverpassPoints(layerGroup, data, color) {
          layerGroup.clearLayers();
          var els = (data && Array.isArray(data.elements)) ? data.elements : [];
          for (var i = 0; i < els.length; i++) {
            var el = els[i];
            var lat = (el.type === 'node') ? el.lat : (el.center && el.center.lat);
            var lng = (el.type === 'node') ? el.lon : (el.center && el.center.lon);
            if (!isFinite(lat) || !isFinite(lng)) continue;
            var tags = el.tags || {};
            var title = tags['name:' + MAP_LANGUAGE] || tags.name || tags['name:en'] || tags.tourism || tags.historic || tags.amenity || ${serializeForInlineScript(i18nT('map:components.MapPage.Map.nativeWebView.osmPoint'))};
            var m = L.circleMarker([lat, lng], {
              radius: 6, color: ROUTE_SURFACE, weight: 2, fillColor: color, fillOpacity: 0.95
            });
            m.bindPopup('<div class="popup-text"><div class="popup-title">' + escapeHtml(title) + '</div></div>', { maxWidth: 240 });
            m.addTo(layerGroup);
          }
        }

        // Features-слой: точки с попапом name/ele (высота, если есть).
        function renderOverpassFeatures(layerGroup, data, color) {
          layerGroup.clearLayers();
          var els = (data && Array.isArray(data.elements)) ? data.elements : [];
          for (var i = 0; i < els.length; i++) {
            var el = els[i];
            var lat = (el.type === 'node') ? el.lat : (el.center && el.center.lat);
            var lng = (el.type === 'node') ? el.lon : (el.center && el.center.lon);
            if (!isFinite(lat) || !isFinite(lng)) continue;
            var tags = el.tags || {};
            var title = tags['name:' + MAP_LANGUAGE] || tags.name || tags['name:en'] || tags.tourism || tags.natural || tags.historic || tags.amenity || tags.railway || ${serializeForInlineScript(i18nT('map:components.MapPage.Map.nativeWebView.osmPoint'))};
            var eleNum = tags.ele != null ? Number(tags.ele) : NaN;
            var eleLine = isFinite(eleNum) ? ('<div style="margin-top:4px;font-size:12px;color:#888">' + ${serializeForInlineScript(i18nT('map:components.MapPage.Map.nativeWebView.elevationPrefix'))} + Math.round(eleNum) + ${serializeForInlineScript(i18nT('map:components.MapPage.Map.nativeWebView.meterSuffix'))} + '</div>') : '';
            var m = L.circleMarker([lat, lng], {
              radius: 6, color: ROUTE_SURFACE, weight: 2, fillColor: (color || '#ff9f0a'), fillOpacity: 0.95
            });
            m.bindPopup('<div class="popup-text"><div class="popup-title">' + escapeHtml(title) + '</div>' + eleLine + '</div>', { maxWidth: 260 });
            m.addTo(layerGroup);
          }
        }

        // Overpass relation route с out geom → полилинии по way-сегментам.
        function renderOverpassRoutes(layerGroup, data) {
          layerGroup.clearLayers();
          var els = (data && Array.isArray(data.elements)) ? data.elements : [];
          for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (el.type !== 'way' || !Array.isArray(el.geometry)) continue;
            var pts = [];
            for (var j = 0; j < el.geometry.length; j++) {
              var g = el.geometry[j];
              if (g && isFinite(g.lat) && isFinite(g.lon)) pts.push([g.lat, g.lon]);
            }
            if (pts.length >= 2) {
              L.polyline(pts, { color: '#1f7a1f', weight: 3, opacity: 0.85 }).addTo(layerGroup);
            }
          }
        }

        // WFS GeoJSON (Польша: места палаток). Бьём по абсолютному upstream-URL.
        function wfsUrl(def, b) {
          var sep = def.url.indexOf('?') !== -1 ? '&' : '?';
          var bboxVal = (def.wfsBboxOrder === 'latlon')
            ? (b.south + ',' + b.west + ',' + b.north + ',' + b.east)
            : (b.west + ',' + b.south + ',' + b.east + ',' + b.north);
          var p = 'service=WFS&request=GetFeature&version=' + encodeURIComponent(def.wfsVersion) +
            '&typeNames=' + encodeURIComponent(def.wfsTypeName) +
            '&outputFormat=GEOJSON&srsName=' + encodeURIComponent(def.wfsSrs) +
            '&bbox=' + encodeURIComponent(bboxVal);
          return def.url + sep + p;
        }

        function renderWfsGeoJson(layerGroup, data) {
          layerGroup.clearLayers();
          if (!data || data.type !== 'FeatureCollection') return;
          L.geoJSON(data, {
            style: function() {
              return { color: 'rgb(31,122,31)', weight: 2, fillColor: 'rgb(52,199,89)', fillOpacity: 0.25, opacity: 0.9 };
            },
            onEachFeature: function(feature, layer) {
              var props = (feature && feature.properties) || {};
              var name = props.name || props.Name || props.NAZWA || props.nazwa || ${serializeForInlineScript(i18nT('map:components.MapPage.Map.nativeWebView.forestCamping'))};
              try { layer.bindPopup('<div class="popup-text"><div class="popup-title">' + escapeHtml(String(name)) + '</div></div>'); } catch (e) {}
            }
          }).addTo(layerGroup);
        }

        function buildOverlay(def) {
          if (def.kind === 'tile') {
            var tile = L.tileLayer(def.url, { opacity: def.opacity, maxZoom: def.maxZoom || 19, zIndex: def.zIndex });
            try { if (def.zIndex != null && typeof tile.setZIndex === 'function') tile.setZIndex(def.zIndex); } catch (e) {}
            return { layer: tile, controller: null };
          }
          var group = L.layerGroup();
          var controller = null;
          if (def.kind === 'osm-overpass-camping') {
            controller = makeBboxController(group, function(b) { return overpassUrl(overpassCampingQL(b)); },
              function(g, d) { renderOverpassPoints(g, d, '#34c759'); }, 650, { minZoom: def.minZoom, logId: def.id });
          } else if (def.kind === 'osm-overpass-poi') {
            controller = makeBboxController(group, function(b) { return overpassUrl(overpassPoiQL(b)); },
              function(g, d) { renderOverpassPoints(g, d, '#ff9f0a'); }, 650, { minZoom: def.minZoom, logId: def.id });
          } else if (def.kind === 'osm-overpass-routes') {
            controller = makeBboxController(group, function(b) { return overpassUrl(overpassRoutesQL(b)); },
              function(g, d) { renderOverpassRoutes(g, d); }, 700, { minZoom: def.minZoom, logId: def.id });
          } else if (def.kind === 'osm-overpass-features') {
            var filters = def.overpassFilters;
            var color = def.markerColor;
            controller = makeBboxController(group, function(b) { return overpassUrl(overpassFeaturesQL(b, filters)); },
              function(g, d) { renderOverpassFeatures(g, d, color); }, 700, { minZoom: def.minZoom, logId: def.id });
          } else if (def.kind === 'wfs-geojson') {
            controller = makeBboxController(group, function(b) { return wfsUrl(def, b); },
              function(g, d) { renderWfsGeoJson(g, d); }, 700, { minZoom: def.minZoom, logId: def.id });
          }
          return { layer: group, controller: controller };
        }

        // Контракт совпадает с web (useMapApi.setOverlayEnabled): тогл по id.
        window.__metravelSetOverlay = function(id, enabled) {
          try {
            var def = null;
            for (var i = 0; i < OVERLAY_DEFS.length; i++) { if (OVERLAY_DEFS[i].id === id) { def = OVERLAY_DEFS[i]; break; } }
            if (!def) return;
            overlayEnabled[id] = !!enabled;
            if (!overlayLayers[id]) {
              var built = buildOverlay(def);
              overlayLayers[id] = built.layer;
              overlayControllers[id] = built.controller;
            }
            var layer = overlayLayers[id];
            var ctrl = overlayControllers[id];
            if (enabled) {
              if (!map.hasLayer(layer)) layer.addTo(map);
              if (ctrl) ctrl.start();
            } else {
              if (ctrl) ctrl.stop();
              if (map.hasLayer(layer)) map.removeLayer(layer);
            }
          } catch (e) {}
        };

        // Сообщаем RN, что каркас готов и функция рендера определена.
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
        }
        setTimeout(function() { __metravelPostViewport('MAP_VIEWPORT'); }, 0);`,
  });
