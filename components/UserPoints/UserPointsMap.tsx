/**
 * User Points Map — карта личных точек (web: Leaflet + кластеры, native: WebView).
 * @module components/UserPoints/UserPointsMap
 */

import React from 'react';
import { ActivityIndicator, Text, View, StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { ImportedPoint } from '@/types/userPoints';
import type { MapUiApi } from '@/types/mapUi';

import { useThemedColors } from '@/hooks/useTheme';
import { OSM_PROXY_MAX_ZOOM } from '@/config/mapWebLayers';
import { UserPointsMapWebLayers, UserPointsMapWebStyles } from './UserPointsMapWebLayers';
import { useUserPointsMapWebController } from './useUserPointsMapWebController';
import { useUserPointsMapWebRuntime } from './useUserPointsMapWebRuntime';
import { useUserPointsMarkerIcons } from './useUserPointsMarkerIcons';
import { UserPointsMapNative } from './UserPointsMapNative';
import {
  WebMapAutoResize,
  WebMapCenterReporter,
  WebMapClickHandler,
  WebMapInstanceBinder,
} from './UserPointsMapWebHelpers';
import { translate as i18nT } from '@/i18n'


export interface UserPointsMapProps {
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
}

/**
 * Пустая коллекция без геолокации: карта открывается на мир, а не на зашитую
 * столицу (#3135; раньше фоллбэком была Москва).
 */
const WORLD_VIEW_CENTER: [number, number] = [20, 0];
const WORLD_VIEW_ZOOM = 2;
/** Отступ подписи под спиннером загрузки карты — между xs (8) и sm (12), как было. */
const LOADING_TEXT_GAP = 10;

/**
 * Карта личных точек пользователя.
 *
 * Web: Leaflet через `loadLeafletRuntime`; точки живут в `L.markerClusterGroup`
 * (`UserPointsClusterLayer.web.tsx`, #3131) — кластеры при отдалении, один
 * ленивый попап на карту, стартовая область по плотной части коллекции и
 * `minZoom` по размеру контейнера. Native: WebView+Leaflet стек экрана /map.
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
}) => {
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
      onPointPress={onPointPress}
      onMapPress={onMapPress}
      pendingMarker={pendingMarker}
      pendingMarkerColor={pendingMarkerColor}
      routeLines={routeLines}
      height={height}
    />
  );
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

  const { mods, isCompactPopup } = useUserPointsMapWebRuntime();
  const { getMarkerIconCached } = useUserPointsMarkerIcons({ L: mods?.L, colors });
  // #3132: перерисовка маркеров и подгонка карты — отложенный рендер, чтобы ввод
  // в поиск и список не ждали пересборку слоя Leaflet.
  const deferredPoints = React.useDeferredValue(points);
  const { center, mapInstance, mapRef, polylinePathOptions, registerPointMarker, safePoints, handleMapReady, handleWhenReady } =
    useUserPointsMapWebController({
      points: deferredPoints,
      centerOverride,
      activePointId,
      mods,
      colors,
      onMapUiApiReady,
    });

  if (!mods?.MapContainer) {
    return (
      <View style={[styles.container, height ? { height } : null, loadingStyles.loadingWrap]}>
        <ActivityIndicator color={colors.primaryDark} />
        <Text style={loadingStyles.loadingText}>{i18nT('map:components.UserPoints.UserPointsMap.zagruzka_karty_0bb3386b')}</Text>
      </View>
    );
  }

  const leafletContainerStyle: React.CSSProperties & { '--metravel-map-background': string } = {
    height: '100%',
    width: '100%',
    background: colors.background,
    '--metravel-map-background': colors.background,
  };

  return (
    <View style={[styles.container, height ? { height } : null]}>
      {Platform.OS === 'web' ? <UserPointsMapWebStyles colors={colors} /> : null}
      <mods.MapContainer
        ref={mapRef}
        center={center ? [center.lat, center.lng] : WORLD_VIEW_CENTER}
        // Стартовый зум прежний (10 с точками, 5 только по геолокации); мир — когда центра нет.
        zoom={!center ? WORLD_VIEW_ZOOM : safePoints.length > 0 ? 10 : 5}
        // leaflet.markercluster бросает «Map has no maxZoom specified» при добавлении
        // группы на карту без maxZoom (#3131, прод 08.11): потолок — как у тайлов прокси.
        maxZoom={OSM_PROXY_MAX_ZOOM}
        whenReady={handleWhenReady}
        style={leafletContainerStyle}
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
          polylinePathOptions={polylinePathOptions}
          getMarkerIconCached={getMarkerIconCached}
          onPointPress={onPointPress}
          onEditPoint={onEditPoint}
          onDeletePoint={onDeletePoint}
          registerPointMarker={registerPointMarker}
        />
      </mods.MapContainer>
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

const createLoadingStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    loadingWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: DESIGN_TOKENS.spacing.md,
    },
    loadingText: {
      marginTop: LOADING_TEXT_GAP,
      fontSize: DESIGN_TOKENS.typography.scale.caption.fontSize,
      color: colors.textMuted,
    },
  });

export default React.memo(UserPointsMap);
