import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { useThemedColors } from '@/hooks/useTheme';
import { getSafeExternalUrl } from '@/utils/safeExternalUrl';
import { DESIGN_COLORS } from '@/constants/designSystem';
import { MODERN_MATTE_PALETTE } from '@/constants/modernMattePalette';
import { openExternalUrl } from '@/utils/externalLinks';
import { resolveInternalTravelRoute } from '@/utils/relatedTravel';
import { getActiveOverlayLayers } from '@/config/mapWebLayers';

// Overpass endpoint mirrors utils/overpass/fetchOverpass.ts. Inlined as a plain
// string because the overlay engine runs INSIDE the WebView and has no access to
// the RN module graph (those overlays живут только в web Leaflet через useMapApi).
const OVERPASS_ENDPOINT =
  process.env.EXPO_PUBLIC_OVERPASS_ENDPOINT || 'https://overpass-api.de/api/interpreter';

// Сериализуемая форма слоёв-оверлеев для WebView. id совпадает с активными слоями
// конфигурации, поэтому тот же mapUiApi.setOverlayEnabled(id, enabled)
// из useMapScreenController рисует слой и на native (web — через useMapApi,
// native — через инъекцию в Leaflet здесь). wfs-geojson на native бьёт по
// абсолютному upstream-URL: relative-прокси/static-файл web-хоста в WebView
// недоступны. getActiveOverlayLayers уже отфильтровал слои по requiresEnv и
// подставил OWM-ключ в url, поэтому слой без ключа сюда не попадёт.
const NATIVE_OVERLAY_LAYERS = getActiveOverlayLayers().map((layer) => ({
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

type Point = {
  id?: number | string;
  lat?: string;
  lng?: string;
  coord: string;
  address: string;
  travelImageThumbUrl: string;
  categoryName: string;
  articleUrl?: string;
  urlTravel?: string;
};

type PaginatedResponse = {
  current_page: number;
  data: Point[];
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number;
  total: number;
};

type TravelPropsType = {
  travelAddress?: PaginatedResponse;
  /** Плоская форма, которую передают quests-экраны: { data: Point[] } */
  data?: Point[];
};

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface TravelProps {
  travel: TravelPropsType;
  coordinates: Coordinates | null;
  /**
   * Реальная геолокация пользователя для маркера «вы здесь». null когда гео
   * недоступна или это fallback-Минск — тогда синяя точка НЕ рисуется.
   * Отделено от coordinates (которые могут быть дефолтным центром).
   */
  userLocation?: Coordinates | null;
  routePoints?: [number, number][];
  fullRouteCoords?: [number, number][];
  mode?: 'radius' | 'route';
  onMapClick?: (lng: number, lat: number) => void;
  onMapUiApiReady?: (api: {
    zoomIn: () => void;
    zoomOut: () => void;
    centerOnUser: () => void;
    setOverlayEnabled: (id: string, enabled: boolean) => void;
  } | null) => void;
}

const DEFAULT_LAT = 53.8828449;
const DEFAULT_LNG = 27.7273595;

const withAlpha = (color: string, alpha: number) => {
  if (!color || color.startsWith('rgba') || color.startsWith('rgb')) {
    return color;
  }

  if (color.startsWith('#')) {
    const raw = color.replace('#', '');
    const hex = raw.length === 3 ? raw.split('').map((ch) => ch + ch).join('') : raw;
    const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0');
    return `#${hex}${alphaHex}`;
  }

  return color;
};

const normalizeRoutePoint = (point: unknown): [number, number] | null => {
  if (!Array.isArray(point) || point.length < 2) return null;
  const lng = Number(point[0]);
  const lat = Number(point[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
  return [lat, lng];
};

// Данные шлём в WebView через injectJavaScript, а не через перезагрузку source.html:
// на Android смена source.html не всегда триггерит reload, и инлайн JSON может
// оборвать <script> неэкранированными символами. U+2028/U+2029 — валидны в JSON,
// но являются терминаторами строки в JS, поэтому их экранируем для inject.
const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), 'g');
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), 'g');
const serializeForInjection = (value: unknown): string =>
  JSON.stringify(value).replace(LINE_SEPARATOR, '\\u2028').replace(PARAGRAPH_SEPARATOR, '\\u2029');

const USER_LOCATION_COLOR = MODERN_MATTE_PALETTE.accent;

const Map: React.FC<TravelProps> = ({
  travel,
  coordinates: propCoordinates,
  userLocation = null,
  routePoints = [],
  fullRouteCoords = [],
  mode = 'radius',
  onMapClick,
  onMapUiApiReady,
}) => {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const isReadyRef = useRef(false);
  // MapPanel передаёт { travelAddress: { data } }, quests-экраны — { data } напрямую (F-21).
  const travelAddress = useMemo(
    () => travel?.travelAddress?.data ?? travel?.data ?? [],
    [travel?.travelAddress?.data, travel?.data],
  );
  const [localCoordinates, setLocalCoordinates] = useState<Coordinates | null>(propCoordinates);
  const [isLoading, setIsLoading] = useState(true);
  const themeColors = useThemedColors();
  const { getSiteBaseUrl } = require('@/utils/seo');

  useEffect(() => {
    if (!localCoordinates) {
      setLocalCoordinates({ latitude: DEFAULT_LAT, longitude: DEFAULT_LNG });
    }
  }, [localCoordinates]);

  useEffect(() => {
    if (!propCoordinates) return;
    if (!Number.isFinite(propCoordinates.latitude) || !Number.isFinite(propCoordinates.longitude)) return;
    setLocalCoordinates((current) =>
      current?.latitude === propCoordinates.latitude && current?.longitude === propCoordinates.longitude
        ? current
        : propCoordinates,
    );
  }, [propCoordinates]);

  const centerLat = localCoordinates?.latitude ?? DEFAULT_LAT;
  const centerLng = localCoordinates?.longitude ?? DEFAULT_LNG;
  const loaderOverlay = useMemo(
    () => withAlpha(themeColors.surface, 0.8),
    [themeColors.surface]
  );
  const markerColor = DESIGN_COLORS.mapPin;
  const markerShadowColor = themeColors.shadows.medium.shadowColor || themeColors.text;
  const routeLatLngs = useMemo(
    () => (fullRouteCoords.length >= 2 ? fullRouteCoords : routePoints)
      .map(normalizeRoutePoint)
      .filter((point): point is [number, number] => Boolean(point)),
    [fullRouteCoords, routePoints],
  );

  const injectMapCommand = useCallback((script: string) => {
    try {
      webViewRef.current?.injectJavaScript?.(`${script}; true;`);
    } catch {
      // noop
    }
  }, []);

  // Состояние включённых оверлеев. Храним в ref, чтобы переприменить их после
  // reload WebView (handleReady) — иначе при пересборке HTML слой пропал бы.
  const enabledOverlaysRef = useRef<Record<string, boolean>>({});

  const setOverlayEnabled = useCallback(
    (id: string, enabled: boolean) => {
      enabledOverlaysRef.current[id] = enabled;
      injectMapCommand(
        `window.__metravelSetOverlay && window.__metravelSetOverlay(${JSON.stringify(id)}, ${enabled ? 'true' : 'false'})`,
      );
    },
    [injectMapCommand],
  );

  useEffect(() => {
    if (!onMapUiApiReady) return undefined;

    onMapUiApiReady({
      zoomIn: () => injectMapCommand('window.__metravelMapZoomIn && window.__metravelMapZoomIn()'),
      zoomOut: () => injectMapCommand('window.__metravelMapZoomOut && window.__metravelMapZoomOut()'),
      centerOnUser: () => injectMapCommand('window.__metravelMapCenterOnUser && window.__metravelMapCenterOnUser()'),
      setOverlayEnabled,
    });

    return () => onMapUiApiReady(null);
  }, [injectMapCommand, onMapUiApiReady, setOverlayEnabled]);

  // Полезная нагрузка для WebView: точки/маршрут/режим/центр. Меняется по приходу
  // данных, но HTML при этом НЕ пересобирается — маркеры дорисовываются injectJavaScript.
  const mapPayload = useMemo(
    () => ({
      points: travelAddress,
      routePoints: routeLatLngs,
      mode,
      center: { lat: centerLat, lng: centerLng },
    }),
    [travelAddress, routeLatLngs, mode, centerLat, centerLng],
  );

  const pushPayload = useCallback(() => {
    if (!isReadyRef.current) return;
    injectMapCommand(
      `window.__metravelRenderPoints && window.__metravelRenderPoints(${serializeForInjection(mapPayload)})`,
    );
  }, [injectMapCommand, mapPayload]);

  // Реальная гео пользователя для маркера «вы здесь». null когда координаты
  // невалидны — синяя точка тогда не рисуется (fallback-Минск отсекается в
  // MapPanel до прокидывания пропа).
  const userLat = userLocation?.latitude;
  const userLng = userLocation?.longitude;
  const userLocationLatLng = useMemo(() => {
    if (userLat == null || userLng == null) return null;
    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) return null;
    if (Math.abs(userLat) > 90 || Math.abs(userLng) > 180) return null;
    return { lat: userLat, lng: userLng };
  }, [userLat, userLng]);

  const pushUserLocation = useCallback(() => {
    if (!isReadyRef.current) return;
    if (userLocationLatLng) {
      injectMapCommand(
        `window.__metravelRenderUserLocation && window.__metravelRenderUserLocation(${userLocationLatLng.lat}, ${userLocationLatLng.lng})`,
      );
    } else {
      injectMapCommand('window.__metravelClearUserLocation && window.__metravelClearUserLocation()');
    }
  }, [injectMapCommand, userLocationLatLng]);

  // Ref на последние push-функции — чтобы обработчики onLoadEnd/onMessage слали
  // актуальные данные без устаревшего замыкания.
  const pushPayloadRef = useRef(pushPayload);
  pushPayloadRef.current = pushPayload;
  const pushUserLocationRef = useRef(pushUserLocation);
  pushUserLocationRef.current = pushUserLocation;

  // Перерисовать маркеры при любом изменении данных (если WebView уже готов).
  useEffect(() => {
    pushPayload();
  }, [pushPayload]);

  // Перерисовать/очистить маркер пользователя при изменении гео.
  useEffect(() => {
    pushUserLocation();
  }, [pushUserLocation]);

  const handleReady = useCallback(() => {
    isReadyRef.current = true;
    pushPayloadRef.current();
    pushUserLocationRef.current();
    // Переприменяем включённые оверлеи после (ре)загрузки WebView.
    const enabled = enabledOverlaysRef.current;
    Object.keys(enabled).forEach((id) => {
      if (!enabled[id]) return;
      injectMapCommand(
        `window.__metravelSetOverlay && window.__metravelSetOverlay(${JSON.stringify(id)}, true)`,
      );
    });
  }, [injectMapCommand]);

  // Статичный HTML-каркас: карта + функция window.__metravelRenderPoints.
  // Мемоизирован по теме — стабилен между обновлениями данных, поэтому WebView
  // не перезагружается при каждом приходе точек.
  const htmlContent = useMemo(
    () => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; }
        #map { width: 100%; height: 100%; }
        .leaflet-popup-content-wrapper { background-color: ${themeColors.surface}; border-radius: 8px; padding: 0; }
        .leaflet-popup-content { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; }
        .popup-image {
          width: 200px;
          height: 150px;
          object-fit: cover;
          border-radius: 8px 8px 0 0;
          display: block;
        }
        .popup-image-link {
          display: block;
          text-decoration: none;
        }
        .popup-text { padding: 12px; font-size: 13px; line-height: 1.45; }
        .popup-title {
          font-weight: 700;
          color: ${themeColors.text};
          font-size: 14px;
          line-height: 1.35;
          margin-bottom: 8px;
        }
        .popup-chip {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          background: ${withAlpha(themeColors.primary, 0.12)};
          color: ${themeColors.primary};
          font-size: 11px;
          font-weight: 600;
          line-height: 1.2;
          margin-bottom: 10px;
        }
        .popup-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .popup-action {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0 12px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .popup-action-primary {
          background: ${themeColors.primary};
          color: ${themeColors.textOnDark};
        }
        .popup-action-secondary {
          background: ${withAlpha(themeColors.primary, 0.12)};
          color: ${themeColors.primary};
        }
        .metravel-marker { background: transparent; border: 0; }
        .metravel-marker-pin {
          width: 32px;
          height: 48px;
          position: relative;
          transform: translateY(-2px);
          filter: drop-shadow(0 6px 8px ${markerShadowColor});
        }
        .metravel-marker-pin::before {
          content: "";
          position: absolute;
          left: 4px;
          top: 0;
          width: 24px;
          height: 24px;
          border-radius: 999px;
          background: ${markerColor};
          box-shadow: inset 0 0 0 5px ${themeColors.textOnDark};
        }
        .metravel-marker-pin::after {
          content: "";
          position: absolute;
          left: 10px;
          top: 20px;
          width: 12px;
          height: 18px;
          background: ${markerColor};
          clip-path: polygon(50% 100%, 0 0, 100% 0);
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        // zoomControl: false — встроенные кнопки +/− Leaflet (верхний левый угол)
        // перекрывали номерной/стартовый маркер маршрута. Зум доступен через
        // плавающие нативные контролы (__metravelMapZoomIn/Out).
        const map = L.map('map', { zoomControl: false }).setView([${DEFAULT_LAT}, ${DEFAULT_LNG}], 10);
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

        window.__metravelMapZoomIn = function() {
          try { map.zoomIn(); } catch (e) {}
        };
        window.__metravelMapZoomOut = function() {
          try { map.zoomOut(); } catch (e) {}
        };
        // Центрируем на реальной точке пользователя, если она есть
        // (__metravelRenderUserLocation её выставляет), иначе на дефолтном центре.
        map.__realUserLocation = null;
        window.__metravelMapCenterOnUser = function() {
          try {
            const target = map.__realUserLocation || map.__userCenter;
            map.setView(target, Math.max(map.getZoom ? map.getZoom() : 10, 13));
          } catch (e) {}
        };

        // OpenStreetMap (бесплатно!)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19
        }).addTo(map);

        const markersLayer = L.layerGroup().addTo(map);
        const routeLayer = L.layerGroup().addTo(map);
        // Отдельный слой для маркера «вы здесь». НЕ чистится в __metravelRenderPoints
        // (где clearLayers зовётся только для markersLayer/routeLayer), поэтому синяя
        // точка не мигает при ре-рендере travel-маркеров. Добавлен последним —
        // лежит поверх travel-маркеров.
        const userLayer = L.layerGroup().addTo(map);

        const USER_LOCATION_COLOR = ${JSON.stringify(USER_LOCATION_COLOR)};
        const USER_LOCATION_RING = ${JSON.stringify(themeColors.textOnDark)};

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
            dot.bindPopup('Вы здесь');
            try { dot.bringToFront(); } catch (e) {}
          } catch (e) {}
        };

        window.__metravelClearUserLocation = function() {
          try { userLayer.clearLayers(); map.__realUserLocation = null; } catch (e) {}
        };

        // Inline HTML marker works reliably in Android WebView, where SVG data-URI
        // marker images can render as an invisible icon.
        const markerIcon = L.divIcon({
          className: 'metravel-marker',
          html: '<div class="metravel-marker-pin" aria-hidden="true"></div>',
          iconSize: [32, 48],
          iconAnchor: [16, 48],
          popupAnchor: [0, -48]
        });

        function sendOpenUrl(rawUrl) {
          try {
            if (!rawUrl) return;
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'OPEN_URL', url: rawUrl }));
            }
          } catch {
            // noop
          }
        }

        const ROUTE_COLOR = ${JSON.stringify(DESIGN_COLORS.routeLine)};
        const ROUTE_SURFACE = ${JSON.stringify(themeColors.surface)};
        const ROUTE_START = ${JSON.stringify(themeColors.success || themeColors.primary)};

        // Экранируем значения точек перед вставкой в HTML popup: поля приходят с бэка
        // и могут содержать <, >, ", ' и & — без эскейпа это XSS в WebView (#113).
        function escapeHtml(value) {
          return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }

        window.__metravelRenderPoints = function(payload) {
          try {
            const data = payload || {};
            const points = Array.isArray(data.points) ? data.points : [];
            const routePoints = Array.isArray(data.routePoints) ? data.routePoints : [];
            const routeMode = data.mode || 'radius';
            window.__metravelMapMode = routeMode;
            if (data.center && isFinite(data.center.lat) && isFinite(data.center.lng)) {
              map.__userCenter = [data.center.lat, data.center.lng];
            }

            markersLayer.clearLayers();
            routeLayer.clearLayers();
            const bounds = L.latLngBounds();

            points.forEach(function(point) {
              if (!point || !point.coord) return;
              const parts = String(point.coord).split(',').map(Number);
              const lat = parts[0];
              const lng = parts[1];
              if (!isFinite(lat) || !isFinite(lng)) return;

              let popupContent = '';
              if (point.travelImageThumbUrl) {
                const link = (point.articleUrl || point.urlTravel || '');
                popupContent += '<a href="#" class="popup-image-link" data-open-url="' + escapeHtml(link) + '">' +
                  '<img src="' + escapeHtml(point.travelImageThumbUrl) + '" class="popup-image" alt="' + escapeHtml(point.address || 'Image') + '" />' +
                '</a>';
              }

              const travelLink = String(point.urlTravel || point.articleUrl || '').trim();
              const directionsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng;

              popupContent += '<div class="popup-text">';
              popupContent += '<div class="popup-title">' + escapeHtml(point.address || 'Место на карте') + '</div>';
              if (point.categoryName) {
                popupContent += '<span class="popup-chip">' + escapeHtml(point.categoryName) + '</span>';
              }
              popupContent += '<div class="popup-actions">';
              if (travelLink) {
                popupContent += '<a href="#" class="popup-action popup-action-primary" data-open-url="' + escapeHtml(travelLink) + '">Подробнее</a>';
              }
              popupContent += '<a href="#" class="popup-action popup-action-secondary" data-open-url="' + escapeHtml(directionsUrl) + '">Маршрут</a>';
              popupContent += '</div>';
              popupContent += '</div>';

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
              // bindPopup сам открывает popup по тапу на маркер; отдельный click→OPEN_URL
              // уводил на travel сразу и popup-карточка никогда не показывалась (#…).
              // Навигация на travel идёт только по кнопке «Подробнее» внутри popup.
              marker.bindPopup(popupContent, { maxWidth: 200 });

              marker.on('popupopen', function(e) {
                try {
                  const popupEl = e && e.popup ? e.popup.getElement() : null;
                  if (!popupEl) return;
                  const linkEls = popupEl.querySelectorAll('[data-open-url]');
                  for (let i = 0; i < linkEls.length; i++) {
                    (function(linkEl) {
                      linkEl.addEventListener('click', function(ev) {
                        try {
                          ev.preventDefault();
                          const url = (linkEl.getAttribute('data-open-url') || '').trim();
                          if (!url) return;
                          sendOpenUrl(url);
                        } catch {
                          // noop
                        }
                      });
                    })(linkEls[i]);
                  }
                } catch {
                  // noop
                }
              });

              bounds.extend([lat, lng]);
            });

            if (routeMode === 'route' && routePoints.length >= 2) {
              const routeLine = L.polyline(routePoints, {
                color: ROUTE_COLOR,
                weight: 5,
                opacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(routeLayer);
              const start = routePoints[0];
              const end = routePoints[routePoints.length - 1];
              L.circleMarker(start, {
                radius: 8,
                color: ROUTE_SURFACE,
                weight: 3,
                fillColor: ROUTE_START,
                fillOpacity: 1
              }).addTo(routeLayer);
              L.circleMarker(end, {
                radius: 8,
                color: ROUTE_SURFACE,
                weight: 3,
                fillColor: ROUTE_COLOR,
                fillOpacity: 1
              }).addTo(routeLayer);
              bounds.extend(start);
              bounds.extend(end);
              try {
                map.fitBounds(routeLine.getBounds(), { padding: [70, 70] });
              } catch (e) {}
            } else if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [50, 50] });
            } else if (map.__userCenter) {
              map.setView(map.__userCenter, map.getZoom ? map.getZoom() : 10);
            }
          } catch (e) {}
        };

        // ───────────────────────── Оверлеи (web-parity) ─────────────────────────
        // На web эти слои рисует useMapApi (Overpass/WFS/tile). На native повторяем
        // тот же контракт mapUiApi.setOverlayEnabled(id, enabled) — но рендерим
        // внутри WebView. Overpass/WFS — bbox-driven с дебаунсом по moveend.
        var OVERLAY_DEFS = ${serializeForInjection(NATIVE_OVERLAY_LAYERS)};
        var OVERPASS_ENDPOINT = ${JSON.stringify(OVERPASS_ENDPOINT)};
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
            var title = tags.name || tags['name:ru'] || tags.tourism || tags.historic || tags.amenity || 'Точка OSM';
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
            var title = tags['name:ru'] || tags.name || tags['name:en'] || tags.tourism || tags.natural || tags.historic || tags.amenity || tags.railway || 'Точка OSM';
            var eleNum = tags.ele != null ? Number(tags.ele) : NaN;
            var eleLine = isFinite(eleNum) ? ('<div style="margin-top:4px;font-size:12px;color:#888">Высота: ' + Math.round(eleNum) + ' м</div>') : '';
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
              var name = props.name || props.Name || props.NAZWA || props.nazwa || 'Zanocuj w lesie';
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
      </script>
    </body>
    </html>
  `,
    [themeColors, markerColor, markerShadowColor],
  );

  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface }]}>
      {isLoading && (
        <View style={[styles.loader, { backgroundColor: loaderOverlay }]}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      )}
      <WebView
        ref={webViewRef}
        // baseUrl даёт WebView реальный https-origin. Без него source={{html}}
        // грузится как about:blank c origin 'null', и браузерный CORS-слой режет
        // ВСЕ fetch к Overpass/WFS (ночёвки, POI, маршруты-сообщества, польские
        // палатки): Overpass отдаёт ACAO '*' и WFS отражает Origin — но только при
        // непустом Origin. Тайлы (Waymarked, OSM) грузятся как <img> и CORS не
        // затрагивает, поэтому маршруты-треки рисовались и без baseUrl.
        source={{ html: htmlContent, baseUrl: 'https://metravel.by/' }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        onLoadEnd={() => {
          setIsLoading(false);
          handleReady();
        }}
        onMessage={async (event) => {
          const raw = String(event?.nativeEvent?.data ?? '');
          if (!raw) return;
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.type === 'READY') {
              handleReady();
              return;
            }
            if (parsed?.type === 'MAP_CLICK') {
              const lat = Number(parsed?.lat);
              const lng = Number(parsed?.lng);
              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                onMapClick?.(lng, lat);
              }
              return;
            }
            if (parsed?.type !== 'OPEN_URL') return;
            const safeUrl = getSafeExternalUrl(parsed?.url, { allowRelative: true, baseUrl: getSiteBaseUrl() });
            if (!safeUrl) return;
            // Travel marker links arrive as absolute URLs against the API host
            // (on local/dev API that host is NOT metravel.by), so route by path
            // regardless of host instead of leaking them to the external browser.
            const internalRoute = resolveInternalTravelRoute(safeUrl);
            if (internalRoute) {
              router.push(internalRoute as any);
              return;
            }
            await openExternalUrl(safeUrl, { allowRelative: true, baseUrl: getSiteBaseUrl() });
          } catch {
            // noop
          }
        }}
        scrollEnabled={true}
        pinchZoomEnabled={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
    minHeight: 300,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});

export default Map;
