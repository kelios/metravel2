/**
 * OverlaysPopover - quick toggle for map overlay layers.
 */
import React, { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

interface OverlayOption {
  id: string
  title: string
}

interface OverlaysPopoverProps {
  options: ReadonlyArray<OverlayOption>
  enabledOverlays: Record<string, boolean>
  onToggle: (id: string, enabled: boolean) => void
  onReset?: () => void
  onClose: () => void
  showHeaderClose?: boolean
}

const CONTROL_RADIUS = DESIGN_TOKENS.radii.sm
const PILL_RADIUS = DESIGN_TOKENS.radii.pill

const OVERLAY_COPY: Record<
  string,
  { title: string; subtitle?: string; badge?: string }
> = {
  'waymarked-hiking': {
    title: 'Пешие маршруты',
    subtitle: 'Waymarked Trails',
    badge: 'Треки',
  },
  'waymarked-cycling': {
    title: 'Веломаршруты',
    subtitle: 'Waymarked Trails',
    badge: 'Треки',
  },
  'osm-camping': {
    title: 'Ночёвки и кемпинги',
    subtitle: 'OSM: camp / shelter',
    badge: 'OSM',
  },
  'osm-poi': {
    title: 'Достопримечательности',
    subtitle: 'Интересные места из OSM',
    badge: 'OSM',
  },
  'osm-routes': {
    title: 'Маршруты сообщества',
    subtitle: 'OSM: hiking / bicycle',
    badge: 'OSM',
  },
  'lasy-zanocuj-wfs': {
    title: 'Польша: места для ночёвки',
    subtitle: 'Программа Zanocuj w lesie',
    badge: 'PL',
  },
}

const normalizeOverlayCopy = (option: OverlayOption) => {
  const predefined = OVERLAY_COPY[option.id]
  if (predefined) return predefined

  const compact = option.title
    .replace(/\s*\((.*?)\)\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  const detailMatch = option.title.match(/\((.*?)\)/)

  return {
    title: compact || option.title,
    subtitle: detailMatch?.[1]?.trim(),
  }
}

export const OverlaysPopover: React.FC<OverlaysPopoverProps> = ({
  options,
  enabledOverlays,
  onToggle,
  onReset,
  onClose,
  showHeaderClose = false,
}) => {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])

  const rows = useMemo(
    () =>
      options.map((option) => ({
        ...option,
        copy: normalizeOverlayCopy(option),
      })),
    [options],
  )

  const enabledCount = useMemo(
    () => rows.filter((option) => Boolean(enabledOverlays[option.id])).length,
    [enabledOverlays, rows],
  )

  const statusLabel =
    rows.length === 0
      ? 'Нет слоёв'
      : enabledCount > 0
        ? `Включено ${enabledCount} из ${rows.length}`
        : 'Все выключены'

  const canReset = typeof onReset === 'function' && enabledCount > 0

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerLabels}>
          <Text style={styles.title}>Оверлеи</Text>
          <Text style={styles.hint}>{statusLabel}</Text>
        </View>
        {showHeaderClose ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Закрыть список оверлеев"
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
            testID="overlays-popover-header-close-button"
          >
            <Feather name="x" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
        {rows.length === 0 ? (
          <Text style={styles.empty}>Нет доступных слоёв карты</Text>
        ) : (
          rows.map((option) => {
            const enabled = Boolean(enabledOverlays[option.id])

            return (
              <Pressable
                key={option.id}
                accessibilityRole="switch"
                accessibilityLabel={option.copy.title}
                accessibilityHint={
                  option.copy.subtitle ? `${option.copy.subtitle}` : undefined
                }
                accessibilityState={{ checked: enabled }}
                onPress={() => onToggle(option.id, !enabled)}
                style={({ pressed }) => [
                  styles.row,
                  enabled && styles.rowSelected,
                  pressed && styles.rowPressed,
                ]}
                testID={`overlays-popover-row-${option.id}`}
              >
                <View
                  style={[
                    styles.checkbox,
                    enabled && {
                      borderColor: colors.primary,
                      backgroundColor: colors.primary,
                    },
                  ]}
                >
                  {enabled ? (
                    <Feather name="check" size={12} color={colors.textOnPrimary} />
                  ) : null}
                </View>

                <View style={styles.rowContent}>
                  <View style={styles.rowMain}>
                    <Text
                      style={[styles.rowLabel, enabled && styles.rowLabelSelected]}
                      numberOfLines={2}
                    >
                      {option.copy.title}
                    </Text>

                    {option.copy.badge ? (
                      <View style={[styles.badge, enabled && styles.badgeSelected]}>
                        <Text
                          style={[
                            styles.badgeText,
                            enabled && styles.badgeTextSelected,
                          ]}
                        >
                          {option.copy.badge}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {option.copy.subtitle ? (
                    <Text
                      style={[
                        styles.rowSubtitle,
                        enabled && styles.rowSubtitleSelected,
                      ]}
                      numberOfLines={2}
                    >
                      {option.copy.subtitle}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )
          })
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Сбросить"
          accessibilityLabel="Сбросить оверлеи"
          onPress={canReset ? onReset : undefined}
          variant="ghost"
          disabled={!canReset}
          icon={<Feather name="rotate-ccw" size={14} color={colors.textMuted} />}
          style={styles.footerBtnGhost}
          labelStyle={styles.footerBtnGhostText}
          testID="overlays-popover-reset-button"
        />

        <Button
          label="Готово"
          accessibilityLabel="Закрыть список оверлеев"
          onPress={onClose}
          variant="primary"
          fullWidth={true}
          style={styles.footerBtnPrimary}
          labelStyle={styles.footerBtnPrimaryText}
          testID="overlays-popover-close-button"
        />
      </View>
    </View>
  )
}

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    root: {
      flexShrink: 1,
      minHeight: 0,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    headerLabels: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    title: {
      flexShrink: 1,
      fontSize: 19,
      fontWeight: '800',
      color: colors.text,
    },
    hint: {
      flexShrink: 0,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: CONTROL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlpha40,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    closeButtonPressed: {
      opacity: 0.68,
    },
    scroll: {
      maxHeight: 420,
    },
    list: {
      paddingHorizontal: 10,
      paddingBottom: 18,
    },
    empty: {
      padding: 24,
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: 13,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      minHeight: 58,
      paddingHorizontal: 12,
      paddingVertical: 13,
      borderRadius: CONTROL_RADIUS,
      marginBottom: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    rowSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderAccent,
    },
    rowPressed: {
      opacity: 0.75,
    },
    checkbox: {
      width: 20,
      height: 20,
      marginTop: 2,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    rowContent: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    rowMain: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    rowLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    rowLabelSelected: {
      color: colors.primaryText,
    },
    rowSubtitle: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.textMuted,
    },
    rowSubtitleSelected: {
      color: colors.primaryText,
      opacity: 0.84,
    },
    badge: {
      minWidth: 34,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: PILL_RADIUS,
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeSelected: {
      backgroundColor: colors.primary,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
    },
    badgeTextSelected: {
      color: colors.textOnPrimary,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 8,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    footerBtnGhost: {
      minWidth: 118,
      paddingHorizontal: 12,
      backgroundColor: colors.backgroundSecondary,
      borderColor: colors.borderLight,
      borderWidth: 1,
    },
    footerBtnGhostText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    footerBtnPrimary: {
      flex: 1,
    },
    footerBtnPrimaryText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
  })

export { normalizeOverlayCopy }
