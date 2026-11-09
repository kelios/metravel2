import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

import type { UserPointsMapProps } from './UserPointsMap';
import { buildUserPointsTravelData, getUserPointsCenter, normalizeUserPoints } from './userPointsMapData';

// На native переиспользуем рабочий WebView+Leaflet стек экрана /map
// (components/MapPage/Map → Map.ios, который Map.android ре-экспортирует).
// Прежняя реализация требовала react-native-maps, которого НЕТ в бандле —
// require падал в try/catch и компонент монтировал пустой <View> (#545
// regression: на устройстве канвас карты пустой, без WebView-узла).
/** Пустая коллекция без геолокации — вид на мир, а не на зашитую столицу (#3135). */
const NATIVE_WORLD_VIEW_CENTER = { lat: 20, lng: 0 };

export const UserPointsMapNative: React.FC<UserPointsMapProps> = ({
  points,
  center,
  searchMarker: _searchMarker,
  activePointId,
  onPointPress,
  onMapPress,
  routeLines,
  height,
}) => {
  const colors = useThemedColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  // Резолвим WebView+Leaflet карту экрана /map только на native, чтобы web-бандл
  // userpoints не тянул Map.web (у web уже свой UserPointsMapWeb выше).
  const MapPageNativeMap = React.useMemo<React.ComponentType<any> | null>(() => {
    if (Platform.OS === 'web') return null;
    try {
      const mod = require('@/components/MapPage/Map');
      return (mod?.default ?? mod) as React.ComponentType<any>;
    } catch {
      return null;
    }
  }, []);

  const safePoints = React.useMemo(() => normalizeUserPoints(points), [points]);

  const travelData = React.useMemo(() => buildUserPointsTravelData(safePoints), [safePoints]);

  const mapCenter = React.useMemo(() => {
    const c = getUserPointsCenter(center, safePoints) ?? NATIVE_WORLD_VIEW_CENTER;
    return { latitude: c.lat, longitude: c.lng };
  }, [center, safePoints]);

  const activeCoordinates = React.useMemo(() => {
    const activeId = Number(activePointId);
    if (!Number.isFinite(activeId)) return null;
    const target = safePoints.find((p: any) => Number(p?.id) === activeId);
    if (!target) return null;
    return { latitude: target.latitude, longitude: target.longitude };
  }, [activePointId, safePoints]);

  const routePoints = React.useMemo<[number, number][]>(() => {
    const first = (routeLines ?? []).find((r) => Array.isArray(r?.line) && r.line.length >= 2);
    if (!first) return [];
    return first.line.map(([lat, lng]) => [lng, lat] as [number, number]);
  }, [routeLines]);

  const handleMarkerSelect = React.useCallback(
    (point: { id?: number | string }) => {
      const id = Number(point?.id);
      if (!Number.isFinite(id)) return;
      const original = safePoints.find((p: any) => Number(p?.id) === id);
      if (original) onPointPress?.(original);
    },
    [onPointPress, safePoints]
  );

  const handleMapClick = React.useCallback(
    (lng: number, lat: number) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      onMapPress?.({ lat, lng });
    },
    [onMapPress]
  );

  if (!MapPageNativeMap) {
    return <View style={[styles.container, height ? { height } : null]} />;
  }

  return (
    <View style={[styles.container, height ? { height } : null]}>
      <MapPageNativeMap
        travel={{ data: travelData }}
        pointsOnly
        coordinates={activeCoordinates ?? mapCenter}
        routePoints={routePoints}
        fullRouteCoords={routePoints}
        mode={routePoints.length >= 2 ? 'route' : 'radius'}
        onMapClick={handleMapClick}
        onMarkerSelect={handleMarkerSelect}
      />
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      width: '100%',
      flex: 1,
      borderRadius: DESIGN_TOKENS.radii.sm,
      overflow: 'hidden',
      backgroundColor: colors.backgroundTertiary,
    },
  });
