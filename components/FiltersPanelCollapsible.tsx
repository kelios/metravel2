// components/FiltersPanelCollapsible.tsx
// ✅ РЕДИЗАЙН: Компактная панель фильтров с возможностью сворачивания
// ✅ МИГРАЦИЯ: Полная поддержка динамических цветов через useThemedColors

import React, { useMemo } from 'react';
import { View, StyleSheet, Text, Pressable, Platform, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import FiltersComponent from '@/components/listTravel/FiltersComponent';
import type { TravelFilters } from '@/src/types/types';

interface FiltersPanelCollapsibleProps {
  filters: TravelFilters | null;
  filterValue: any;
  onSelectedItemsChange: (field: string, items: any[]) => void;
  handleApplyFilters: () => void;
  resetFilters: () => void;
  isSuperuser?: boolean;
  isExpanded?: boolean;
  isHidden?: boolean;
  onToggleExpanded?: () => void;
  onToggleHidden?: () => void;
  isMobile?: boolean;
}

const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

export default function FiltersPanelCollapsible({
  filters,
  filterValue,
  onSelectedItemsChange,
  handleApplyFilters,
  resetFilters,
  isSuperuser = false,
  isExpanded = false,
  isHidden = false,
  onToggleExpanded: _onToggleExpanded,
  onToggleHidden: _onToggleHidden,
  isMobile = false,
}: FiltersPanelCollapsibleProps) {
  const colors = useThemedColors();

  // ✅ Динамические стили на основе текущей темы
  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
        },
        default: {
          ...DESIGN_TOKENS.shadowsNative.light,
        },
      }),
    },
    containerMobile: {
      marginBottom: spacing.sm,
    },
    actionsBar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    clearButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radii.sm,
      backgroundColor: colors.primarySoft,
      minHeight: 28,
      ...Platform.select({
        web: {
          transition: 'background-color 0.2s ease',
          cursor: 'pointer',
        },
      }),
    },
    clearButtonText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.primary,
    },
    content: {
      maxHeight: Platform.select({
        default: 600,
        web: 700,
      }),
    },
    scrollView: {
      maxHeight: Platform.select({
        default: 600,
        web: 700,
      }),
    },
    scrollContent: {
      padding: spacing.sm,
    },
  }), [colors]);

  if (isHidden) return null;

  const activeFiltersCount = Object.values(filterValue || {}).reduce<number>((count, value) => {
    if (Array.isArray(value)) return count + value.length;
    if (value && value !== '') return count + 1;
    return count;
  }, 0);

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      {/* ✅ ИСПРАВЛЕНИЕ: Убран дублирующий заголовок, так как он уже есть в CollapsibleBlock */}
      {/* Кнопка сброса фильтров (если есть активные) */}
      {activeFiltersCount > 0 && (
        <View style={styles.actionsBar}>
          <Pressable
            onPress={resetFilters}
            style={styles.clearButton}
            accessibilityLabel="Сбросить все фильтры"
            hitSlop={8}
            {...Platform.select({
              web: {
                cursor: 'pointer',
              },
            })}
          >
            <Feather name="x-circle" size={14} color={colors.primary} />
            <Text style={styles.clearButtonText}>Сбросить все</Text>
          </Pressable>
        </View>
      )}

      {/* Содержимое фильтров */}
      {isExpanded && filters && (
        <View style={styles.content}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <FiltersComponent
              filters={filters}
              filterValue={filterValue}
              onSelectedItemsChange={onSelectedItemsChange}
              handleApplyFilters={handleApplyFilters}
              resetFilters={resetFilters}
              isSuperuser={isSuperuser}
              isCompact={true}
            />
          </ScrollView>
        </View>
      )}

      {/* ✅ ИСПРАВЛЕНИЕ: Компактный вид убран, так как CollapsibleBlock управляет видимостью */}
    </View>
  );
}
