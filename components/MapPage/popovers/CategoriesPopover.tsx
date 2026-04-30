/**
 * CategoriesPopover - multi-select facet filter with per-category counters.
 */
import React, { useEffect, useMemo, useState } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

type CategoryOption = string | { id?: string | number; name?: string; value?: string }

interface CategoriesPopoverProps {
  categories: ReadonlyArray<CategoryOption>
  selected: string[]
  travelsData: ReadonlyArray<{ categoryName?: string | null | undefined }>
  onApply: (next: string[]) => void
  onClose: () => void
}

const SEARCH_MIN_ITEMS = 10
const CONTROL_RADIUS = DESIGN_TOKENS.radii.sm
const PILL_RADIUS = DESIGN_TOKENS.radii.pill

const normalizeCategoryName = (raw: CategoryOption): string => {
  if (typeof raw === 'string') return raw.trim()
  if (!raw || typeof raw !== 'object') return ''
  if (typeof raw.value === 'string') return raw.value.trim()
  if (typeof raw.name === 'string') return raw.name.trim()
  return ''
}

const sameStringSet = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((v, i) => v === sortedB[i])
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
  const [query, setQuery] = useState('')

  useEffect(() => {
    setLocalSelected([...selected])
  }, [selected])

  const counts = useMemo(() => {
    const acc: Record<string, number> = {}
    const dataset = Array.isArray(travelsData) ? travelsData : []

    for (const travel of dataset) {
      if (!travel?.categoryName) continue

      String(travel.categoryName)
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
        .forEach((name) => {
          acc[name] = (acc[name] || 0) + 1
        })
    }

    return acc
  }, [travelsData])

  const allRows = useMemo(() => {
    return (Array.isArray(categories) ? categories : [])
      .map((category) => {
        const name = normalizeCategoryName(category)
        if (!name) return null
        return {
          name,
          count: counts[name] || 0,
        }
      })
      .filter((row): row is { name: string; count: number } => row !== null)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        return a.name.localeCompare(b.name, 'ru')
      })
  }, [categories, counts])

  const normalizedQuery = query.trim().toLowerCase()

  const visibleRows = useMemo(() => {
    if (!normalizedQuery) return allRows
    return allRows.filter((row) => row.name.toLowerCase().includes(normalizedQuery))
  }, [allRows, normalizedQuery])

  const availableRowNames = useMemo(
    () => allRows.filter((row) => row.count > 0).map((row) => row.name),
    [allRows],
  )

  const visibleAvailableRowNames = useMemo(
    () => visibleRows.filter((row) => row.count > 0).map((row) => row.name),
    [visibleRows],
  )

  const bulkTargetNames =
    normalizedQuery.length > 0 ? visibleAvailableRowNames : availableRowNames

  const toggle = (name: string) => {
    setLocalSelected((prev) =>
      prev.includes(name) ? prev.filter((value) => value !== name) : [...prev, name],
    )
  }

  const handleSelectAll = () => {
    setLocalSelected((prev) => Array.from(new Set([...prev, ...bulkTargetNames])))
  }

  const handleClearSelection = () => {
    if (!normalizedQuery) {
      setLocalSelected([])
      return
    }

    setLocalSelected((prev) =>
      prev.filter((name) => !visibleAvailableRowNames.includes(name)),
    )
  }

  const hasChanges = useMemo(
    () => !sameStringSet(localSelected, selected),
    [localSelected, selected],
  )

  const handleReset = () => {
    if (localSelected.length > 0) {
      handleClearSelection()
      return
    }

    if (selected.length > 0) {
      onApply([])
    }

    onClose()
  }

  const handlePrimary = () => {
    if (hasChanges) onApply(localSelected)
    onClose()
  }

  const allSelected =
    bulkTargetNames.length > 0 &&
    bulkTargetNames.every((name) => localSelected.includes(name))

  const showSearch = allRows.length >= SEARCH_MIN_ITEMS
  const showBulkAction = bulkTargetNames.length > 0

  const selectionLabel =
    allRows.length === 0
      ? 'Нет категорий'
      : localSelected.length > 0
        ? `Выбрано ${localSelected.length} из ${allRows.length}`
        : `Категорий: ${allRows.length}`

  const resultsLabel =
    normalizedQuery.length > 0
      ? visibleRows.length > 0
        ? `Найдено ${visibleRows.length}`
        : 'Совпадений нет'
      : null

  const bulkActionLabel = allSelected
    ? normalizedQuery
      ? 'Снять найденные'
      : 'Снять все'
    : normalizedQuery
      ? 'Выбрать найденные'
      : 'Выбрать все'

  const primaryLabel = hasChanges
    ? localSelected.length > 0
      ? `Применить (${localSelected.length})`
      : 'Показать все'
    : 'Готово'

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            Что посмотреть
          </Text>
          <Text style={styles.hint}>{selectionLabel}</Text>
        </View>

        {showBulkAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={bulkActionLabel}
            onPress={allSelected ? handleClearSelection : handleSelectAll}
            style={({ pressed }) => [styles.bulkAction, pressed && styles.bulkActionPressed]}
            testID="categories-popover-bulk-action"
          >
            <Feather
              name={allSelected ? 'square' : 'check-square'}
              size={13}
              color={colors.primary}
            />
            <Text style={styles.bulkActionText}>{bulkActionLabel}</Text>
          </Pressable>
        ) : null}

        {resultsLabel ? <Text style={styles.resultsHint}>{resultsLabel}</Text> : null}
      </View>

      {showSearch ? (
        <View style={styles.searchRow}>
          <Feather
            name="search"
            size={14}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Поиск по категориям"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            testID="categories-popover-search-input"
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Очистить поиск"
              onPress={() => setQuery('')}
              hitSlop={8}
              style={({ pressed }) => [styles.searchClear, pressed && styles.searchClearPressed]}
            >
              <Feather name="x" size={14} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      >
        {visibleRows.length === 0 ? (
          <Text style={styles.empty}>
            {query ? 'Ничего не найдено' : 'Нет доступных категорий в радиусе'}
          </Text>
        ) : (
          visibleRows.map((row) => {
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
                testID={`categories-popover-row-${row.name}`}
              >
                <View
                  style={[
                    styles.checkbox,
                    checked && {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  {checked ? (
                    <Feather name="check" size={12} color={colors.textOnPrimary} />
                  ) : null}
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
        <Button
          label={localSelected.length > 0 ? 'Сбросить' : 'Закрыть'}
          accessibilityLabel={localSelected.length > 0 ? 'Сбросить выбор' : 'Закрыть фильтр'}
          onPress={handleReset}
          variant="ghost"
          icon={
            <Feather
              name={localSelected.length > 0 ? 'rotate-ccw' : 'x'}
              size={14}
              color={colors.textMuted}
            />
          }
          style={styles.footerBtnGhost}
          labelStyle={styles.footerBtnGhostText}
          testID="categories-popover-reset-button"
        />

        <Button
          label={primaryLabel}
          accessibilityLabel={primaryLabel}
          onPress={handlePrimary}
          variant="primary"
          fullWidth={true}
          style={styles.footerBtnPrimary}
          labelStyle={styles.footerBtnPrimaryText}
          testID="categories-popover-apply-button"
        />
      </View>
    </View>
  )
}

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      minHeight: 0,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10,
      gap: 8,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    title: {
      flex: 1,
      fontSize: 19,
      fontWeight: '800',
      color: colors.text,
    },
    hint: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      paddingTop: 3,
    },
    bulkAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: PILL_RADIUS,
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderAccent,
    },
    bulkActionPressed: {
      opacity: 0.75,
    },
    bulkActionText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    resultsHint: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSubtle ?? colors.textMuted,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 12,
      marginBottom: 8,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'web' ? 9 : 8,
      borderRadius: CONTROL_RADIUS,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    searchIcon: {
      flexShrink: 0,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      paddingVertical: 2,
      ...(Platform.OS === 'web'
        ? ({ outlineStyle: 'none', outlineWidth: 0 } as any)
        : null),
    },
    searchClear: {
      width: 22,
      height: 22,
      borderRadius: PILL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchClearPressed: {
      opacity: 0.6,
    },
    scroll: {
      flex: 1,
      minHeight: 0,
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
      alignItems: 'center',
      gap: 10,
      minHeight: 54,
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
    rowDisabled: {
      opacity: 0.4,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    rowLabelSelected: {
      color: colors.primaryText,
    },
    badge: {
      minWidth: 32,
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
      fontSize: 11,
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
      paddingBottom: Platform.OS === 'web' ? 10 : 8,
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
