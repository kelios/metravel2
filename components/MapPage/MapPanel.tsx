import React, { Suspense, useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Platform, Text, ActivityIndicator } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import MapErrorBoundary from './MapErrorBoundary';
import { MapSkeleton } from '@/components/ui/SkeletonLoader';
import type { MapUiApi } from '@/types/mapUi';
import type { ComponentType } from 'react';

type LatLng = { latitude: number; longitude: number };

const LazyWebMap = React.lazy(() =>
  import('@/components/MapPage/OptimizedMap.web').then((m) => ({ default: (m.default ?? m) as ComponentType<any> }))
);

interface MapPanelProps {
    travelsData: any[];
    coordinates: LatLng | null;
    routePoints?: [number, number][];
    fullRouteCoords?: [number, number][];
    placesAlongRoute?: any[];
    mode?: 'radius' | 'route';
    setRoutePoints?: (points: [number, number][]) => void;
    onMapClick?: (lng: number, lat: number) => void;
    transportMode?: 'car' | 'bike' | 'foot';
    setRouteDistance: (distance: number) => void;
    setRouteDuration?: (durationSeconds: number) => void;
    setFullRouteCoords: (coords: [number, number][]) => void;
    setRouteElevationStats?: (gainMeters: number | null, lossMeters: number | null) => void;
    setRoutingLoading?: (loading: boolean) => void;
    setRoutingError?: (error: string | null) => void;
    radius?: string; // Радиус поиска в км
    onMapUiApiReady?: (api: MapUiApi | null) => void;
    onUserLocationChange?: ((loc: LatLng | null) => void) | undefined;
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
                                               fullRouteCoords = [],
                                               placesAlongRoute = [],
                                               mode = 'radius',
                                               setRoutePoints = () => {},
                                               onMapClick = () => {},
                                               transportMode = 'car',
                                               setRouteDistance,
                                               setRouteDuration,
                                               setFullRouteCoords,
                                               setRouteElevationStats,
                                               setRoutingLoading,
                                               setRoutingError,
                                               radius,
                                               onMapUiApiReady,
                                               onUserLocationChange,
	                                           }) => {
	    const isWeb = Platform.OS === 'web';
    const themeColors = useThemedColors();

	    // ✅ ИСПРАВЛЕНИЕ: Уникальный ключ для карты без недетерминированного SSR
    const [mapKeyVersion, setMapKeyVersion] = useState(0);

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

    return (
        <View style={[styles.mapContainer, { backgroundColor: themeColors.surface }]}>
            <MapErrorBoundary onError={handleMapError}>
                <Suspense fallback={<Placeholder text="Инициализация карты…" showSkeleton={true} />}>
                  <LazyWebMap
                      key={`map-${mapKeyVersion}`}
                      travel={travelProp}
                      coordinates={safeCoordinates}
                      routePoints={routePoints}
                      fullRouteCoords={fullRouteCoords}
                      placesAlongRoute={placesAlongRoute}
                      mode={mode}
                      setRoutePoints={setRoutePoints}
                      onMapClick={onMapClick}
                      transportMode={transportMode}
                      setRouteDistance={setRouteDistance}
                      setRouteDuration={setRouteDuration}
                      setFullRouteCoords={setFullRouteCoords}
                      setRouteElevationStats={setRouteElevationStats}
                      setRoutingLoading={setRoutingLoading}
                      setRoutingError={setRoutingError}
                      radius={radius}
                      onMapUiApiReady={onMapUiApiReady}
                      onUserLocationChange={onUserLocationChange}
                  />
                </Suspense>
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
