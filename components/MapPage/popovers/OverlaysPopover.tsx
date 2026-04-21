/**
 * OverlaysPopover - quick toggle for map overlay layers.
 */
import React, { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

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
}

export const OverlaysPopover: React.FC<OverlaysPopoverProps> = ({
  options,
  enabledOverlays,
  onToggle,
  onReset,
  onClose,
}) => {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])

  const enabledCount = useMemo(
    () => options.filter((option) => Boolean(enabledOverlays[option.id])).length,
    [enabledOverlays, options],
  )

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Оверлеи</Text>
        <Text style={styles.hint}>
          {enabledCount > 0 ? `${enabledCount} включено` : 'Все выключены'}
        </Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
        {options.length === 0 ? (
          <Text style={styles.empty}>Нет доступных оверлеев</Text>
        ) : (
          options.map((option) => {
            const enabled = Boolean(enabledOverlays[option.id])
            return (
              <Pressable
                key={option.id}
                accessibilityRole="switch"
                accessibilityLabel={option.title}
                accessibilityState={{ checked: enabled }}
                onPress={() => onToggle(option.id, !enabled)}
                style={({ pressed }) => [
                  styles.row,
                  enabled && styles.rowSelected,
                  pressed && styles.rowPressed,
                ]}
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
                  {enabled && <Feather name="check" size={12} color={colors.textOnPrimary} />}
                </View>
                <Text style={[styles.rowLabel, enabled && styles.rowLabelSelected]} numberOfLines={2}>
                  {option.title}
                </Text>
              </Pressable>
            )
          })
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Сбросить оверлеи"
          onPress={onReset}
          style={({ pressed }) => [styles.footerBtnGhost, pressed && styles.footerBtnPressed]}
        >
          <Feather name="rotate-ccw" size={14} color={colors.textMuted} />
          <Text style={styles.footerBtnGhostText}>Сбросить</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Закрыть список оверлеев"
          onPress={onClose}
          style={({ pressed }) => [styles.footerBtnPrimary, pressed && styles.footerBtnPressed]}
        >
          <Text style={styles.footerBtnPrimaryText}>Готово</Text>
        </Pressable>
      </View>
    </View>
  )
}

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    root: {
      paddingBottom: 4,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    hint: {
      fontSize: 11,
      color: colors.textMuted,
    },
    scroll: {
      maxHeight: 360,
    },
    list: {
      paddingHorizontal: 8,
      paddingBottom: 8,
    },
    empty: {
      padding: 24,
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: 13,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
    },
    rowSelected: {
      backgroundColor: colors.primarySoft,
    },
    rowPressed: {
      opacity: 0.75,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    rowLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    rowLabelSelected: {
      color: colors.primaryText,
    },
    footer: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 4,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    footerBtnGhost: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
    },
    footerBtnGhostText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    footerBtnPrimary: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.primary,
    },
    footerBtnPrimaryText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    footerBtnPressed: {
      opacity: 0.8,
    },
  })
