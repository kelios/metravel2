/**
 * CategoriesPopover — multi-select facet filter with per-category counters.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

type CategoryOption = string | { id?: string | number; name?: string; value?: string }

interface CategoriesPopoverProps {
  categories: ReadonlyArray<CategoryOption>
  selected: string[]
  travelsData: ReadonlyArray<{ categoryName?: string | null | undefined }>
  onApply: (next: string[]) => void
  onClose: () => void
}

const normalizeCategoryName = (raw: CategoryOption): string => {
  if (typeof raw === 'string') return raw.trim()
  if (!raw || typeof raw !== 'object') return ''
  if (typeof raw.value === 'string') return raw.value.trim()
  if (typeof raw.name === 'string') return raw.name.trim()
  return ''
}

export const CategoriesPopover: React.FC<CategoriesPopoverProps> = ({
  categories,
  selected,
  travelsData,
  onApply,
  onClose,
}) => {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])

  const [localSelected, setLocalSelected] = useState<string[]>(() => [...selected])

  useEffect(() => {
    setLocalSelected([...selected])
  }, [selected])

  const counts = useMemo(() => {
    const acc: Record<string, number> = {}
    const dataset = Array.isArray(travelsData) ? travelsData : []
    for (const t of dataset) {
      if (!t?.categoryName) continue
      String(t.categoryName)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((cat) => {
          acc[cat] = (acc[cat] || 0) + 1
        })
    }
    return acc
  }, [travelsData])

  const rows = useMemo(() => {
    return (Array.isArray(categories) ? categories : [])
      .map((c) => {
        const name = normalizeCategoryName(c)
        if (!name) return null
        const count = counts[name] || 0
        return { name, count }
      })
      .filter((r): r is { name: string; count: number } => r !== null)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        return a.name.localeCompare(b.name, 'ru')
      })
  }, [categories, counts])

  const toggle = (name: string) => {
    setLocalSelected((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
    )
  }

  const handleReset = () => {
    setLocalSelected([])
    onApply([])
    onClose()
  }

  const handleApply = () => {
    onApply(localSelected)
    onClose()
  }

  const hasChanges = useMemo(() => {
    if (localSelected.length !== selected.length) return true
    const a = [...localSelected].sort()
    const b = [...selected].sort()
    return a.some((v, i) => v !== b[i])
  }, [localSelected, selected])

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Что посмотреть</Text>
        <Text style={styles.hint}>
          {localSelected.length > 0 ? `${localSelected.length} выбрано` : 'Все категории'}
        </Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
        {rows.length === 0 ? (
          <Text style={styles.empty}>Нет доступных категорий в радиусе</Text>
        ) : (
          rows.map((row) => {
            const checked = localSelected.includes(row.name)
            const disabled = row.count === 0 && !checked
            return (
              <Pressable
                key={row.name}
                accessibilityRole="checkbox"
                accessibilityState={{ checked, disabled }}
                accessibilityLabel={`${row.name}, ${row.count} мест`}
                disabled={disabled}
                onPress={() => toggle(row.name)}
                style={({ pressed }) => [
                  styles.row,
                  checked && styles.rowSelected,
                  pressed && !disabled && styles.rowPressed,
                  disabled && styles.rowDisabled,
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    checked && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                >
                  {checked && <Feather name="check" size={12} color={colors.textOnPrimary} />}
                </View>
                <Text
                  style={[styles.rowLabel, checked && styles.rowLabelSelected]}
                  numberOfLines={1}
                >
                  {row.name}
                </Text>
                <View style={[styles.badge, checked && styles.badgeSelected]}>
                  <Text style={[styles.badgeText, checked && styles.badgeTextSelected]}>
                    {row.count}
                  </Text>
                </View>
              </Pressable>
            )
          })
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Сбросить категории"
          onPress={handleReset}
          style={({ pressed }) => [styles.footerBtnGhost, pressed && styles.footerBtnPressed]}
        >
          <Feather name="rotate-ccw" size={14} color={colors.textMuted} />
          <Text style={styles.footerBtnGhostText}>Сбросить</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Применить выбор"
          onPress={handleApply}
          disabled={!hasChanges}
          style={({ pressed }) => [
            styles.footerBtnPrimary,
            !hasChanges && styles.footerBtnPrimaryDisabled,
            pressed && hasChanges && styles.footerBtnPressed,
          ]}
        >
          <Text style={styles.footerBtnPrimaryText}>Применить</Text>
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
    rowDisabled: {
      opacity: 0.4,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
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
    badge: {
      minWidth: 28,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeSelected: {
      backgroundColor: colors.primary,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
    },
    badgeTextSelected: {
      color: colors.textOnPrimary,
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
    footerBtnPrimaryDisabled: {
      opacity: 0.5,
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
