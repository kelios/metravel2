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
import { buildQuestOfflineMapGeoJSON, buildQuestOfflineMapGpx } from './questOfflineMapExport';
import { buildQuestWalkingRouteGeometry } from './questRouteGeometry';
import { hasRoutedQuestTrack, useQuestRouteGeometry, type QuestRouteGeometryState } from './useQuestRouteGeometry';
import { saveAndShareQuestMapPng } from './questNativeMapPng';
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
import { buildQuestNativeMapHtml } from './questNativeMapHtml';
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

    const htmlContent = useMemo(
        () => buildQuestNativeMapHtml({
            points,
            routeLineTrack,
            routeIsRouted,
            groupedPoints,
            colors,
            interactive,
            questNavProviders,
        }),
        [points, routeLineTrack, routeIsRouted, groupedPoints, colors, interactive, questNavProviders],
    );

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
