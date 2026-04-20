/**
 * MapQuickFilters - compact selector chips over the map.
 * Mobile uses two selectors: filters and categories.
 */
import React, { useMemo } from 'react'
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import CardActionPressable from '@/components/ui/CardActionPressable'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

interface MapQuickFiltersProps {
  filtersValue?: string
  categoriesValue?: string
  onPressFilters?: () => void
  onPressCategories?: () => void
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

export const MapQuickFilters: React.FC<MapQuickFiltersProps> = React.memo(
  ({ filtersValue, categoriesValue, onPressFilters, onPressCategories }) => {
    const colors = useThemedColors()
    const { width } = useWindowDimensions()
    const isNarrow = width > 0 && width <= PHONE_COMPACT_LAYOUT_MAX_WIDTH
    const isVeryNarrow = width > 0 && width <= PHONE_VERY_NARROW_LAYOUT_MAX_WIDTH
    const styles = useMemo(() => getStyles(colors, { isNarrow, isVeryNarrow }), [colors, isNarrow, isVeryNarrow])

    const selectors = [
      {
        key: 'filters',
        label: 'Фильтры',
        value: filtersValue || 'Выбор',
        icon: 'sliders' as const,
        onPress: onPressFilters,
      },
      {
        key: 'categories',
        label: 'Категории',
        value: categoriesValue || 'Выбор',
        icon: 'grid' as const,
        onPress: onPressCategories,
      },
    ].filter((item) => typeof item.onPress === 'function')

    if (!selectors.length) return null

    return (
      <View style={[styles.container, { pointerEvents: 'box-none' }]}>
        <View style={styles.row}>
          {selectors.map((selector) => (
            <CardActionPressable
              key={selector.key}
              accessibilityLabel={`${selector.label}: ${selector.value}`}
              onPress={selector.onPress}
              title={selector.label}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            >
              <View style={styles.iconBadge}>
                <Feather name={selector.icon} size={13} color={colors.primaryText} />
              </View>
              <Text style={styles.chipLabel} numberOfLines={1}>
                {selector.label}
              </Text>
              <View style={styles.valueBadge}>
                <Text style={styles.valueText} numberOfLines={1}>
                  {selector.value}
                </Text>
              </View>
            </CardActionPressable>
          ))}
        </View>
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
      flexDirection: 'row',
      gap: options.isVeryNarrow ? 8 : 10,
      alignItems: 'stretch',
    },
    chip: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: options.isVeryNarrow ? 5 : options.isNarrow ? 6 : 8,
      paddingHorizontal: options.isVeryNarrow ? 10 : options.isNarrow ? 11 : 14,
      paddingVertical: options.isVeryNarrow ? 6 : options.isNarrow ? 7 : 9,
      borderRadius: options.isVeryNarrow ? 18 : options.isNarrow ? 20 : 24,
      backgroundColor: options.isNarrow ? 'rgba(255,255,255,0.84)' : 'rgba(255,255,255,0.88)',
      borderWidth: 1,
      borderColor: colors.surface,
      ...(Platform.OS === 'web'
        ? ({
            backdropFilter: 'blur(18px) saturate(1.15)',
            WebkitBackdropFilter: 'blur(18px) saturate(1.15)',
            boxShadow: '0 10px 24px rgba(58,58,58,0.08), 0 2px 8px rgba(58,58,58,0.05)',
            cursor: 'pointer',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease',
          } as any)
        : colors.shadows.light),
    },
    chipPressed: {
      opacity: 0.85,
      ...(Platform.OS === 'web'
        ? ({
            transform: 'translateY(0px) scale(0.985)',
          } as any)
        : null),
    },
    iconBadge: {
      width: options.isVeryNarrow ? 20 : options.isNarrow ? 22 : 24,
      height: options.isVeryNarrow ? 20 : options.isNarrow ? 22 : 24,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
      flexShrink: 0,
    },
    chipLabel: {
      fontSize: options.isVeryNarrow ? 11 : options.isNarrow ? 12 : 13,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 0.1,
      flexShrink: 1,
    },
    valueBadge: {
      marginLeft: 'auto',
      maxWidth: options.isVeryNarrow ? 64 : options.isNarrow ? 84 : 100,
      minHeight: options.isVeryNarrow ? 20 : 22,
      paddingHorizontal: 8,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
      flexShrink: 0,
    },
    valueText: {
      fontSize: options.isVeryNarrow ? 10 : 11,
      fontWeight: '800',
      color: colors.primaryText,
    },
  })
