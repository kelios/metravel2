/**
 * MapEmptyStateToast — компактная плашка «в этой области ничего не нашлось»
 * поверх самой карты, при ЗАКРЫТОЙ панели фильтров.
 *
 * Зачем: «Искать в этой области» честно шлёт запрос с новым центром, и при
 * total=0 бэкенд отдаёт {"total":0,"data":[]}. Маркеры пропадали, счётчик в
 * бейдже списка исчезал — и никакого сообщения не было. Существующий
 * empty-state (`filters-empty-state`) живёт ВНУТРИ FiltersPanelBody, то есть в
 * этом сценарии пользователь его не видит никогда.
 *
 * Действия и гейт — те же, что у панели (общий `mapEmptyState`), чтобы
 * «Увеличить радиус» / «Сбросить» вели себя одинаково в обоих местах.
 */
import React from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'
import type { MapRadiusOption } from '@/components/MapPage/mapEmptyState'
import { translate as i18nT } from '@/i18n'

interface MapEmptyStateToastProps {
  colors: ThemedColors
  /** Следующий пресет радиуса или null, если текущий уже максимальный. */
  nextRadiusOption: MapRadiusOption | null
  onExpandRadius: (radiusId: string) => void
  /** Показываем «Сбросить фильтры» только когда есть что сбрасывать. */
  hasActiveFilters?: boolean
  onResetFilters?: () => void
  /** Абсолютный `bottom`: считается вызывающим, чтобы плашка не легла на док/FAB. */
  bottom: number | string
}

const MapEmptyStateToastInner: React.FC<MapEmptyStateToastProps> = ({
  colors,
  nextRadiusOption,
  onExpandRadius,
  hasActiveFilters,
  onResetFilters,
  bottom,
}) => {
  const styles = getStyles(colors)
  const showReset = Boolean(hasActiveFilters && onResetFilters)
  const showExpand = Boolean(nextRadiusOption)

  return (
    <View
      style={[styles.toast, { bottom } as any]}
      testID="map-empty-state-toast"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.titleRow}>
        <Feather name="map-pin" size={14} color={colors.textMuted} />
        <Text style={styles.title} numberOfLines={2}>
          {i18nT('map:components.MapPage.MapEmptyStateToast.v_etoy_oblasti_nichego_ne_nashlos_5b1c0a74')}
        </Text>
      </View>

      {(showExpand || showReset) && (
        <View style={styles.actions}>
          {showExpand && nextRadiusOption && (
            <Pressable
              testID="map-empty-state-expand-radius"
              onPress={() => onExpandRadius(nextRadiusOption.id)}
              accessibilityRole="button"
              accessibilityLabel={i18nT(
                'map:components.MapPage.FiltersPanelBody.uvelichit_radius_do_value1_kilometrov_92dd77b0',
                { value1: nextRadiusOption.name },
              )}
              hitSlop={6}
              style={({ pressed }) => [styles.actionPrimary, pressed && styles.actionPressed]}
            >
              <Text style={styles.actionPrimaryText} numberOfLines={1}>
                {i18nT('map:components.MapPage.FiltersPanelBody.uvelichit_do_value1_km_edbb1aa6', {
                  value1: nextRadiusOption.name,
                })}
              </Text>
            </Pressable>
          )}
          {showReset && (
            <Pressable
              testID="map-empty-state-reset"
              onPress={onResetFilters}
              accessibilityRole="button"
              accessibilityLabel={i18nT(
                'map:components.MapPage.FiltersPanelBody.sbrosit_filtry_f14ca19f',
              )}
              hitSlop={6}
              style={({ pressed }) => [styles.actionSecondary, pressed && styles.actionPressed]}
            >
              <Text style={styles.actionSecondaryText} numberOfLines={1}>
                {i18nT('map:components.MapPage.FiltersPanelBody.sbrosit_filtry_f14ca19f')}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  )
}

export const MapEmptyStateToast = React.memo(MapEmptyStateToastInner)

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    toast: {
      position: 'absolute' as const,
      left: 12,
      right: 12,
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      // Статичный «фрост»-фон (правило проекта: без живого blur на мобиле).
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      zIndex: 1440,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 4px 14px rgba(15,23,42,0.18)' } as any)
        : {
            shadowColor: DESIGN_TOKENS.colors.text,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.16,
            shadowRadius: 8,
            elevation: 5,
          }),
    },
    titleRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 7,
    },
    title: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '700' as const,
      color: colors.text,
    },
    actions: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
    },
    actionPrimary: {
      minHeight: 34,
      flexGrow: 1,
      flexBasis: 0,
      minWidth: 0,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingHorizontal: 10,
      borderRadius: 9,
      backgroundColor: colors.primary,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    actionSecondary: {
      minHeight: 34,
      flexGrow: 1,
      flexBasis: 0,
      minWidth: 0,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingHorizontal: 10,
      borderRadius: 9,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    actionPressed: {
      opacity: 0.75,
    },
    actionPrimaryText: {
      fontSize: 12,
      lineHeight: 14,
      fontWeight: '700' as const,
      color: colors.textOnPrimary,
    },
    actionSecondaryText: {
      fontSize: 12,
      lineHeight: 14,
      fontWeight: '700' as const,
      color: colors.text,
    },
  })
