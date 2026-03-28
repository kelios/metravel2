// ✅ УЛУЧШЕНИЕ: ModernFilters - декомпозирован на подкомпоненты (SRCH-01)
// Подкомпоненты вынесены в ./filters/
import React, { memo, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  Animated,
  TextInput,
  Dimensions,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';
import { useThemedColors } from '@/hooks/useTheme';
import { getTravelLabel } from '@/services/pdf-export/utils/pluralize';

// Подкомпоненты из filters/
import {
  FilterCheckbox,
  FilterOptionItem,
  GroupClearButton,
  SortDropdown,
  createModernFiltersStyles,
} from './filters';

export interface FilterOption {
  id: string;
  name: string;
  count?: number;
}

export interface FilterGroup {
  key: string;
  title: string;
  options: FilterOption[];
  multiSelect?: boolean;
  icon?: string;
}

export type FilterState = Record<string, string[]> & { year?: string | number; moderation?: number };

interface ModernFiltersProps {
  filterGroups: FilterGroup[];
  selectedFilters: FilterState;
  onFilterChange: (groupKey: string, optionId: string) => void;
  onClearAll: () => void;
  resultsCount?: number;
  isCompact?: boolean;
  isLoading?: boolean;
  year?: string | number | undefined;
  onYearChange?: (value: string | undefined) => void;
  showModeration?: boolean;
  moderationValue?: number | undefined;
  onToggleModeration?: () => void;
  onApply?: () => void;
  onClose?: () => void;
}

const ModernFilters: React.FC<ModernFiltersProps> = memo(({
  filterGroups,
  selectedFilters,
  onFilterChange,
  onClearAll,
  resultsCount,
  isCompact = false,
  isLoading = false,
  year,
  onYearChange,
  showModeration,
  moderationValue,
  onToggleModeration,
  onApply,
  onClose,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createModernFiltersStyles(colors), [colors]);

  const isNarrowWeb = Platform.OS === 'web' && Dimensions.get('window').width <= METRICS.breakpoints.tablet;
  const hasOptions = filterGroups.some((group) => (group.options || []).length > 0);
  const shouldReserveSpace = isLoading || !hasOptions;
  const reserveMinHeight = Platform.OS === 'web'
    ? (isNarrowWeb ? 720 : 760)
    : 640;
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set()
  );
  const [animatedValues] = useState(() =>
    filterGroups.reduce((acc, group) => {
      acc[group.key] = new Animated.Value(1);
      return acc;
    }, {} as Record<string, Animated.Value>)
  );

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);

      if (!animatedValues[groupKey]) {
        animatedValues[groupKey] = new Animated.Value(next.has(groupKey) ? 1 : 0);
      }

      const animated = animatedValues[groupKey];
      if (!animated) {
        return next;
      }

      if (next.has(groupKey)) {
        next.delete(groupKey);
        Animated.timing(animated, {
          toValue: 0,
          duration: DESIGN_TOKENS.animations.duration.normal,
          useNativeDriver: false,
        }).start();
      } else {
        next.add(groupKey);
        Animated.timing(animated, {
          toValue: 1,
          duration: DESIGN_TOKENS.animations.duration.normal,
          useNativeDriver: false,
        }).start();
      }
      return next;
    });
  }, [animatedValues]);

  const activeFiltersCount = useMemo(() => {
    return Object.values(selectedFilters).reduce<number>((sum, filters) => {
      if (Array.isArray(filters)) {
        return sum + filters.length;
      }
      return sum;
    }, 0);
  }, [selectedFilters]);

  const sortGroup = useMemo(
    () => filterGroups.find((group) => group.key === 'sort'),
    [filterGroups],
  );

  const groupsWithoutSort = useMemo(
    () => filterGroups.filter((group) => group.key !== 'sort'),
    [filterGroups],
  );

  const allGroupKeys = useMemo(() => groupsWithoutSort.map((g) => g.key), [groupsWithoutSort]);

  const areAllGroupsExpanded = useMemo(
    () => allGroupKeys.length > 0 && allGroupKeys.every((key) => expandedGroups.has(key)),
    [allGroupKeys, expandedGroups],
  );

  const resultsText = useMemo(() => {
    if (typeof resultsCount !== 'number') return '';
    return `Найдено ${resultsCount} ${getTravelLabel(resultsCount)}`;
  }, [resultsCount]);

  const shouldReserveResultsBadge = Platform.OS !== 'web' || isNarrowWeb;
  const showResultsBadge =
    typeof resultsCount === 'number' && shouldReserveResultsBadge;

  return (
    <View
      style={[
        styles.container,
        isCompact && styles.containerCompact,
        Platform.OS !== 'web' && styles.containerMobile,
        Platform.OS === 'web' && isNarrowWeb && styles.containerWebFull,
        shouldReserveSpace && { minHeight: reserveMinHeight },
      ]}
    >
      <View
        style={[
          styles.topChrome,
          (Platform.OS !== 'web' || isNarrowWeb) && styles.topChromeCompact,
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Feather name="filter" size={20} color={colors.primary} />
            <Text style={styles.headerTitle}>Фильтры</Text>
          </View>
          <View style={styles.headerRight}>
            {activeFiltersCount > 0 && (
              <Pressable
                onPress={onClearAll}
                style={styles.clearButton}
                accessibilityRole="button"
                accessibilityLabel={`Очистить все фильтры (${activeFiltersCount})`}
              >
                <Text style={styles.clearButtonText}>
                  Очистить ({activeFiltersCount})
                </Text>
              </Pressable>
            )}
            {onClose && (
              <Pressable
                onPress={onClose}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Закрыть фильтры"
              >
                <Feather name="x" size={20} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Mobile/Narrow web: explicit clear-all button */}
        {activeFiltersCount > 0 && (Platform.OS !== 'web' || isNarrowWeb) && (
          <Pressable
            onPress={onClearAll}
            style={styles.clearAllMobileButton}
            accessibilityRole="button"
            accessibilityLabel="Очистить все фильтры"
            hitSlop={8}
          >
            <Feather name="x-circle" size={16} color={colors.primary} />
            <Text style={styles.clearAllMobileButtonText}>Очистить все фильтры</Text>
          </Pressable>
        )}

        {/* Toggle all groups */}
        <Pressable
          testID="toggle-all-groups"
          onPress={() => {
            const allKeys = groupsWithoutSort.map((g) => g.key);
            const allExpanded = allKeys.every((key) => expandedGroups.has(key));
            const next = new Set<string>();

            allKeys.forEach((key) => {
              if (!animatedValues[key]) {
                animatedValues[key] = new Animated.Value(allExpanded ? 1 : 0);
              }
              const animated = animatedValues[key];
              Animated.timing(animated, {
                toValue: allExpanded ? 0 : 1,
                duration: DESIGN_TOKENS.animations.duration.normal,
                useNativeDriver: false,
              }).start();

              if (!allExpanded) {
                next.add(key);
              }
            });

            if (allExpanded) {
              setExpandedGroups(new Set());
            } else {
              setExpandedGroups(next);
            }
          }}
          style={styles.toggleAllButton}
          accessibilityRole="button"
          accessibilityLabel={areAllGroupsExpanded ? 'Свернуть все группы фильтров' : 'Развернуть все группы фильтров'}
        >
          <View style={styles.toggleAllButtonInner}>
            <View style={styles.iconSlot16}>
              <Feather
                name={areAllGroupsExpanded ? 'chevrons-up' : 'chevrons-down'}
                size={16}
                color={colors.textSecondary}
              />
            </View>
            <Text style={styles.toggleAllButtonText}>
              {areAllGroupsExpanded ? 'Свернуть все' : 'Развернуть все'}
            </Text>
          </View>
        </Pressable>

        {/* Moderation (admin) */}
        <View style={styles.extraFilters}>
          {showModeration && onToggleModeration && (
            <Pressable
              onPress={onToggleModeration}
              style={[
                styles.moderationRow,
                moderationValue === 0 && styles.moderationRowSelected,
              ]}
              accessibilityRole="checkbox"
              accessibilityLabel="Только на модерации"
              accessibilityState={{ checked: moderationValue === 0 }}
              {...(Platform.OS === 'web'
                ? ({
                    title: 'Показывать только путешествия, ожидающие модерации',
                  } as any)
                : null)}
            >
              <FilterCheckbox checked={moderationValue === 0} checkboxStyle={styles.checkbox} checkboxCheckedStyle={styles.checkboxChecked} checkColor={colors.textOnPrimary} />
              <Text
                style={[
                  styles.moderationLabel,
                  moderationValue === 0 && styles.moderationLabelSelected,
                ]}
              >
                Только на модерации
              </Text>
            </Pressable>
          )}
        </View>

        {/* Results Count Badge */}
        {(showResultsBadge || shouldReserveResultsBadge) && (
          <View style={styles.resultsBadge}>
            <Feather
              name="search"
              size={14}
              color={colors.textMuted}
              style={!showResultsBadge ? ({ opacity: 0 } as any) : null}
            />
            <Text style={styles.resultsBadgeText}>
              {showResultsBadge ? resultsText : 'Найдено 000 путешествий'}
            </Text>
          </View>
        )}

        {/* Sort (collapsible dropdown) */}
        {sortGroup && (
          <SortDropdown
            sortGroup={sortGroup}
            selectedFilters={selectedFilters}
            onFilterChange={onFilterChange}
            styles={styles}
            colors={colors}
          />
        )}
      </View>

      {/* Filter Groups */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.scrollContent}
      >
        {groupsWithoutSort.map((group, index) => {
          const isExpanded = expandedGroups.has(group.key);
          const rawSelected = selectedFilters[group.key];
          const isMultiSelect = group.multiSelect !== false;
          const selectedArray = isMultiSelect
            ? (Array.isArray(rawSelected) ? rawSelected : [])
            : (rawSelected !== undefined && rawSelected !== null && (rawSelected as any) !== ''
              ? [rawSelected].flat()
              : []);
          const selectedSet = new Set(selectedArray.map(String));
          const selectedCount = selectedArray.length;
          const selectedNames = group.options
            .filter((option) => selectedSet.has(String(option.id)))
            .map((option) => option.name);
          const orderedOptions = group.options
            .slice()
            .sort((a, b) => {
              const aSelected = selectedSet.has(String(a.id));
              const bSelected = selectedSet.has(String(b.id));
              if (aSelected === bSelected) return 0;
              return aSelected ? -1 : 1;
            });

          return (
            <View
              key={group.key}
              style={[
                styles.filterGroup,
                index === groupsWithoutSort.length - 1 && styles.filterGroupLast
              ]}
            >
              {/* Group Header */}
              <View style={styles.groupHeader}>
                <Pressable
                  onPress={() => toggleGroup(group.key)}
                  style={[styles.groupHeaderLeft, { paddingVertical: 4 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${isExpanded ? 'Свернуть' : 'Развернуть'} ${group.title}`}
                  accessibilityState={{ expanded: isExpanded }}
                >
                  {group.icon && (
                    <View style={styles.iconSlot16}>
                      <Feather
                        name={group.icon as any}
                        size={16}
                        color={colors.textMuted}
                      />
                    </View>
                  )}
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  {selectedCount > 0 && (
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedBadgeText}>{selectedCount}</Text>
                    </View>
                  )}
                  <View style={styles.iconSlot18}>
                    <Feather
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={colors.textMuted}
                    />
                  </View>
                </Pressable>
                <View style={styles.groupHeaderRight}>
                  {selectedCount > 0 && (
                    <GroupClearButton
                      onPress={() => {
                        selectedArray.forEach(id => onFilterChange(group.key, String(id)));
                      }}
                      count={selectedCount}
                      colors={colors}
                    />
                  )}
                </View>
              </View>

              {/* Group Options */}
              {isExpanded && (
                <Animated.View
                  style={[
                    styles.groupContent as any,
                    {
                      opacity: animatedValues[group.key],
                    } as any
                  ]}
                >
                  {selectedCount > 0 && (
                    <View style={styles.selectedSummaryRow}>
                      <Text style={styles.selectedSummaryLabel}>Выбрано:</Text>
                      <Text style={styles.selectedSummaryText} numberOfLines={2}>
                        {selectedNames.length > 0 ? selectedNames.join(', ') : selectedArray.join(', ')}
                      </Text>
                    </View>
                  )}
                  {orderedOptions.map(option => {
                    const optionId = String(option.id);
                    const isSelected = selectedSet.has(optionId);

                    return (
                      <FilterOptionItem
                        key={option.id}
                        option={option}
                        isSelected={isSelected}
                        isMultiSelect={isMultiSelect}
                        onPress={() => onFilterChange(group.key, option.id)}
                        styles={styles}
                        colors={colors}
                      />
                    );
                  })}
                </Animated.View>
              )}
            </View>
          );
        })}

        {/* Year */}
        {onYearChange && (
          <View style={[styles.filterGroup, styles.filterGroupLast, styles.yearGroup]}>
            <View style={styles.yearInlineRow}>
              <View style={styles.yearLabelContainer}>
                <Feather
                  name="calendar"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text style={styles.yearLabel}>Год</Text>
              </View>
              <TextInput
                value={year ? String(year) : ''}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
                  onYearChange(cleaned.length === 4 ? cleaned : cleaned || undefined);
                }}
                placeholder="2023"
                keyboardType="numeric"
                maxLength={4}
                style={styles.yearInput}
                accessibilityLabel="Фильтр по году"
              />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Apply / Reset Buttons (Mobile: native + web-narrow) — sticky footer вне ScrollView */}
      {(Platform.OS !== 'web' || isNarrowWeb) && (
        <View style={styles.applyButtonContainer}>
          {activeFiltersCount > 0 && (
            <Pressable
              style={styles.resetMobileButton}
              onPress={onClearAll}
              accessibilityRole="button"
              accessibilityLabel={`Сбросить все фильтры (${activeFiltersCount})`}
            >
              <Text style={styles.resetMobileButtonText}>Сбросить всё</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.applyButton}
            onPress={onClose ?? onApply}
            accessibilityRole="button"
            accessibilityLabel={activeFiltersCount > 0 ? `Показать результаты (фильтров: ${activeFiltersCount})` : 'Показать результаты'}
          >
            <Text style={styles.applyButtonText}>
              {activeFiltersCount > 0 ? `Показать результаты · ${activeFiltersCount}` : 'Показать результаты'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
});

ModernFilters.displayName = 'ModernFilters';


export default ModernFilters;
