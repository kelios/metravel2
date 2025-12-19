// components/FiltersPanelCollapsible.tsx
// ✅ РЕДИЗАЙН: Компактная панель фильтров с возможностью сворачивания

import React from 'react';
import { View, StyleSheet, Text, Pressable, Platform, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
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

const palette = DESIGN_TOKENS.colors;
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
  onToggleExpanded,
  onToggleHidden,
  isMobile = false,
}: FiltersPanelCollapsibleProps) {
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
            <Feather name="x-circle" size={14} color={palette.primary} />
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
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
    borderBottomColor: palette.border,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: palette.primarySoft,
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
    color: palette.primary,
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
});

