import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import IconButton from '@/components/ui/IconButton'
import { Toggle } from '@/components/ui/Toggle'
import CollapsibleSection from '@/components/MapPage/CollapsibleSection'
import MapIcon from './MapIcon'
import { WEB_MAP_BASE_LAYERS, WEB_MAP_OVERLAY_LAYERS } from '@/config/mapWebLayers'
import type { ThemedColors } from '@/hooks/useTheme'
import type { MapUiApi } from '@/types/mapUi'

const OSM_POI_CATEGORIES = [
  'Достопримечательности',
  'Культура',
  'Видовые места',
  'Развлечения',
  'Религия',
  'История',
] as const

const OSM_POI_DEFAULT_CATEGORIES = [
  'Достопримечательности',
  'Видовые места',
  'Культура',
] as const

interface FiltersPanelMapSettingsProps {
  colors: ThemedColors
  styles: any
  isMobile: boolean
  mode: 'radius' | 'route'
  mapUiApi?: MapUiApi | null
  overlayOptions?: Array<{ id: string; title: string }>
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
  onResetOverlays: _onResetOverlays,
  totalPoints: _totalPoints,
  hasFilters: _hasFilters,
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
  const [localEnabledOverlays, setLocalEnabledOverlays] = useState<
    Record<string, boolean>
  >(() => {
    const initial: Record<string, boolean> = {}
    for (const overlay of WEB_MAP_OVERLAY_LAYERS) {
      initial[overlay.id] = Boolean(overlay.defaultEnabled)
    }
    return initial
  })
  const [osmPoiCategories, setOsmPoiCategories] = useState<string[]>(() => [
    ...OSM_POI_DEFAULT_CATEGORIES,
  ])

  const safeMapUiCall = useCallback((fn?: () => void) => {
    if (typeof fn !== 'function') return
    try {
      fn()
    } catch {
      // noop
    }
  }, [])

  const availableOverlays = useMemo(() => {
    if (Array.isArray(overlayOptions) && overlayOptions.length > 0) {
      return overlayOptions
    }

    return WEB_MAP_OVERLAY_LAYERS.filter(
      (overlay) =>
        overlay.kind.startsWith('osm-overpass-') || Boolean(overlay.url),
    )
  }, [overlayOptions])

  const usesControlledOverlays =
    typeof onOverlayToggle === 'function' && Boolean(controlledEnabledOverlays)
  const resolvedEnabledOverlays =
    controlledEnabledOverlays ?? localEnabledOverlays

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

  const canFitToResults = Boolean(mapUiApi?.capabilities?.canFitToResults)
  const canExportRoute = Boolean(mapUiApi?.capabilities?.canExportRoute)
  const osmPoiEnabled = Boolean(resolvedEnabledOverlays['osm-poi'])

  const resolvedShowBaseLayer = showBaseLayer ?? showLayers
  const resolvedShowOverlays = showOverlays ?? showLayers
  const shouldShowBaseLayerSelector =
    resolvedShowBaseLayer && WEB_MAP_BASE_LAYERS.length > 1

  useEffect(() => {
    if (!mapUiApi) return
    try {
      mapUiApi.setBaseLayer(selectedBaseLayerId)
    } catch {
      // noop
    }
  }, [mapUiApi, selectedBaseLayerId])

  useEffect(() => {
    if (usesControlledOverlays || !mapUiApi) return

    try {
      for (const overlay of WEB_MAP_OVERLAY_LAYERS) {
        mapUiApi.setOverlayEnabled(
          overlay.id,
          Boolean(localEnabledOverlays[overlay.id]),
        )
      }
    } catch {
      // noop
    }
  }, [mapUiApi, localEnabledOverlays, usesControlledOverlays])

  useEffect(() => {
    if (!mapUiApi?.setOsmPoiCategories || !osmPoiEnabled) return
    mapUiApi.setOsmPoiCategories(osmPoiCategories)
  }, [mapUiApi, osmPoiCategories, osmPoiEnabled])

  const body = (
    <>
      <View style={styles.mapControlsRow}>
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
        <View style={styles.mapLayersSection}>
          <Text style={styles.mapLayersLabel}>Слой карты</Text>
          <View style={styles.mapLayersRow}>
            {WEB_MAP_BASE_LAYERS.map((layer) => {
              const active = selectedBaseLayerId === layer.id

              return (
                <Chip
                  key={layer.id}
                  label={layer.title}
                  selected={active}
                  style={[
                    styles.mapLayerChip,
                    active && styles.mapLayerChipSelected,
                  ]}
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
      ) : null}

      {resolvedShowOverlays ? (
        <>
          <View style={styles.mapLayersSection}>
            <Text style={styles.mapLayersLabel}>Оверлеи</Text>
            <View style={styles.mapToggleList}>
              {availableOverlays.map((overlay) => {
                const enabled = Boolean(resolvedEnabledOverlays[overlay.id])

                return (
                  <Pressable
                    key={overlay.id}
                    testID={`map-overlay-${overlay.id}`}
                    disabled={!mapUiApi}
                    onPress={() => {
                      updateOverlayEnabled(overlay.id, !enabled)
                    }}
                    accessibilityRole="switch"
                    accessibilityLabel={overlay.title}
                    accessibilityState={{ checked: enabled, disabled: !mapUiApi }}
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
                      onValueChange={() => {
                        if (!mapUiApi) return
                        updateOverlayEnabled(overlay.id, !enabled)
                      }}
                      disabled={!mapUiApi}
                    />
                  </Pressable>
                )
              })}
            </View>
          </View>

          {osmPoiEnabled && typeof mapUiApi?.setOsmPoiCategories === 'function' ? (
            <View style={styles.mapLayersSection}>
              <Text style={styles.mapLayersLabel}>OSM: категории</Text>
              <View style={styles.mapToggleList}>
                {OSM_POI_CATEGORIES.map((category) => {
                  const enabled = osmPoiCategories.includes(category)

                  return (
                    <Pressable
                      key={category}
                      testID={`map-osm-category-${category}`}
                      disabled={!mapUiApi}
                      onPress={() => {
                        if (!mapUiApi) return
                        setOsmPoiCategories((prev) => {
                          const next = prev.includes(category)
                            ? prev.filter((item) => item !== category)
                            : [...prev, category]
                          safeMapUiCall(() =>
                            mapUiApi?.setOsmPoiCategories?.(next),
                          )
                          return next
                        })
                      }}
                      accessibilityRole="switch"
                      accessibilityLabel={category}
                      accessibilityState={{
                        checked: enabled,
                        disabled: !mapUiApi,
                      }}
                      style={({ pressed }) => [
                        styles.mapToggleRow,
                        pressed && mapUiApi && styles.mapToggleRowPressed,
                        !mapUiApi && styles.mapToggleRowDisabled,
                      ]}
                    >
                      <Text style={styles.mapToggleText} numberOfLines={1}>
                        {category}
                      </Text>
                      <Toggle
                        value={enabled}
                        onValueChange={() => {
                          if (!mapUiApi) return
                          setOsmPoiCategories((prev) => {
                            const next = prev.includes(category)
                              ? prev.filter((item) => item !== category)
                              : [...prev, category]
                            safeMapUiCall(() =>
                              mapUiApi?.setOsmPoiCategories?.(next),
                            )
                            return next
                          })
                        }}
                        disabled={!mapUiApi}
                      />
                    </Pressable>
                  )
                })}
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </>
  )

  if (!withContainer) {
    return <View>{body}</View>
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
  )
}

export default React.memo(FiltersPanelMapSettings)
