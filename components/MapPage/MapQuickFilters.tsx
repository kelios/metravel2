/**
 * MapQuickFilters — горизонтальный scroll с chip-кнопками категорий поверх карты
 */
import React, { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { LinearGradient } from 'expo-linear-gradient'
import CardActionPressable from '@/components/ui/CardActionPressable'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

interface Category {
  id: string | number
  name: string
}

interface MapQuickFiltersProps {
  categories: Category[]
  selectedCategories: string[]
  onToggleCategory: (categoryName: string) => void
  maxVisible?: number
  onOpenFilters?: () => void
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
  ({
    categories,
    selectedCategories,
    onToggleCategory,
    maxVisible = 5,
    onOpenFilters,
  }) => {
    const colors = useThemedColors()
    const { width } = useWindowDimensions()
    const isNarrow = width > 0 && width <= PHONE_COMPACT_LAYOUT_MAX_WIDTH
    const isVeryNarrow =
      width > 0 && width <= PHONE_VERY_NARROW_LAYOUT_MAX_WIDTH
    const styles = useMemo(
      () => getStyles(colors, { isNarrow, isVeryNarrow }),
      [colors, isNarrow, isVeryNarrow],
    )
    const safeCategories = useMemo(
      () =>
        categories.filter((category) => {
          const name =
            typeof category?.name === 'string' ? category.name.trim() : ''
          return Boolean(name)
        }),
      [categories],
    )
    const selectedCount = selectedCategories.length
    const shouldReserveActionChipSpace =
      typeof onOpenFilters === 'function' &&
      (selectedCount > 0 ||
        safeCategories.length > (isVeryNarrow ? 2 : isNarrow ? 2 : maxVisible))
    const effectiveMaxVisible = isVeryNarrow
      ? Math.min(maxVisible, 2)
      : isNarrow
        ? Math.min(maxVisible, shouldReserveActionChipSpace ? 2 : 3)
        : maxVisible

    const visible = useMemo(
      () => safeCategories.slice(0, effectiveMaxVisible),
      [safeCategories, effectiveMaxVisible],
    )
    const hiddenCount = Math.max(safeCategories.length - visible.length, 0)
    const shouldShowActionChip =
      typeof onOpenFilters === 'function' &&
      (hiddenCount > 0 || selectedCount > 0)
    const actionChipLabel = isNarrow ? 'Все' : 'Все фильтры'
    const actionBadgeLabel =
      selectedCount > 0
        ? String(selectedCount)
        : hiddenCount > 0
          ? `+${hiddenCount}`
          : ''
    const actionAccessibilityLabel =
      hiddenCount > 0
        ? `Открыть все фильтры, скрыто ещё ${hiddenCount}`
        : `Открыть все фильтры, выбрано ${selectedCount}`

    if (!visible.length) return null

    // Show fade hint when there are more items than visible (hidden chips or action chip)
    const showFadeHint = hiddenCount > 0 || shouldShowActionChip

    return (
      <View style={[styles.container, { pointerEvents: 'box-none' }]}>
        <View style={styles.scrollWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            style={[styles.scroll, Platform.OS === 'web' && styles.scrollWeb]}
          >
            {visible.map((cat) => {
              const isSelected = selectedCategories.includes(cat.name)
              const iconName = CATEGORY_ICONS[cat.name]

              return (
                <CardActionPressable
                  key={cat.id}
                  accessibilityLabel={`${isSelected ? 'Убрать' : 'Добавить'} фильтр: ${cat.name}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => onToggleCategory(cat.name)}
                  title={cat.name}
                  style={({ pressed }) => [
                    styles.chip,
                    isSelected && styles.chipActive,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.iconBadge,
                      isSelected && styles.iconBadgeActive,
                    ]}
                  >
                    {isSelected ? (
                      <Feather
                        name="x"
                        size={13}
                        color={colors.textOnPrimary}
                      />
                    ) : iconName ? (
                      <Feather
                        name={iconName}
                        size={13}
                        color={colors.primaryText}
                      />
                    ) : (
                      <Feather name="circle" size={10} color={colors.primary} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.chipText,
                      isSelected && styles.chipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {cat.name}
                  </Text>
                </CardActionPressable>
              )
            })}

            {shouldShowActionChip && (
              <CardActionPressable
                accessibilityLabel={actionAccessibilityLabel}
                onPress={onOpenFilters}
                title="Все фильтры"
                style={({ pressed }) => [
                  styles.chip,
                  styles.actionChip,
                  selectedCount > 0 && styles.actionChipActive,
                  pressed && styles.chipPressed,
                ]}
              >
                <View style={styles.actionIconBadge}>
                  <Feather
                    name="sliders"
                    size={13}
                    color={colors.primaryText}
                  />
                </View>
                <Text style={styles.chipText} numberOfLines={1}>
                  {actionChipLabel}
                </Text>
                {actionBadgeLabel ? (
                  <View style={styles.actionBadge}>
                    <Text style={styles.actionBadgeText}>
                      {actionBadgeLabel}
                    </Text>
                  </View>
                ) : null}
              </CardActionPressable>
            )}
          </ScrollView>
          {showFadeHint && Platform.OS === 'web' && (
            <LinearGradient
              colors={[
                'rgba(253, 252, 251, 0)',
                'rgba(253, 252, 251, 0.84)',
                colors.background,
              ]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.fadeHint, { pointerEvents: 'none' }]}
            />
          )}
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
      top: options.isNarrow ? 10 : 16,
      left: options.isNarrow ? 12 : 16,
      right: options.isNarrow ? 12 : 16,
      zIndex: 5,
    },
    scrollWrapper: {
      position: 'relative',
      flexShrink: 0,
      maxWidth: '100%',
    },
    fadeHint: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: 60,
      borderTopRightRadius: 24,
      borderBottomRightRadius: 24,
    },
    scroll: {
      flexGrow: 0,
    },
    scrollWeb: {
      ...(Platform.OS === 'web'
        ? ({
            overflowX: 'auto',
            overflowY: 'hidden',
            overscrollBehaviorX: 'contain',
            touchAction: 'pan-x pan-y',
            WebkitOverflowScrolling: 'touch',
          } as any)
        : null),
    },
    scrollContent: {
      gap: options.isVeryNarrow ? 6 : options.isNarrow ? 8 : 10,
      paddingRight: options.isNarrow ? 18 : 28,
      ...(Platform.OS === 'web'
        ? ({
            minWidth: 'max-content',
            touchAction: 'pan-x pan-y',
            WebkitOverflowScrolling: 'touch',
          } as any)
        : null),
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: options.isVeryNarrow ? 6 : 8,
      paddingHorizontal: options.isVeryNarrow ? 10 : options.isNarrow ? 12 : 14,
      paddingVertical: options.isVeryNarrow ? 7 : options.isNarrow ? 8 : 9,
      borderRadius: options.isVeryNarrow ? 20 : 24,
      backgroundColor: 'rgba(255,255,255,0.88)',
      borderWidth: 1,
      borderColor: colors.surface,
      ...(Platform.OS === 'web'
        ? ({
            backdropFilter: 'blur(18px) saturate(1.15)',
            WebkitBackdropFilter: 'blur(18px) saturate(1.15)',
            boxShadow:
              '0 10px 24px rgba(58,58,58,0.08), 0 2px 8px rgba(58,58,58,0.05)',
            cursor: 'pointer',
            transition:
              'transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease, background-color 0.18s ease',
          } as any)
        : colors.shadows.light),
    },
    chipActive: {
      backgroundColor: colors.surface,
      borderColor: 'rgba(255,255,255,0.95)',
      ...(Platform.OS === 'web'
        ? ({
            boxShadow:
              '0 14px 30px rgba(122,157,143,0.18), 0 2px 10px rgba(58,58,58,0.06)',
            transform: 'translateY(-1px)',
          } as any)
        : null),
    },
    chipPressed: {
      opacity: 0.85,
      ...(Platform.OS === 'web'
        ? ({
            transform: 'translateY(0px) scale(0.985)',
          } as any)
        : null),
    },
    actionChip: {
      borderWidth: 1,
      borderColor: colors.surface,
      backgroundColor: 'rgba(255,255,255,0.92)',
    },
    actionChipActive: {
      borderColor: colors.surface,
      backgroundColor: colors.surface,
    },
    iconBadge: {
      width: options.isVeryNarrow ? 22 : 24,
      height: options.isVeryNarrow ? 22 : 24,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    iconBadgeActive: {
      backgroundColor: colors.brand,
    },
    actionIconBadge: {
      width: options.isVeryNarrow ? 22 : 24,
      height: options.isVeryNarrow ? 22 : 24,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    actionBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    actionBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primaryText,
    },
    chipText: {
      fontSize: options.isVeryNarrow ? 12 : 13,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 0.1,
      maxWidth: options.isVeryNarrow ? 104 : options.isNarrow ? 132 : 168,
    },
    chipTextActive: {
      color: colors.text,
    },
  })
