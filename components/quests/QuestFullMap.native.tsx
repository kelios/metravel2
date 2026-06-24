// components/quests/QuestFullMap.native.tsx
// Native-реализация карты квеста: WebView + Leaflet (как Map.ios.tsx).
// Web-версия (react-leaflet) — в QuestFullMap.tsx; она грузит Leaflet только на web,
// из-за чего на native карта навсегда висла в «Загрузка карты...» (F-22).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { buildQuestOfflineMapGpx } from './questOfflineMapExport';
import { openQuestMap, type QuestMapApp } from './questWizardHelpers';
import { getOsmNativeTileUrl, OSM_PROXY_MAX_ZOOM } from '@/config/mapWebLayers';

const QUEST_NAV_PROVIDERS: Array<{ app: QuestMapApp; label: string }> = [
    { app: 'google', label: 'Google' },
    { app: 'organic', label: 'Organic' },
    { app: 'waze', label: 'Waze' },
    { app: 'yandex', label: 'Яндекс' },
    { app: 'osm', label: 'OSM' },
];

type StepPoint = { lat: number; lng: number; title?: string };

type GroupedPoint = { lat: number; lng: number; indexes: number[]; titles: string[] };

type MarkerStatus = {
    expectedMarkers: number;
    markerNodes: number;
    visibleMarkers: number;
};

function formatPointCount(count: number) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return `${count} точка`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} точки`;
    return `${count} точек`;
}

function buildGeoJSON(pts: StepPoint[]) {
    return JSON.stringify(
        {
            type: 'FeatureCollection',
            features: [
                ...pts.map((p, i) => ({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
                    properties: { order: i + 1, title: p.title || `Точка ${i + 1}` },
                })),
                {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: pts.map(p => [p.lng, p.lat]),
                    },
                    properties: { name: 'Маршрут квеста' },
                },
            ],
        },
        null,
        2
    );
}

const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

function QuestFullMap({
    steps,
    height = 520,
    title = 'Карта квеста',
    activeStepIndex,
    allowFullscreen = true,
}: {
    steps: StepPoint[];
    height?: number;
    title?: string;
    activeStepIndex?: number;
    allowFullscreen?: boolean;
}) {
    const [isLoading, setIsLoading] = useState(true);
    const [exportMenuVisible, setExportMenuVisible] = useState(false);
    const [fullscreenVisible, setFullscreenVisible] = useState(false);
    const [markerStatus, setMarkerStatus] = useState<MarkerStatus | null>(null);
    const webViewRef = useRef<WebView>(null);
    const { height: viewportHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const fullscreenMapHeight = Math.max(360, Math.round(viewportHeight - 72));

    useAndroidBackHandler(() => {
        if (fullscreenVisible) {
            setFullscreenVisible(false);
            return true;
        }
        return false;
    });

    const points = useMemo(
        () => steps.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng)),
        [steps]
    );

    // Группировка совпадающих координат (как в web-версии)
    const groupedPoints = useMemo<GroupedPoint[]>(() => {
        const map = new Map<string, GroupedPoint>();
        points.forEach((p, i) => {
            const key = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
            const existing = map.get(key);
            if (!existing) {
                map.set(key, {
                    lat: p.lat,
                    lng: p.lng,
                    indexes: [i + 1],
                    titles: [p.title || `Точка ${i + 1}`],
                });
            } else {
                existing.indexes.push(i + 1);
                existing.titles.push(p.title || `Точка ${i + 1}`);
            }
        });
        return Array.from(map.values()).sort(
            (a, b) => Math.min(...a.indexes) - Math.min(...b.indexes)
        );
    }, [points]);

    const htmlContent = useMemo(() => `
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
        var map = L.map('map', { zoomControl: false });
        L.tileLayer('${getOsmNativeTileUrl()}', {
          attribution: '© OpenStreetMap',
          maxZoom: ${OSM_PROXY_MAX_ZOOM}
        }).addTo(map);

        var routePoints = ${safeJson(points.map(p => [p.lat, p.lng]))};
        var grouped = ${safeJson(groupedPoints)};
        var navProviders = ${safeJson(QUEST_NAV_PROVIDERS)};
        var theme = ${safeJson({
            primary: colors.primary,
            primaryDark: colors.primaryDark,
            warning: colors.warning,
            warningDark: colors.warningDark,
            text: colors.text,
            textOnPrimary: colors.textOnPrimary,
            routeLine: DESIGN_COLORS.routeLine,
        })};

        if (routePoints.length > 1) {
          L.polyline(routePoints, { color: theme.routeLine, weight: 4 }).addTo(map);
        }

        function iconFor(label, active) {
          var size = active ? 36 : 28;
          var fontSize = active ? 14 : 12;
          var bg = active ? theme.primary : theme.warning;
          var stroke = active ? theme.primaryDark : theme.warningDark;
          var color = active ? theme.textOnPrimary : theme.text;
          var html = '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:9999px;' +
            'background:' + bg + ';border:2px solid ' + stroke + ';color:' + color + ';' +
            'display:flex;align-items:center;justify-content:center;font-weight:800;' +
            'font-size:' + fontSize + 'px;line-height:1;padding:0 4px;' +
            'box-shadow:0 2px 6px rgba(0,0,0,.25)">' + label + '</div>';
          return L.divIcon({ className: 'qmark', html: html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
        }

        function navButtonsHtml(gp) {
          var buttons = navProviders.map(function (provider) {
            return '<button type="button" class="qnav-btn" data-app="' + provider.app +
              '" data-lat="' + gp.lat + '" data-lng="' + gp.lng + '" ' +
              'style="cursor:pointer;border:1px solid ' + theme.routeLine + ';background:#fff;color:' + theme.text +
              ';border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700;line-height:1">' +
              provider.label + '</button>';
          }).join('');
          return '<div style="margin-top:8px;font-size:12px;font-weight:700;color:' + theme.text +
            '">Довести меня</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;max-width:220px">' +
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
            lng: parseFloat(btn.getAttribute('data-lng'))
          }));
        });

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

        function postMapStatus(stage) {
          try {
            if (!window.ReactNativeWebView) return;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'quest-map-status',
              stage: stage,
              points: routePoints.length,
              expectedMarkers: grouped.length,
              markerNodes: document.querySelectorAll('.qmark').length,
              visibleMarkers: visibleMarkerCount()
            }));
          } catch (e) {}
        }

        window.__qmZoomIn = function () { try { map.zoomIn(); } catch (e) {} };
        window.__qmZoomOut = function () { try { map.zoomOut(); } catch (e) {} };

        window.setActiveStep = function (activeIndex) {
          grouped.forEach(function (gp, i) {
            var active = activeIndex != null && gp.indexes.indexOf(activeIndex + 1) !== -1;
            markers[i].setIcon(iconFor(gp.indexes.join(','), active));
          });
          if (activeIndex != null && routePoints[activeIndex]) {
            map.panTo(routePoints[activeIndex], { animate: true });
          }
        };

        // Подгонка границ. На Android WebView контейнер карты в момент выполнения
        // скрипта нередко имеет нулевую высоту (карта ниже сгиба / внутри Suspense),
        // поэтому одиночный fitBounds оставляет карту на zoom 0 (вид всего мира).
        // Повторяем fit после invalidateSize, пока контейнер не получит размер.
        function fitToRoute() {
          try {
            if (routePoints.length === 0) { map.setView([53.9, 27.56], 10); return; }
            map.invalidateSize();
            var size = map.getSize();
            if (!size || size.x === 0 || size.y === 0) return false;
            var bounds = L.latLngBounds(routePoints).pad(0.15);
            map.fitBounds(bounds, { animate: false });
            window.setTimeout(function () { postMapStatus('fit'); }, 50);
            return true;
          } catch (e) { return false; }
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
      </script>
    </body>
    </html>
  `, [points, groupedPoints, colors]);

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
        try {
            const data = JSON.parse(event.nativeEvent.data) as Partial<MarkerStatus> & {
                type?: string;
                app?: QuestMapApp;
                lat?: number;
                lng?: number;
            };
            if (data.type === 'quest-map-nav') {
                if (
                    data.app &&
                    Number.isFinite(data.lat) &&
                    Number.isFinite(data.lng)
                ) {
                    void openQuestMap({ lat: data.lat!, lng: data.lng! }, data.app);
                }
                return;
            }
            if (data.type !== 'quest-map-status') return;
            setMarkerStatus({
                expectedMarkers: Number(data.expectedMarkers) || groupedPoints.length,
                markerNodes: Number(data.markerNodes) || 0,
                visibleMarkers: Number(data.visibleMarkers) || 0,
            });
        } catch {
            // Ignore non-JSON WebView messages.
        }
    };

    const markersConfirmed =
        Boolean(markerStatus) &&
        markerStatus!.expectedMarkers > 0 &&
        markerStatus!.visibleMarkers >= markerStatus!.expectedMarkers;

    const handleZoom = (direction: 'in' | 'out') => {
        const fn = direction === 'in' ? '__qmZoomIn' : '__qmZoomOut';
        webViewRef.current?.injectJavaScript(`window.${fn} && window.${fn}(); true;`);
    };

    const shareAsGPX = async () => {
        try {
            const gpxFile = buildQuestOfflineMapGpx({ title, steps: points });
            const cacheDir = FileSystem.cacheDirectory ?? '';
            const fileUri = `${cacheDir}${gpxFile.filename}`;
            await FileSystem.writeAsStringAsync(fileUri, gpxFile.content);
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: gpxFile.mimeType,
                    dialogTitle: 'Поделиться маршрутом',
                });
            }
        } catch {
            Alert.alert('Экспорт', 'Не удалось поделиться GPX-файлом');
        }
    };

    const shareAsGeoJSON = async () => {
        try {
            const cacheDir = FileSystem.cacheDirectory ?? '';
            const fileUri = `${cacheDir}${title.replace(/\s+/g, '_')}.geojson`;
            await FileSystem.writeAsStringAsync(fileUri, buildGeoJSON(points));
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'application/geo+json',
                    dialogTitle: 'Поделиться маршрутом',
                });
            }
        } catch {
            Alert.alert('Экспорт', 'Не удалось поделиться GeoJSON-файлом');
        }
    };

    if (points.length === 0) {
        return (
            <View style={[styles.wrap, { height }]}>
                <Text style={styles.loadingText}>Нет точек маршрута для карты</Text>
            </View>
        );
    }

    return (
        <View style={[styles.wrap, { height }]}>
            <View style={styles.toolbar}>
                <Text style={styles.toolbarTitle} numberOfLines={1}>
                    {title}
                </Text>
                <View style={styles.toolbarActions}>
                    {allowFullscreen && (
                        <TouchableOpacity
                            style={styles.mobileMenuButton}
                            onPress={() => setFullscreenVisible(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Открыть карту квеста на весь экран"
                        >
                            <Feather name="maximize-2" size={18} color={colors.textOnPrimary} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={styles.mobileMenuButton}
                        onPress={() => setExportMenuVisible(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Скачать маршрут (PNG, GPX, GeoJSON)"
                    >
                        <Feather name="download" size={18} color={colors.textOnPrimary} />
                    </TouchableOpacity>
                </View>
            </View>

            {fullscreenVisible ? (
                <Modal
                    visible
                    transparent={false}
                    animationType="slide"
                    statusBarTranslucent
                    onRequestClose={() => setFullscreenVisible(false)}
                >
                    <View style={[styles.fullscreenModal, { paddingTop: insets.top }]}>
                        <View style={styles.fullscreenHeader}>
                            <Text style={styles.fullscreenTitle} numberOfLines={1}>{title}</Text>
                            <TouchableOpacity
                                style={styles.fullscreenClose}
                                onPress={() => setFullscreenVisible(false)}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                accessibilityRole="button"
                                accessibilityLabel="Закрыть полноэкранную карту квеста"
                            >
                                <Feather name="x" size={20} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <QuestFullMap
                            steps={steps}
                            height={fullscreenMapHeight}
                            title={title}
                            activeStepIndex={activeStepIndex}
                            allowFullscreen={false}
                        />
                    </View>
                </Modal>
            ) : null}

            <View
                style={styles.pointStatus}
                testID="quest-map-points-status"
                accessibilityLabel={
                    markersConfirmed
                        ? `${formatPointCount(points.length)} на карте`
                        : markerStatus && markerStatus.expectedMarkers > 0
                          ? 'Точки карты не отрисовались'
                          : `${formatPointCount(points.length)} загружаются на карту`
                }
            >
                <Feather
                    name={markersConfirmed ? 'map-pin' : 'loader'}
                    size={14}
                    color={markersConfirmed ? colors.primary : colors.textMuted}
                />
                <Text style={styles.pointStatusText} numberOfLines={1}>
                    {markersConfirmed
                        ? `${formatPointCount(points.length)} на карте`
                        : markerStatus && markerStatus.expectedMarkers > 0
                          ? 'Точки карты не отрисовались'
                          : `${formatPointCount(points.length)} загружаются на карту`}
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
                        <Text style={styles.modalTitle}>Экспорт маршрута</Text>
                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => {
                                setExportMenuVisible(false);
                                void shareAsGPX();
                            }}
                        >
                            <Text style={styles.modalOptionText}>Поделиться GPX</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => {
                                setExportMenuVisible(false);
                                void shareAsGeoJSON();
                            }}
                        >
                            <Text style={styles.modalOptionText}>Поделиться GeoJSON</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalOption, styles.cancelOption]}
                            onPress={() => setExportMenuVisible(false)}
                        >
                            <Text style={styles.cancelOptionText}>Отмена</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <View style={styles.mapBox}>
                {isLoading && (
                    <View style={styles.loader}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Загрузка карты...</Text>
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
                    scrollEnabled
                />
                <View style={styles.zoomControls} pointerEvents="box-none">
                    <TouchableOpacity
                        style={styles.zoomButton}
                        onPress={() => handleZoom('in')}
                        accessibilityRole="button"
                        accessibilityLabel="Приблизить карту"
                    >
                        <Text style={styles.zoomButtonText}>+</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.zoomButton}
                        onPress={() => handleZoom('out')}
                        accessibilityRole="button"
                        accessibilityLabel="Отдалить карту"
                    >
                        <Text style={styles.zoomButtonText}>−</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.touchHints}>
                <Text style={styles.hintText}>↕️ Двумя пальцами для масштабирования</Text>
            </View>
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
        fullscreenHeader: {
            minHeight: 56,
            paddingHorizontal: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        fullscreenTitle: {
            flex: 1,
            color: colors.text,
            fontSize: 16,
            fontWeight: '800',
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
