import { DESIGN_COLORS } from '@/constants/designSystem';
import { getOsmNativeTileUrl, OSM_PROXY_MAX_ZOOM } from '@/config/mapWebLayers';
import type { ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n';
import { serializeForInlineScript } from '@/utils/webViewBridge';
import {
  buildInvalidateSchedulerScript,
  buildLeafletWebViewHtml,
} from '@/components/map-core/leafletWebViewHtml';
import { QUEST_MAP_PNG_RENDERER_SCRIPT } from './questNativeMapPng';
import type { GroupedQuestPoint, QuestStepPoint } from './questMapPoints';
import type { QuestMapApp } from './questWizardHelpers';

export const buildQuestNativeMapHtml = ({
    points,
    routeLineTrack,
    routeIsRouted,
    groupedPoints,
    colors,
    interactive,
    questNavProviders,
}: {
    points: readonly QuestStepPoint[];
    routeLineTrack: readonly [number, number][];
    routeIsRouted: boolean;
    groupedPoints: readonly GroupedQuestPoint[];
    colors: ThemedColors;
    interactive: boolean;
    questNavProviders: ReadonlyArray<{ app: QuestMapApp; label: string }>;
}) =>
    buildLeafletWebViewHtml({
        headStyles: `        .leaflet-overlay-pane { z-index: 450 !important; }
        .leaflet-marker-pane { z-index: 650 !important; }
        .qmark {
          background: transparent !important;
          border: none !important;
          display: block !important;
          visibility: visible !important;
        }
        .qmark > div { transform: translateZ(0); }`,
        bodyScript: `        function isValidLatLng(point) {
          return Array.isArray(point) &&
            point.length >= 2 &&
            Number.isFinite(point[0]) &&
            Number.isFinite(point[1]) &&
            point[0] >= -90 && point[0] <= 90 &&
            point[1] >= -180 && point[1] <= 180;
        }

        var rawWaypointPoints = ${serializeForInlineScript(points.map(p => [p.lat, p.lng]))};
        var waypointPoints = rawWaypointPoints.filter(isValidLatLng);
        var rawRouteTrack = ${serializeForInlineScript(routeLineTrack)};
        var routePoints = rawRouteTrack.map(function (point) {
          return Array.isArray(point) && point.length >= 2 ? [Number(point[1]), Number(point[0])] : null;
        }).filter(isValidLatLng);
        if (routePoints.length < 2) routePoints = waypointPoints;
        var routeIsRouted = ${routeIsRouted ? 'true' : 'false'};
        var grouped = ${serializeForInlineScript(groupedPoints)}.filter(function (point) {
          return Number.isFinite(point.lat) &&
            Number.isFinite(point.lng) &&
            point.lat >= -90 && point.lat <= 90 &&
            point.lng >= -180 && point.lng <= 180;
        });
        var navProviders = ${serializeForInlineScript(questNavProviders)};
        var theme = ${serializeForInlineScript({
            primary: colors.primary,
            primaryDark: colors.primaryDark,
            warning: colors.warning,
            warningDark: colors.warningDark,
            text: colors.text,
            textOnPrimary: colors.textOnPrimary,
            surface: colors.surface,
            routeLine: DESIGN_COLORS.routeLine,
        })};
        var initialCenter = waypointPoints[0] || routePoints[0] || [53.9, 27.56];

        var mapInteractive = ${interactive ? 'true' : 'false'};
        var map = L.map('map', {
          zoomControl: false,
          preferCanvas: true,
          fadeAnimation: false,
          zoomAnimation: false,
          markerZoomAnimation: false,
          // Превью-карта внутри вертикального ScrollView (interactive=false): гасим
          // все жесты панорамирования/зума в Leaflet, чтобы Android WebView не
          // перехватывал вертикальный свайп страницы. Зум остаётся через нативные
          // кнопки +/− (injectJavaScript), полное взаимодействие — в fullscreen.
          dragging: mapInteractive,
          touchZoom: mapInteractive,
          scrollWheelZoom: mapInteractive,
          doubleClickZoom: mapInteractive,
          boxZoom: mapInteractive,
          keyboard: mapInteractive,
          tap: mapInteractive
        }).setView(initialCenter, routePoints.length > 1 ? 14 : 15);

        var tileLayer = L.tileLayer('${getOsmNativeTileUrl()}', {
          attribution: '© OpenStreetMap',
          maxZoom: ${OSM_PROXY_MAX_ZOOM},
          updateWhenIdle: false,
          updateWhenZooming: false,
          keepBuffer: 1
        });

        var routeHalo = routePoints.length > 1
          ? L.polyline(routePoints, {
              color: theme.surface,
              weight: routeIsRouted ? 9 : 7,
              opacity: 0.92,
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map)
          : null;
        var routeLine = routePoints.length > 1
          ? L.polyline(routePoints, {
              color: routeIsRouted ? theme.routeLine : theme.warningDark,
              weight: routeIsRouted ? 5 : 4,
              opacity: routeIsRouted ? 0.96 : 0.78,
              dashArray: routeIsRouted ? null : '8 10',
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map)
          : null;

        function iconFor(label, active) {
          var size = active ? 40 : 34;
          var dotSize = active ? 30 : 26;
          var fontSize = active ? 14 : 13;
          var bg = active ? theme.primary : theme.surface;
          var stroke = active ? theme.primaryDark : theme.primary;
          var color = active ? theme.textOnPrimary : theme.primaryDark;
          var html = '<div style="position:relative;width:' + size + 'px;height:' + size + 'px">' +
            '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:9999px;' +
            'background:' + theme.surface + ';border:2px solid ' + theme.surface + ';' +
            'display:flex;align-items:center;justify-content:center;' +
            'box-shadow:0 8px 18px rgba(0,0,0,.22);position:relative;z-index:1">' +
            '<div style="width:' + dotSize + 'px;height:' + dotSize + 'px;border-radius:9999px;' +
            'background:' + bg + ';border:2px solid ' + stroke + ';color:' + color + ';' +
            'display:flex;align-items:center;justify-content:center;font-weight:800;' +
            'font-size:' + fontSize + 'px;line-height:1;padding:0 4px">' + label + '</div>' +
            '</div><div style="position:absolute;left:50%;bottom:-2px;width:10px;height:10px;' +
            'background:' + theme.surface + ';border-right:2px solid ' + theme.surface + ';' +
            'border-bottom:2px solid ' + theme.surface + ';transform:translateX(-50%) rotate(45deg);' +
            'box-shadow:0 8px 18px rgba(0,0,0,.22);z-index:0"></div></div>';
          return L.divIcon({ className: 'qmark', html: html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
        }

        function navButtonsHtml(gp) {
          var buttons = navProviders.map(function (provider) {
            return '<button type="button" class="qnav-btn" data-app="' + provider.app +
              '" data-lat="' + gp.lat + '" data-lng="' + gp.lng +
              '" data-title="' + encodeURIComponent(gp.titles[0] || '') + '" ' +
              'style="cursor:pointer;border:1px solid ' + theme.routeLine + ';background:' + theme.surface + ';color:' + theme.text +
              ';border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700;line-height:1">' +
              provider.label + '</button>';
          }).join('');
          return '<div style="margin-top:8px;font-size:12px;font-weight:700;color:' + theme.text +
            '">' + ${serializeForInlineScript(i18nT('quests:components.quests.QuestFullMap.dovesti_menya_cbcbe1c8'))} + '</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;max-width:220px">' +
            buttons + '</div>';
        }

        var markers = grouped.map(function (gp) {
          var marker = L.marker([gp.lat, gp.lng], {
            icon: iconFor(gp.indexes.join(','), false),
            zIndexOffset: 1000
          }).addTo(map);
          marker.bindPopup(
            '<b>' + gp.indexes.join(', ') + '.</b><br/>' + gp.titles.join(', ') + navButtonsHtml(gp)
          );
          return marker;
        });

        document.addEventListener('click', function (e) {
          var btn = e.target && e.target.closest ? e.target.closest('.qnav-btn') : null;
          if (!btn) return;
          if (!window.ReactNativeWebView) return;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'quest-map-nav',
            app: btn.getAttribute('data-app'),
            lat: parseFloat(btn.getAttribute('data-lat')),
            lng: parseFloat(btn.getAttribute('data-lng')),
            title: decodeURIComponent(btn.getAttribute('data-title') || '')
          }));
        });

${buildInvalidateSchedulerScript({
    schedulerName: 'scheduleMapRefresh',
    helperName: 'refreshMapLayout',
    mode: 'function-decl',
    emitRegistration: false,
})}

        function visibleMarkerCount() {
          var nodes = document.querySelectorAll('.leaflet-marker-icon.qmark, .qmark.leaflet-marker-icon');
          var visible = 0;
          nodes.forEach(function (node) {
            var rect = node.getBoundingClientRect();
            var computed = window.getComputedStyle(node);
            if (
              rect.width > 0 &&
              rect.height > 0 &&
              computed.display !== 'none' &&
              computed.visibility !== 'hidden' &&
              computed.opacity !== '0'
            ) {
              visible += 1;
            }
          });
          return visible;
        }

        var statusRetryCount = 0;
        function postMapStatus(stage) {
          try {
            if (!window.ReactNativeWebView) return;
            refreshMapLayout(stage);
            var visibleMarkers = visibleMarkerCount();
            var expectedMarkers = grouped.length;
            var settled = stage === 'settled' || stage === 'final' || visibleMarkers >= expectedMarkers || statusRetryCount >= 3;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'quest-map-status',
              stage: stage,
              points: waypointPoints.length,
              expectedMarkers: expectedMarkers,
              markerNodes: document.querySelectorAll('.qmark').length,
              visibleMarkers: visibleMarkers,
              settled: settled
            }));

            if (!settled && visibleMarkers < expectedMarkers) {
              statusRetryCount += 1;
              scheduleMapRefresh('status-retry');
              setTimeout(function () { postMapStatus('retry'); }, 260);
            }
          } catch (e) {}
        }

        window.__qmZoomIn = function () { try { map.zoomIn(); } catch (e) {} };
        window.__qmZoomOut = function () { try { map.zoomOut(); } catch (e) {} };
${QUEST_MAP_PNG_RENDERER_SCRIPT}

        window.setActiveStep = function (activeIndex) {
          grouped.forEach(function (gp, i) {
            var active = activeIndex != null && gp.indexes.indexOf(activeIndex + 1) !== -1;
            markers[i].setIcon(iconFor(gp.indexes.join(','), active));
          });
          if (activeIndex != null && isValidLatLng(waypointPoints[activeIndex])) {
            map.panTo(waypointPoints[activeIndex], { animate: true });
          }
        };

        function hasStableMapSize() {
          try {
            var container = map.getContainer();
            var rect = container.getBoundingClientRect();
            var size = map.getSize();
            return rect.width > 0 && rect.height > 0 && size.x > 0 && size.y > 0;
          } catch (e) {
            return false;
          }
        }

        function ensureTileLayer() {
          try {
            if (!map.hasLayer(tileLayer) && hasStableMapSize()) {
              tileLayer.addTo(map);
              if (routeHalo && !map.hasLayer(routeHalo)) routeHalo.addTo(map);
              if (routeLine && !map.hasLayer(routeLine)) routeLine.addTo(map);
            }
          } catch (e) {}
        }

        scheduleMapRefresh('init');
        window.addEventListener('resize', function() { scheduleMapRefresh('resize'); });
        window.addEventListener('orientationchange', function() { scheduleMapRefresh('orientationchange'); });
        document.addEventListener('visibilitychange', function() {
          if (!document.hidden) scheduleMapRefresh('visibilitychange');
        });
        map.on('moveend zoomend', function() { scheduleMapRefresh('map-change'); });

        // Подгонка границ. На Android WebView контейнер карты в момент выполнения
        // скрипта нередко имеет нулевую высоту (карта ниже сгиба / внутри Suspense),
        // поэтому одиночный fitBounds оставляет карту на zoom 0 (вид всего мира).
        // Повторяем fit после invalidateSize, пока контейнер не получит размер.
        function fitToRoute() {
          try {
            if (waypointPoints.length === 0 && routePoints.length === 0) {
              map.setView([53.9, 27.56], 10);
              ensureTileLayer();
              return true;
            }
            map.invalidateSize();
            if (!hasStableMapSize()) return false;
            var boundsPoints = routePoints.length > 1 ? routePoints.concat(waypointPoints) : waypointPoints;
            var bounds = L.latLngBounds(boundsPoints).pad(0.15);
            if (!bounds.isValid()) {
              map.setView(initialCenter, 15);
              ensureTileLayer();
              return true;
            }
            var nextZoom = map.getBoundsZoom(bounds, false);
            if (Number.isFinite(nextZoom)) {
              map.fitBounds(bounds, { animate: false, maxZoom: 17 });
            } else {
              map.setView(initialCenter, routePoints.length > 1 ? 14 : 15);
            }
            ensureTileLayer();
            scheduleMapRefresh('fit');
            window.setTimeout(function () { postMapStatus('fit'); }, 50);
            return true;
          } catch (e) {
            try {
              map.setView(initialCenter, routePoints.length > 1 ? 14 : 15);
              ensureTileLayer();
            } catch (err) {}
            return false;
          }
        }

        if (!fitToRoute()) {
          var fitTries = 0;
          var fitTimer = setInterval(function () {
            fitTries += 1;
            if (fitToRoute() || fitTries > 20) clearInterval(fitTimer);
          }, 150);
        }
        window.setTimeout(function () { postMapStatus('ready'); }, 250);
        window.setTimeout(function () { postMapStatus('settled'); }, 1000);
        window.setTimeout(function () { postMapStatus('final'); }, 1600);`,
    });

