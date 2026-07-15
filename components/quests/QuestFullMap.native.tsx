// components/quests/QuestFullMap.native.tsx
// Native-реализация карты квеста: WebView + Leaflet (как Map.ios.tsx).
// Web-версия (react-leaflet) — в QuestFullMap.tsx; она грузит Leaflet только на web,
// из-за чего на native карта навсегда висла в «Загрузка карты...» (F-22).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    InteractionManager,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { DESIGN_COLORS } from '@/constants/designSystem';
import { buildQuestOfflineMapGeoJSON, buildQuestOfflineMapGpx } from './questOfflineMapExport';
import { buildQuestWalkingRouteGeometry } from './questRouteGeometry';
import { hasRoutedQuestTrack, useQuestRouteGeometry, type QuestRouteGeometryState } from './useQuestRouteGeometry';
import {
    QUEST_MAP_PNG_RENDERER_SCRIPT,
    saveAndShareQuestMapPng,
} from './questNativeMapPng';
import {
    parseQuestMapBridgeMessage,
    type QuestMapMarkerStatus,
} from './questMapBridge';
import {
    groupQuestStepPoints,
    normalizeQuestStepPoints,
    type QuestStepPoint,
} from './questMapPoints';
import { openQuestMap, type QuestMapApp } from './questWizardHelpers';
import { getOsmNativeTileUrl, OSM_PROXY_MAX_ZOOM } from '@/config/mapWebLayers';
import { LEAFLET_JS, LEAFLET_CSS } from '@/utils/leafletInlineAsset';
import { serializeForInlineScript } from '@/utils/webViewBridge';
import { selectPlural, translate as i18nT } from '@/i18n'


const MIN_INLINE_MAP_HEIGHT = 420;

function formatPointCount(count: number) {
    return selectPlural(count, {
        one: i18nT('quests:components.quests.QuestFullMap.value1_tochka_c8481435', { value1: count }),
        few: i18nT('quests:components.quests.QuestFullMap.value1_tochki_a2cd5a87', { value1: count }),
        many: i18nT('quests:components.quests.QuestFullMap.value1_tochek_75c461c8', { value1: count }),
        other: i18nT('quests:components.quests.QuestFullMap.value1_tochek_75c461c8', { value1: count }),
    });
}

const formatRouteDistance = (meters: number) => {
    if (!Number.isFinite(meters) || meters <= 0) return null;
    if (meters < 1000) return i18nT('quests:components.quests.QuestFullMap.value1_m_a64562c6', { value1: Math.round(meters) });
    return i18nT('quests:components.quests.QuestFullMap.value1_km_24d92f57', { value1: (meters / 1000).toFixed(meters < 10000 ? 1 : 0) });
};

const getRouteStatusText = (route: QuestRouteGeometryState) => {
    if (route.status === 'loading') return i18nT('quests:components.quests.QuestFullMap.stroim_peshiy_marshrut_po_dorozhkam_8ab3ce79');
    if (hasRoutedQuestTrack(route.track, route.source)) {
        const distance = formatRouteDistance(route.distanceM);
        return distance ? i18nT('quests:components.quests.QuestFullMap.peshiy_marshrut_gotov_value1_62786bc6', { value1: distance }) : i18nT('quests:components.quests.QuestFullMap.peshiy_marshrut_gotov_bca517c9');
    }
    if (route.status === 'fallback') return i18nT('quests:components.quests.QuestFullMap.marshrutizator_nedostupen_pokazana_priblizit_20e198c4');
    return i18nT('quests:components.quests.QuestFullMap.dobavte_minimum_dve_tochki_dlya_marshruta_1653582f');
};

function QuestFullMap({
    steps,
    height = 520,
    title = i18nT('quests:components.quests.QuestFullMap.karta_kvesta_9da6e5cf'),
    activeStepIndex,
    allowFullscreen = true,
    onClose,
    interactive = true,
    pointerFrozen = false,
}: {
    steps: QuestStepPoint[];
    height?: number;
    title?: string;
    activeStepIndex?: number;
    allowFullscreen?: boolean;
    onClose?: () => void;
    interactive?: boolean;
    pointerFrozen?: boolean;
}) {
    const [isLoading, setIsLoading] = useState(true);
    const [exportMenuVisible, setExportMenuVisible] = useState(false);
    const [fullscreenVisible, setFullscreenVisible] = useState(false);
    // Пока идёт закрытие fullscreen — снимаем pointerEvents с WebView, чтобы native
    // touch-responder успел получить UP/CANCEL до размонтирования (RN touch-deadlock).
    const [fullscreenClosing, setFullscreenClosing] = useState(false);
    const [markerStatus, setMarkerStatus] = useState<QuestMapMarkerStatus | null>(null);
    const [isExportingPng, setIsExportingPng] = useState(false);
    const webViewRef = useRef<WebView>(null);
    const pngResolverRef = useRef<((dataUrl: string | null) => void) | null>(null);
    const pngTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { height: viewportHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const resolvedHeight = Math.max(MIN_INLINE_MAP_HEIGHT, Math.round(height));
    const fullscreenMapHeight = Math.max(360, Math.round(viewportHeight - insets.top));

    // Двухфазное закрытие fullscreen-карты. Синхронный unmount WebView во время
    // активного жеста пана оставляет JSResponder залоченным (DOWN без UP/CANCEL) —
    // приложение перестаёт принимать касания (#809). Сначала гасим pointerEvents
    // WebView, затем размонтируем Modal после завершения touch-каскада.
    const closeFullscreen = useCallback(() => {
        setFullscreenClosing(true);
        InteractionManager.runAfterInteractions(() => {
            setFullscreenVisible(false);
            setFullscreenClosing(false);
        });
    }, []);

    useAndroidBackHandler(() => {
        if (fullscreenVisible) {
            closeFullscreen();
            return true;
        }
        return false;
    });

    const points = useMemo(
        () => normalizeQuestStepPoints(steps),
        [steps]
    );
    const questNavProviders = useMemo<Array<{ app: QuestMapApp; label: string }>>(
        () => [
            { app: 'google', label: 'Google' },
            { app: 'organic', label: 'Organic' },
            { app: 'waze', label: 'Waze' },
            { app: 'yandex', label: i18nT('quests:components.quests.QuestFullMap.navigation.yandex') },
            { app: 'osm', label: 'OSM' },
        ],
        [],
    );

    // Группировка совпадающих координат (как в web-версии)
    const groupedPoints = useMemo(
        () => groupQuestStepPoints(
            points,
            pointNumber => i18nT(
                'quests:components.quests.QuestFullMap.pointFallback',
                { value1: pointNumber },
            ),
        ),
        [points],
    );

    const routeGeometry = useQuestRouteGeometry(points);
    const routeIsRouted = hasRoutedQuestTrack(routeGeometry.track, routeGeometry.source);
    const routeStatusText = getRouteStatusText(routeGeometry);
    const routeLineTrack = routeGeometry.track.length >= 2
        ? routeGeometry.track
        : points.map(point => [point.lng, point.lat] as [number, number]);

    const htmlContent = useMemo(() => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${LEAFLET_CSS}</style>
      <script>${LEAFLET_JS}</script>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; }
        #map { width: 100%; height: 100%; }
        .leaflet-overlay-pane { z-index: 450 !important; }
        .leaflet-marker-pane { z-index: 650 !important; }
        .qmark {
          background: transparent !important;
          border: none !important;
          display: block !important;
          visibility: visible !important;
        }
        .qmark > div { transform: translateZ(0); }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        function isValidLatLng(point) {
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

        function refreshMapLayout(stage) {
          try {
            map.invalidateSize({ animate: false, pan: false });
          } catch (e) {
            try { map.invalidateSize(); } catch (err) {}
          }
        }

        function scheduleMapRefresh(stage) {
          try {
            refreshMapLayout(stage);
            [80, 240, 600].forEach(function(delay) {
              setTimeout(function() { refreshMapLayout(stage); }, delay);
            });
          } catch (e) {}
        }

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
        window.setTimeout(function () { postMapStatus('final'); }, 1600);
      </script>
    </body>
    </html>
  `, [points, routeLineTrack, routeIsRouted, groupedPoints, colors, interactive, questNavProviders]);

    useEffect(() => {
        if (isLoading) return;
        webViewRef.current?.injectJavaScript(
            `window.setActiveStep && window.setActiveStep(${activeStepIndex ?? 'null'}); true;`
        );
    }, [activeStepIndex, isLoading]);

    useEffect(() => {
        setIsLoading(true);
        setMarkerStatus(null);
    }, [htmlContent]);

    const handleMapMessage = (event: WebViewMessageEvent) => {
        const message = parseQuestMapBridgeMessage(event.nativeEvent.data);
        if (!message) return;
        if (message.type === 'quest-map-png') {
            const resolver = pngResolverRef.current;
            pngResolverRef.current = null;
            if (pngTimeoutRef.current) {
                clearTimeout(pngTimeoutRef.current);
                pngTimeoutRef.current = null;
            }
            resolver?.(message.ok ? message.dataUrl : null);
            return;
        }
        if (message.type === 'quest-map-nav') {
            void openQuestMap(
                { lat: message.lat, lng: message.lng, title: message.title },
                message.app,
            );
            return;
        }
        setMarkerStatus({
            expectedMarkers: message.expectedMarkers || groupedPoints.length,
            markerNodes: message.markerNodes || 0,
            visibleMarkers: message.visibleMarkers || 0,
            settled: message.settled,
        });
    };

    const markersConfirmed =
        Boolean(markerStatus) &&
        markerStatus!.expectedMarkers > 0 &&
        markerStatus!.visibleMarkers >= markerStatus!.expectedMarkers;
    const markersMissing =
        Boolean(markerStatus?.settled) &&
        markerStatus!.expectedMarkers > 0 &&
        markerStatus!.visibleMarkers < markerStatus!.expectedMarkers;

    const handleZoom = (direction: 'in' | 'out') => {
        const fn = direction === 'in' ? '__qmZoomIn' : '__qmZoomOut';
        webViewRef.current?.injectJavaScript(`window.${fn} && window.${fn}(); true;`);
    };

    // Просим WebView отрисовать off-DOM canvas и вернуть PNG data-URL.
    // Мост injectJavaScript → postMessage: резолвер держим в ref, страхуем таймаутом,
    // чтобы зависший рендер не блокировал экспорт навсегда.
    const requestQuestMapPng = useCallback(() => {
        return new Promise<string | null>(resolve => {
            if (pngTimeoutRef.current) clearTimeout(pngTimeoutRef.current);
            pngResolverRef.current = resolve;
            pngTimeoutRef.current = setTimeout(() => {
                pngResolverRef.current = null;
                pngTimeoutRef.current = null;
                resolve(null);
            }, 15000);
            webViewRef.current?.injectJavaScript('window.__qmExportPng && window.__qmExportPng(); true;');
        });
    }, []);

    const shareAsPNG = async () => {
        if (isExportingPng) return;
        setIsExportingPng(true);
        try {
            const dataUrl = await requestQuestMapPng();
            const ok = await saveAndShareQuestMapPng({ dataUrl, title });
            if (!ok && dataUrl == null) {
                Alert.alert(
                    i18nT('quests:components.quests.QuestFullMap.eksport_png_f998b6c7'),
                    i18nT('quests:components.quests.QuestFullMap.ne_udalos_sformirovat_izobrazhenie_karty_pop_8f0c211b')
                );
            } else if (!ok) {
                Alert.alert(i18nT('quests:components.quests.QuestFullMap.eksport_png_f998b6c7'), i18nT('quests:components.quests.QuestFullMap.ne_udalos_podelitsya_izobrazheniem_karty_f9e98473'));
            }
        } catch {
            Alert.alert(i18nT('quests:components.quests.QuestFullMap.eksport_png_f998b6c7'), i18nT('quests:components.quests.QuestFullMap.ne_udalos_sformirovat_izobrazhenie_karty_91b89c4b'));
        } finally {
            setIsExportingPng(false);
        }
    };

    useEffect(() => {
        return () => {
            if (pngTimeoutRef.current) clearTimeout(pngTimeoutRef.current);
            pngResolverRef.current = null;
        };
    }, []);

    const resolveRoutedTrackForExport = async () => {
        if (routeIsRouted) return routeGeometry.track;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const result = await buildQuestWalkingRouteGeometry(points, { signal: controller.signal });
            return result.source === 'routed' && result.track.length >= 2 ? result.track : null;
        } finally {
            clearTimeout(timeout);
        }
    };

    const shareAsGPX = async () => {
        try {
            const routedTrack = await resolveRoutedTrackForExport();
            if (!routedTrack) {
                Alert.alert(i18nT('quests:components.quests.QuestFullMap.eksport_gpx_5b594fb6'), i18nT('quests:components.quests.QuestFullMap.ne_udalos_postroit_realnyy_peshiy_marshrut_s_01a5921d'));
                return;
            }

            const gpxFile = buildQuestOfflineMapGpx({ title, steps: points, routeTrack: routedTrack, routeSource: 'routed' });
            const cacheDir = FileSystem.cacheDirectory ?? '';
            const fileUri = `${cacheDir}${gpxFile.filename}`;
            await FileSystem.writeAsStringAsync(fileUri, gpxFile.content);
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: gpxFile.mimeType,
                    dialogTitle: i18nT('quests:components.quests.QuestFullMap.podelitsya_marshrutom_d39de8d4'),
                });
            }
        } catch {
            Alert.alert(i18nT('quests:components.quests.QuestFullMap.eksport_d541404b'), i18nT('quests:components.quests.QuestFullMap.ne_udalos_podelitsya_gpx_faylom_fbac86e9'));
        }
    };

    const shareAsGeoJSON = async () => {
        try {
            const routedTrack = await resolveRoutedTrackForExport();
            if (!routedTrack) {
                Alert.alert(i18nT('quests:components.quests.QuestFullMap.eksport_geojson_2369b67f'), i18nT('quests:components.quests.QuestFullMap.ne_udalos_postroit_realnyy_peshiy_marshrut_s_433c08de'));
                return;
            }

            const cacheDir = FileSystem.cacheDirectory ?? '';
            const fileUri = `${cacheDir}${title.replace(/\s+/g, '_')}.geojson`;
            await FileSystem.writeAsStringAsync(
                fileUri,
                buildQuestOfflineMapGeoJSON({ title, steps: points, routeTrack: routedTrack, routeSource: 'routed' }),
            );
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'application/geo+json',
                    dialogTitle: i18nT('quests:components.quests.QuestFullMap.podelitsya_marshrutom_d39de8d4'),
                });
            }
        } catch {
            Alert.alert(i18nT('quests:components.quests.QuestFullMap.eksport_d541404b'), i18nT('quests:components.quests.QuestFullMap.ne_udalos_podelitsya_geojson_faylom_5bb0e239'));
        }
    };

    if (points.length === 0) {
        return (
            <View style={[styles.wrap, { height: resolvedHeight }]}>
                <Text style={styles.loadingText}>{i18nT('quests:components.quests.QuestFullMap.net_tochek_marshruta_dlya_karty_bd5c5d99')}</Text>
            </View>
        );
    }

    return (
        <View style={[styles.wrap, { height: resolvedHeight }]}>
            <View
                style={styles.toolbar}
                testID={onClose ? 'quest-fullscreen-toolbar' : 'quest-map-toolbar'}
            >
                <Text style={styles.toolbarTitle} numberOfLines={1}>
                    {title}
                </Text>
                <View style={styles.toolbarActions}>
                    {allowFullscreen && (
                        <TouchableOpacity
                            style={styles.mobileMenuButton}
                            onPress={() => setFullscreenVisible(true)}
                            accessibilityRole="button"
                            accessibilityLabel={i18nT('quests:components.quests.QuestFullMap.otkryt_kartu_kvesta_na_ves_ekran_aa9d3b80')}
                        >
                            <Feather name="maximize-2" size={18} color={colors.textOnPrimary} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={styles.mobileMenuButton}
                        onPress={() => setExportMenuVisible(true)}
                        accessibilityRole="button"
                        accessibilityLabel={i18nT('quests:components.quests.QuestFullMap.skachat_marshrut_png_gpx_geojson_bb653813')}
                    >
                        <Feather name="download" size={18} color={colors.textOnPrimary} />
                    </TouchableOpacity>
                    {onClose && (
                        <TouchableOpacity
                            style={styles.fullscreenClose}
                            onPress={onClose}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            accessibilityRole="button"
                            accessibilityLabel={i18nT('quests:components.quests.QuestFullMap.zakryt_polnoekrannuyu_kartu_kvesta_dbff4c11')}
                        >
                            <Feather name="x" size={20} color={colors.text} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {fullscreenVisible ? (
                <Modal
                    visible
                    transparent={false}
                    animationType="slide"
                    statusBarTranslucent
                    onRequestClose={closeFullscreen}
                >
                    <View style={[styles.fullscreenModal, { paddingTop: insets.top }]}>
                        <QuestFullMap
                            steps={steps}
                            height={fullscreenMapHeight}
                            title={title}
                            activeStepIndex={activeStepIndex}
                            allowFullscreen={false}
                            onClose={closeFullscreen}
                            pointerFrozen={fullscreenClosing}
                        />
                    </View>
                </Modal>
            ) : null}

            <View
                style={styles.routeStatus}
                testID="quest-map-route-status"
                accessibilityLabel={routeStatusText}
            >
                <Feather
                    name={routeGeometry.status === 'loading' ? 'loader' : routeIsRouted ? 'navigation' : 'alert-triangle'}
                    size={14}
                    color={routeIsRouted ? colors.primary : routeGeometry.status === 'loading' ? colors.textMuted : colors.warningDark}
                />
                <Text style={styles.routeStatusText} numberOfLines={1}>
                    {routeStatusText}
                </Text>
            </View>

            <View
                style={styles.pointStatus}
                testID="quest-map-points-status"
                accessibilityLabel={
                    markersConfirmed
                        ? i18nT('quests:components.quests.QuestFullMap.value1_na_karte_23ac5875', { value1: formatPointCount(points.length) })
                        : markersMissing
                          ? i18nT('quests:components.quests.QuestFullMap.tochki_karty_ne_otrisovalis_4b6fa92f')
                          : i18nT('quests:components.quests.QuestFullMap.value1_zagruzhayutsya_na_kartu_430cc5cb', { value1: formatPointCount(points.length) })
                }
            >
                <Feather
                    name={markersConfirmed ? 'map-pin' : 'loader'}
                    size={14}
                    color={markersConfirmed ? colors.primary : colors.textMuted}
                />
                <Text style={styles.pointStatusText} numberOfLines={1}>
                    {markersConfirmed
                        ? i18nT('quests:components.quests.QuestFullMap.value1_na_karte_23ac5875', { value1: formatPointCount(points.length) })
                        : markersMissing
                          ? i18nT('quests:components.quests.QuestFullMap.tochki_karty_ne_otrisovalis_4b6fa92f')
                          : i18nT('quests:components.quests.QuestFullMap.value1_zagruzhayutsya_na_kartu_430cc5cb', { value1: formatPointCount(points.length) })}
                </Text>
            </View>

            <Modal
                visible={exportMenuVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setExportMenuVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setExportMenuVisible(false)}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{i18nT('quests:components.quests.QuestFullMap.eksport_marshruta_365e5842')}</Text>
                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => {
                                setExportMenuVisible(false);
                                void shareAsPNG();
                            }}
                        >
                            <Text style={styles.modalOptionText}>{i18nT('quests:components.quests.QuestFullMap.podelitsya_png_cea537a4')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => {
                                setExportMenuVisible(false);
                                void shareAsGPX();
                            }}
                        >
                            <Text style={styles.modalOptionText}>{i18nT('quests:components.quests.QuestFullMap.podelitsya_gpx_bd013bf8')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => {
                                setExportMenuVisible(false);
                                void shareAsGeoJSON();
                            }}
                        >
                            <Text style={styles.modalOptionText}>{i18nT('quests:components.quests.QuestFullMap.podelitsya_geojson_1c4cb024')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalOption, styles.cancelOption]}
                            onPress={() => setExportMenuVisible(false)}
                        >
                            <Text style={styles.cancelOptionText}>{i18nT('quests:components.quests.QuestFullMap.otmena_bac038f4')}</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <View style={styles.mapBox} pointerEvents={pointerFrozen ? 'none' : 'auto'}>
                {isLoading && (
                    <View style={styles.loader}>
                        <ActivityIndicator size="large" color={colors.primaryDark} />
                        <Text style={styles.loadingText}>{i18nT('quests:components.quests.QuestFullMap.zagruzka_karty_7aad04b6')}</Text>
                    </View>
                )}
                <WebView
                    ref={webViewRef}
                    testID="quest-map-webview"
                    source={{ html: htmlContent }}
                    style={styles.map}
                    javaScriptEnabled
                    domStorageEnabled
                    startInLoadingState
                    onLoadEnd={() => setIsLoading(false)}
                    onMessage={handleMapMessage}
                    scrollEnabled={interactive}
                    nestedScrollEnabled={interactive}
                />
                <View style={styles.zoomControls} pointerEvents="box-none">
                    <TouchableOpacity
                        style={styles.zoomButton}
                        onPress={() => handleZoom('in')}
                        accessibilityRole="button"
                        accessibilityLabel={i18nT('quests:components.quests.QuestFullMap.priblizit_kartu_aa504c98')}
                    >
                        <Text style={styles.zoomButtonText}>+</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.zoomButton}
                        onPress={() => handleZoom('out')}
                        accessibilityRole="button"
                        accessibilityLabel={i18nT('quests:components.quests.QuestFullMap.otdalit_kartu_1b6a4a22')}
                    >
                        <Text style={styles.zoomButtonText}>−</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.touchHints}>
                <Text style={styles.hintText}>
                    {interactive
                        ? i18nT('quests:components.quests.QuestFullMap.dvumya_paltsami_dlya_masshtabirovaniya_2e3cc5a3')
                        : i18nT('quests:components.quests.QuestFullMap.otkroyte_kartu_na_ves_ekran_chtoby_peremesch_a990f545')}
                </Text>
            </View>

            {isExportingPng ? (
                <View style={styles.pngOverlay} pointerEvents="auto">
                    <ActivityIndicator size="large" color={colors.primaryDark} />
                    <Text style={styles.loadingText}>{i18nT('quests:components.quests.QuestFullMap.gotovim_izobrazhenie_karty_a9ade26f')}</Text>
                </View>
            ) : null}
        </View>
    );
}

const createStyles = (colors: ThemedColors) =>
    StyleSheet.create({
        wrap: {
            width: '100%',
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        toolbar: {
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.backgroundSecondary,
            minHeight: 44,
        },
        toolbarTitle: {
            fontWeight: '700',
            color: colors.text,
            fontSize: 14,
            flex: 1,
            marginRight: 8,
        },
        toolbarActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        mobileMenuButton: {
            padding: 8,
            borderRadius: 8,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        fullscreenModal: {
            flex: 1,
            backgroundColor: colors.background,
        },
        fullscreenClose: {
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.backgroundSecondary,
        },
        mapBox: {
            flex: 1,
            minHeight: 280,
        },
        map: {
            flex: 1,
        },
        routeStatus: {
            minHeight: 36,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        routeStatusText: {
            flex: 1,
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
        },
        pointStatus: {
            minHeight: 36,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        pointStatusText: {
            flex: 1,
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
        },
        zoomControls: {
            position: 'absolute',
            right: 12,
            bottom: 12,
            gap: 8,
        },
        zoomButton: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 3,
        },
        zoomButtonText: {
            fontSize: 24,
            lineHeight: 26,
            fontWeight: '700',
            color: colors.text,
        },
        loader: {
            ...StyleSheet.absoluteFillObject,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            zIndex: 10,
            backgroundColor: colors.surface,
        },
        pngOverlay: {
            ...StyleSheet.absoluteFillObject,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            zIndex: 20,
            backgroundColor: colors.overlay,
        },
        loadingText: {
            textAlign: 'center',
            padding: 20,
            color: colors.textMuted,
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'flex-end',
        },
        modalContent: {
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            paddingBottom: 30,
        },
        modalTitle: {
            fontSize: 18,
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: 20,
            color: colors.text,
        },
        modalOption: {
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        modalOptionText: {
            fontSize: 16,
            color: colors.text,
            textAlign: 'center',
        },
        cancelOption: {
            marginTop: 10,
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 12,
            borderBottomWidth: 0,
        },
        cancelOptionText: {
            fontSize: 16,
            color: colors.textMuted,
            fontWeight: '600',
            textAlign: 'center',
        },
        touchHints: {
            padding: 12,
            backgroundColor: colors.backgroundSecondary,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        hintText: {
            fontSize: 12,
            color: colors.textMuted,
            textAlign: 'center',
        },
    });

export default React.memo(QuestFullMap);
