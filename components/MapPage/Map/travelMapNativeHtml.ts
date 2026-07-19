// components/MapPage/Map/travelMapNativeHtml.ts
//
// #990 — Pure builder для inline-Leaflet HTML карты travel-деталей (native WebView).
// Вынесено из TravelMap.native.tsx, чтобы (а) переиспользовать общий скелет
// `buildLeafletWebViewHtml`, (б) юнит-тестировать HTML без рендера компонента.
//
// Мост RN: OPEN_URL / POINT_SELECT / CLEAR_SELECTED_POINT + RESIZE (message).
// Планировщик — облегчённый whenReady+rAF+250ms fit (НЕ общий [80,240,600]-scheduler
// native/quest): у travel-карты нет офлайн-тайлов/оверлеев, поэтому лёгкого fit
// достаточно — поведение сохранено 1:1 из прежнего inline-HTML.
import { buildLeafletWebViewHtml } from '@/components/map-core/leafletWebViewHtml';
import { getOsmNativeTileUrl, OSM_PROXY_MAX_ZOOM } from '@/config/mapWebLayers';

export interface TravelMapNativeHtmlParams {
  /** JSON-сериализуемые точки (coord/address/...). */
  points: unknown[];
  /** JSON-сериализуемые линии маршрута ({ coords, color? }). */
  routes: unknown[];
  /** Подсвеченная координата или null. */
  highlightCoord: string | null;
  center: [number, number];
  initialZoom: number;
  /** Цвет поверхности попапа (themed). */
  surfaceColor: string;
  /** Цвет линии маршрута по умолчанию. */
  routeColor: string;
  /** HTML brand-маркера («птица»). */
  birdMarkerHtml: string;
}

export const buildTravelMapNativeHtml = ({
  points,
  routes,
  highlightCoord,
  center,
  initialZoom,
  surfaceColor,
  routeColor,
  birdMarkerHtml,
}: TravelMapNativeHtmlParams): string => {
  const pointsJson = JSON.stringify(points);
  const routesJson = JSON.stringify(routes);
  const highlightCoordJson = highlightCoord ? JSON.stringify(highlightCoord) : 'null';

  return buildLeafletWebViewHtml({
    headStyles: `        .leaflet-popup-content-wrapper { background-color: ${surfaceColor}; border-radius: 8px; padding: 0; }
        .leaflet-popup-content { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; }
        .metravel-marker { background: transparent; border: 0; }`,
    bodyScript: `        const map = L.map('map', { zoomControl: true }).setView([${center[0]}, ${center[1]}], ${initialZoom});
        L.tileLayer('${getOsmNativeTileUrl()}', {
          attribution: '© OpenStreetMap',
          maxZoom: ${OSM_PROXY_MAX_ZOOM}
        }).addTo(map);

        const points = ${pointsJson};
        const routes = ${routesJson};
        const highlightCoord = ${highlightCoordJson};
        const initialZoom = ${initialZoom};
        const bounds = L.latLngBounds();
        let boundsPointCount = 0;

        function sendOpenUrl(rawUrl) {
          try {
            if (!rawUrl) return;
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'OPEN_URL', url: rawUrl }));
            }
          } catch {}
        }
        function sendPointSelect(coord) {
          try {
            if (!coord) return;
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'POINT_SELECT', coord: coord }));
            }
          } catch {}
        }
        function sendClearSelectedPoint() {
          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CLEAR_SELECTED_POINT' }));
            }
          } catch {}
        }

        map.on('click', function() {
          sendClearSelectedPoint();
        });

        routes.forEach(function(route) {
          if (!route || !Array.isArray(route.coords) || route.coords.length < 2) return;
          const latlngs = route.coords.map(function(c) { return [c[0], c[1]]; });
          L.polyline(latlngs, { color: route.color || '${routeColor}', weight: 4, opacity: 0.85 }).addTo(map);
          latlngs.forEach(function(ll) { bounds.extend(ll); boundsPointCount++; });
        });

        // #843 — shared brand «bird» divIcon (same source as web/native /map). Inline
        // HTML renders reliably in Android WebView (SVG data-URI markers can render
        // invisible). Size/anchor match useLeafletIcons so the bird tip sits on the coord.
        const markerIcon = L.divIcon({
          className: 'metravel-marker',
          html: ${JSON.stringify(birdMarkerHtml)},
          iconSize: [48, 58],
          iconAnchor: [24, 54],
          popupAnchor: [0, -46]
        });

        let highlightedMarker = null;

        points.forEach(function(point) {
          if (!point.coord) return;
          const parts = point.coord.split(',').map(function(s) { return Number(String(s).trim()); });
          const lat = parts[0];
          const lng = parts[1];
          if (!isFinite(lat) || !isFinite(lng)) return;

          const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
          marker.on('click', function(e) {
            try {
              if (e && e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
              map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true });
              sendPointSelect(point.coord);
            } catch {}
          });

          if (highlightCoord && point.coord === highlightCoord) {
            highlightedMarker = marker;
            marker.setZIndexOffset(1000);
          }
          bounds.extend([lat, lng]);
          boundsPointCount++;
        });

        // Подгоняем карту под все точки/линии маршрута. invalidateSize ПЕРЕД fitBounds —
        // иначе на первом кадре/при раскрытии секции контейнер ещё нулевого размера и
        // zoom считается неверно (часть маркеров уходит за край экрана).
        function fitMap(animate) {
          try {
            map.invalidateSize(false);
          } catch (e) {}
          if (highlightedMarker) {
            try {
              map.setView(highlightedMarker.getLatLng(), 14, { animate: !!animate });
              return;
            } catch (e) {}
          }
          if (boundsPointCount === 1) {
            // Одиночная точка: fitBounds дал бы нулевую рамку — центрируем с разумным зумом.
            try {
              map.setView(bounds.getCenter(), initialZoom, { animate: !!animate });
              return;
            } catch (e) {}
          }
          if (bounds.isValid()) {
            try {
              map.fitBounds(bounds.pad(0.15), { padding: [40, 40], maxZoom: 15, animate: !!animate });
            } catch (e) {}
          }
        }

        // whenReady гарантирует, что Leaflet знает размер контейнера. rAF + повтор через 250ms —
        // подстраховка для медленного Android WebView, где первый кадр приходит с размером 0.
        map.whenReady(function() {
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(function() { fitMap(false); });
          } else {
            fitMap(false);
          }
          setTimeout(function() { fitMap(false); }, 250);
        });

        // Повторный fit по запросу из RN (раскрытие ToggleableMap / resize контейнера).
        function handleResizeMessage(event) {
          try {
            var data = event && event.data;
            if (typeof data !== 'string') return;
            var parsed = JSON.parse(data);
            if (parsed && parsed.type === 'RESIZE') {
              fitMap(true);
            }
          } catch (e) {}
        }
        document.addEventListener('message', handleResizeMessage);
        window.addEventListener('message', handleResizeMessage);`,
  });
};
