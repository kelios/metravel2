import React, { Suspense, useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Platform, Text, ActivityIndicator } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import MapErrorBoundary from './MapErrorBoundary';
import { MapSkeleton } from '@/components/ui/SkeletonLoader';
import Map from '@/components/MapPage/Map';
import MapRouteEngine from '@/components/MapPage/MapRouteEngine';
import type { MapUiApi } from '@/types/mapUi';
import type { MapClustersFilters } from '@/api/map';
import type { MapMovePayload } from './Map/types';
import type { ComponentType } from 'react';
import { isFallbackMinskCenter } from './Map/fallbackCenter';

type LatLng = { latitude: number; longitude: number };

// Start downloading the Map.web chunk as soon as this module evaluates
// (before React renders & Suspense triggers), so it overlaps with Leaflet preload.
const mapWebImport = Platform.OS === 'web'
  ? Promise.resolve(import('@/components/MapPage/Map.web'))
  : null;

const LazyWebMap = React.lazy(() =>
  (mapWebImport ?? Promise.resolve(import('@/components/MapPage/Map.web'))).then((m) => ({ default: (m.default ?? m) as ComponentType<any> }))
);

interface MapPanelProps {
    travelsData: any[];
    coordinates: LatLng | null;
    /**
     * True when `coordinates` is the non-user DEFAULT center (no real geolocation
     * and no cached/explicit anchor). The map must not draw a real "you are here"
     * marker in that case. Explicit origin flag — replaces brittle Minsk
     * coordinate-matching so a user physically near Minsk is still treated as real.
     */
    coordinatesAreFallback?: boolean;
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
    mapClusterFilters?: MapClustersFilters;
    categoryFilterUnresolved?: boolean;
    onMapUiApiReady?: (api: MapUiApi | null) => void;
    onUserLocationChange?: ((loc: LatLng | null) => void) | undefined;
    onMapMove?: (center: MapMovePayload) => void;
    hideFloatingControls?: boolean;
    onMarkerSelect?: (point: any) => void;
    onMapBackgroundTap?: () => void;
    suppressLeafletPopupOnSelect?: boolean;
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
                                               coordinatesAreFallback,
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
                                               mapClusterFilters,
                                               categoryFilterUnresolved,
                                               onMapUiApiReady,
                                               onUserLocationChange,
                                               onMapMove,
                                               hideFloatingControls = false,
                                               onMarkerSelect,
                                               onMapBackgroundTap,
                                               suppressLeafletPopupOnSelect = false,
	                                           }) => {
	    const isWeb = Platform.OS === 'web';
    const themeColors = useThemedColors();

	    // ✅ ИСПРАВЛЕНИЕ: Уникальный ключ для карты без недетерминированного SSR
    const [mapKeyVersion, setMapKeyVersion] = useState(0);

    const travelProp = useMemo(() => ({ data: travelsData }), [travelsData]);
    const nativeTravelProp = useMemo(
        () => ({ data: travelsData }),
        [travelsData],
    );

    // Safe coordinates with defaults - MUST be before any early returns
    const safeCoordinates = useMemo(() => {
        if (!coordinates || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) {
            return { latitude: 53.9006, longitude: 27.559 }; // Default: Minsk
        }
        return coordinates;
    }, [coordinates]);

    // Реальная гео пользователя для нативного маркера «вы здесь». coordinates на
    // native приходит из useMapCoordinates и при denied/timeout = дефолтный Минск.
    // Источник координат теперь приходит явным флагом (coordinatesAreFallback) —
    // пользователь, физически находящийся у Минска, больше не считается fallback.
    // isFallbackMinskCenter оставлен defensive-only на случай отсутствия флага.
    // null → синяя точка не рисуется.
    const nativeUserLocation = useMemo<LatLng | null>(() => {
        if (!coordinates) return null;
        const { latitude, longitude } = coordinates;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
        if (coordinatesAreFallback) return null;
        if (isFallbackMinskCenter(latitude, longitude)) return null;
        return { latitude, longitude };
    }, [coordinates, coordinatesAreFallback]);

    // ✅ ИСПРАВЛЕНИЕ: Функция для обработки ошибок и регенерации ключа карты
    const handleMapError = useCallback(() => {
        console.warn('[MapPanel] Map error occurred, regenerating map key...');
        setMapKeyVersion((prev) => prev + 1);
    }, []);

    // Early returns - AFTER all hooks
    if (!isWeb) {
        return (
            <View style={[styles.mapContainer, { backgroundColor: themeColors.surface }]}>
                {mode === 'route' && (
                    <MapRouteEngine
                        routePoints={routePoints}
                        transportMode={transportMode}
                        setRouteDistance={setRouteDistance}
                        setRouteDuration={setRouteDuration}
                        setFullRouteCoords={setFullRouteCoords}
                        setRouteElevationStats={setRouteElevationStats}
                        setRoutingLoading={setRoutingLoading}
                        setRoutingError={setRoutingError}
                    />
                )}
                <Map
                    travel={nativeTravelProp}
                    coordinates={safeCoordinates}
                    userLocation={nativeUserLocation}
                    routePoints={routePoints}
                    fullRouteCoords={fullRouteCoords}
                    mapClusterFilters={mapClusterFilters}
                    categoryFilterUnresolved={categoryFilterUnresolved}
                    mode={mode}
                    transportMode={transportMode}
                    setRouteDistance={setRouteDistance}
                    setFullRouteCoords={setFullRouteCoords}
                    onMapClick={onMapClick}
                    onMarkerSelect={onMarkerSelect}
                    onMapMove={onMapMove}
                    onMapUiApiReady={onMapUiApiReady}
                    enableOfflineDownload
                />
            </View>
        );
    }

    return (
        <View style={[styles.mapContainer, { backgroundColor: themeColors.surface }]}>
            <MapErrorBoundary onError={handleMapError}>
                <Suspense fallback={<Placeholder text="Инициализация карты…" showSkeleton={true} />}>
                  <LazyWebMap
                      key={`map-${mapKeyVersion}`}
                      travel={travelProp}
                      coordinates={safeCoordinates}
                      coordinatesAreFallback={coordinatesAreFallback}
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
                      mapClusterFilters={mapClusterFilters}
                      categoryFilterUnresolved={categoryFilterUnresolved}
                      onMapUiApiReady={onMapUiApiReady}
                      onUserLocationChange={onUserLocationChange}
                      onMapMove={onMapMove}
                      hideFloatingControls={hideFloatingControls}
                      onMarkerSelect={onMarkerSelect}
                      onMapBackgroundTap={onMapBackgroundTap}
                      suppressLeafletPopupOnSelect={suppressLeafletPopupOnSelect}
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
        borderRadius: DESIGN_TOKENS.radii.lg,
        overflow: 'hidden',
        ...(Platform.OS === 'web'
            ? ({
                  boxShadow: DESIGN_TOKENS.shadows.card,
              } as any)
            : {
                  shadowColor: DESIGN_TOKENS.colors.text,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 8,
              }),
    },
    placeholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 32,
        borderRadius: DESIGN_TOKENS.radii.lg,
    },
    placeholderText: {
        fontSize: 15,
        fontWeight: '500',
        textAlign: 'center',
        opacity: 0.8,
    },
});
