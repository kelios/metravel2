import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { AI_MAP_INTENT_MAX_QUERY_CHARS, AI_MAP_INTENT_MIN_QUERY_CHARS, fetchMapIntent, isAiMapIntentError, normalizeMapIntentQuery } from '@/api/aiMapIntent'
import { useLocationSearchQuery } from '@/api/geoQueries'
import { OSM_POI_CATEGORIES, OSM_POI_DEFAULT_CATEGORIES } from '@/components/MapPage/FiltersPanelMapSettings'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { formatRadiusValue } from '@/constants/mapConfig'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { getActiveLocale } from '@/i18n/format'
import type { MapUiApi } from '@/types/mapUi'
import { isAiPicksEnabled } from '@/utils/aiPicksConfig'
import { type MapIntentConstraint, type MapIntentFilters, mapIntentToFilters } from '@/utils/mapIntent'

/** Слой POI карты (`config/mapWebLayers.ts`), в который уходят категории ответа. */
export const OSM_POI_OVERLAY_ID = 'osm-poi'
/** Слой POI рисуется с зума 11 (`minZoom` слоя): кадр по центру не может быть дальше. */
const FOCUS_ZOOM_BY_RADIUS: ReadonlyArray<{ maxKm: number; zoom: number }> = [
  { maxKm: 10, zoom: 12 },
  { maxKm: Number.POSITIVE_INFINITY, zoom: 11 },
]
const INPUT_ROW_MIN_HEIGHT = 48

const CONSTRAINT_LABEL_KEYS = {
  dogs: 'aiPicksStatic:mapIntent.constraint.dogs',
  camper: 'aiPicksStatic:mapIntent.constraint.camper',
  kids: 'aiPicksStatic:mapIntent.constraint.kids',
  free: 'aiPicksStatic:mapIntent.constraint.free',
} as const satisfies Record<MapIntentConstraint, string>

type Status = 'idle' | 'loading' | 'applied' | 'unavailable' | 'limit'

/** Значения до применения ответа — к ним возвращает «Сбросить». */
interface PreviousValues {
  radius: string
  address: string
  osmPoiEnabled: boolean | undefined
}

interface AppliedIntent {
  filters: MapIntentFilters
  previous: PreviousValues
}

export interface MapIntentRowProps {
  filterValue: { radius: string; address: string }
  onFilterChange: (field: string, value: any) => void
  mapUiApi?: MapUiApi | null
  enabledOverlays?: Record<string, boolean>
  onOverlayToggle?: (id: string, enabled: boolean) => void
  testID?: string
}

export const focusZoomForRadius = (radius: string | null): number =>
  (FOCUS_ZOOM_BY_RADIUS.find((step) => Number(radius ?? Number.POSITIVE_INFINITY) <= step.maxKm) ?? FOCUS_ZOOM_BY_RADIUS[FOCUS_ZOOM_BY_RADIUS.length - 1]).zoom

/**
 * Строка «Опишите, что ищете» в панели фильтров `/map` (#2887, под флагом
 * `EXPO_PUBLIC_AI_PICKS`): описание → `POST /ai/intent` → JSON-фильтр → карта.
 * Категории ответа — слой POI (`mapUiApi.setOsmPoiCategories`, слой включается),
 * радиус — фильтр `radius`, центр — геокод Nominatim (`useLocationSearchQuery`) и
 * кадр `mapUiApi.focusOnCoord` плюс фильтр `address`. Чипы «Понял так» показывают,
 * что применено; «Сбросить» возвращает значения до запроса. Пожелания без фильтра
 * на карте (`constraints`) названы подсказкой, а не потеряны. Отказ службы —
 * подсказка «недоступно», ручные фильтры работают как раньше.
 */
export default function MapIntentRow({ filterValue, onFilterChange, mapUiApi, enabledOverlays, onOverlayToggle, testID = 'map-intent-row' }: MapIntentRowProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [applied, setApplied] = useState<AppliedIntent | null>(null)
  const [centerQuery, setCenterQuery] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const focusedForRef = useRef<string | null>(null)
  const latestRef = useRef({ filterValue, enabledOverlays })
  latestRef.current = { filterValue, enabledOverlays }

  const enabled = isAiPicksEnabled()
  const osmPoiEnabled = enabledOverlays?.[OSM_POI_OVERLAY_ID]
  const usesControlledOverlays = typeof onOverlayToggle === 'function' && Boolean(enabledOverlays)

  const setOverlayEnabled = useCallback(
    (nextEnabled: boolean) => {
      if (!usesControlledOverlays) {
        try {
          mapUiApi?.setOverlayEnabled?.(OSM_POI_OVERLAY_ID, nextEnabled)
        } catch {
          // карта ещё не готова — слой включится из состояния панели
        }
      }
      onOverlayToggle?.(OSM_POI_OVERLAY_ID, nextEnabled)
    },
    [mapUiApi, onOverlayToggle, usesControlledOverlays],
  )

  const setPoiCategories = useCallback(
    (categories: readonly string[]) => {
      try {
        mapUiApi?.setOsmPoiCategories?.([...categories])
      } catch {
        // noop: слой появится позже, повтор — в эффекте ниже
      }
    },
    [mapUiApi],
  )

  const geocode = useLocationSearchQuery({ query: centerQuery, enabled: enabled && Boolean(centerQuery), limit: 1 })
  useEffect(() => {
    if (!centerQuery || !geocode.data?.length || focusedForRef.current === centerQuery) return
    const hit = geocode.data[0]
    const lat = Number(hit.lat)
    const lng = Number(hit.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    focusedForRef.current = centerQuery
    try {
      mapUiApi?.focusOnCoord?.(`${lat},${lng}`, { zoom: focusZoomForRadius(applied?.filters.radius ?? null) })
    } catch {
      // noop
    }
  }, [applied, centerQuery, geocode.data, mapUiApi])

  // Слой POI мог включиться уже после нашего вызова (контролируемые оверлеи) и поднять
  // свои категории по умолчанию: повторяем категории ответа следующим тиком.
  useEffect(() => {
    if (!applied || !osmPoiEnabled) return
    const timer = setTimeout(() => setPoiCategories(applied.filters.osmCategories), 0)
    return () => clearTimeout(timer)
  }, [applied, osmPoiEnabled, setPoiCategories])

  useEffect(() => () => abortRef.current?.abort(), [])

  const apply = useCallback(
    (filters: MapIntentFilters) => {
      const { filterValue: current, enabledOverlays: overlays } = latestRef.current
      setApplied((previousApplied) => ({
        filters,
        previous: previousApplied?.previous ?? {
          radius: current.radius,
          address: current.address,
          osmPoiEnabled: overlays?.[OSM_POI_OVERLAY_ID],
        },
      }))
      if (filters.radius !== null) onFilterChange('radius', filters.radius)
      setOverlayEnabled(true)
      setPoiCategories(filters.osmCategories)
      focusedForRef.current = null
      if (filters.centerName) {
        onFilterChange('address', filters.centerName)
        setCenterQuery(filters.centerName)
      } else {
        setCenterQuery('')
      }
    },
    [onFilterChange, setOverlayEnabled, setPoiCategories],
  )

  const submit = useCallback(async () => {
    if (!enabled) return
    const q = normalizeMapIntentQuery(value)
    if (q.length < AI_MAP_INTENT_MIN_QUERY_CHARS) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus('loading')
    try {
      const intent = await fetchMapIntent(q, getActiveLocale(), controller.signal)
      if (controller.signal.aborted) return
      apply(mapIntentToFilters(intent))
      setStatus('applied')
    } catch (error) {
      if (controller.signal.aborted) return
      setStatus(isAiMapIntentError(error) && error.kind === 'limit' ? 'limit' : 'unavailable')
    }
  }, [apply, enabled, value])

  const reset = useCallback(() => {
    if (!applied) return
    const { previous } = applied
    onFilterChange('radius', previous.radius)
    onFilterChange('address', previous.address)
    setPoiCategories(OSM_POI_DEFAULT_CATEGORIES)
    if (previous.osmPoiEnabled === false) setOverlayEnabled(false)
    setApplied(null)
    setCenterQuery('')
    focusedForRef.current = null
    setStatus('idle')
  }, [applied, onFilterChange, setOverlayEnabled, setPoiCategories])

  if (!enabled) return null

  const chips = applied
    ? [
        ...applied.filters.osmCategories.map((category) => ({
          key: `category-${category}`,
          label: i18nT(OSM_POI_CATEGORIES.find((item) => item.value === category)?.labelKey ?? 'aiPicksStatic:mapIntent.title'),
        })),
        ...(applied.filters.radius !== null
          ? [{ key: 'radius', label: i18nT('aiPicksStatic:mapIntent.radiusChip', { value: formatRadiusValue(applied.filters.radius) }) }]
          : []),
        ...(applied.filters.centerName ? [{ key: 'center', label: applied.filters.centerName }] : []),
      ]
    : []
  const unsupported = applied?.filters.unsupportedConstraints ?? []
  const canSubmit = status !== 'loading' && normalizeMapIntentQuery(value).length >= AI_MAP_INTENT_MIN_QUERY_CHARS

  return (
    <View style={styles.block} testID={testID}>
      <Text style={styles.title}>{i18nT('aiPicksStatic:mapIntent.title')}</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={setValue}
          onSubmitEditing={() => void submit()}
          placeholder={i18nT('aiPicksStatic:mapIntent.placeholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={i18nT('aiPicksStatic:mapIntent.inputLabel')}
          maxLength={AI_MAP_INTENT_MAX_QUERY_CHARS}
          returnKeyType="search"
          blurOnSubmit
          autoCorrect={false}
          editable={status !== 'loading'}
          style={styles.input}
          testID="map-intent-input"
        />
        <IconButton
          icon={<Feather name={status === 'loading' ? 'loader' : 'arrow-right'} size={18} color={canSubmit ? colors.primary : colors.textMuted} />}
          label={i18nT('aiPicksStatic:mapIntent.submit')}
          onPress={() => void submit()}
          disabled={!canSubmit}
          size="sm"
          testID="map-intent-submit"
        />
      </View>

      {status === 'loading' ? (
        <Text style={styles.hint} testID="map-intent-loading">
          {i18nT('aiPicksStatic:mapIntent.loading')}
        </Text>
      ) : null}

      {status === 'unavailable' ? (
        <Text style={styles.hint} testID="map-intent-unavailable">
          {i18nT('aiPicksStatic:mapIntent.unavailable')}
        </Text>
      ) : null}

      {status === 'limit' ? (
        <Text style={styles.hint} testID="map-intent-limit">
          {i18nT('aiPicksStatic:mapIntent.limit')}
        </Text>
      ) : null}

      {applied ? (
        <View style={styles.result} testID="map-intent-applied">
          <Text style={styles.understood}>{i18nT('aiPicksStatic:mapIntent.understood')}</Text>
          <View style={styles.chips} testID="map-intent-chips">
            {chips.map((chip) => (
              <View key={chip.key} style={styles.chip} testID={`map-intent-chip-${chip.key}`}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {chip.label}
                </Text>
              </View>
            ))}
          </View>
          {unsupported.length > 0 ? (
            <Text style={styles.hint} testID="map-intent-constraints">
              {i18nT('aiPicksStatic:mapIntent.constraintUnsupported', {
                names: unsupported.map((key) => i18nT(CONSTRAINT_LABEL_KEYS[key])).join(', '),
              })}
            </Text>
          ) : null}
          <Button
            label={i18nT('aiPicksStatic:mapIntent.reset')}
            onPress={reset}
            variant="outline"
            size="sm"
            style={styles.resetButton}
            testID="map-intent-reset"
          />
        </View>
      ) : null}
    </View>
  )
}

function createStyles(colors: ThemedColors) {
  return StyleSheet.create({
    block: {
      marginBottom: DESIGN_TOKENS.spacing.sm,
      gap: DESIGN_TOKENS.spacing.xxs,
    },
    title: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xxs,
      minHeight: INPUT_ROW_MIN_HEIGHT,
      paddingLeft: DESIGN_TOKENS.spacing.sm,
      paddingRight: DESIGN_TOKENS.spacing.xxs,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      minWidth: 0,
      minHeight: 44,
      fontSize: 16,
      color: colors.text,
      ...Platform.select({ web: { outlineStyle: 'none' as never } }),
    },
    hint: {
      fontSize: 13,
      color: colors.textMuted,
    },
    result: {
      gap: DESIGN_TOKENS.spacing.xxs,
    },
    understood: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DESIGN_TOKENS.spacing.xxs,
    },
    chip: {
      maxWidth: '100%',
      paddingHorizontal: DESIGN_TOKENS.spacing.xs,
      paddingVertical: DESIGN_TOKENS.spacing.xxs,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primarySoft,
    },
    chipText: {
      fontSize: 13,
      color: colors.text,
    },
    resetButton: {
      alignSelf: 'flex-start',
    },
  })
}
