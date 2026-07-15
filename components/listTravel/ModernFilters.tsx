// Подкомпоненты вынесены в ./filters/
import React, { memo, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  Animated,
  TextInput,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { getTravelLabel } from '@/utils/pluralize';
import { BREAKPOINTS } from './utils/listTravelConstants';
import { useResponsiveWidth } from '@/hooks/useResponsive';

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
import { translate as i18nT } from '@/i18n'


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

function getModernFiltersViewportState(width: number) {
  // Must match usesOverlaySidebar threshold in listTravelBaseModel (BREAKPOINTS.DESKTOP = 1440).
  // On compact web widths the sidebar is a fullscreen overlay, so it needs the sticky footer.
  const isNarrowWeb =
    Platform.OS === 'web'
      && width < BREAKPOINTS.DESKTOP;

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
  const viewportWidth = useResponsiveWidth();

  const { isNarrowWeb, showsStickyFooter } = getModernFiltersViewportState(viewportWidth);
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
    const { isNarrowWeb: narrow } = getModernFiltersViewportState(viewportWidth);
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
  const appliedDesktopDefaultsRef = useRef(Platform.OS !== 'web' || viewportWidth > 0);

  useEffect(() => {
    if (Platform.OS !== 'web' || appliedDesktopDefaultsRef.current || viewportWidth <= 0) return;
    appliedDesktopDefaultsRef.current = true;
    if (viewportWidth < BREAKPOINTS.DESKTOP) return;

    setExpandedGroups((current) => {
      if (current.size > 0) return current;
      const nonSortGroups = filterGroups.filter((group) => group.key !== 'sort');
      return new Set(nonSortGroups.slice(0, 2).map((group) => group.key));
    });
  }, [filterGroups, viewportWidth]);

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
                <Text style={styles.headerTitle}>{i18nT('travel:components.listTravel.ModernFilters.filtry_11f4ea40')}</Text>
              </>
            )}
            {optionalHint && <Text style={styles.optionalHint}>{i18nT('travel:components.listTravel.ModernFilters.neobyazatelno_6bf70c13')}</Text>}
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
                accessibilityLabel={i18nT('travel:components.listTravel.ModernFilters.ochistit_vse_filtry_value1_0badfc04', { value1: activeFiltersCount })}
              >
                <Text style={styles.clearButtonText}>{i18nT('travel:components.listTravel.ModernFilters.sbrosit_2f0ddae1')}</Text>
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
              accessibilityLabel={areAllGroupsExpanded ? i18nT('travel:components.listTravel.ModernFilters.svernut_vse_gruppy_filtrov_c5e05236') : i18nT('travel:components.listTravel.ModernFilters.razvernut_vse_gruppy_filtrov_1022c93e')}
              {...(Platform.OS === 'web'
                ? ({ title: areAllGroupsExpanded ? i18nT('travel:components.listTravel.ModernFilters.svernut_vse_957f730d') : i18nT('travel:components.listTravel.ModernFilters.razvernut_vse_a8506446') } as any)
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
                    {areAllGroupsExpanded ? i18nT('travel:components.listTravel.ModernFilters.svernut_1fb6fffb') : i18nT('travel:components.listTravel.ModernFilters.razvernut_69ed5231')}
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
                accessibilityLabel={i18nT('travel:components.listTravel.ModernFilters.zakryt_filtry_65ea723a')}
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
              accessibilityLabel={i18nT('travel:components.listTravel.ModernFilters.pokazat_chernoviki_721ba67a')}
              accessibilityState={{ checked: !!draftsOnlyValue }}
              {...(Platform.OS === 'web'
                ? ({
                    title: i18nT('travel:components.listTravel.ModernFilters.pokazyvat_tolko_chernoviki_avtora_266b3f38'),
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
                {i18nT('travel:components.listTravel.ModernFilters.pokazat_chernoviki_721ba67a')}</Text>
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
              accessibilityLabel={i18nT('travel:components.listTravel.ModernFilters.tolko_na_moderatsii_2663efb3')}
              accessibilityState={{ checked: moderationValue === 0 }}
              {...(Platform.OS === 'web'
                ? ({
                    title: i18nT('travel:components.listTravel.ModernFilters.pokazyvat_tolko_puteshestviya_ozhidayuschie__3e7a3fd7'),
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
                {i18nT('travel:components.listTravel.ModernFilters.tolko_na_moderatsii_2663efb3')}</Text>
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
                <Text style={styles.yearLabel}>{i18nT('travel:components.listTravel.ModernFilters.god_ad7f26e4')}</Text>
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
                accessibilityLabel={i18nT('travel:components.listTravel.ModernFilters.filtr_po_godu_95020f4a')}
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
                  accessibilityLabel={`${isExpanded ? i18nT('travel:components.listTravel.ModernFilters.svernut_1fb6fffb') : i18nT('travel:components.listTravel.ModernFilters.razvernut_69ed5231')} ${group.title}`}
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
                      accessibilityLabel={i18nT('travel:components.listTravel.ModernFilters.vybrano_value1_08feb12d', { value1: selectedNames.length > 0 ? selectedNames.join(', ') : selectedArray.join(', ') })}
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
              accessibilityLabel={i18nT('travel:components.listTravel.ModernFilters.sbrosit_vse_filtry_value1_7c7447fa', { value1: activeFiltersCount })}
            >
              <Text style={styles.resetMobileButtonText}>{i18nT('travel:components.listTravel.ModernFilters.sbrosit_vse_325adc51')}</Text>
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
            accessibilityLabel={activeFiltersCount > 0 ? i18nT('travel:components.listTravel.ModernFilters.pokazat_rezultaty_filtrov_value1_7e4c6fc1', { value1: activeFiltersCount }) : i18nT('travel:components.listTravel.ModernFilters.pokazat_rezultaty_0c2ce1f0')}
          >
            <Text style={styles.applyButtonText}>
              {activeFiltersCount > 0 ? i18nT('travel:components.listTravel.ModernFilters.pokazat_rezultaty_value1_46ec1ee2', { value1: activeFiltersCount }) : i18nT('travel:components.listTravel.ModernFilters.pokazat_rezultaty_0c2ce1f0')}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
});

ModernFilters.displayName = 'ModernFilters';


export default ModernFilters;
