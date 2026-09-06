import { DESIGN_COLORS, DESIGN_TOKENS } from '@/constants/designSystem';
import {
  getActiveOverlayLayers,
  getThemedBaseAttribution,
  getThemedBaseMaxZoom,
  type WebMapLayerDefinition,
} from '@/config/mapWebLayers';
import type { ThemedColors } from '@/hooks/useTheme';
import { getActiveLocaleDefinition, translate as i18nT } from '@/i18n';
import { serializeForInlineScript } from '@/utils/webViewBridge';
import {
  buildInvalidateSchedulerScript,
  buildLeafletWebViewHtml,
  ESCAPE_HTML_FN_SCRIPT,
} from '@/components/map-core/leafletWebViewHtml';
import {
  NATIVE_BASE_MIN_ZOOM_GLOBAL,
  NATIVE_BASE_MIN_ZOOM_SCRIPT,
  buildNativeTileBridgeScript,
} from './nativeTileBridgeScript';
import {
  buildBirdMarkerHtml,
  buildUserLocationHtml,
  USER_LOCATION_MARKER_COLOR,
  USER_LOCATION_MARKER_SIZE,
} from './mapMarkerStyles';
import { buildNativeWeatherTempLabelsScript } from './nativeWeatherTempLabelsScript';

const DEFAULT_LAT = 53.8828449;
const DEFAULT_LNG = 27.7273595;
const OVERPASS_ENDPOINT =
  process.env.EXPO_PUBLIC_OVERPASS_ENDPOINT || 'https://overpass-api.de/api/interpreter';

export const toNativeOverlayLayerDefinitions = (
  layers: readonly WebMapLayerDefinition[],
) =>
  layers.map((layer) => ({
    id: layer.id,
    kind: layer.kind,
    url: layer.url,
    attribution: layer.attribution,
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

const NATIVE_OVERLAY_LAYERS = toNativeOverlayLayerDefinitions(getActiveOverlayLayers());

// #1780 — цвет «вы здесь» задан самим маркером (см. mapMarkerStyles): матовый
// accent сливался с тайлами, а бренд-оранжевый — с POI-пинами. Accuracy-круг
// красится тем же цветом, чтобы точка и её погрешность читались как одно целое.
const USER_LOCATION_COLOR = USER_LOCATION_MARKER_COLOR;
const BIRD_MARKER_HTML = buildBirdMarkerHtml();
const USER_LOCATION_MARKER_HTML = buildUserLocationHtml();
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
        /* #1781 — точка маршрута рисует свой круг сама, дефолтная рамка
           .leaflet-div-icon её бы обвела белым квадратом. */
        .metravel-route-point { background: transparent; border: 0; }
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
        }
        .metravel-temp-label {
          background: transparent;
          border: 0;
        }
        @keyframes metravelUserPulse {
          0% { transform: scale(0.6); opacity: 0.5; }
          70% { opacity: 0; }
          100% { transform: scale(2.6); opacity: 0; }
        }`,
    bodyScript: `        const MAP_LANGUAGE = ${serializeForInlineScript(getActiveLocaleDefinition().geocoderLanguage)};
        // zoomControl: false — встроенные кнопки +/− Leaflet (верхний левый угол)
        // перекрывали номерной/стартовый маркер маршрута. Зум доступен через
        // плавающие нативные контролы (__metravelMapZoomIn/Out).
${NATIVE_BASE_MIN_ZOOM_SCRIPT}
        const map = L.map('map', {
          zoomControl: false,
          preferCanvas: true,
          fadeAnimation: false,
          zoomAnimation: false,
          markerZoomAnimation: false,
          minZoom: window.${NATIVE_BASE_MIN_ZOOM_GLOBAL}
        }).setView([${DEFAULT_LAT}, ${DEFAULT_LNG}], 10);
        map.__userCenter = [${DEFAULT_LAT}, ${DEFAULT_LNG}];
        // Текущий режим карты ('radius' | 'route'); обновляется при каждом рендере точек.
        // Every empty-map tap reaches RN so transient native chrome (notably the
        // selected-place card above Android WebView) can close. In route mode
        // the same event also adds the next route point in the controller.
        window.__metravelMapMode = 'radius';
        map.on('click', function(e) {
          try {
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
            if (arguments.length >= 2) {
              const lat = Number(arguments[0]);
              const lng = Number(arguments[1]);
              if (!window.__metravelRenderUserLocation ||
                  !window.__metravelRenderUserLocation(lat, lng)) return false;
            }
            const target = map.__realUserLocation;
            if (!target) return false;
            __metravelProgrammaticMoveUntil = Date.now() + 700;
            map.setView(target, Math.max(map.getZoom ? map.getZoom() : 10, 13));
            return true;
          } catch (e) {
            return false;
          }
        };

${buildNativeTileBridgeScript({
  attribution: getThemedBaseAttribution(),
  maxZoom: getThemedBaseMaxZoom(),
})}

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
        // Отдельный pane держит «вы здесь» выше POI/cluster markerPane (600), но
        // ниже tooltip/popup (650/700). Порядок добавления layerGroup сам по себе
        // pane не меняет: прежний circleMarker жил в overlayPane (400) и мог быть
        // полностью закрыт обычным маркером.
        const USER_LOCATION_PANE = 'metravel-user-location';
        const userLocationPane = map.createPane(USER_LOCATION_PANE);
        userLocationPane.style.zIndex = '625';
        // preferCanvas renders the accuracy circle into a viewport-sized canvas.
        // Disable DOM hit-testing for the whole visual-only pane so that the
        // canvas cannot block POI/cluster markers in the lower markerPane.
        userLocationPane.style.pointerEvents = 'none';

        // НЕ чистится в __metravelRenderPoints, поэтому GPS-маркер не мигает при
        // обновлении travel-маркеров и серверных кластеров.
        const userLayer = L.layerGroup().addTo(map);

        const USER_LOCATION_COLOR = ${serializeForInlineScript(USER_LOCATION_COLOR)};
        const userLocationIcon = L.divIcon({
          className: 'metravel-pin-marker metravel-pin-marker-user',
          html: ${serializeForInlineScript(USER_LOCATION_MARKER_HTML)},
          iconSize: [${USER_LOCATION_MARKER_SIZE}, ${USER_LOCATION_MARKER_SIZE}],
          iconAnchor: [${USER_LOCATION_MARKER_SIZE / 2}, ${USER_LOCATION_MARKER_SIZE / 2}],
          popupAnchor: [0, ${-USER_LOCATION_MARKER_SIZE / 2 - 1}]
        });

        // Рисует тот же заметный GPS-маркер, что mobile web, и accuracy-круг.
        // map.__realUserLocation коммитится только после успешного добавления обоих
        // слоёв: камера не должна центрироваться на точке, которой визуально нет.
        window.__metravelRenderUserLocation = function(lat, lng) {
          try {
            lat = Number(lat);
            lng = Number(lng);
            if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
              userLayer.clearLayers();
              map.__realUserLocation = null;
              return false;
            }
            const accuracy = L.circle([lat, lng], {
              pane: USER_LOCATION_PANE,
              radius: 60,
              color: USER_LOCATION_COLOR,
              weight: 1,
              opacity: 0.4,
              fillColor: USER_LOCATION_COLOR,
              fillOpacity: 0.12,
              interactive: false
            });
            const dot = L.marker([lat, lng], {
              pane: USER_LOCATION_PANE,
              icon: userLocationIcon,
              // The pane is above POIs, so an interactive icon would steal taps
              // from a coincident marker/cluster. Mobile web uses the same
              // non-interactive location marker contract.
              interactive: false,
              keyboard: false,
              zIndexOffset: 1000
            });
            dot.bindPopup(${serializeForInlineScript(i18nT('map:components.MapPage.Map.nativeWebView.currentLocation'))});
            userLayer.clearLayers();
            accuracy.addTo(userLayer);
            dot.addTo(userLayer);
            map.__realUserLocation = [lat, lng];
            return true;
          } catch (e) {
            try { userLayer.clearLayers(); } catch (clearError) {}
            map.__realUserLocation = null;
            return false;
          }
        };

        window.__metravelClearUserLocation = function() {
          map.__realUserLocation = null;
          try { userLayer.clearLayers(); } catch (e) {}
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
        const ROUTE_WARNING = ${serializeForInlineScript(themeColors.warningDark || themeColors.warning || DESIGN_TOKENS.colors.warning)};
        const ROUTE_SURFACE = ${serializeForInlineScript(themeColors.surface)};
        const ROUTE_START = ${serializeForInlineScript(themeColors.success || themeColors.primary)};
        // #1496 — цвет оригинального (неупрощённого) трека из загруженного файла.
        const ORIGINAL_TRACK_COLOR = ${serializeForInlineScript(themeColors.accentDark || themeColors.accent || DESIGN_COLORS.travelPoint)};

        // #1781 — маркер точки маршрута: тот же круг, что раньше рисовал
        // L.circleMarker, но как divIcon, потому что перетаскивать Leaflet умеет
        // только L.Marker. box-sizing:border-box повторяет центрированную обводку.
        const ROUTE_POINT_WEIGHT = 3;
        function makeRoutePointIcon(radius, fillColor) {
          var size = radius * 2 + ROUTE_POINT_WEIGHT;
          var half = size / 2;
          var style = 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;'
            + 'box-sizing:border-box;background:' + fillColor + ';'
            + 'border:' + ROUTE_POINT_WEIGHT + 'px solid ' + ROUTE_SURFACE + ';';
          return L.divIcon({
            className: 'metravel-route-point',
            html: '<div aria-hidden="true" style="' + style + '"></div>',
            iconSize: [size, size],
            iconAnchor: [half, half]
          });
        }

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
            const routeApproximate = data.routeApproximate === true;
            const originalTrack = Array.isArray(data.originalTrack) ? data.originalTrack : [];
            const routeMode = data.mode || 'radius';
            const usesServerClusters = data.usesServerClusters === true;
            const pointsOnly = data.pointsOnly === true;
            // #1781 — точки маршрута планировщика тянутся и открывают действия
            // только у владельца поездки. У гостя маркеры остаются как были:
            // не перетаскиваются и не перехватывают тап.
            const routePointsInteractive = data.routePointsInteractive === true;
            window.__metravelMapMode = routeMode;
            if (data.center && isFinite(data.center.lat) && isFinite(data.center.lng)) {
              map.__userCenter = [data.center.lat, data.center.lng];
            }

            clustersLayer.clearLayers();
            routeLayer.clearLayers();
            const bounds = L.latLngBounds();

            // #1773 — RN шлёт renderPoints и при изменениях, которые маркеров не
            // касаются (центр, маршрут, вьюпорт): на «Моих точках» это давало ~11
            // полных перестроек 869 маркеров за первые секунды. Если набор точек
            // тот же — маркеры не трогаем, незавершённая порционная отрисовка
            // предыдущего вызова продолжается.
            const pointsJson = JSON.stringify(points);
            const samePoints = window.__metravelLastPointsJson === pointsJson;
            window.__metravelLastPointsJson = pointsJson;
            if (!samePoints) {
              markersLayer.clearLayers();
              // Поколение рендера: маркеры добавляются порциями через setTimeout,
              // поэтому хвост предыдущего набора обязан остановиться — иначе он
              // дорисует старые маркеры уже ПОСЛЕ clearLayers().
              window.__metravelRenderGeneration = (window.__metravelRenderGeneration || 0) + 1;
            }
            const renderGeneration = window.__metravelRenderGeneration;

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

            // points приходит уже сгруппированным по местам (#1573): один элемент —
            // одно физическое место, один Leaflet-маркер, один hit target. RN шлёт
            // сюда узкую проекцию (placeKey/id/coord/categoryName/sourceCount), а не
            // полные записи: массив источников места здесь не нужен и не сериализуется.
            const addPointMarker = function(point, pointIndex) {
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
              // Основной идентификатор выбора — placeKey физического места (#1573):
              // он переживает переупорядочивание и обновление dataset между рендером
              // и тапом. id/coord/индекс остаются legacy-fallback переходного периода.
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
                      index: pointIndex,
                      id: point.id == null ? null : String(point.id),
                      coord: point.coord == null ? null : String(point.coord)
                    }));
                  }
                } catch (err) {}
              });
            };

            // #1773 — границы считаем отдельным числовым проходом (без DOM), чтобы
            // fitBounds ниже работал сразу, ещё до отрисовки самих маркеров.
            points.forEach(function(point) {
              if (!point || !point.coord) return;
              const parts = String(point.coord).split(',').map(Number);
              if (!isFinite(parts[0]) || !isFinite(parts[1])) return;
              bounds.extend([parts[0], parts[1]]);
            });

            // #1773 — «Мои точки» на iPhone открывались пустым серым холстом: 869
            // маркеров добавлялись в DOM одним синхронным проходом и держали JS
            // WebView ~10 с, а тайлы приезжают в тот же поток инъекцией
            // __metravelSetTile из RN и просто ждали своей очереди. Рисуем порциями
            // и отдаём поток между ними: подложка появляется сразу, маркеры
            // дорисовываются следом. Итоговый набор маркеров не меняется.
            const MARKER_CHUNK = 100;
            const scheduleChunk = function(fn) {
              if (typeof window.requestAnimationFrame === 'function') {
                // rAF отдаёт кадр между порциями — тайлы успевают отрисоваться.
                window.requestAnimationFrame(fn);
                return;
              }
              setTimeout(fn, 0);
            };
            const renderMarkerChunk = function(start) {
              if (window.__metravelRenderGeneration !== renderGeneration) return;
              const end = Math.min(start + MARKER_CHUNK, points.length);
              for (var i = start; i < end; i += 1) {
                addPointMarker(points[i], i);
              }
              if (end < points.length) {
                scheduleChunk(function() { renderMarkerChunk(end); });
              }
            };
            if (!samePoints) scheduleChunk(function() { renderMarkerChunk(0); });

            if (routeMode === 'route' && routePoints.length >= 1) {
              const routeBounds = L.latLngBounds();
              // #1781 — защёлка кадра держится, пока на карте остаётся хоть одна
              // из точек, ради которых её поставили. Оптовая замена маршрута
              // (шаблон, импорт трека) не оставляет ни одной, и новый маршрут
              // обязан попасть в кадр: иначе он остаётся за пределами вида до
              // пересоздания карты. Ключ точки — её координаты (id сюда не
              // доезжает), огрублённые до шести знаков: RouteBuilder округляет
              // координаты дропа тем же шагом, и сырой ключ не совпал бы с
              // сохранённым никогда. Индексация — по ПОЛНОМУ набору, тому же,
              // по которому нумеруются маркеры: фильтрация сдвинула бы слоты.
              const routePointKey = function(lat, lng) {
                return lat.toFixed(6) + ',' + lng.toFixed(6);
              };
              const routePointKeys = routePoints.map(function(point) {
                if (!Array.isArray(point) || !isFinite(point[0]) || !isFinite(point[1])) return '';
                return routePointKey(point[0], point[1]);
              });
              if (map.__metravelRouteFitLocked) {
                const lockedKeys = map.__metravelRouteFitLockedKeys || [];
                const survives = routePointKeys.some(function(key) {
                  return key !== '' && lockedKeys.indexOf(key) !== -1;
                });
                if (!survives) {
                  map.__metravelRouteFitLocked = false;
                  map.__metravelRouteFitLockedKeys = null;
                }
              }
              if (routeLine.length >= 2) {
                const routePolyline = L.polyline(routeLine, {
                  color: routeApproximate ? ROUTE_WARNING : ROUTE_COLOR,
                  weight: routeApproximate ? 4 : 5,
                  opacity: routeApproximate ? 0.58 : 0.9,
                  dashArray: routeApproximate ? '8 8' : null,
                  lineCap: 'round',
                  lineJoin: 'round'
                }).addTo(routeLayer);
                routeLine.forEach(function(point) {
                  if (Array.isArray(point) && isFinite(point[0]) && isFinite(point[1])) {
                    routeBounds.extend(point);
                  }
                });
                try {
                  // #1781 — после ручного перетаскивания маркера кадр не двигаем:
                  // подгонка существует для формы маршрута, а не для того, чтобы
                  // отменять наведённый пользователем вид.
                  if (!map.__metravelRouteFitLocked) {
                    map.fitBounds(routePolyline.getBounds(), { padding: [70, 70] });
                  }
                } catch (e) {}
              }
              // Оригинальный трек — отдельная полилиния поверх линии маршрута:
              // упрощённые точки и построенная по ним линия остаются на карте.
              if (originalTrack.length >= 2) {
                L.polyline(originalTrack, {
                  color: ORIGINAL_TRACK_COLOR,
                  weight: 3,
                  opacity: 0.95,
                  lineCap: 'round',
                  lineJoin: 'round'
                }).addTo(routeLayer);
                originalTrack.forEach(function(point) {
                  if (Array.isArray(point) && isFinite(point[0]) && isFinite(point[1])) {
                    routeBounds.extend(point);
                  }
                });
                // Оригинал может выходить за пределы упрощённой линии, по которой
                // карта уже подогналась выше, — досаживаем кадр на общие границы.
                try {
                  if (routeBounds.isValid() && !map.__metravelRouteFitLocked) {
                    map.fitBounds(routeBounds, { padding: [70, 70] });
                  }
                } catch (e) {}
              }
              routePoints.forEach(function(point, index) {
                if (!Array.isArray(point) || !isFinite(point[0]) || !isFinite(point[1])) return;
                const isStart = index === 0;
                const isEnd = routePoints.length > 1 && index === routePoints.length - 1;
                // #1781 — L.Draggable есть только у L.Marker, у circleMarker его нет
                // вовсе. Поэтому точка маршрута рисуется divIcon той же геометрии:
                // диаметр = 2*radius + weight, заливка и рамка — прежние цвета.
                const marker = L.marker(point, {
                  icon: makeRoutePointIcon(
                    isStart || isEnd ? 8 : 6,
                    isStart ? ROUTE_START : ROUTE_COLOR
                  ),
                  draggable: routePointsInteractive,
                  interactive: routePointsInteractive,
                  keyboard: false
                }).addTo(routeLayer);
                if (routePointsInteractive) {
                  marker.on('dragstart', function() {
                    // Кадр перестаёт подгоняться под маршрут: дальше видом
                    // управляет пользователь, а не форма линии.
                    map.__metravelRouteFitLocked = true;
                    map.__metravelRouteFitLockedKeys = routePointKeys;
                  });
                  marker.on('dragend', function(event) {
                    try {
                      const position = event && event.target && event.target.getLatLng
                        ? event.target.getLatLng()
                        : null;
                      if (!position || !isFinite(position.lat) || !isFinite(position.lng)) return;
                      // Ключи защёлки запоминаются уже с местом дропа: иначе
                      // перетаскивание единственной точки маршрута само же и
                      // сняло бы защёлку следующим рендером.
                      map.__metravelRouteFitLockedKeys = routePointKeys.map(function(key, keyIndex) {
                        return keyIndex === index ? routePointKey(position.lat, position.lng) : key;
                      });
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
              if (routeLine.length < 2 && routeBounds.isValid() && !map.__metravelRouteFitLocked) {
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
        var overlayAttributionActive = {}; // id -> bool

        function setOverlayAttribution(def, enabled) {
          try {
            if (!def || !def.attribution || !map.attributionControl) return;
            if (enabled && !overlayAttributionActive[def.id]) {
              map.attributionControl.addAttribution(def.attribution);
              overlayAttributionActive[def.id] = true;
            } else if (!enabled && overlayAttributionActive[def.id]) {
              map.attributionControl.removeAttribution(def.attribution);
              overlayAttributionActive[def.id] = false;
            }
          } catch (e) {}
        }

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

${buildNativeWeatherTempLabelsScript()}

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
          } else if (def.kind === 'weather-temp-labels') {
            controller = makeWeatherTempLabelsController(group, def);
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
              setOverlayAttribution(def, true);
              if (ctrl) ctrl.start();
            } else {
              if (ctrl) ctrl.stop();
              if (map.hasLayer(layer)) map.removeLayer(layer);
              setOverlayAttribution(def, false);
            }
          } catch (e) {}
        };

        // Сообщаем RN, что каркас готов и функция рендера определена.
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
        }
        setTimeout(function() { __metravelPostViewport('MAP_VIEWPORT'); }, 0);`,
  });
