import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import MapIcon from './MapIcon';
import MapLegend from '@/components/MapPage/MapLegend';
import QuickActions from '@/components/MapPage/QuickActions';
import CollapsibleSection from '@/components/MapPage/CollapsibleSection';
import { globalFocusStyles } from '@/styles/globalFocus';
import { WEB_MAP_BASE_LAYERS, WEB_MAP_OVERLAY_LAYERS } from '@/src/config/mapWebLayers';
import type { MapUiApi } from '@/src/types/mapUi';
import type { ThemedColors } from '@/hooks/useTheme';

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
  totalPoints,
  hasFilters,
  canBuildRoute,
  onReset,
  hideReset,
  onOpenList,
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
  const [enabledOverlays, setEnabledOverlays] = useState<Record<string, boolean>>(() => {
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
    return WEB_MAP_OVERLAY_LAYERS.filter((o) => o.kind.startsWith('osm-overpass-') || Boolean(o.url));
  }, []);

  const canCenterOnUser = Boolean(mapUiApi?.capabilities?.canCenterOnUser);
  const canFitToResults = Boolean(mapUiApi?.capabilities?.canFitToResults);
  const canExportRoute = Boolean(mapUiApi?.capabilities?.canExportRoute);
  const osmPoiEnabled = Boolean(enabledOverlays['osm-poi']);

  const resolvedShowBaseLayer = showBaseLayer ?? showLayers;
  const resolvedShowOverlays = showOverlays ?? showLayers;

  useEffect(() => {
    if (!mapUiApi) return;
    try {
      mapUiApi.setBaseLayer(selectedBaseLayerId);
      for (const o of WEB_MAP_OVERLAY_LAYERS) {
        mapUiApi.setOverlayEnabled(o.id, Boolean(enabledOverlays[o.id]));
      }
    } catch {
      // noop
    }
  }, [mapUiApi, selectedBaseLayerId, enabledOverlays]);

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
        <Pressable
          style={[styles.mapControlButton, globalFocusStyles.focusable, !mapUiApi && styles.mapControlDisabled]}
          onPress={() => safeMapUiCall(mapUiApi?.zoomIn)}
          disabled={!mapUiApi}
          accessibilityRole="button"
          accessibilityLabel="Увеличить масштаб"
          accessibilityState={{ disabled: !mapUiApi }}
        >
          <MapIcon name="add" size={18} color={colors.text} />
          <Text style={styles.mapControlText}>Zoom +</Text>
        </Pressable>
        <Pressable
          style={[styles.mapControlButton, globalFocusStyles.focusable, !mapUiApi && styles.mapControlDisabled]}
          onPress={() => safeMapUiCall(mapUiApi?.zoomOut)}
          disabled={!mapUiApi}
          accessibilityRole="button"
          accessibilityLabel="Уменьшить масштаб"
          accessibilityState={{ disabled: !mapUiApi }}
        >
          <MapIcon name="remove" size={18} color={colors.text} />
          <Text style={styles.mapControlText}>Zoom -</Text>
        </Pressable>
        <Pressable
          style={[
            styles.mapControlButton,
            globalFocusStyles.focusable,
            (!mapUiApi || !canCenterOnUser) && styles.mapControlDisabled,
          ]}
          onPress={() => {
            if (!mapUiApi || !canCenterOnUser) return;
            safeMapUiCall(mapUiApi?.centerOnUser);
          }}
          disabled={!mapUiApi || !canCenterOnUser}
          accessibilityRole="button"
          accessibilityLabel="Моё местоположение"
          accessibilityState={{ disabled: !mapUiApi || !canCenterOnUser }}
        >
          <MapIcon name="my-location" size={18} color={colors.text} />
          <Text style={styles.mapControlText}>Я</Text>
        </Pressable>
        <Pressable
          style={[
            styles.mapControlButton,
            globalFocusStyles.focusable,
            (!mapUiApi || !canFitToResults) && styles.mapControlDisabled,
          ]}
          onPress={() => safeMapUiCall(mapUiApi?.fitToResults)}
          disabled={!mapUiApi || !canFitToResults}
          accessibilityRole="button"
          accessibilityLabel="Показать все результаты на карте"
          accessibilityState={{ disabled: !mapUiApi || !canFitToResults }}
        >
          <MapIcon name="zoom-out-map" size={18} color={colors.text} />
          <Text style={styles.mapControlText}>Все</Text>
        </Pressable>
      </View>

      {mode === 'route' ? (
        <View style={styles.mapControlsRow}>
          <Pressable
            style={[
              styles.mapControlButton,
              globalFocusStyles.focusable,
              (!mapUiApi || !canBuildRoute || !canExportRoute) && styles.mapControlDisabled,
            ]}
            onPress={() => safeMapUiCall(mapUiApi?.exportGpx)}
            disabled={!mapUiApi || !canBuildRoute || !canExportRoute}
            accessibilityRole="button"
            accessibilityLabel="Скачать маршрут в формате GPX"
            accessibilityState={{ disabled: !mapUiApi || !canBuildRoute || !canExportRoute }}
          >
            <MapIcon name="download" size={18} color={colors.text} />
            <Text style={styles.mapControlText}>GPX</Text>
          </Pressable>
          <Pressable
            style={[
              styles.mapControlButton,
              globalFocusStyles.focusable,
              (!mapUiApi || !canBuildRoute || !canExportRoute) && styles.mapControlDisabled,
            ]}
            onPress={() => safeMapUiCall(mapUiApi?.exportKml)}
            disabled={!mapUiApi || !canBuildRoute || !canExportRoute}
            accessibilityRole="button"
            accessibilityLabel="Скачать маршрут в формате KML"
            accessibilityState={{ disabled: !mapUiApi || !canBuildRoute || !canExportRoute }}
          >
            <MapIcon name="download" size={18} color={colors.text} />
            <Text style={styles.mapControlText}>KML</Text>
          </Pressable>
        </View>
      ) : null}

      {resolvedShowBaseLayer ? (
        <>
          <View style={styles.mapLayersSection}>
            <Text style={styles.sectionLabel}>Слой карты</Text>
            <View style={styles.mapLayersRow}>
              {WEB_MAP_BASE_LAYERS.map((l) => {
                const active = selectedBaseLayerId === l.id;
                return (
                  <Pressable
                    key={l.id}
                    style={[
                      styles.layerChip,
                      active && styles.layerChipActive,
                      globalFocusStyles.focusable,
                      !mapUiApi && styles.mapControlDisabled,
                    ]}
                    onPress={() => {
                      setSelectedBaseLayerId(l.id);
                      safeMapUiCall(() => mapUiApi?.setBaseLayer?.(l.id));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Выбрать базовый слой: ${l.title}`}
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.layerChipText, active && styles.layerChipTextActive]}>{l.title}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      ) : null}

      {resolvedShowOverlays ? (
        <>
          <View style={styles.mapLayersSection}>
            <Text style={styles.sectionLabel}>Оверлеи</Text>
            <View style={styles.mapLayersRow}>
              {availableOverlays.map((o) => {
                const enabled = Boolean(enabledOverlays[o.id]);
                return (
                  <Pressable
                    key={o.id}
                    style={[
                      styles.layerChip,
                      enabled && styles.layerChipActive,
                      globalFocusStyles.focusable,
                    ]}
                    onPress={() => {
                      const next = !enabled;
                      console.info('[FiltersPanel] Toggle overlay:', o.id, 'to', next);
                      setEnabledOverlays((prev) => ({ ...prev, [o.id]: next }));
                      safeMapUiCall(() => mapUiApi?.setOverlayEnabled?.(o.id, next));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${enabled ? 'Выключить' : 'Включить'} оверлей: ${o.title}`}
                    accessibilityState={{ selected: enabled }}
                  >
                    <Text style={[styles.layerChipText, enabled && styles.layerChipTextActive]}>{o.title}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {osmPoiEnabled && typeof mapUiApi?.setOsmPoiCategories === 'function' && (
            <View style={styles.mapLayersSection}>
              <Text style={styles.sectionLabel}>OSM: категории</Text>
              <View style={styles.mapLayersRow}>
                {OSM_POI_CATEGORIES.map((cat) => {
                  const enabled = osmPoiCategories.includes(cat);
                  return (
                    <Pressable
                      key={cat}
                      style={[styles.layerChip, enabled && styles.layerChipActive, globalFocusStyles.focusable]}
                      onPress={() => {
                        setOsmPoiCategories((prev) => {
                          const next = prev.includes(cat) ? prev.filter((x) => x !== cat) : [...prev, cat];
                          safeMapUiCall(() => mapUiApi?.setOsmPoiCategories?.(next));
                          return next;
                        });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${enabled ? 'Скрыть' : 'Показывать'}: ${cat}`}
                      accessibilityState={{ selected: enabled }}
                    >
                      <Text style={[styles.layerChipText, enabled && styles.layerChipTextActive]}>{cat}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </>
      ) : null}

      <QuickActions
        onReset={mode === 'radius' && hasFilters ? onReset : undefined}
        hideReset={Boolean(hideReset)}
        onFitBounds={
          totalPoints > 0 && mapUiApi
            ? () => {
                safeMapUiCall(mapUiApi?.fitToResults);
                onOpenList?.();
              }
            : undefined
        }
        totalPoints={totalPoints}
        hasFilters={hasFilters}
      />
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
      defaultOpen={!isMobile}
    >
      {body}
    </CollapsibleSection>
  );
};

export default React.memo(FiltersPanelMapSettings);
