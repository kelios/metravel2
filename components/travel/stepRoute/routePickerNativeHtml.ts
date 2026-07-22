// components/travel/stepRoute/routePickerNativeHtml.ts
//
// #1040 — Билдер inline-Leaflet HTML для РЕДАКТИРУЕМОЙ карты выбора точек
// маршрута в мастере путешествия (native WebView, Android).
//
// Отличие от `travelMapNativeHtml` (карта travel-деталей, read-only): здесь
// маркеры draggable, тап по пустой карте создаёт точку, а точки приходят из RN
// через `window.__mtRouteSetPoints(json)` (injectJavaScript), а НЕ вшиваются в
// HTML. Это принципиально: пересборка HTML на каждую правку перезагружала бы
// WebView и сбрасывала позицию/зум карты после каждого добавления точки.
//
// Мост RN → WebView: __mtRouteSetPoints / __mtRouteFlyTo / __mtRouteFit.
// Мост WebView → RN: POINT_ADD / POINT_MOVE / POINT_SELECT / MAP_READY.
import { buildLeafletWebViewHtml } from '@/components/map-core/leafletWebViewHtml';
import { getOsmNativeTileUrl, OSM_PROXY_MAX_ZOOM } from '@/config/mapWebLayers';

export interface RoutePickerNativeHtmlParams {
  center: [number, number];
  initialZoom: number;
  /** HTML brand-маркера («птица») — тот же источник, что и на web/native /map. */
  birdMarkerHtml: string;
  /** Цвет линии маршрута между точками. */
  routeColor: string;
}

export const buildRoutePickerNativeHtml = ({
  center,
  initialZoom,
  birdMarkerHtml,
  routeColor,
}: RoutePickerNativeHtmlParams): string =>
  buildLeafletWebViewHtml({
    headStyles: `        .metravel-marker { background: transparent; border: 0; }
        .mt-point-badge {
          position: absolute; top: -2px; left: 50%; transform: translateX(-50%);
          min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px;
          background: ${routeColor}; color: #fff; font: 700 12px/20px -apple-system, Roboto, sans-serif;
          text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,.35);
        }`,
    bodyScript: `        const map = L.map('map', { zoomControl: true, tap: false })
          .setView([${center[0]}, ${center[1]}], ${initialZoom});
        L.tileLayer('${getOsmNativeTileUrl()}', {
          attribution: '© OpenStreetMap',
          maxZoom: ${OSM_PROXY_MAX_ZOOM}
        }).addTo(map);

        const BIRD_HTML = ${JSON.stringify(birdMarkerHtml)};
        let markers = [];
        let routeLine = null;
        // Leaflet на Android эмитит «призрачный» click после тапа по маркеру и
        // после drag (см. project_map_cluster_popup_ghost_click). Без этого гварда
        // каждое перетаскивание/выделение точки создавало бы ещё одну точку.
        let suppressMapClickUntil = 0;

        function post(payload) {
          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify(payload));
            }
          } catch (e) {}
        }

        function makeIcon(order) {
          return L.divIcon({
            className: 'metravel-marker',
            html: '<div style="position:relative">' + BIRD_HTML +
                  '<span class="mt-point-badge">' + order + '</span></div>',
            iconSize: [48, 58],
            iconAnchor: [24, 54],
            popupAnchor: [0, -46]
          });
        }

        function clearMarkers() {
          markers.forEach(function (m) { try { map.removeLayer(m); } catch (e) {} });
          markers = [];
          if (routeLine) { try { map.removeLayer(routeLine); } catch (e) {} routeLine = null; }
        }

        // Вызывается из RN при каждом изменении списка точек.
        window.__mtRouteSetPoints = function (json, shouldFit) {
          try {
            const points = JSON.parse(json) || [];
            clearMarkers();
            const bounds = L.latLngBounds();
            const line = [];

            points.forEach(function (p, index) {
              const lat = Number(p && p.lat);
              const lng = Number(p && p.lng);
              if (!isFinite(lat) || !isFinite(lng)) return;

              const marker = L.marker([lat, lng], {
                icon: makeIcon(index + 1),
                draggable: true,
                autoPan: true
              }).addTo(map);

              marker.on('click', function (e) {
                try { if (e && e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent); } catch (err) {}
                suppressMapClickUntil = Date.now() + 400;
                post({ type: 'POINT_SELECT', index: index });
              });
              marker.on('dragstart', function () { suppressMapClickUntil = Date.now() + 1500; });
              marker.on('dragend', function (ev) {
                try {
                  const ll = ev.target.getLatLng();
                  suppressMapClickUntil = Date.now() + 600;
                  post({ type: 'POINT_MOVE', index: index, lat: ll.lat, lng: ll.lng });
                } catch (err) {}
              });

              markers.push(marker);
              bounds.extend([lat, lng]);
              line.push([lat, lng]);
            });

            if (line.length >= 2) {
              routeLine = L.polyline(line, { color: '${routeColor}', weight: 3, opacity: 0.7 }).addTo(map);
            }

            if (shouldFit && bounds.isValid()) {
              try { map.invalidateSize(false); } catch (e) {}
              if (line.length === 1) {
                map.setView(bounds.getCenter(), Math.max(map.getZoom(), 14), { animate: false });
              } else {
                map.fitBounds(bounds.pad(0.15), { padding: [40, 40], maxZoom: 15, animate: false });
              }
            }
          } catch (e) {}
        };

        window.__mtRouteFlyTo = function (lat, lng, zoom) {
          try {
            if (!isFinite(lat) || !isFinite(lng)) return;
            suppressMapClickUntil = Date.now() + 400;
            map.setView([lat, lng], zoom || Math.max(map.getZoom(), 14), { animate: true });
          } catch (e) {}
        };

        window.__mtRouteFit = function () {
          try { map.invalidateSize(false); } catch (e) {}
        };

        // Тап по пустой карте — добавление точки.
        map.on('click', function (e) {
          try {
            if (Date.now() < suppressMapClickUntil) return;
            if (!e || !e.latlng) return;
            post({ type: 'POINT_ADD', lat: e.latlng.lat, lng: e.latlng.lng });
          } catch (err) {}
        });

        map.whenReady(function () {
          try { map.invalidateSize(false); } catch (e) {}
          post({ type: 'MAP_READY' });
          setTimeout(function () { try { map.invalidateSize(false); } catch (e) {} }, 250);
        });`,
  });
