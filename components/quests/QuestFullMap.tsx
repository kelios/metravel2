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
import { buildQuestOfflineMapGpx } from './questOfflineMapExport';
import { openQuestMap, type QuestMapApp } from './questWizardHelpers';
import {
    getNavigationActionVisual,
    NAVIGATION_ACTION_LABELS,
} from '@/components/navigation/navigationActionMeta';

const QUEST_NAV_PROVIDERS: Array<{ app: QuestMapApp; kind: 'google' | 'organic' | 'waze' | 'yandex' | 'osm' }> = [
    { app: 'google', kind: 'google' },
    { app: 'organic', kind: 'organic' },
    { app: 'waze', kind: 'waze' },
    { app: 'yandex', kind: 'yandex' },
    { app: 'osm', kind: 'osm' },
];

type StepPoint = { lat: number; lng: number; title?: string };

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

// n теперь может быть числом или строкой "1,2"
function numberIcon(L: any, n: number | string, colors: ThemedColors, active = false) {
    const bg = active ? colors.primary : colors.warning;
    const stroke = active ? colors.primaryDark : colors.warningDark;
    const textColor = active ? colors.textOnPrimary : colors.text;
    const shadow = colors.boxShadows.light ?? '0 2px 6px rgba(0,0,0,.25)';
    const size = active ? 36 : 28;
    const fontSize = active ? 14 : 12;
    const ring = active
        ? `<div style="position:absolute;inset:-6px;border-radius:9999px;border:2px solid ${colors.primary};opacity:0.4;animation:qpulse 1.8s ease-in-out infinite"></div>`
        : '';
    const html = `
    <div style="position:relative;width:${size}px;height:${size}px">
      ${ring}
      <div style="
        width:${size}px;height:${size}px;border-radius:9999px;
        background:${bg};border:2px solid ${stroke};
        color:${textColor};display:flex;align-items:center;justify-content:center;
        font-weight:800;font-size:${fontSize}px;line-height:1;box-shadow:${shadow};
        padding:0 4px;position:relative;z-index:1
      ">${String(n)}</div>
    </div>`;
    const half = size / 2;
    return L.divIcon({ className: 'qmark', html, iconSize: [size, size], iconAnchor: [half, half] });
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
        throw new Error('Не удалось загрузить dom-to-image из CDN');
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
    const [mods, setMods] = useState<Mods | null>(null);
    const [exportMenuVisible, setExportMenuVisible] = useState(false);
    const [fullscreenVisible, setFullscreenVisible] = useState(false);
    const mapDivRef = useRef<HTMLDivElement | null>(null);
    const insets = useSafeAreaInsets();
    const { height: viewportHeight } = useWindowDimensions();
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const fullscreenMapHeight = Math.max(360, Math.round(viewportHeight - 72));
    const bounds = useMemo(() => {
        if (!steps?.length) return undefined;
        const coords = steps
            .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
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
        () => steps.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng)),
        [steps]
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
    const groupedPoints = useMemo(() => {
        type GP = { lat: number; lng: number; indexes: number[]; titles: string[] };
        const map = new Map<string, GP>();
        points.forEach((p, i) => {
            const key = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
            if (!map.has(key)) {
                map.set(key, {
                    lat: p.lat,
                    lng: p.lng,
                    indexes: [i + 1],
                    titles: [p.title || `Точка ${i + 1}`],
                });
            } else {
                const gp = map.get(key)!;
                gp.indexes.push(i + 1);
                gp.titles.push(p.title || `Точка ${i + 1}`);
            }
        });
        // стабильный порядок для консистентности
        return Array.from(map.values()).sort(
            (a, b) => Math.min(...a.indexes) - Math.min(...b.indexes)
        );
    }, [points]);

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
                Alert.alert('Требуется разрешение', 'Разрешите доступ к галерее для сохранения изображения');
                return;
            }

            Alert.alert('Экспорт', 'Функция экспорта PNG на мобильных устройствах в разработке');
        } catch (error) {
            console.error('Error sharing PNG:', error);
        }
    };

    const shareAsGPX = async () => {
        try {
            if (Platform.OS === 'web') {
                exportGPX();
                return;
            }

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
        } catch (error) {
            console.error('Error sharing GPX:', error);
        }
    };

    const shareAsGeoJSON = async () => {
        try {
            if (Platform.OS === 'web') {
                exportGeoJSON();
                return;
            }

            const geoJsonContent = buildGeoJSON(points);
            const cacheDir = FileSystem.cacheDirectory ?? '';
            const fileUri = `${cacheDir}${title.replace(/\s+/g, '_')}.geojson`;

            await FileSystem.writeAsStringAsync(fileUri, geoJsonContent);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'application/geo+json',
                    dialogTitle: 'Поделиться маршрутом',
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

    const exportGPX = () => {
        const file = buildQuestOfflineMapGpx({ title, steps: points });
        downloadText(file.filename, file.content, file.mimeType);
    };
    const exportGeoJSON = () =>
        downloadText(`${title.replace(/\s+/g, '_')}.geojson`, buildGeoJSON(points), 'application/geo+json');

    if (!mods || points.length === 0) {
        return (
            <View style={[styles.wrap, { height }]}>
                <Text style={styles.loadingText}>Загрузка карты...</Text>
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
            <View style={[styles.toolbar, { paddingTop: insets.top + 8 }]}>
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

            {fullscreenVisible
                ? renderFullscreenOverlay(
                      <View style={[styles.fullscreenOverlay, { paddingTop: insets.top }]} pointerEvents="auto">
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
                        <Text style={styles.modalTitle}>Экспорт маршрута</Text>

                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => {
                                setExportMenuVisible(false);
                                shareAsPNG();
                            }}
                        >
                            <Text style={styles.modalOptionText}>Сохранить как PNG</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => {
                                setExportMenuVisible(false);
                                shareAsGPX();
                            }}
                        >
                            <Text style={styles.modalOptionText}>Поделиться GPX</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => {
                                setExportMenuVisible(false);
                                shareAsGeoJSON();
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

                    {/* Линия по исходным точкам, чтобы сохранить порядок маршрута */}
                    <Polyline
                        positions={points.map(p => [p.lat, p.lng])}
                        pathOptions={{ color: DESIGN_COLORS.routeLine, weight: 4 }}
                    />

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
                                        <Text style={styles.popupNavLabel}>Довести меня</Text>
                                        <View style={styles.popupNavGrid}>
                                            {QUEST_NAV_PROVIDERS.map(provider => {
                                                const visual = getNavigationActionVisual(provider.kind, colors);
                                                const label = provider.app === 'yandex'
                                                    ? 'Яндекс'
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
                                                        accessibilityLabel={`Открыть точку в ${NAVIGATION_ACTION_LABELS[provider.kind]}`}
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
                    <Text style={styles.hintText}>↕️ Двумя пальцами для масштабирования</Text>
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
