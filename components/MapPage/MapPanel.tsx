import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Platform, Text, ActivityIndicator } from 'react-native';
import { useLazyMap } from '@/hooks/useLazyMap';
import { useThemedColors } from '@/hooks/useTheme';
import MapErrorBoundary from './MapErrorBoundary';
import { MapSkeleton } from '@/components/SkeletonLoader';
import { useDeferredMapLoad } from './MapOptimizations';
import type { MapUiApi } from '@/src/types/mapUi';

type LatLng = { latitude: number; longitude: number };

interface MapPanelProps {
    travelsData: any[];
    coordinates: LatLng | null;
    routePoints?: [number, number][];
    placesAlongRoute?: any[];
    mode?: 'radius' | 'route';
    setRoutePoints?: (points: [number, number][]) => void;
    onMapClick?: (lng: number, lat: number) => void;
    transportMode?: 'car' | 'bike' | 'foot';
    setRouteDistance: (distance: number) => void;
    setRouteDuration?: (durationSeconds: number) => void;
    setFullRouteCoords: (coords: [number, number][]) => void;
    radius?: string; // Радиус поиска в км
    onMapUiApiReady?: (api: MapUiApi | null) => void;
}

/** Плейсхолдер для нативных платформ или во время загрузки карты */
function Placeholder({ text = 'Карта доступна только в браузере', showSkeleton = false }: { text?: string; showSkeleton?: boolean }) {
    const themeColors = useThemedColors();

    if (showSkeleton) {
        return (
            <View style={[styles.placeholder, { backgroundColor: themeColors.surface }]}>
                <MapSkeleton />
            </View>
        );
    }

    return (
        <View style={[styles.placeholder, { backgroundColor: themeColors.surface }]}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text style={[styles.placeholderText, { color: themeColors.textMuted }]}>{text}</Text>
        </View>
    );
}

const MapPanel: React.FC<MapPanelProps> = ({
                                               travelsData,
                                               coordinates,
                                               routePoints = [],
                                               placesAlongRoute = [],
                                               mode = 'radius',
                                               setRoutePoints = () => {},
                                               onMapClick = () => {},
                                               transportMode = 'car',
                                               setRouteDistance,
                                               setRouteDuration,
                                               setFullRouteCoords,
                                               radius,
                                               onMapUiApiReady,
	                                           }) => {
	    const [hydrated, setHydrated] = useState(false);
    const isWeb = Platform.OS === 'web' && hydrated;
    const isE2E = String(process.env.EXPO_PUBLIC_E2E || '').toLowerCase() === 'true';
    const themeColors = useThemedColors();

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        setHydrated(true);
    }, []);

	    // ✅ ОПТИМИЗАЦИЯ: Отложенная загрузка карты для улучшения Lighthouse score
	    const shouldDeferLoad = useDeferredMapLoad(isWeb && !isE2E);

	    // ✅ ИСПРАВЛЕНИЕ: Уникальный ключ для карты без недетерминированного SSR
    const [mapKeyVersion, setMapKeyVersion] = useState(0);

	    // ✅ УЛУЧШЕНИЕ: Ленивая загрузка карты с Intersection Observer
	    const { shouldLoad, setElementRef } = useLazyMap({
	        rootMargin: '200px',
	        threshold: 0.1,
	        // In e2e we always load immediately to avoid flaky IntersectionObserver behavior.
	        enabled: isWeb && shouldDeferLoad && !isE2E,
	    });

    // Динамически импортируем веб-карту, только в браузере и когда нужно
    const [WebMap, setWebMap] = useState<React.ComponentType<any> | null>(null);
    const [loading, setLoading] = useState(isWeb && shouldLoad && shouldDeferLoad);

    useEffect(() => {
        let mounted = true;
        if (!isWeb || !shouldLoad) return;

        (async () => {
            try {
                const mod = await import('@/components/MapPage/Map');
                if (mounted) setWebMap(() => (mod.default ?? mod as any));
            } catch (e) {
                console.error('[MapPanel] Failed to load web map:', e);
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [isWeb, shouldLoad]);

    const travelProp = useMemo(() => ({ data: travelsData }), [travelsData]);

    // Safe coordinates with defaults - MUST be before any early returns
    const safeCoordinates = useMemo(() => {
        if (!coordinates || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) {
            return { latitude: 53.9006, longitude: 27.559 }; // Default: Minsk
        }
        return coordinates;
    }, [coordinates]);

    // ✅ ИСПРАВЛЕНИЕ: Функция для обработки ошибок и регенерации ключа карты
    const handleMapError = useCallback(() => {
        console.warn('[MapPanel] Map error occurred, regenerating map key...');
        setMapKeyVersion((prev) => prev + 1);
    }, []);

    // Early returns - AFTER all hooks
    if (!isWeb) return <Placeholder />;

    if (!shouldLoad) {
        return (
            <View 
                style={[styles.mapContainer, { backgroundColor: themeColors.surface }]}
                ref={setElementRef as any}
            >
                <Placeholder text="Карта загрузится при прокрутке…" showSkeleton={true} />
            </View>
        );
    }

    if (loading || !WebMap) {
        return <Placeholder text="Инициализация карты…" showSkeleton={true} />;
    }

    return (
        <View 
            style={[styles.mapContainer, { backgroundColor: themeColors.surface }]}
            ref={setElementRef as any}
        >
            <MapErrorBoundary onError={handleMapError}>
                <WebMap
                    key={`map-${mapKeyVersion}`}
                    travel={travelProp}
                    coordinates={safeCoordinates}
                    routePoints={routePoints}
                    placesAlongRoute={placesAlongRoute}
                    mode={mode}
                    setRoutePoints={setRoutePoints}
                    onMapClick={onMapClick}
                    transportMode={transportMode}
                    setRouteDistance={setRouteDistance}
                    setRouteDuration={setRouteDuration}
                    setFullRouteCoords={setFullRouteCoords}
                    radius={radius}
                    onMapUiApiReady={onMapUiApiReady}
                />
            </MapErrorBoundary>
        </View>
    );
};

export default React.memo(MapPanel);

const styles = StyleSheet.create({
    mapContainer: {
        flex: 1,
        ...(Platform.OS === 'web'
            ? ({
                  width: '100%',
                  height: '100%',
                  minHeight: 0,
                  position: 'relative',
              } as any)
            : null),
        borderRadius: 16,
        overflow: 'hidden',
    },
    placeholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        borderRadius: 16,
    },
    placeholderText: {
        fontSize: 16,
        textAlign: 'center',
    },
});
