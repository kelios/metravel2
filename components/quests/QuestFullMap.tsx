// components/quests/QuestFullMap.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    View,
    StyleSheet,
    Platform,
    Text,
    TouchableOpacity,
    Modal,
    Alert,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { DESIGN_COLORS } from '@/constants/designSystem';
import { buildQuestOfflineMapGeoJSON, buildQuestOfflineMapGpx } from './questOfflineMapExport';
import { buildQuestWalkingRouteGeometry } from './questRouteGeometry';
import { hasRoutedQuestTrack, useQuestRouteGeometry, type QuestRouteGeometryState } from './useQuestRouteGeometry';
import {
    groupQuestStepPoints,
    normalizeQuestStepPoints,
    type QuestStepPoint,
} from './questMapPoints';
import { openQuestMap, type QuestMapApp } from './questWizardHelpers';
import {
    getNavigationActionVisual,
    NAVIGATION_ACTION_LABELS,
} from '@/components/navigation/navigationActionMeta';
import { translate as i18nT } from '@/i18n'


const QUEST_NAV_PROVIDERS: Array<{ app: QuestMapApp; kind: 'google' | 'organic' | 'waze' | 'yandex' | 'osm' }> = [
    { app: 'google', kind: 'google' },
    { app: 'organic', kind: 'organic' },
    { app: 'waze', kind: 'waze' },
    { app: 'yandex', kind: 'yandex' },
    { app: 'osm', kind: 'osm' },
];

type Mods = {
    L: any;
    MapContainer: any;
    TileLayer: any;
    Marker: any;
    Polyline: any;
    Popup: any;
    FeatureGroup: any;
    useMap: () => any;
};

const formatRouteDistance = (meters: number) => {
    if (!Number.isFinite(meters) || meters <= 0) return null;
    if (meters < 1000) return i18nT('quests:components.quests.QuestFullMap.value1_m_fd529197', { value1: Math.round(meters) });
    return i18nT('quests:components.quests.QuestFullMap.value1_km_e6f90e2a', { value1: (meters / 1000).toFixed(meters < 10000 ? 1 : 0) });
};

const getRouteStatusText = (route: QuestRouteGeometryState) => {
    if (route.status === 'loading') return i18nT('quests:components.quests.QuestFullMap.stroim_peshiy_marshrut_po_dorozhkam_db0b0939');
    if (hasRoutedQuestTrack(route.track, route.source)) {
        const distance = formatRouteDistance(route.distanceM);
        return distance ? i18nT('quests:components.quests.QuestFullMap.peshiy_marshrut_gotov_value1_679a9da1', { value1: distance }) : i18nT('quests:components.quests.QuestFullMap.peshiy_marshrut_gotov_01c8c350');
    }
    if (route.status === 'fallback') return i18nT('quests:components.quests.QuestFullMap.marshrutizator_nedostupen_pokazana_priblizit_ec750b6f');
    return i18nT('quests:components.quests.QuestFullMap.dobavte_minimum_dve_tochki_dlya_marshruta_7b40ac4f');
};

// n теперь может быть числом или строкой "1,2"
function numberIcon(L: any, n: number | string, colors: ThemedColors, active = false) {
    const bg = active ? colors.primary : colors.surface;
    const stroke = active ? colors.primaryDark : colors.primary;
    const textColor = active ? colors.textOnPrimary : colors.primaryDark;
    const shadow = colors.boxShadows.medium ?? colors.boxShadows.light ?? '0 8px 18px rgba(0,0,0,.22)';
    const size = active ? 40 : 34;
    const dotSize = active ? 30 : 26;
    const fontSize = active ? 14 : 13;
    const ring = active
        ? `<div style="position:absolute;inset:-7px;border-radius:9999px;border:2px solid ${colors.primary};opacity:0.45;animation:qpulse 1.8s ease-in-out infinite"></div>`
        : '';
    const html = `
    <div style="position:relative;width:${size}px;height:${size}px">
      ${ring}
      <div style="
        width:${size}px;height:${size}px;border-radius:9999px;
        background:${colors.surface};border:2px solid ${colors.surface};
        display:flex;align-items:center;justify-content:center;
        box-shadow:${shadow};position:relative;z-index:1
      ">
        <div style="
          width:${dotSize}px;height:${dotSize}px;border-radius:9999px;
          background:${bg};border:2px solid ${stroke};
          color:${textColor};display:flex;align-items:center;justify-content:center;
          font-weight:800;font-size:${fontSize}px;line-height:1;padding:0 4px;
        ">${String(n)}</div>
      </div>
      <div style="
        position:absolute;left:50%;bottom:-2px;width:10px;height:10px;
        background:${colors.surface};border-right:2px solid ${colors.surface};
        border-bottom:2px solid ${colors.surface};transform:translateX(-50%) rotate(45deg);
        box-shadow:${shadow};z-index:0
      "></div>
    </div>`;
    const half = size / 2;
    return L.divIcon({ className: 'qmark', html, iconSize: [size, size], iconAnchor: [half, half] });
}

function downloadText(filename: string, text: string, type = 'text/plain') {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

async function ensureDomToImage(): Promise<any> {
    const w = window as any;
    if (w.domtoimage) return w.domtoimage;

    if (!(ensureDomToImage as any)._loader) {
        (ensureDomToImage as any)._loader = new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/dom-to-image-more@3.3.0/dist/dom-to-image-more.min.js';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = (err) => {
                (ensureDomToImage as any)._loader = null;
                reject(err);
            };
            document.body.appendChild(script);
        });
    }

    await (ensureDomToImage as any)._loader;

    if (!w.domtoimage) {
        (ensureDomToImage as any)._loader = null;
        throw new Error(i18nT('quests:components.quests.QuestFullMap.ne_udalos_zagruzit_dom_to_image_iz_cdn_8179dcf1'));
    }

    return w.domtoimage;
}

// На web RN-Web ScrollView-предок может иметь transform → position:fixed
// привязывается к нему, а не к вьюпорту, и кнопка закрытия уезжает за экран.
// Портал в document.body выносит оверлей из трансформированного контекста.
function renderFullscreenOverlay(node: React.ReactNode): React.ReactNode {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
        return createPortal(node, document.body);
    }
    return node;
}

function QuestFullMap({
                                         steps,
                                         height = 520,
                                         title = i18nT('quests:components.quests.QuestFullMap.karta_kvesta_8aa1d381'),
                                         activeStepIndex,
                                         allowFullscreen = true,
                                         onClose,
                                         // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                         interactive = true,
                                     }: {
    steps: QuestStepPoint[];
    height?: number;
    title?: string;
    activeStepIndex?: number;
    allowFullscreen?: boolean;
    onClose?: () => void;
    interactive?: boolean;
}) {
    const [mods, setMods] = useState<Mods | null>(null);
    const [exportMenuVisible, setExportMenuVisible] = useState(false);
    const [fullscreenVisible, setFullscreenVisible] = useState(false);
    const mapDivRef = useRef<HTMLDivElement | null>(null);
    const insets = useSafeAreaInsets();
    const { height: viewportHeight } = useWindowDimensions();
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const fullscreenMapHeight = Math.max(360, Math.round(viewportHeight - insets.top));
    const bounds = useMemo(() => {
        if (!steps?.length) return undefined;
        const coords = normalizeQuestStepPoints(steps)
            .map(p => [p.lat, p.lng] as [number, number]);
        return coords.length ? coords : undefined;
    }, [steps]);
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (!document.getElementById('qpulse-style')) {
            const style = document.createElement('style');
            style.id = 'qpulse-style';
            style.textContent = '@keyframes qpulse{0%,100%{transform:scale(1);opacity:.4}50%{transform:scale(1.3);opacity:.15}}';
            document.head.appendChild(style);
        }
    }, []);

    useEffect(() => {
        if (Platform.OS !== 'web' || !fullscreenVisible) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setFullscreenVisible(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [fullscreenVisible]);

    useEffect(() => {
        if (Platform.OS !== 'web') return;

        let cancelled = false;
        (async () => {
            try {
                const { ensureLeafletCss } = await import('@/utils/ensureLeafletCss');
                await ensureLeafletCss();
                const { loadLeafletRuntime } = await import('@/utils/loadLeafletRuntime');
                const { L, RL } = await loadLeafletRuntime();
                if (cancelled) return;
                setMods({
                    L,
                    MapContainer: RL.MapContainer,
                    TileLayer: RL.TileLayer,
                    Marker: RL.Marker,
                    Polyline: RL.Polyline,
                    Popup: RL.Popup,
                    FeatureGroup: RL.FeatureGroup,
                    useMap: RL.useMap,
                });
            } catch (error) {
                console.error('Error loading map modules:', error);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const points = useMemo(
        () => normalizeQuestStepPoints(steps),
        [steps]
    );
    const routeGeometry = useQuestRouteGeometry(points);
    const routeIsRouted = hasRoutedQuestTrack(routeGeometry.track, routeGeometry.source);
    const routeStatusText = getRouteStatusText(routeGeometry);
    const routeLineTrack = routeGeometry.track.length >= 2
        ? routeGeometry.track
        : points.map(point => [point.lng, point.lat] as [number, number]);
    const routeLinePositions = useMemo(
        () => routeLineTrack.map(([lng, lat]) => [lat, lng] as [number, number]),
        [routeLineTrack]
    );

    // Стабильный ключ для зависимостей эффектов: меняется только при реальном
    // изменении набора/границ точек, а не при смене ссылки массива steps.
    const pointsKey = useMemo(() => {
        if (points.length === 0) return '';
        const first = points[0];
        const last = points[points.length - 1];
        return `${points.length}:${first.lat},${first.lng}:${last.lat},${last.lng}`;
    }, [points]);

    // Группировка совпадающих координат
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

    // Mobile-specific export functions
    const shareAsPNG = async () => {
        try {
            if (Platform.OS === 'web') {
                exportPNG();
                return;
            }

            // expo-media-library — native-only: lazy require внутри native-ветки
            // (после web-return выше), иначе top-level import инициализирует
            // ExpoMediaLibraryNext и валит web-бандл в рантайме.
            const MediaLibrary = require('expo-media-library') as typeof import('expo-media-library');
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(i18nT('quests:components.quests.QuestFullMap.trebuetsya_razreshenie_fb33c81f'), i18nT('quests:components.quests.QuestFullMap.razreshite_dostup_k_galeree_dlya_sohraneniya_72af3496'));
                return;
            }

            Alert.alert(i18nT('quests:components.quests.QuestFullMap.eksport_a573001b'), i18nT('quests:components.quests.QuestFullMap.funktsiya_eksporta_png_na_mobilnyh_ustroystv_38234d18'));
        } catch (error) {
            console.error('Error sharing PNG:', error);
        }
    };

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
                Alert.alert(i18nT('quests:components.quests.QuestFullMap.eksport_gpx_c785ac18'), i18nT('quests:components.quests.QuestFullMap.ne_udalos_postroit_realnyy_peshiy_marshrut_s_590dfe0b'));
                return;
            }

            if (Platform.OS === 'web') {
                exportGPX(routedTrack);
                return;
            }

            const gpxFile = buildQuestOfflineMapGpx({ title, steps: points, routeTrack: routedTrack, routeSource: 'routed' });
            const cacheDir = FileSystem.cacheDirectory ?? '';
            const fileUri = `${cacheDir}${gpxFile.filename}`;

            await FileSystem.writeAsStringAsync(fileUri, gpxFile.content);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: gpxFile.mimeType,
                    dialogTitle: i18nT('quests:components.quests.QuestFullMap.podelitsya_marshrutom_f0d2e5de'),
                });
            }
        } catch (error) {
            console.error('Error sharing GPX:', error);
        }
    };

    const shareAsGeoJSON = async () => {
        try {
            const routedTrack = await resolveRoutedTrackForExport();
            if (!routedTrack) {
                Alert.alert(i18nT('quests:components.quests.QuestFullMap.eksport_geojson_763e0f06'), i18nT('quests:components.quests.QuestFullMap.ne_udalos_postroit_realnyy_peshiy_marshrut_s_4748c560'));
                return;
            }

            if (Platform.OS === 'web') {
                exportGeoJSON(routedTrack);
                return;
            }

            const geoJsonContent = buildQuestOfflineMapGeoJSON({ title, steps: points, routeTrack: routedTrack, routeSource: 'routed' });
            const cacheDir = FileSystem.cacheDirectory ?? '';
            const fileUri = `${cacheDir}${title.replace(/\s+/g, '_')}.geojson`;

            await FileSystem.writeAsStringAsync(fileUri, geoJsonContent);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'application/geo+json',
                    dialogTitle: i18nT('quests:components.quests.QuestFullMap.podelitsya_marshrutom_f0d2e5de'),
                });
            }
        } catch (error) {
            console.error('Error sharing GeoJSON:', error);
        }
    };

    const exportPNG = async () => {
        try {
            const domtoimage = await ensureDomToImage();
            const node = mapDivRef.current;
            if (!node) return;
            const dataUrl = await (domtoimage as any).toPng(node, { quality: 1 });
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `${title.replace(/\s+/g, '_')}.png`;
            a.click();
        } catch {
            window.print();
        }
    };

    const exportGPX = (routedTrack: [number, number][]) => {
        const file = buildQuestOfflineMapGpx({ title, steps: points, routeTrack: routedTrack, routeSource: 'routed' });
        downloadText(file.filename, file.content, file.mimeType);
    };
    const exportGeoJSON = (routedTrack: [number, number][]) =>
        downloadText(
            `${title.replace(/\s+/g, '_')}.geojson`,
            buildQuestOfflineMapGeoJSON({ title, steps: points, routeTrack: routedTrack, routeSource: 'routed' }),
            'application/geo+json'
        );

    if (!mods || points.length === 0) {
        return (
            <View style={[styles.wrap, { height }]}>
                <Text style={styles.loadingText}>{i18nT('quests:components.quests.QuestFullMap.zagruzka_karty_a7d37b43')}</Text>
            </View>
        );
    }

    const { L, MapContainer, TileLayer, Marker, Polyline, Popup, FeatureGroup, useMap } = mods;

    // Безопасное подгоняние границ
    const FitBounds: React.FC<{ fitKey: string }> = ({ fitKey }) => {
        const map = useMap();

        useEffect(() => {
            if (!map) return;

            const fit = () => {
                try {
                    const container: HTMLElement | undefined = map.getContainer?.();
                    if (!container || !container.isConnected) return;

                    const { clientWidth, clientHeight } = container;
                    if (!clientWidth || !clientHeight) return;

                    // Фильтруем точки с валидными координатами
                    const validPoints = points.filter(p =>
                        Number.isFinite(p.lat) &&
                        Number.isFinite(p.lng) &&
                        p.lat >= -90 && p.lat <= 90 &&
                        p.lng >= -180 && p.lng <= 180
                    );

                    if (validPoints.length === 0) return;

                    const nextBounds = L.latLngBounds(validPoints.map(p => [p.lat, p.lng] as [number, number])).pad(0.15);
                    if (!nextBounds.isValid()) return;

                    const current = map.getBounds?.();
                    const already = current && current.contains(nextBounds) && nextBounds.contains(current);

                    if (!already) {
                        map.fitBounds(nextBounds, { animate: false });
                    }

                    requestAnimationFrame(() => {
                        try {
                            const c = map.getContainer?.();
                            if (c && c.isConnected) map.invalidateSize();
                        } catch { /* pane not ready */ }
                    });
                } catch { /* map not ready */ }
            };

            // Задержка, чтобы Leaflet успел инициализировать mapPane
            const timer = setTimeout(() => {
                map.whenReady(fit);
            }, 100);

            return () => clearTimeout(timer);
        }, [map, fitKey]);

        return null;
    };

    // Автоцентрирование на активный шаг при смене
    const PanToActive: React.FC<{ index?: number }> = ({ index }) => {
        const map = useMap();
        const prevIndex = useRef<number | undefined>(undefined);

        useEffect(() => {
            if (index == null || !map) {
                prevIndex.current = index ?? undefined;
                return;
            }
            if (index === prevIndex.current) {
                return;
            }
            prevIndex.current = index;

            const pt = points[index];
            if (!pt || !Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) return;

            try {
                map.panTo([pt.lat, pt.lng], { animate: true, duration: 0.4 });
            } catch { /* map not ready */ }
        }, [index, map]);

        return null;
    };

    return (
        <View style={[styles.wrap, { height }]}>
            {/* Mobile-friendly toolbar */}
            <View
                style={[styles.toolbar, { paddingTop: insets.top + 8 }]}
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
                            accessibilityLabel={i18nT('quests:components.quests.QuestFullMap.otkryt_kartu_kvesta_na_ves_ekran_50d6d221')}
                        >
                            <Feather name="maximize-2" size={18} color={colors.textOnPrimary} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={styles.mobileMenuButton}
                        onPress={() => setExportMenuVisible(true)}
                        accessibilityRole="button"
                        accessibilityLabel={i18nT('quests:components.quests.QuestFullMap.skachat_marshrut_png_gpx_geojson_79e8c69f')}
                    >
                        <Feather name="download" size={18} color={colors.textOnPrimary} />
                    </TouchableOpacity>
                    {onClose && (
                        <TouchableOpacity
                            style={styles.fullscreenClose}
                            onPress={onClose}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            accessibilityRole="button"
                            accessibilityLabel={i18nT('quests:components.quests.QuestFullMap.zakryt_polnoekrannuyu_kartu_kvesta_9c32a17c')}
                        >
                            <Feather name="x" size={20} color={colors.text} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

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

            {fullscreenVisible
                ? renderFullscreenOverlay(
                      <View style={styles.fullscreenOverlay} pointerEvents="auto">
                          <QuestFullMap
                              steps={steps}
                              height={fullscreenMapHeight}
                              title={title}
                              activeStepIndex={activeStepIndex}
                              allowFullscreen={false}
                              onClose={() => setFullscreenVisible(false)}
                          />
                      </View>
                  )
                : null}

            {/* Mobile export menu modal */}
            <Modal
                visible={exportMenuVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setExportMenuVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setExportMenuVisible(false)}
                >
                    <View style={[styles.modalContent, { bottom: insets.bottom }]}>
                        <Text style={styles.modalTitle}>{i18nT('quests:components.quests.QuestFullMap.eksport_marshruta_4db5c962')}</Text>

                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => {
                                setExportMenuVisible(false);
                                shareAsPNG();
                            }}
                        >
                            <Text style={styles.modalOptionText}>{i18nT('quests:components.quests.QuestFullMap.sohranit_kak_png_923a1779')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => {
                                setExportMenuVisible(false);
                                shareAsGPX();
                            }}
                        >
                            <Text style={styles.modalOptionText}>{i18nT('quests:components.quests.QuestFullMap.podelitsya_gpx_781eaf8e')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => {
                                setExportMenuVisible(false);
                                shareAsGeoJSON();
                            }}
                        >
                            <Text style={styles.modalOptionText}>{i18nT('quests:components.quests.QuestFullMap.podelitsya_geojson_36af5ef4')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modalOption, styles.cancelOption]}
                            onPress={() => setExportMenuVisible(false)}
                        >
                            <Text style={styles.cancelOptionText}>{i18nT('quests:components.quests.QuestFullMap.otmena_0f9f0745')}</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <View ref={mapDivRef as any} style={styles.mapBox} {...{ 'data-quest-map': 'true' } as any}>
                <MapContainer
                    bounds={bounds}
                    style={styles.map}
                    scrollWheelZoom={false}
                    zoomControl={Platform.OS === 'web'}
                    dragging={Platform.OS === 'web'}
                    touchZoom={true}
                    doubleClickZoom={false}
                >
                    <FitBounds fitKey={pointsKey} />
                    <PanToActive index={activeStepIndex} />
                    <TileLayer
                        attribution="&copy; OpenStreetMap"
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {routeLinePositions.length >= 2 && (
                        <>
                            <Polyline
                                positions={routeLinePositions}
                                pathOptions={{
                                    color: colors.surface,
                                    weight: routeIsRouted ? 9 : 7,
                                    opacity: 0.92,
                                    lineCap: 'round',
                                    lineJoin: 'round',
                                } as any}
                            />
                            <Polyline
                                positions={routeLinePositions}
                                pathOptions={{
                                    color: routeIsRouted ? DESIGN_COLORS.routeLine : colors.warningDark,
                                    weight: routeIsRouted ? 5 : 4,
                                    opacity: routeIsRouted ? 0.96 : 0.78,
                                    dashArray: routeIsRouted ? undefined : '8 10',
                                    lineCap: 'round',
                                    lineJoin: 'round',
                                } as any}
                            />
                        </>
                    )}

                    {/* Маркеры по сгруппированным координатам */}
                    <FeatureGroup>
                        {groupedPoints.map((gp, idx) => (
                            <Marker
                                key={`${gp.lat}-${gp.lng}-${idx}`}
                                position={[gp.lat, gp.lng]}
                                icon={numberIcon(
                                    L,
                                    gp.indexes.join(','),
                                    colors,
                                    activeStepIndex != null && gp.indexes.includes(activeStepIndex + 1),
                                )}
                            >
                                <Popup>
                                    <View style={{ minWidth: 200 }}>
                                        <Text style={styles.popupTitle}>
                                            {gp.indexes.join(', ')}.
                                        </Text>
                                        <Text style={styles.popupCoords}>
                                            {gp.lat.toFixed(6)}, {gp.lng.toFixed(6)}
                                        </Text>
                                        <Text style={[styles.popupCoords, { marginTop: 6 }]}>
                                            {gp.titles.join(', ')}
                                        </Text>
                                        <Text style={styles.popupNavLabel}>{i18nT('quests:components.quests.QuestFullMap.dovesti_menya_cbcbe1c8')}</Text>
                                        <View style={styles.popupNavGrid}>
                                            {QUEST_NAV_PROVIDERS.map(provider => {
                                                const visual = getNavigationActionVisual(provider.kind, colors);
                                                const label = provider.app === 'yandex'
                                                    ? i18nT('quests:components.quests.QuestFullMap.yandeks_c620dc06')
                                                    : NAVIGATION_ACTION_LABELS[provider.kind];
                                                return (
                                                    <TouchableOpacity
                                                        key={provider.app}
                                                        style={styles.popupNavChip}
                                                        onPress={() => {
                                                            void openQuestMap(
                                                                { lat: gp.lat, lng: gp.lng, title: gp.titles[0] },
                                                                provider.app,
                                                            );
                                                        }}
                                                        accessibilityRole="button"
                                                        accessibilityLabel={i18nT('quests:components.quests.QuestFullMap.otkryt_tochku_v_value1_067707f1', { value1: NAVIGATION_ACTION_LABELS[provider.kind] })}
                                                    >
                                                        <View style={[styles.popupNavIcon, { backgroundColor: visual.tintBg }]}>
                                                            <Feather name={visual.icon} size={13} color={visual.iconColor} />
                                                        </View>
                                                        <Text style={styles.popupNavChipText} numberOfLines={1}>
                                                            {label}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </View>
                                </Popup>
                            </Marker>
                        ))}
                    </FeatureGroup>
                </MapContainer>
            </View>

            {/* Mobile touch hints */}
            {Platform.OS !== 'web' && (
                <View style={styles.touchHints}>
                    <Text style={styles.hintText}>{i18nT('quests:components.quests.QuestFullMap.dvumya_paltsami_dlya_masshtabirovaniya_3dd61e24')}</Text>
                </View>
            )}
        </View>
    );
}

const createStyles = (colors: ThemedColors) => StyleSheet.create({
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
    webButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    toolbarActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
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
        color: colors.text,
        fontSize: 13,
        fontWeight: '600',
    },
    btn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: colors.primary,
    },
    btnTxt: {
        color: colors.textOnPrimary,
        fontWeight: '600',
        fontSize: 12,
    },
    mobileMenuButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fullscreenOverlay: {
        ...(Platform.OS === 'web'
            ? ({ position: 'fixed' } as any)
            : { position: 'absolute' }),
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
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
        minHeight: 420,
    },
    map: {
        width: '100%',
        height: '100%',
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
    popupTitle: {
        fontWeight: 'bold',
        fontSize: 14,
        marginBottom: 4,
        color: colors.text,
    },
    popupCoords: {
        fontSize: 12,
        color: colors.textMuted,
    },
    popupNavLabel: {
        marginTop: 10,
        marginBottom: 6,
        fontSize: 12,
        fontWeight: '700',
        color: colors.text,
    },
    popupNavGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    popupNavChip: {
        flexGrow: 1,
        flexBasis: '30%',
        minWidth: 86,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.borderLight,
        backgroundColor: colors.surface,
        ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    popupNavIcon: {
        width: 22,
        height: 22,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    popupNavChipText: {
        flexShrink: 1,
        fontSize: 12,
        fontWeight: '700',
        color: colors.text,
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
