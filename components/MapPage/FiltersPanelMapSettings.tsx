import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import { Toggle } from '@/components/ui/Toggle'
import CollapsibleSection from '@/components/MapPage/CollapsibleSection'
import MapIcon from './MapIcon'
import {
  WEB_MAP_BASE_LAYERS,
  getActiveOverlayLayers,
  groupOverlaysByCategory,
} from '@/config/mapWebLayers'
import type { ThemedColors } from '@/hooks/useTheme'
import type { MapUiApi } from '@/types/mapUi'
import type { OsmPoiCategory } from '@/utils/overpass'
import { translate as i18nT, type TranslationKey } from '@/i18n'


const OSM_POI_CATEGORIES: ReadonlyArray<{ value: OsmPoiCategory; labelKey: TranslationKey }> = [
  { value: 'attractions', labelKey: 'map:components.MapPage.FiltersPanelMapSettings.dostoprimechatelnosti_a8a167c8' },
  { value: 'culture', labelKey: 'map:components.MapPage.FiltersPanelMapSettings.kultura_111870cc' },
  { value: 'viewpoints', labelKey: 'map:components.MapPage.FiltersPanelMapSettings.vidovye_mesta_ed29416a' },
  { value: 'entertainment', labelKey: 'map:components.MapPage.FiltersPanelMapSettings.razvlecheniya_1ed614fb' },
  { value: 'religion', labelKey: 'map:components.MapPage.FiltersPanelMapSettings.religiya_07624514' },
  { value: 'history', labelKey: 'map:components.MapPage.FiltersPanelMapSettings.istoriya_e588d346' },
] as const

const OSM_POI_DEFAULT_CATEGORIES = [
  'attractions',
  'viewpoints',
  'culture',
] as const

function ignoreTransientMapRuntimeError() {
  return
}

interface FiltersPanelMapSettingsProps {
  colors: ThemedColors
  styles: any
  isMobile: boolean
  mode: 'radius' | 'route'
  mapUiApi?: MapUiApi | null
  overlayOptions?: Array<{
    id: string
    title: string
    category?: string
    subtitle?: string
    badge?: string
  }>
  enabledOverlays?: Record<string, boolean>
  onOverlayToggle?: (id: string, enabled: boolean) => void
  onResetOverlays?: () => void
  totalPoints: number
  hasFilters: boolean
  canBuildRoute: boolean
  onReset?: () => void
  hideReset?: boolean
  onOpenList?: () => void
  showLayers?: boolean
  showBaseLayer?: boolean
  showOverlays?: boolean
  withContainer?: boolean
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
  canBuildRoute,
  showLayers = true,
  showBaseLayer,
  showOverlays,
  withContainer = true,
}) => {
  const [selectedBaseLayerId, setSelectedBaseLayerId] = useState<string>(
    WEB_MAP_BASE_LAYERS.find((layer) => layer.defaultEnabled)?.id ||
      WEB_MAP_BASE_LAYERS[0]?.id ||
      'osm',
  )
  const [localEnabledOverlays, setLocalEnabledOverlays] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {}
      for (const overlay of getActiveOverlayLayers()) {
        initial[overlay.id] = Boolean(overlay.defaultEnabled)
      }
      return initial
    },
  )
  const [osmPoiCategories, setOsmPoiCategories] = useState<OsmPoiCategory[]>(() => [
    ...OSM_POI_DEFAULT_CATEGORIES,
  ])

  const safeMapUiCall = useCallback((fn?: () => void) => {
    if (typeof fn !== 'function') return
    try {
      fn()
    } catch {
      ignoreTransientMapRuntimeError()
    }
  }, [])

  const availableOverlays = useMemo(() => {
    if (Array.isArray(overlayOptions) && overlayOptions.length > 0) return overlayOptions
    return getActiveOverlayLayers().filter(
      (overlay) =>
        overlay.kind.startsWith('osm-overpass-') ||
        overlay.kind === 'weather-temp-labels' ||
        Boolean(overlay.url),
    )
  }, [overlayOptions])

  const overlaySections = useMemo(
    () => groupOverlaysByCategory(availableOverlays),
    [availableOverlays],
  )

  const usesControlledOverlays =
    typeof onOverlayToggle === 'function' && Boolean(controlledEnabledOverlays)
  const resolvedEnabledOverlays = controlledEnabledOverlays ?? localEnabledOverlays

  const updateOverlayEnabled = useCallback(
    (id: string, enabled: boolean) => {
      if (!usesControlledOverlays) {
        setLocalEnabledOverlays((prev) => ({ ...prev, [id]: enabled }))
        safeMapUiCall(() => mapUiApi?.setOverlayEnabled?.(id, enabled))
      }
      onOverlayToggle?.(id, enabled)
    },
    [mapUiApi, onOverlayToggle, safeMapUiCall, usesControlledOverlays],
  )

  const toggleOsmCategory = useCallback(
    (category: OsmPoiCategory) => {
      if (!mapUiApi) return
      setOsmPoiCategories((prev) => {
        const next = prev.includes(category)
          ? prev.filter((item) => item !== category)
          : [...prev, category]
        safeMapUiCall(() => mapUiApi?.setOsmPoiCategories?.(next))
        return next
      })
    },
    [mapUiApi, safeMapUiCall],
  )

  const canFitToResults = Boolean(mapUiApi?.capabilities?.canFitToResults)
  const canExportRoute = Boolean(mapUiApi?.capabilities?.canExportRoute)
  const osmPoiEnabled = Boolean(resolvedEnabledOverlays['osm-poi'])

  const resolvedShowBaseLayer = showBaseLayer ?? showLayers
  const resolvedShowOverlays = showOverlays ?? showLayers
  const shouldShowBaseLayerSelector =
    resolvedShowBaseLayer && WEB_MAP_BASE_LAYERS.length > 1
  const showOsmCategoriesPanel =
    resolvedShowOverlays && osmPoiEnabled && typeof mapUiApi?.setOsmPoiCategories === 'function'

  useEffect(() => {
    if (!mapUiApi) return
    try {
      mapUiApi.setBaseLayer(selectedBaseLayerId)
    } catch {
      ignoreTransientMapRuntimeError()
    }
  }, [mapUiApi, selectedBaseLayerId])

  useEffect(() => {
    if (usesControlledOverlays || !mapUiApi) return
    try {
      for (const overlay of getActiveOverlayLayers()) {
        mapUiApi.setOverlayEnabled(overlay.id, Boolean(localEnabledOverlays[overlay.id]))
      }
    } catch {
      ignoreTransientMapRuntimeError()
    }
  }, [mapUiApi, localEnabledOverlays, usesControlledOverlays])

  useEffect(() => {
    if (!mapUiApi?.setOsmPoiCategories || !osmPoiEnabled) return
    mapUiApi.setOsmPoiCategories(osmPoiCategories)
  }, [mapUiApi, osmPoiCategories, osmPoiEnabled])

  const body = (
    <>
      <View style={styles.mapControlsRow}>
        <Button
          label={i18nT('map:components.MapPage.FiltersPanelMapSettings.pokazat_vse_na_karte_ba0f263b')}
          icon={<MapIcon name="zoom-out-map" size={18} color={colors.text} />}
          onPress={() => safeMapUiCall(mapUiApi?.fitToResults)}
          disabled={!mapUiApi || !canFitToResults}
          accessibilityLabel={i18nT('map:components.MapPage.FiltersPanelMapSettings.pokazat_vse_rezultaty_na_karte_03fcd330')}
          size="sm"
          variant="secondary"
        />
      </View>

      {mode === 'route' && (
        <View style={styles.mapControlsRow}>
          <Button
            label={i18nT('map:components.MapPage.FiltersPanelMapSettings.gpx_83a98f34')}
            icon={<MapIcon name="download" size={18} color={colors.text} />}
            onPress={() => safeMapUiCall(mapUiApi?.exportGpx)}
            disabled={!mapUiApi || !canBuildRoute || !canExportRoute}
            accessibilityLabel={i18nT('map:components.MapPage.FiltersPanelMapSettings.skachat_marshrut_v_formate_gpx_08329a73')}
            size="sm"
            variant="secondary"
          />
          <Button
            label={i18nT('map:components.MapPage.FiltersPanelMapSettings.kml_9a82e2b4')}
            icon={<MapIcon name="download" size={18} color={colors.text} />}
            onPress={() => safeMapUiCall(mapUiApi?.exportKml)}
            disabled={!mapUiApi || !canBuildRoute || !canExportRoute}
            accessibilityLabel={i18nT('map:components.MapPage.FiltersPanelMapSettings.skachat_marshrut_v_formate_kml_54e7c65c')}
            size="sm"
            variant="secondary"
          />
        </View>
      )}

      {shouldShowBaseLayerSelector && (
        <View style={styles.mapLayersSection}>
          <Text style={styles.mapLayersLabel}>{i18nT('map:components.MapPage.FiltersPanelMapSettings.sloy_karty_0c227500')}</Text>
          <View style={styles.mapLayersRow}>
            {WEB_MAP_BASE_LAYERS.map((layer) => {
              const active = selectedBaseLayerId === layer.id
              return (
                <Chip
                  key={layer.id}
                  label={layer.title}
                  selected={active}
                  style={[styles.mapLayerChip, active && styles.mapLayerChipSelected]}
                  disabled={!mapUiApi}
                  onPress={() => {
                    setSelectedBaseLayerId(layer.id)
                    safeMapUiCall(() => mapUiApi?.setBaseLayer?.(layer.id))
                  }}
                  testID={`map-layer-${layer.id}`}
                />
              )
            })}
          </View>
        </View>
      )}

      {resolvedShowOverlays && (
        <>
          <View style={styles.mapLayersSection}>
            {overlaySections.map((section, index) => (
              <View
                key={section.category}
                style={[
                  styles.mapOverlaySection,
                  index === 0 && styles.mapOverlaySectionFirst,
                ]}
              >
                <Text style={styles.mapOverlaySectionTitle}>{section.title}</Text>
                <View style={styles.mapToggleList}>
                  {section.items.map((overlay) => {
                    const enabled = Boolean(resolvedEnabledOverlays[overlay.id])
                    const toggle = () => {
                      if (!mapUiApi) return
                      updateOverlayEnabled(overlay.id, !enabled)
                    }
                    return (
                      <Pressable
                        key={overlay.id}
                        testID={`map-overlay-${overlay.id}`}
                        disabled={!mapUiApi}
                        onPress={toggle}
                        accessibilityRole="switch"
                        accessibilityLabel={overlay.title}
                        accessibilityState={{ checked: enabled, disabled: !mapUiApi }}
                        aria-checked={enabled}
                        aria-disabled={!mapUiApi || undefined}
                        style={({ pressed }) => [
                          styles.mapToggleRow,
                          pressed && mapUiApi && styles.mapToggleRowPressed,
                          !mapUiApi && styles.mapToggleRowDisabled,
                        ]}
                      >
                        <Text style={styles.mapToggleText} numberOfLines={2}>
                          {overlay.title}
                        </Text>
                        <Toggle
                          value={enabled}
                          onValueChange={toggle}
                          disabled={!mapUiApi}
                          presentational
                        />
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ))}
          </View>

          {showOsmCategoriesPanel && (
            <View style={styles.mapLayersSection}>
              <Text style={styles.mapLayersLabel}>{i18nT('map:components.MapPage.FiltersPanelMapSettings.osm_kategorii_371d81e3')}</Text>
              <View style={styles.mapToggleList}>
                {OSM_POI_CATEGORIES.map(({ value, labelKey }) => {
                  const enabled = osmPoiCategories.includes(value)
                  const label = i18nT(labelKey)
                  const onToggle = () => toggleOsmCategory(value)
                  return (
                    <Pressable
                      key={value}
                      testID={`map-osm-category-${value}`}
                      disabled={!mapUiApi}
                      onPress={onToggle}
                      accessibilityRole="switch"
                      accessibilityLabel={label}
                      accessibilityState={{ checked: enabled, disabled: !mapUiApi }}
                      aria-checked={enabled}
                      aria-disabled={!mapUiApi || undefined}
                      style={({ pressed }) => [
                        styles.mapToggleRow,
                        pressed && mapUiApi && styles.mapToggleRowPressed,
                        !mapUiApi && styles.mapToggleRowDisabled,
                      ]}
                    >
                      <Text style={styles.mapToggleText} numberOfLines={1}>
                        {label}
                      </Text>
                      <Toggle
                        value={enabled}
                        onValueChange={onToggle}
                        disabled={!mapUiApi}
                        presentational
                      />
                    </Pressable>
                  )
                })}
              </View>
            </View>
          )}
        </>
      )}
    </>
  )

  if (!withContainer) return <View>{body}</View>

  return (
    <CollapsibleSection
      key={isMobile ? 'map-settings-mobile' : 'map-settings-desktop'}
      title={i18nT('map:components.MapPage.FiltersPanelMapSettings.nastroyki_karty_527a23c7')}
      icon="sliders"
      defaultOpen={false}
      tone={isMobile ? 'flat' : 'default'}
    >
      {body}
    </CollapsibleSection>
  )
}

export default React.memo(FiltersPanelMapSettings)
