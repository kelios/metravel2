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
import { useThemedColors } from '@/hooks/useTheme';
import { getTravelLabel } from '@/utils/pluralize';
import { BREAKPOINTS } from './utils/listTravelConstants';

// Подкомпоненты из filters/
import {
  FilterCheckbox,
  FilterOptionItem,
  GroupClearButton,
  SortDropdown,
  createModernFiltersStyles,
} from './filters';

export type { FilterOption, FilterGroup, FilterState } from './filters/types';
import type { FilterGroup, FilterState } from './filters/types';

function getModernFiltersReserveState(params: {
  filterGroups: FilterGroup[];
  isLoading: boolean;
  isNarrowWeb: boolean;
}) {
  const hasOptions = params.filterGroups.some((group) => (group.options || []).length > 0);
  const shouldReserveSpace = params.isLoading || !hasOptions;
  const reserveMinHeight =
    Platform.OS === 'web'
      ? params.isNarrowWeb
        ? 720
        : 760
      : 640;

  return {
    hasOptions,
    reserveMinHeight,
    shouldReserveSpace,
  };
}

function getModernFiltersViewportState() {
  // Must match usesOverlaySidebar threshold in listTravelBaseModel (BREAKPOINTS.DESKTOP = 1440).
  // On compact web widths the sidebar is a fullscreen overlay, so it needs the sticky footer.
  const isNarrowWeb =
    Platform.OS === 'web'
      && Dimensions.get('window').width < BREAKPOINTS.DESKTOP;

  return {
    isNarrowWeb,
    shouldReserveResultsBadge: Platform.OS !== 'web' || isNarrowWeb,
    showsStickyFooter: Platform.OS !== 'web' || isNarrowWeb,
  };
}

function getModernFiltersActiveCount(selectedFilters: FilterState) {
  return Object.values(selectedFilters).reduce<number>((sum, filters) => {
    if (Array.isArray(filters)) {
      return sum + filters.length;
    }

    return sum;
  }, 0);
}

function splitModernFilterGroups(filterGroups: FilterGroup[]) {
  return {
    groupsWithoutSort: filterGroups.filter((group) => group.key !== 'sort'),
    sortGroup: filterGroups.find((group) => group.key === 'sort'),
  };
}

function getModernFiltersResultsText(resultsCount?: number) {
  if (typeof resultsCount !== 'number') return '';
  return `${resultsCount} ${getTravelLabel(resultsCount)}`;
}

function blurActiveWebElement() {
  if (typeof document === 'undefined') return;
  const activeElement = document.activeElement as { blur?: () => void } | null;
  activeElement?.blur?.();
}

function getOrderedModernFilterOptions(group: FilterGroup, selectedFilters: FilterState) {
  const rawSelected = selectedFilters[group.key];
  const isMultiSelect = group.multiSelect !== false;
  const selectedArray = isMultiSelect
    ? Array.isArray(rawSelected)
      ? rawSelected
      : []
    : rawSelected !== undefined && rawSelected !== null && (rawSelected as any) !== ''
      ? [rawSelected].flat()
      : [];
  const selectedSet = new Set(selectedArray.map(String));
  const selectedNames = group.options
    .filter((option) => selectedSet.has(String(option.id)))
    .map((option) => option.name);
  const orderedOptions = group.options.slice().sort((a, b) => {
    const aSelected = selectedSet.has(String(a.id));
    const bSelected = selectedSet.has(String(b.id));
    if (aSelected === bSelected) return 0;
    return aSelected ? -1 : 1;
  });

  return {
    isMultiSelect,
    orderedOptions,
    selectedArray,
    selectedCount: selectedArray.length,
    selectedNames,
    selectedSet,
  };
}

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
  showDraftsOnly?: boolean;
  draftsOnlyValue?: boolean;
  onToggleDraftsOnly?: () => void;
  onApply?: () => void;
  onClose?: () => void;
  optionalHint?: boolean;
  embeddedSidebar?: boolean;
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
  showDraftsOnly,
  draftsOnlyValue,
  onToggleDraftsOnly,
  onApply,
  onClose,
  optionalHint = false,
  embeddedSidebar = false,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createModernFiltersStyles(colors), [colors]);

  const { isNarrowWeb, showsStickyFooter } = getModernFiltersViewportState();
  const useOverlayChrome = !embeddedSidebar && isNarrowWeb;
  const shouldShowStickyFooter = !embeddedSidebar && showsStickyFooter;
  const { reserveMinHeight, shouldReserveSpace } = getModernFiltersReserveState({
    filterGroups,
    isLoading,
    isNarrowWeb: useOverlayChrome,
  });
  const [yearFocused, setYearFocused] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    // На десктопе раскрываем первые 2 группы фильтров по умолчанию для улучшения обнаруживаемости.
    // На мобильном и в overlay-режиме все свёрнуты — экономим место.
    const { isNarrowWeb: narrow } = getModernFiltersViewportState();
    if (Platform.OS !== 'web' || narrow) return new Set<string>();
    const nonSortGroups = filterGroups.filter(g => g.key !== 'sort');
    return new Set(nonSortGroups.slice(0, 2).map(g => g.key));
  });
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

  const activeFiltersCount = useMemo(() => getModernFiltersActiveCount(selectedFilters), [selectedFilters]);
  const { groupsWithoutSort, sortGroup } = useMemo(() => splitModernFilterGroups(filterGroups), [filterGroups]);
  const useStackedHeader = Platform.OS === 'web' && useOverlayChrome;
  // Icon-only toggle on native: the «Развернуть/Свернуть» label widens headerRight and
  // overlaps the results chip on Android (F-39). Keep the label only on narrow web.
  const showToggleAllLabel = Platform.OS === 'web' && useOverlayChrome;

  const allGroupKeys = useMemo(() => groupsWithoutSort.map((g) => g.key), [groupsWithoutSort]);

  const areAllGroupsExpanded = useMemo(
    () => allGroupKeys.length > 0 && allGroupKeys.every((key) => expandedGroups.has(key)),
    [allGroupKeys, expandedGroups],
  );

  const resultsText = useMemo(() => getModernFiltersResultsText(resultsCount), [resultsCount]);
  const orderedOptionsByGroup = useMemo(() => {
    const map: Record<string, ReturnType<typeof getOrderedModernFilterOptions>> = {};
    for (const group of groupsWithoutSort) {
      map[group.key] = getOrderedModernFilterOptions(group, selectedFilters);
    }
    return map;
  }, [groupsWithoutSort, selectedFilters]);
  const handleDismissFilters = useCallback(() => {
    blurActiveWebElement();
    onClose?.();
  }, [onClose]);

  return (
    <View
      style={[
        styles.container,
        isCompact && styles.containerCompact,
        Platform.OS !== 'web' && styles.containerMobile,
        Platform.OS === 'web' && useOverlayChrome && styles.containerWebFull,
        shouldReserveSpace && { minHeight: reserveMinHeight },
      ]}
    >
      <View
        style={[
          styles.topChrome,
          (Platform.OS !== 'web' || useOverlayChrome) && styles.topChromeCompact,
        ]}
      >
        {/* Header — single compact row */}
        <View style={[styles.header, useStackedHeader && styles.headerStacked]}>
          <View
            style={[
              styles.headerLeft,
              useStackedHeader && styles.headerLeftStacked,
              embeddedSidebar && styles.headerLeftEmbeddedSidebar,
            ]}
          >
            {Platform.OS !== 'web' && (
              <>
                <Feather name="filter" size={16} color={colors.primaryDark} />
                <Text style={styles.headerTitle}>Фильтры</Text>
              </>
            )}
            {optionalHint && <Text style={styles.optionalHint}>необязательно</Text>}
            {!!resultsText && (
              <View
                style={[
                  styles.headerCountChip,
                  embeddedSidebar && styles.headerCountChipEmbeddedSidebar,
                ]}
                testID="filters-results-chip"
              >
                <Text style={styles.headerCountChipText} numberOfLines={1}>{resultsText}</Text>
              </View>
            )}
          </View>
          <View style={[styles.headerRight, useStackedHeader && styles.headerRightStacked]}>
            {activeFiltersCount > 0 && (
              <Pressable
                onPress={onClearAll}
                style={({ hovered, pressed }) => [
                  styles.clearButton,
                  (hovered || pressed) && styles.clearButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Очистить все фильтры (${activeFiltersCount})`}
              >
                <Text style={styles.clearButtonText}>Сбросить</Text>
                <View style={styles.clearButtonCountBadge}>
                  <Text style={styles.clearButtonCountText}>{activeFiltersCount}</Text>
                </View>
              </Pressable>
            )}
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
              style={({ hovered, pressed }) => [
                styles.toggleAllButton,
                showToggleAllLabel && styles.toggleAllButtonWide,
                (hovered || pressed) && styles.toggleAllButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={areAllGroupsExpanded ? 'Свернуть все группы фильтров' : 'Развернуть все группы фильтров'}
              {...(Platform.OS === 'web'
                ? ({ title: areAllGroupsExpanded ? 'Свернуть все' : 'Развернуть все' } as any)
                : null)}
            >
              <View style={styles.toggleAllButtonInner}>
                <Feather
                  name={areAllGroupsExpanded ? 'chevrons-up' : 'chevrons-down'}
                  size={16}
                  color={colors.primaryDark}
                />
                {showToggleAllLabel && (
                  <Text style={styles.toggleAllButtonText} numberOfLines={1}>
                    {areAllGroupsExpanded ? 'Свернуть' : 'Развернуть'}
                  </Text>
                )}
              </View>
            </Pressable>
            {onClose && (
              <Pressable
                onPress={handleDismissFilters}
                style={({ hovered, pressed }) => [
                  styles.closeButton,
                  (hovered || pressed) && styles.closeButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Закрыть фильтры"
              >
                <Feather name="x" size={20} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Moderation (admin) */}
        <View style={styles.extraFilters}>
          {showDraftsOnly && onToggleDraftsOnly && (
            <Pressable
              onPress={onToggleDraftsOnly}
              style={({ hovered, pressed }) => [
                styles.moderationRow,
                draftsOnlyValue && styles.moderationRowSelected,
                (hovered || pressed) && styles.moderationRowPressed,
              ]}
              accessibilityRole="checkbox"
              accessibilityLabel="Показать черновики"
              accessibilityState={{ checked: !!draftsOnlyValue }}
              {...(Platform.OS === 'web'
                ? ({
                    title: 'Показывать только черновики автора',
                  } as any)
                : null)}
            >
              <FilterCheckbox checked={!!draftsOnlyValue} checkboxStyle={styles.checkbox} checkboxCheckedStyle={styles.checkboxChecked} checkColor={colors.textOnPrimary} />
              <Text
                style={[
                  styles.moderationLabel,
                  draftsOnlyValue && styles.moderationLabelSelected,
                ]}
              >
                Показать черновики
              </Text>
            </Pressable>
          )}
          {showModeration && onToggleModeration && (
            <Pressable
              onPress={onToggleModeration}
              style={({ hovered, pressed }) => [
                styles.moderationRow,
                moderationValue === 0 && styles.moderationRowSelected,
                (hovered || pressed) && styles.moderationRowPressed,
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

        {/* Year (always visible, not inside the scrollable list) */}
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
                onFocus={() => setYearFocused(true)}
                onBlur={() => setYearFocused(false)}
                placeholder={String(new Date().getFullYear())}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                maxLength={4}
                style={[styles.yearInput, yearFocused && styles.yearInputFocused]}
                accessibilityLabel="Фильтр по году"
              />
            </View>
          </View>
        )}
      </View>

      {/* Filter Groups */}
      <ScrollView
        testID="filter-scrollview"
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {groupsWithoutSort.map((group, index) => {
          const isExpanded = expandedGroups.has(group.key);
          const {
            isMultiSelect,
            orderedOptions,
            selectedArray,
            selectedCount,
            selectedNames,
            selectedSet,
          } = orderedOptionsByGroup[group.key];

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
                  style={({ hovered, pressed }) => [
                    styles.groupHeaderLeft,
                    styles.groupHeaderButton,
                    isExpanded && styles.groupHeaderButtonExpanded,
                    (hovered || pressed) && styles.groupHeaderButtonPressed,
                  ]}
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
                  <Text style={styles.groupTitle} numberOfLines={1}>{group.title}</Text>
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
                    <View
                      style={styles.selectedSummaryRow}
                      accessibilityLabel={`Выбрано: ${
                        selectedNames.length > 0 ? selectedNames.join(', ') : selectedArray.join(', ')
                      }`}
                    >
                      {(selectedNames.length > 0 ? selectedNames : selectedArray.map(String)).map((name) => (
                        <View key={`${group.key}-${name}`} style={styles.selectedSummaryChip}>
                          <Text style={styles.selectedSummaryText} numberOfLines={1}>
                            {name}
                          </Text>
                        </View>
                      ))}
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
      </ScrollView>

      {/* Apply / Reset Buttons (Mobile: native + web-narrow) — sticky footer вне ScrollView */}
      {shouldShowStickyFooter && (
        <View style={styles.applyButtonContainer} testID="filters-apply-footer">
          {activeFiltersCount > 0 && (
            <Pressable
              style={({ hovered, pressed }) => [
                styles.resetMobileButton,
                (hovered || pressed) && styles.resetMobileButtonPressed,
              ]}
              onPress={onClearAll}
              accessibilityRole="button"
              accessibilityLabel={`Сбросить все фильтры (${activeFiltersCount})`}
            >
              <Text style={styles.resetMobileButtonText}>Сбросить всё</Text>
            </Pressable>
          )}
          <Pressable
            testID="filters-apply-button"
            style={({ hovered, pressed }) => [
              styles.applyButton,
              (hovered || pressed) && styles.applyButtonPressed,
            ]}
            onPress={() => {
              blurActiveWebElement();
              if (onClose) {
                onClose();
                return;
              }
              onApply?.();
            }}
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
