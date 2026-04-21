import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import MapIcon from './MapIcon';
import MapLegend from '@/components/MapPage/MapLegend';
import CollapsibleSection from '@/components/MapPage/CollapsibleSection';
import { globalFocusStyles } from '@/styles/globalFocus';
import { WEB_MAP_BASE_LAYERS, WEB_MAP_OVERLAY_LAYERS } from '@/config/mapWebLayers';
import type { MapUiApi } from '@/types/mapUi';
import type { ThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Chip from '@/components/ui/Chip';
import { Toggle } from '@/components/ui/Toggle';

const OSM_POI_CATEGORIES = [
  'Достопримечательности',
  'Культура',
  'Видовые места',
  'Развлечения',
  'Религия',
  'История',
] as const;

const OSM_POI_DEFAULT_CATEGORIES = [
  'Достопримечательности',
  'Видовые места',
  'Культура',
] as const;

interface FiltersPanelMapSettingsProps {
  colors: ThemedColors;
  styles: any;
  isMobile: boolean;
  mode: 'radius' | 'route';
  mapUiApi?: MapUiApi | null;
  overlayOptions?: Array<{ id: string; title: string }>;
  enabledOverlays?: Record<string, boolean>;
  onOverlayToggle?: (id: string, enabled: boolean) => void;
  onResetOverlays?: () => void;
  totalPoints: number;
  hasFilters: boolean;
  canBuildRoute: boolean;
  onReset?: () => void;
  hideReset?: boolean;
  onOpenList?: () => void;
  showLegend?: boolean;
  /** Back-compat: controls both base layer + overlays if specific flags aren't provided */
  showLayers?: boolean;
  showBaseLayer?: boolean;
  showOverlays?: boolean;
  withContainer?: boolean;
}

const FiltersPanelMapSettings: React.FC<FiltersPanelMapSettingsProps> = ({
  colors,
  styles,
  isMobile,
  mode,
  mapUiApi,
  overlayOptions,
  enabledOverlays: controlledEnabledOverlays,
  onOverlayToggle,
  onResetOverlays: _onResetOverlays,
  totalPoints: _totalPoints,
  hasFilters: _hasFilters,
  canBuildRoute,
  showLegend = true,
  showLayers = true,
  showBaseLayer,
  showOverlays,
  withContainer = true,
}) => {
  const [legendOpen, setLegendOpen] = useState(false);
  const [selectedBaseLayerId, setSelectedBaseLayerId] = useState<string>(
    WEB_MAP_BASE_LAYERS.find((l) => l.defaultEnabled)?.id || WEB_MAP_BASE_LAYERS[0]?.id || 'osm'
  );
  const [localEnabledOverlays, setLocalEnabledOverlays] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const o of WEB_MAP_OVERLAY_LAYERS) {
      initial[o.id] = Boolean(o.defaultEnabled);
    }
    return initial;
  });
  const [osmPoiCategories, setOsmPoiCategories] = useState<string[]>(() => [...OSM_POI_DEFAULT_CATEGORIES]);

  const safeMapUiCall = useCallback((fn?: () => void) => {
    if (typeof fn !== 'function') return;
    try {
      fn();
    } catch {
      // noop
    }
  }, []);

  const availableOverlays = useMemo(() => {
    if (Array.isArray(overlayOptions) && overlayOptions.length > 0) {
      return overlayOptions;
    }
    return WEB_MAP_OVERLAY_LAYERS.filter((o) => o.kind.startsWith('osm-overpass-') || Boolean(o.url));
  }, [overlayOptions]);

  const usesControlledOverlays = typeof onOverlayToggle === 'function' && Boolean(controlledEnabledOverlays);
  const resolvedEnabledOverlays = controlledEnabledOverlays ?? localEnabledOverlays;

  const updateOverlayEnabled = useCallback((id: string, enabled: boolean) => {
    if (!usesControlledOverlays) {
      setLocalEnabledOverlays((prev) => ({ ...prev, [id]: enabled }));
      safeMapUiCall(() => mapUiApi?.setOverlayEnabled?.(id, enabled));
    }
    onOverlayToggle?.(id, enabled);
  }, [mapUiApi, onOverlayToggle, safeMapUiCall, usesControlledOverlays]);

  const canCenterOnUser = Boolean(mapUiApi?.capabilities?.canCenterOnUser);
  const canFitToResults = Boolean(mapUiApi?.capabilities?.canFitToResults);
  const canExportRoute = Boolean(mapUiApi?.capabilities?.canExportRoute);
  const osmPoiEnabled = Boolean(resolvedEnabledOverlays['osm-poi']);

  const resolvedShowBaseLayer = showBaseLayer ?? showLayers;
  const resolvedShowOverlays = showOverlays ?? showLayers;

  const shouldShowBaseLayerSelector = resolvedShowBaseLayer && WEB_MAP_BASE_LAYERS.length > 1;

  useEffect(() => {
    if (!mapUiApi) return;
    try {
      mapUiApi.setBaseLayer(selectedBaseLayerId);
    } catch {
      // noop
    }
  }, [mapUiApi, selectedBaseLayerId]);

  useEffect(() => {
    if (usesControlledOverlays) return;
    if (!mapUiApi) return;
    try {
      for (const o of WEB_MAP_OVERLAY_LAYERS) {
        mapUiApi.setOverlayEnabled(o.id, Boolean(resolvedEnabledOverlays[o.id]));
      }
    } catch {
      // noop
    }
  }, [mapUiApi, resolvedEnabledOverlays, usesControlledOverlays]);

  useEffect(() => {
    if (!mapUiApi?.setOsmPoiCategories) return;
    if (!osmPoiEnabled) return;
    mapUiApi.setOsmPoiCategories(osmPoiCategories);
  }, [mapUiApi, osmPoiCategories, osmPoiEnabled]);

  const body = (
    <>
      {showLegend ? (
        <>
          <Pressable
            style={[styles.accordionHeader, globalFocusStyles.focusable]}
            onPress={() => setLegendOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Легенда карты"
            accessibilityState={{ expanded: legendOpen }}
          >
            <Text style={styles.accordionTitle}>Легенда карты</Text>
            <MapIcon name={legendOpen ? 'expand-less' : 'expand-more'} size={20} color={colors.textMuted} />
          </Pressable>
          {legendOpen && <MapLegend showRouteMode={mode === 'route'} />}
        </>
      ) : null}

      <View style={styles.mapControlsRow}>
        <IconButton
          label="Увеличить масштаб"
          icon={<MapIcon name="add" size={18} color={colors.text} />}
          onPress={() => safeMapUiCall(mapUiApi?.zoomIn)}
          disabled={!mapUiApi}
          size="sm"
        />
        <IconButton
          label="Уменьшить масштаб"
          icon={<MapIcon name="remove" size={18} color={colors.text} />}
          onPress={() => safeMapUiCall(mapUiApi?.zoomOut)}
          disabled={!mapUiApi}
          size="sm"
        />
        <IconButton
          label="Моё местоположение"
          icon={<MapIcon name="my-location" size={18} color={colors.text} />}
          onPress={() => {
            if (!mapUiApi || !canCenterOnUser) return;
            safeMapUiCall(mapUiApi?.centerOnUser);
          }}
          disabled={!mapUiApi || !canCenterOnUser}
          size="sm"
        />
        <IconButton
          label="Показать все результаты на карте"
          icon={<MapIcon name="zoom-out-map" size={18} color={colors.text} />}
          onPress={() => safeMapUiCall(mapUiApi?.fitToResults)}
          disabled={!mapUiApi || !canFitToResults}
          size="sm"
        />
      </View>

      {mode === 'route' ? (
        <View style={styles.mapControlsRow}>
          <Button
            label="GPX"
            icon={<MapIcon name="download" size={18} color={colors.text} />}
            onPress={() => safeMapUiCall(mapUiApi?.exportGpx)}
            disabled={!mapUiApi || !canBuildRoute || !canExportRoute}
            accessibilityLabel="Скачать маршрут в формате GPX"
            size="sm"
            variant="secondary"
          />
          <Button
            label="KML"
            icon={<MapIcon name="download" size={18} color={colors.text} />}
            onPress={() => safeMapUiCall(mapUiApi?.exportKml)}
            disabled={!mapUiApi || !canBuildRoute || !canExportRoute}
            accessibilityLabel="Скачать маршрут в формате KML"
            size="sm"
            variant="secondary"
          />
        </View>
      ) : null}

      {shouldShowBaseLayerSelector ? (
        <>
          <View style={styles.mapLayersSection}>
            <Text style={styles.mapLayersLabel}>Слой карты</Text>
            <View style={styles.mapLayersRow}>
              {WEB_MAP_BASE_LAYERS.map((l) => {
                const active = selectedBaseLayerId === l.id;
                return (
                  <Chip
                    key={l.id}
                    label={l.title}
                    selected={active}
                    style={[styles.mapLayerChip, active && styles.mapLayerChipSelected]}
                    disabled={!mapUiApi}
                    onPress={() => {
                      setSelectedBaseLayerId(l.id);
                      safeMapUiCall(() => mapUiApi?.setBaseLayer?.(l.id));
                    }}
                    testID={`map-layer-${l.id}`}
                  />
                );
              })}
            </View>
          </View>
        </>
      ) : null}

      {resolvedShowOverlays ? (
        <>
          <View style={styles.mapLayersSection}>
            <Text style={styles.mapLayersLabel}>Оверлеи</Text>
            <View style={styles.mapToggleList}>
              {availableOverlays.map((o) => {
                const enabled = Boolean(resolvedEnabledOverlays[o.id]);
                return (
                  <Pressable
                    key={o.id}
                    testID={`map-overlay-${o.id}`}
                    disabled={!mapUiApi}
                    onPress={() => {
                      const next = !enabled;
                      updateOverlayEnabled(o.id, next);
                    }}
                    accessibilityRole="switch"
                    accessibilityLabel={o.title}
                    accessibilityState={{ checked: enabled, disabled: !mapUiApi }}
                    style={({ pressed }) => [
                      styles.mapToggleRow,
                      pressed && mapUiApi && styles.mapToggleRowPressed,
                      !mapUiApi && styles.mapToggleRowDisabled,
                    ]}
                  >
                    <Text style={styles.mapToggleText} numberOfLines={2}>
                      {o.title}
                    </Text>
                    <Toggle
                      value={enabled}
                      onValueChange={() => {
                        if (!mapUiApi) return;
                        const next = !enabled;
                        updateOverlayEnabled(o.id, next);
                      }}
                      disabled={!mapUiApi}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          {osmPoiEnabled && typeof mapUiApi?.setOsmPoiCategories === 'function' && (
            <View style={styles.mapLayersSection}>
              <Text style={styles.mapLayersLabel}>OSM: категории</Text>
              <View style={styles.mapToggleList}>
                {OSM_POI_CATEGORIES.map((cat) => {
                  const enabled = osmPoiCategories.includes(cat);
                  return (
                    <Pressable
                      key={cat}
                      testID={`map-osm-category-${cat}`}
                      disabled={!mapUiApi}
                      onPress={() => {
                        if (!mapUiApi) return;
                        setOsmPoiCategories((prev) => {
                          const next = prev.includes(cat) ? prev.filter((x) => x !== cat) : [...prev, cat];
                          safeMapUiCall(() => mapUiApi?.setOsmPoiCategories?.(next));
                          return next;
                        });
                      }}
                      accessibilityRole="switch"
                      accessibilityLabel={cat}
                      accessibilityState={{ checked: enabled, disabled: !mapUiApi }}
                      style={({ pressed }) => [
                        styles.mapToggleRow,
                        pressed && mapUiApi && styles.mapToggleRowPressed,
                        !mapUiApi && styles.mapToggleRowDisabled,
                      ]}
                    >
                      <Text style={styles.mapToggleText} numberOfLines={1}>
                        {cat}
                      </Text>
                      <Toggle
                        value={enabled}
                        onValueChange={() => {
                          if (!mapUiApi) return;
                          setOsmPoiCategories((prev) => {
                            const next = prev.includes(cat) ? prev.filter((x) => x !== cat) : [...prev, cat];
                            safeMapUiCall(() => mapUiApi?.setOsmPoiCategories?.(next));
                            return next;
                          });
                        }}
                        disabled={!mapUiApi}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </>
      ) : null}

    </>
  );

  if (!withContainer) {
    return <View>{body}</View>;
  }

  return (
    <CollapsibleSection
      key={isMobile ? 'map-settings-mobile' : 'map-settings-desktop'}
      title="Настройки карты"
      icon="sliders"
      defaultOpen={false}
      tone={isMobile ? 'flat' : 'default'}
    >
      {body}
    </CollapsibleSection>
  );
};

export default React.memo(FiltersPanelMapSettings);
