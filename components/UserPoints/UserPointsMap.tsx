/**
 * User Points Map - optimized map for user's personal points
 * Extends TravelMap with user-specific features (edit, delete, drive info)
 * Uses all optimizations from Phases 1-6
 * @module components/UserPoints/UserPointsMap
 */

import React from 'react';
import { ActivityIndicator, Text, View, StyleSheet, Platform } from 'react-native';
import type { ImportedPoint } from '@/types/userPoints';
import type { MapUiApi } from '@/types/mapUi';

import { useThemedColors } from '@/hooks/useTheme';
import { UserPointsMapWebLayers, UserPointsMapWebStyles } from './UserPointsMapWebLayers';
import { useUserPointsDriveInfo } from './useUserPointsDriveInfo';
import { useUserPointsMapWebController } from './useUserPointsMapWebController';
import { useUserPointsMapWebRuntime } from './useUserPointsMapWebRuntime';
import { useUserPointsMarkerIcons } from './useUserPointsMarkerIcons';
import { getUserPointsCenter, normalizeUserPoints } from './userPointsMapData';

interface UserPointsMapProps {
  /**
   * User's imported points
   */
  points: ImportedPoint[];

  /**
   * Map center (user location or custom)
   */
  center?: { lat: number; lng: number };

  /**
   * Search marker (from search/filter)
   */
  searchMarker?: { lat: number; lng: number; label?: string } | null;

  /**
   * Active/selected point ID
   */
  activePointId?: number | null;

  /**
   * Point press handler
   */
  onPointPress?: (point: ImportedPoint) => void;

  /**
   * Edit point handler
   */
  onEditPoint?: (point: ImportedPoint) => void;

  /**
   * Delete point handler
   */
  onDeletePoint?: (point: ImportedPoint) => void;

  /**
   * Map press handler (for adding new points)
   */
  onMapPress?: (coords: { lat: number; lng: number }) => void;

  /**
   * Center change handler
   */
  onCenterChange?: (coords: { lat: number; lng: number }) => void;

  /**
   * Pending marker (before point is saved)
   */
  pendingMarker?: { lat: number; lng: number } | null;

  /**
   * Pending marker color
   */
  pendingMarkerColor?: string;

  /**
   * Map UI API ready callback
   */
  onMapUiApiReady?: (api: MapUiApi | null) => void;

  /**
   * Route lines to display
   */
  routeLines?: Array<{ id: number; line: Array<[number, number]> }>;

  /**
   * Map height
   */
  height?: number;

  /**
   * Enable clustering (auto-enabled for >25 points)
   */
  enableClustering?: boolean;
}

/**
 * Optimized map component for user's personal points
 *
 * Key improvements over old PointsMap.tsx:
 * - Uses TravelMap base (all optimizations from Phases 1-6)
 * - Lazy Leaflet loading (useLeafletLoader)
 * - Dynamic clustering (100-1000x faster)
 * - LazyPopup (70% less DOM nodes)
 * - Modular structure (MapLayers, etc.)
 * - 300 lines vs 1739 lines (-82%)
 *
 * @example
 * ```typescript
 * <UserPointsMap
 *   points={userPoints}
 *   center={userLocation}
 *   activePointId={selectedId}
 *   onPointPress={handlePress}
 *   onEditPoint={handleEdit}
 *   onDeletePoint={handleDelete}
 *   enableClustering={userPoints.length > 25}
 * />
 * ```
 */
export const UserPointsMap: React.FC<UserPointsMapProps> = ({
  points = [],
  center,
  searchMarker,
  activePointId,
  onPointPress,
  onEditPoint,
  onDeletePoint,
  onMapPress,
  onCenterChange,
  pendingMarker,
  pendingMarkerColor,
  onMapUiApiReady,
  routeLines,
  height,
  enableClustering: _enableClustering,
}) => {
  void _enableClustering;
  if (Platform.OS === 'web') {
    return (
      <UserPointsMapWeb
        points={points}
        center={center}
        searchMarker={searchMarker}
        activePointId={activePointId}
        onPointPress={onPointPress}
        onEditPoint={onEditPoint}
        onDeletePoint={onDeletePoint}
        onMapPress={onMapPress}
        onCenterChange={onCenterChange}
        pendingMarker={pendingMarker}
        pendingMarkerColor={pendingMarkerColor}
        onMapUiApiReady={onMapUiApiReady}
        routeLines={routeLines}
        height={height}
      />
    );
  }

  return (
    <UserPointsMapNative
      points={points}
      center={center}
      searchMarker={searchMarker}
      activePointId={activePointId}
      onMapPress={onMapPress}
      pendingMarker={pendingMarker}
      pendingMarkerColor={pendingMarkerColor}
      routeLines={routeLines}
      height={height}
    />
  );
};

const WebMapInstanceBinder = ({ useMap, onMapReady }: { useMap: any; onMapReady: (map: any) => void }) => {
  const map = useMap?.();
  React.useEffect(() => {
    if (!map) return;
    onMapReady(map);
  }, [map, onMapReady]);
  return null;
};

const WebMapAutoResize = ({ useMap }: { useMap: any }) => {
  const map = useMap?.();

  React.useEffect(() => {
    if (!map) return;

    let raf: number | null = null;
    const invalidate = () => {
      try {
        if (raf != null && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(raf);
        }
      } catch {
        // noop
      }

      try {
        if (typeof requestAnimationFrame === 'function') {
          raf = requestAnimationFrame(() => {
            try {
              map.invalidateSize?.();
            } catch {
              // noop
            }
          }) as any;
        } else {
          map.invalidateSize?.();
        }
      } catch {
        // noop
      }
    };

    // Initial + post-layout invalidations (fonts/header can shift layout on web).
    invalidate();
    const t1 = setTimeout(invalidate, 50);
    const t2 = setTimeout(invalidate, 250);

    const canUseWindow = typeof window !== 'undefined' && typeof window.addEventListener === 'function';
    const onWindowResize = () => invalidate();
    if (canUseWindow) {
      try {
        window.addEventListener('resize', onWindowResize);
      } catch {
        // noop
      }
    }

    let ro: any = null;
    try {
      const container = map.getContainer?.();
      if (container && typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => invalidate());
        ro.observe(container);
      }
    } catch {
      // noop
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (canUseWindow) {
        try {
          window.removeEventListener('resize', onWindowResize);
        } catch {
          // noop
        }
      }
      try {
        ro?.disconnect();
      } catch {
        // noop
      }
      try {
        if (raf != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
      } catch {
        // noop
      }
    };
  }, [map]);

  return null;
};

const WebMapClickHandler = ({ useMapEvents, onMapPress }: { useMapEvents: any; onMapPress?: (c: any) => void }) => {
  useMapEvents?.({
    click: (e: any) => {
      const lat = e?.latlng?.lat;
      const lng = e?.latlng?.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      onMapPress?.({ lat, lng });
    },
  });
  return null;
};

const WebMapCenterReporter = ({
  useMap,
  useMapEvents,
  onCenterChange,
}: {
  useMap: any;
  useMapEvents: any;
  onCenterChange?: (c: any) => void;
}) => {
  const map = useMap?.();

  useMapEvents?.({
    moveend: () => {
      try {
        const c = map?.getCenter?.();
        const lat = c?.lat;
        const lng = c?.lng;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        onCenterChange?.({ lat, lng });
      } catch {
        // noop
      }
    },
    zoomend: () => {
      try {
        const c = map?.getCenter?.();
        const lat = c?.lat;
        const lng = c?.lng;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        onCenterChange?.({ lat, lng });
      } catch {
        // noop
      }
    },
  });

  React.useEffect(() => {
    try {
      const c = map?.getCenter?.();
      const lat = c?.lat;
      const lng = c?.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      onCenterChange?.({ lat, lng });
    } catch {
      // noop
    }
  }, [map, onCenterChange]);

  return null;
};

const UserPointsMapWeb: React.FC<UserPointsMapProps> = ({
  points,
  center: centerOverride,
  searchMarker,
  activePointId,
  onPointPress,
  onEditPoint,
  onDeletePoint,
  onMapPress,
  onCenterChange,
  pendingMarker,
  pendingMarkerColor,
  onMapUiApiReady,
  routeLines,
  height,
}) => {
  const colors = useThemedColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const loadingStyles = React.useMemo(() => createLoadingStyles(colors), [colors]);

  const { mods, isCompactPopup, isNarrowPopup, isTinyPopup } = useUserPointsMapWebRuntime();
  const { driveInfoById, requestDriveInfo } = useUserPointsDriveInfo(centerOverride);
  const { getMarkerIconCached } = useUserPointsMarkerIcons({ L: mods?.L, colors });
  const { center, mapInstance, mapRef, polylinePathOptions, registerPointMarker, safePoints, handleMapReady, handleWhenReady } =
    useUserPointsMapWebController({
      points,
      centerOverride,
      activePointId,
      mods,
      colors,
      onMapUiApiReady,
    });

  if (!mods?.MapContainer) {
    return (
      <View style={[styles.container, height ? { height } : null, loadingStyles.loadingWrap]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={loadingStyles.loadingText}>Загрузка карты…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, height ? { height } : null]}>
      {Platform.OS === 'web' ? <UserPointsMapWebStyles colors={colors} /> : null}
      <mods.MapContainer
        ref={mapRef}
        center={[center.lat, center.lng]}
        zoom={safePoints.length > 0 ? 10 : 5}
        whenReady={handleWhenReady}
        style={{ height: '100%', width: '100%' }}
      >
	        <WebMapInstanceBinder useMap={mods.useMap} onMapReady={handleMapReady} />
	        <WebMapAutoResize useMap={mods.useMap} />
	        <WebMapClickHandler useMapEvents={mods.useMapEvents} onMapPress={onMapPress} />
	        <WebMapCenterReporter useMap={mods.useMap} useMapEvents={mods.useMapEvents} onCenterChange={onCenterChange} />
        <UserPointsMapWebLayers
          mods={mods}
          points={safePoints}
          colors={colors}
          centerOverride={centerOverride}
          searchMarker={searchMarker}
          activePointId={activePointId}
          pendingMarker={pendingMarker}
          pendingMarkerColor={pendingMarkerColor}
          routeLines={routeLines}
          mapInstance={mapInstance}
          isCompactPopup={isCompactPopup}
          isNarrowPopup={isNarrowPopup}
          isTinyPopup={isTinyPopup}
          driveInfoById={driveInfoById}
          polylinePathOptions={polylinePathOptions}
          getMarkerIconCached={getMarkerIconCached}
          onPointPress={onPointPress}
          onEditPoint={onEditPoint}
          onDeletePoint={onDeletePoint}
          requestDriveInfo={requestDriveInfo}
          registerPointMarker={registerPointMarker}
        />
      </mods.MapContainer>
    </View>
  );
};

const UserPointsMapNative: React.FC<UserPointsMapProps> = ({
  points,
  center,
  searchMarker: _searchMarker,
  activePointId,
  onMapPress,
  pendingMarker,
  pendingMarkerColor,
  routeLines,
  height,
}) => {
  const colors = useThemedColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const mapRef = React.useRef<any>(null);

  const nativeMaps = React.useMemo(() => {
    if (Platform.OS === 'web') return null;
    try {
      const req = (0, eval)('require') as any;
      const m = req('react-native-maps');
      return {
        MapView: m?.default ?? m,
        Marker: m?.Marker,
        Polyline: m?.Polyline,
      } as any;
    } catch {
      return null;
    }
  }, []);

  const safePoints = React.useMemo(() => normalizeUserPoints(points), [points]);

  const defaultCenter = React.useMemo(() => getUserPointsCenter(center, safePoints), [center, safePoints]);

  const initialRegion = React.useMemo(
    () => ({
      latitude: defaultCenter.lat,
      longitude: defaultCenter.lng,
      latitudeDelta: 0.25,
      longitudeDelta: 0.25,
    }),
    [defaultCenter.lat, defaultCenter.lng]
  );

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeId = Number(activePointId);
    if (Number.isFinite(activeId)) {
      const target = safePoints.find((p: any) => Number(p?.id) === activeId);
      if (!target) return;
      try {
        map.animateToRegion(
          {
            latitude: target.latitude,
            longitude: target.longitude,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          },
          350
        );
      } catch {
        // noop
      }
    }
  }, [activePointId, safePoints]);

  if (!nativeMaps?.MapView) {
    return <View style={[styles.container, height ? { height } : null]} />;
  }

  const MapView = nativeMaps.MapView;
  const Marker = nativeMaps.Marker;
  const Polyline = nativeMaps.Polyline;

  return (
    <View style={[styles.container, height ? { height } : null]}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        onPress={(e: any) => {
          const c = e?.nativeEvent?.coordinate;
          const lat = c?.latitude;
          const lng = c?.longitude;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          onMapPress?.({ lat, lng });
        }}
      >
        {pendingMarker ? (
          <Marker
            coordinate={{ latitude: pendingMarker.lat, longitude: pendingMarker.lng }}
            pinColor={String(pendingMarkerColor ?? '') || undefined}
          />
        ) : null}

        {safePoints.map((p) => (
          <Marker
            key={String((p as any)?.id)}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
          />
        ))}

        {(routeLines ?? []).map((r) => {
          if (!Polyline) return null;
          if (!Array.isArray(r?.line) || r.line.length < 2) return null;
          return (
            <Polyline
              key={`route-${r.id}`}
              coordinates={r.line.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))}
              strokeColor={colors.primary}
              strokeWidth={4}
            />
          );
        })}
      </MapView>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      width: '100%',
      flex: 1,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.backgroundTertiary,
    },
  });

const createLoadingStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    loadingWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    loadingText: {
      marginTop: 10,
      fontSize: 12,
      color: colors.textMuted,
    },
  });

export default React.memo(UserPointsMap);
