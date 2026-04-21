/**
 * MapQuickFilters - compact selector chips over the map.
 * Each chip can open an inline popover (radius / categories / overlays).
 * Falls back to external onPress handlers when popover props are absent.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import CardActionPressable from '@/components/ui/CardActionPressable'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { MapChipPopover, type AnchorRect } from './popovers/MapChipPopover'
import { RadiusPopover } from './popovers/RadiusPopover'
import { CategoriesPopover } from './popovers/CategoriesPopover'
import { OverlaysPopover } from './popovers/OverlaysPopover'

type CategoryOption = string | { id?: string | number; name?: string; value?: string }

interface RadiusOption {
  id: string
  name: string
}

interface OverlayOption {
  id: string
  title: string
}

interface MapQuickFiltersProps {
  radiusValue?: string
  categoriesValue?: string
  overlaysValue?: string
  onPressRadius?: () => void
  onPressCategories?: () => void
  onPressOverlays?: () => void
  radiusOptions?: ReadonlyArray<RadiusOption>
  radiusSelected?: string
  onChangeRadius?: (next: string) => void
  categoriesOptions?: ReadonlyArray<CategoryOption>
  categoriesSelected?: string[]
  onChangeCategories?: (next: string[]) => void
  overlayOptions?: ReadonlyArray<OverlayOption>
  enabledOverlays?: Record<string, boolean>
  onChangeOverlay?: (id: string, enabled: boolean) => void
  onResetOverlays?: () => void
  travelsData?: ReadonlyArray<{ categoryName?: string | null | undefined }>
}

const PHONE_COMPACT_LAYOUT_MAX_WIDTH = 430
const PHONE_VERY_NARROW_LAYOUT_MAX_WIDTH = 360

export const CATEGORY_ICONS: Record<
  string,
  React.ComponentProps<typeof Feather>['name']
> = {
  Горы: 'triangle',
  Пляжи: 'sun',
  Города: 'map-pin',
  Природа: 'feather',
  Музеи: 'home',
  Озера: 'droplet',
  Культура: 'music',
  Спорт: 'activity',
  Еда: 'coffee',
  Архитектура: 'layers',
}

type ChipKey = 'radius' | 'categories' | 'overlays'

export const MapQuickFilters: React.FC<MapQuickFiltersProps> = React.memo(
  ({
    radiusValue,
    categoriesValue,
    overlaysValue,
    onPressRadius,
    onPressCategories,
    onPressOverlays,
    radiusOptions,
    radiusSelected,
    onChangeRadius,
    categoriesOptions,
    categoriesSelected,
    onChangeCategories,
    overlayOptions,
    enabledOverlays,
    onChangeOverlay,
    onResetOverlays,
    travelsData,
  }) => {
    const colors = useThemedColors()
    const { width } = useWindowDimensions()
    const isNarrow = width > 0 && width <= PHONE_COMPACT_LAYOUT_MAX_WIDTH
    const isVeryNarrow = width > 0 && width <= PHONE_VERY_NARROW_LAYOUT_MAX_WIDTH
    const styles = useMemo(
      () => getStyles(colors, { isNarrow, isVeryNarrow }),
      [colors, isNarrow, isVeryNarrow],
    )

    const radiusAnchorRef = useRef<View | null>(null)
    const categoriesAnchorRef = useRef<View | null>(null)
    const overlaysAnchorRef = useRef<View | null>(null)
    const [openChip, setOpenChip] = useState<ChipKey | null>(null)
    const [anchor, setAnchor] = useState<AnchorRect | null>(null)

    const hasRadiusPopover =
      Array.isArray(radiusOptions) &&
      radiusOptions.length > 0 &&
      typeof onChangeRadius === 'function'

    const hasCategoriesPopover =
      Array.isArray(categoriesOptions) &&
      categoriesOptions.length > 0 &&
      typeof onChangeCategories === 'function'

    const hasOverlaysPopover =
      Array.isArray(overlayOptions) &&
      overlayOptions.length > 0 &&
      typeof onChangeOverlay === 'function'

    const measureAndOpen = useCallback(
      (key: ChipKey, ref: React.MutableRefObject<View | null>) => {
        const node = ref.current
        if (!node || typeof node.measureInWindow !== 'function') {
          setAnchor(null)
          setOpenChip(key)
          return
        }
        node.measureInWindow((x, y, w, h) => {
          setAnchor({ x, y, width: w, height: h })
          setOpenChip(key)
        })
      },
      [],
    )

    const handleClose = useCallback(() => {
      setOpenChip(null)
      setAnchor(null)
    }, [])

    const handleRadiusPress = useCallback(() => {
      if (hasRadiusPopover) {
        measureAndOpen('radius', radiusAnchorRef)
        return
      }
      onPressRadius?.()
    }, [hasRadiusPopover, measureAndOpen, onPressRadius])

    const handleCategoriesPress = useCallback(() => {
      if (hasCategoriesPopover) {
        measureAndOpen('categories', categoriesAnchorRef)
        return
      }
      onPressCategories?.()
    }, [hasCategoriesPopover, measureAndOpen, onPressCategories])

    const handleOverlaysPress = useCallback(() => {
      if (hasOverlaysPopover) {
        measureAndOpen('overlays', overlaysAnchorRef)
        return
      }
      onPressOverlays?.()
    }, [hasOverlaysPopover, measureAndOpen, onPressOverlays])

    const selectors = [
      {
        key: 'radius' as const,
        label: 'Радиус',
        value: radiusValue || 'Выбор',
        icon: 'radio' as const,
        onPress: handleRadiusPress,
        ref: radiusAnchorRef,
        hasHandler: hasRadiusPopover || typeof onPressRadius === 'function',
      },
      {
        key: 'categories' as const,
        label: 'Что посмотреть',
        value: categoriesValue || 'Выбор',
        icon: 'grid' as const,
        onPress: handleCategoriesPress,
        ref: categoriesAnchorRef,
        hasHandler: hasCategoriesPopover || typeof onPressCategories === 'function',
      },
      {
        key: 'overlays' as const,
        label: 'Оверлеи',
        value: overlaysValue || 'Выкл',
        icon: 'layers' as const,
        onPress: handleOverlaysPress,
        ref: overlaysAnchorRef,
        hasHandler: hasOverlaysPopover || typeof onPressOverlays === 'function',
      },
    ].filter((item) => item.hasHandler)

    if (!selectors.length) return null

    return (
      <View style={styles.container} pointerEvents="box-none">
        <View style={styles.row} pointerEvents="box-none">
          {selectors.map((selector) => (
            <View
              key={selector.key}
              ref={selector.ref}
              collapsable={false}
              style={styles.fieldWrap}
            >
              <CardActionPressable
                accessibilityLabel={`${selector.label}: ${selector.value}`}
                onPress={selector.onPress}
                title={selector.label}
                style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
              >
                <View style={styles.iconBadge}>
                  <Feather name={selector.icon} size={13} color={colors.primaryText} />
                </View>
                <View style={styles.fieldCopy}>
                  <Text style={styles.fieldLabel} numberOfLines={1}>
                    {selector.label}
                  </Text>
                </View>
                <View style={styles.fieldValueWrap}>
                  <Text style={styles.fieldValue} numberOfLines={1}>
                    {selector.value}
                  </Text>
                  <Feather name="chevron-down" size={14} color={colors.textMuted} />
                </View>
              </CardActionPressable>
            </View>
          ))}
        </View>

        {hasRadiusPopover && (
          <MapChipPopover
            visible={openChip === 'radius'}
            onClose={handleClose}
            anchor={anchor}
            maxWidth={280}
            testID="map-quick-filters-radius-popover"
          >
            <RadiusPopover
              options={radiusOptions!}
              value={radiusSelected ?? ''}
              onChange={(next) => onChangeRadius!(next)}
              onClose={handleClose}
            />
          </MapChipPopover>
        )}

        {hasCategoriesPopover && (
          <MapChipPopover
            visible={openChip === 'categories'}
            onClose={handleClose}
            anchor={anchor}
            maxWidth={340}
            testID="map-quick-filters-categories-popover"
          >
            <CategoriesPopover
              categories={categoriesOptions!}
              selected={categoriesSelected ?? []}
              travelsData={travelsData ?? []}
              onApply={(next) => onChangeCategories!(next)}
              onClose={handleClose}
            />
          </MapChipPopover>
        )}

        {hasOverlaysPopover && (
          <MapChipPopover
            visible={openChip === 'overlays'}
            onClose={handleClose}
            anchor={anchor}
            maxWidth={360}
            testID="map-quick-filters-overlays-popover"
          >
            <OverlaysPopover
              options={overlayOptions!}
              enabledOverlays={enabledOverlays ?? {}}
              onToggle={(id, enabled) => onChangeOverlay!(id, enabled)}
              onReset={onResetOverlays}
              onClose={handleClose}
            />
          </MapChipPopover>
        )}
      </View>
    )
  },
)

const getStyles = (
  colors: ThemedColors,
  options: { isNarrow: boolean; isVeryNarrow: boolean },
) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: options.isNarrow ? 8 : 16,
      left: options.isNarrow ? 12 : 16,
      right: options.isNarrow ? 12 : 16,
      zIndex: 5,
    },
    row: {
      flexDirection: options.isVeryNarrow ? 'column' : 'row',
      gap: options.isVeryNarrow ? 8 : 10,
      alignItems: 'stretch',
    },
    fieldWrap: {
      flex: 1,
      minWidth: 0,
    },
    field: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: options.isVeryNarrow ? 6 : options.isNarrow ? 8 : 10,
      minHeight: options.isVeryNarrow ? 40 : options.isNarrow ? 43 : 46,
      paddingHorizontal: options.isVeryNarrow ? 10 : options.isNarrow ? 11 : 13,
      paddingVertical: options.isVeryNarrow ? 6 : options.isNarrow ? 7 : 8,
      borderRadius: options.isVeryNarrow ? 15 : options.isNarrow ? 17 : 18,
      backgroundColor: Platform.OS === 'web' ? colors.surfaceAlpha40 : colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...(Platform.OS === 'web'
        ? ({
            backdropFilter: 'blur(16px) saturate(1.08)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.08)',
            boxShadow: '0 10px 22px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.04)',
            cursor: 'pointer',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease',
          } as any)
        : colors.shadows.light),
    },
    fieldPressed: {
      opacity: 0.85,
      ...(Platform.OS === 'web'
        ? ({
            transform: 'translateY(0px) scale(0.985)',
          } as any)
        : null),
    },
    iconBadge: {
      width: options.isVeryNarrow ? 18 : options.isNarrow ? 20 : 22,
      height: options.isVeryNarrow ? 18 : options.isNarrow ? 20 : 22,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
      flexShrink: 0,
    },
    fieldCopy: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
    },
    fieldLabel: {
      fontSize: options.isVeryNarrow ? 10 : options.isNarrow ? 11 : 12,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 0.1,
    },
    fieldValueWrap: {
      marginLeft: 'auto',
      maxWidth: options.isVeryNarrow ? 90 : options.isNarrow ? 108 : 120,
      minHeight: options.isVeryNarrow ? 22 : 26,
      paddingLeft: 7,
      paddingRight: 4,
      borderRadius: 999,
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlpha40,
      flexShrink: 0,
    },
    fieldValue: {
      fontSize: options.isVeryNarrow ? 10 : 11,
      fontWeight: '800',
      color: colors.primaryText,
    },
  })
