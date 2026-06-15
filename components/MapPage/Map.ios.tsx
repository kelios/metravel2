import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { useThemedColors } from '@/hooks/useTheme';
import { getSafeExternalUrl } from '@/utils/safeExternalUrl';
import { DESIGN_COLORS } from '@/constants/designSystem';
import { openExternalUrl } from '@/utils/externalLinks';
import { normalizeRelatedTravelRoute } from '@/utils/relatedTravel';

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
  routePoints?: [number, number][];
  fullRouteCoords?: [number, number][];
  mode?: 'radius' | 'route';
  onMapClick?: (lng: number, lat: number) => void;
  onMapUiApiReady?: (api: {
    zoomIn: () => void;
    zoomOut: () => void;
    centerOnUser: () => void;
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

const Map: React.FC<TravelProps> = ({
  travel,
  coordinates: propCoordinates,
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

  useEffect(() => {
    if (!onMapUiApiReady) return undefined;

    onMapUiApiReady({
      zoomIn: () => injectMapCommand('window.__metravelMapZoomIn && window.__metravelMapZoomIn()'),
      zoomOut: () => injectMapCommand('window.__metravelMapZoomOut && window.__metravelMapZoomOut()'),
      centerOnUser: () => injectMapCommand('window.__metravelMapCenterOnUser && window.__metravelMapCenterOnUser()'),
    });

    return () => onMapUiApiReady(null);
  }, [injectMapCommand, onMapUiApiReady]);

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

  // Ref на последний pushPayload — чтобы обработчики onLoadEnd/onMessage слали
  // актуальные данные без устаревшего замыкания.
  const pushPayloadRef = useRef(pushPayload);
  pushPayloadRef.current = pushPayload;

  // Перерисовать маркеры при любом изменении данных (если WebView уже готов).
  useEffect(() => {
    pushPayload();
  }, [pushPayload]);

  const handleReady = useCallback(() => {
    isReadyRef.current = true;
    pushPayloadRef.current();
  }, []);

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
        .popup-text { padding: 12px; font-size: 13px; line-height: 1.5; }
        .popup-label { font-weight: 600; color: ${themeColors.text}; margin-top: 8px; margin-bottom: 4px; }
        .popup-label:first-of-type { margin-top: 0; }
        .popup-value { color: ${themeColors.textMuted}; font-size: 12px; margin-bottom: 4px; }
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
        window.__metravelMapCenterOnUser = function() {
          try { map.setView(map.__userCenter, Math.max(map.getZoom ? map.getZoom() : 10, 13)); } catch (e) {}
        };

        // OpenStreetMap (бесплатно!)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19
        }).addTo(map);

        const markersLayer = L.layerGroup().addTo(map);
        const routeLayer = L.layerGroup().addTo(map);

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

              popupContent += '<div class="popup-text">';
              popupContent += '<div class="popup-label">Адрес:</div>';
              popupContent += '<div class="popup-value">' + escapeHtml(point.address || 'Не указан') + '</div>';
              popupContent += '<div class="popup-label">Координаты:</div>';
              popupContent += '<div class="popup-value">' + escapeHtml(point.coord) + '</div>';
              popupContent += '<div class="popup-label">Категория:</div>';
              popupContent += '<div class="popup-value">' + escapeHtml(point.categoryName || 'Не указана') + '</div>';
              popupContent += '</div>';

              const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(markersLayer);
              marker.bindPopup(popupContent, { maxWidth: 200 });

              marker.on('click', function() {
                const directUrl = String(point.urlTravel || point.articleUrl || '').trim();
                if (directUrl) {
                  sendOpenUrl(directUrl);
                }
              });

              marker.on('popupopen', function(e) {
                try {
                  const popupEl = e && e.popup ? e.popup.getElement() : null;
                  if (!popupEl) return;
                  const linkEl = popupEl.querySelector('.popup-image-link');
                  if (!linkEl) return;
                  linkEl.addEventListener('click', function(ev) {
                    try {
                      ev.preventDefault();
                      const url = (linkEl.getAttribute('data-open-url') || '').trim();
                      if (!url) return;
                      sendOpenUrl(url);
                    } catch {
                      // noop
                    }
                  }, { once: true });
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
        source={{ html: htmlContent }}
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
            const internalRoute = normalizeRelatedTravelRoute(safeUrl);
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
