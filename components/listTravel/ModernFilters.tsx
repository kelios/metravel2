// ✅ УЛУЧШЕНИЕ: ModernFilters - мигрирован на DESIGN_TOKENS и useThemedColors
import React, { memo, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
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
import CardActionPressable from '@/components/ui/CardActionPressable';

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

const FilterCheckbox = memo(({ checked, checkboxStyle, checkboxCheckedStyle, checkColor }: {
  checked: boolean;
  checkboxStyle: any;
  checkboxCheckedStyle: any;
  checkColor: string;
}) => (
  <View style={[checkboxStyle, checked && checkboxCheckedStyle]}>
    {checked && <Feather name="check" size={14} color={checkColor} />}
  </View>
));

const FilterRadio = memo(({ checked, radioStyle, radioCheckedStyle, radioDotStyle }: {
  checked: boolean;
  radioStyle: any;
  radioCheckedStyle: any;
  radioDotStyle: any;
}) => (
  <View style={[radioStyle, checked && radioCheckedStyle]}>
    {checked && <View style={radioDotStyle} />}
  </View>
));

const GroupClearButton = memo(({ onPress, count, colors }: {
  onPress: () => void;
  count: number;
  colors: ReturnType<typeof useThemedColors>;
}) => (
  <CardActionPressable
    onPress={onPress}
    title={`Очистить ${count} выбранных`}
    style={{
      paddingHorizontal: DESIGN_TOKENS.spacing.xs,
      paddingVertical: 2,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.dangerSoft,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
    }}
    accessibilityRole="button"
    accessibilityLabel={`Очистить ${count} выбранных`}
  >
    <Feather name="x" size={12} color={colors.danger} />
    <Text style={{
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.danger,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
    }} numberOfLines={1}>
      Очистить
    </Text>
  </CardActionPressable>
));

const SortDropdown = memo(({ 
  sortGroup, 
  selectedFilters, 
  onFilterChange, 
  styles, 
  colors 
}: {
  sortGroup: FilterGroup;
  selectedFilters: FilterState;
  onFilterChange: (groupKey: string, optionId: string) => void;
  styles: any;
  colors: ReturnType<typeof useThemedColors>;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const selectedOption = useMemo(() => {
    const selectedId = String(selectedFilters.sort ?? '');
    return sortGroup.options.find(opt => String(opt.id) === selectedId) || sortGroup.options[0];
  }, [sortGroup.options, selectedFilters.sort]);

  const handleSelect = useCallback((optionId: string) => {
    onFilterChange(sortGroup.key, optionId);
    setIsExpanded(false);
  }, [onFilterChange, sortGroup.key]);

  return (
    <View style={styles.sortSection}>
      {/* Dropdown trigger */}
      <Pressable
        onPress={() => setIsExpanded(!isExpanded)}
        style={[
          styles.sortDropdownTrigger,
          isExpanded && styles.sortDropdownTriggerActive,
          Platform.OS === 'web' && isHovered && !isExpanded && styles.sortDropdownTriggerHover,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Сортировка: ${selectedOption?.name || 'Новые'}`}
        accessibilityState={{ expanded: isExpanded }}
        {...(Platform.OS === 'web'
          ? {
              onMouseEnter: () => setIsHovered(true),
              onMouseLeave: () => setIsHovered(false),
            } as any
          : {})}
      >
        <View style={styles.sortDropdownTriggerLeft}>
          <View style={styles.sortDropdownIcon}>
            <Feather name="sliders" size={16} color={colors.primary} />
          </View>
          <View style={styles.sortDropdownTextContainer}>
            <Text style={styles.sortDropdownLabel}>Сортировка</Text>
            <Text style={styles.sortDropdownValue} numberOfLines={1}>
              {selectedOption?.name || 'Новые'}
            </Text>
          </View>
        </View>
        <View style={styles.sortDropdownChevron}>
          <Feather 
            name={isExpanded ? 'chevron-up' : 'chevron-down'} 
            size={18} 
            color={colors.textSecondary} 
          />
        </View>
      </Pressable>

      {/* Dropdown content */}
      {isExpanded && (
        <View style={styles.sortDropdownContent}>
          {sortGroup.options.map((option) => {
            const optionId = String(option.id);
            const isSelected = String(selectedFilters.sort ?? '') === optionId;

            return (
              <SortOptionItem
                key={option.id}
                option={option}
                isSelected={isSelected}
                onPress={() => handleSelect(option.id)}
                styles={styles}
                colors={colors}
                isCompact
              />
            );
          })}
        </View>
      )}
    </View>
  );
});

const SORT_ICONS: Record<string, string> = {
  'new': 'clock',
  'old': 'archive',
  'popular_desc': 'trending-up',
  'popular_asc': 'trending-down',
  'rating_desc': 'star',
  'added_desc': 'plus-circle',
  'added_asc': 'minus-circle',
  'name_asc': 'type',
  'name_desc': 'type',
  'year_desc': 'calendar',
  'year_asc': 'calendar',
};

const getSortIcon = (optionId: string): string => {
  return SORT_ICONS[optionId] || 'list';
};

const SortOptionItem = memo(({ 
  option, 
  isSelected, 
  onPress, 
  styles, 
  colors,
  isCompact = false,
}: {
  option: FilterOption;
  isSelected: boolean;
  onPress: () => void;
  styles: any;
  colors: ReturnType<typeof useThemedColors>;
  isCompact?: boolean;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const iconName = getSortIcon(option.id);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterOption,
        styles.sortOption,
        isCompact && styles.sortOptionCompact,
        isSelected && styles.sortOptionSelected,
        Platform.OS === 'web' && isHovered && !isSelected && styles.sortOptionHover,
      ]}
      accessibilityRole="radio"
      accessibilityLabel={option.name}
      accessibilityState={{ checked: isSelected }}
      {...(Platform.OS === 'web'
        ? {
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false),
          } as any
        : {})}
    >
      <View style={[
        styles.sortIconContainer,
        isSelected && styles.sortIconContainerSelected,
      ]}>
        <Feather 
          name={iconName as any} 
          size={14} 
          color={isSelected ? colors.primary : colors.textMuted} 
        />
      </View>
      <Text
        style={[
          styles.sortOptionText,
          isSelected && styles.sortOptionTextSelected,
        ]}
        numberOfLines={1}
      >
        {option.name}
      </Text>
      {isSelected && (
        <View style={styles.sortCheckIcon}>
          <Feather name="check" size={16} color={colors.primary} />
        </View>
      )}
    </Pressable>
  );
});

const FilterOptionItem = memo(({ 
  option, 
  isSelected, 
  isMultiSelect,
  onPress, 
  styles, 
  colors 
}: {
  option: FilterOption;
  isSelected: boolean;
  isMultiSelect: boolean;
  onPress: () => void;
  styles: any;
  colors: ReturnType<typeof useThemedColors>;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterOption,
        isSelected && styles.filterOptionSelected,
        Platform.OS === 'web' && isHovered && !isSelected && styles.filterOptionHover,
      ]}
      accessibilityRole={isMultiSelect ? 'checkbox' : 'radio'}
      accessibilityLabel={option.name}
      accessibilityState={{ checked: isSelected }}
      {...(Platform.OS === 'web'
        ? ({
            'aria-checked': isSelected,
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false),
          } as any)
        : null)}
    >
      {isMultiSelect ? (
        <FilterCheckbox 
          checked={isSelected} 
          checkboxStyle={styles.checkbox} 
          checkboxCheckedStyle={styles.checkboxChecked} 
          checkColor={colors.textOnPrimary} 
        />
      ) : (
        <FilterRadio 
          checked={isSelected} 
          radioStyle={styles.radio} 
          radioCheckedStyle={styles.radioChecked} 
          radioDotStyle={styles.radioDot} 
        />
      )}
      <Text 
        style={[
          styles.filterOptionText,
          isSelected && styles.filterOptionTextSelected
        ]}
        numberOfLines={1}
      >
        {option.name}
      </Text>
      {typeof option.count === 'number' && option.count > 0 && (
        <Text style={styles.filterOptionCount}>
          {option.count}
        </Text>
      )}
    </Pressable>
  );
});

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
  // ✅ УЛУЧШЕНИЕ: Поддержка тем через useThemedColors
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

      // Если по какой-то причине нет Animated.Value для этой группы (например, группа добавлена позже),
      // инициализируем его на лету, чтобы избежать runtime-ошибок.
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

  const showResultsBadge =
    resultsCount !== undefined && (Platform.OS !== 'web' || isNarrowWeb);

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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Фильтры</Text>
        </View>
        <View style={styles.headerRight}>
          {activeFiltersCount > 0 && (
            <Pressable onPress={onClearAll} style={styles.clearButton}>
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
              <Feather name="x" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Mobile/Narrow web: explicit clear-all button (avoid tiny icon-only control) */}
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
            // Инициализируем анимационные значения при необходимости
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
      {showResultsBadge && (
        <View style={styles.resultsBadge}>
          <Feather name="search" size={14} color={colors.textMuted} />
          <Text style={styles.resultsBadgeText}>
            {resultsText}
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
            : (rawSelected !== undefined && rawSelected !== null && rawSelected !== ''
              ? [rawSelected]
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
              <Pressable
                onPress={() => toggleGroup(group.key)}
                style={styles.groupHeader}
                accessibilityRole="button"
                accessibilityLabel={`${isExpanded ? 'Свернуть' : 'Развернуть'} ${group.title}`}
                accessibilityState={{ expanded: isExpanded }}
              >
                <View style={styles.groupHeaderLeft}>
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
                </View>
                <View style={styles.groupHeaderRight}>
                  {selectedCount > 0 && (
                    <GroupClearButton
                      onPress={() => {
                        selectedArray.forEach(id => onFilterChange(group.key, id));
                      }}
                      count={selectedCount}
                      colors={colors}
                    />
                  )}
                  <View style={styles.iconSlot18}>
                    <Feather
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={colors.textMuted}
                    />
                  </View>
                </View>
              </Pressable>

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
              />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Apply Button (Mobile) */}
      {Platform.OS !== 'web' && activeFiltersCount > 0 && (
        <View style={styles.applyButtonContainer}>
          <Pressable
            style={styles.applyButton}
            onPress={onApply}
            accessibilityRole="button"
            accessibilityLabel="Применить фильтры"
          >
            <Text style={styles.applyButtonText}>
              Применить фильтры ({activeFiltersCount})
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
});

ModernFilters.displayName = 'ModernFilters';

const createStyles = (colors: ReturnType<typeof useThemedColors>) => {
  const { spacing, typography, radii } = DESIGN_TOKENS;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      ...Platform.select({
        web: {
          boxShadow: colors.boxShadows.card,
          width: 280,
          position: 'sticky' as any,
          top: spacing.lg,
          maxHeight: '100%',
        },
        default: {},
      }),
    },
    containerMobile: {
      flex: 1,
      borderRadius: 0,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      backgroundColor: colors.surface,
      elevation: 0,
    },
    containerWebFull: {
      width: '100%',
      maxWidth: '100%',
      height: '100vh' as any,
      borderRadius: 0,
      position: 'relative',
      top: 0,
      maxHeight: '100vh' as any,
      boxShadow: 'none' as any,
      display: 'flex' as any,
      flexDirection: 'column' as any,
      overflowY: 'hidden' as any,
    },
    containerCompact: {
      padding: spacing.md,
      ...Platform.select({
        web: {
          width: 240,
        },
      }),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    headerTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.semibold as any,
      color: colors.text,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    iconSlot16: {
      width: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    iconSlot18: {
      width: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    closeButton: {
      padding: spacing.xs,
    },
    toggleAllButton: {
      marginBottom: spacing.xs,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.pill,
      paddingVertical: 8,
      paddingHorizontal: spacing.sm,
      ...Platform.select({
        web: {
          cursor: 'pointer',
        },
      }),
    },
    toggleAllButtonInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    toggleAllButtonText: {
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
      fontWeight: typography.weights.medium as any,
    },
    clearButton: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: colors.primarySoft,
    },
    clearButtonText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.medium as any,
      color: colors.primaryText,
    },
    clearAllMobileButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: 10,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.xs,
      ...Platform.select({
        web: {
          cursor: 'pointer',
        },
      }),
    },
    clearAllMobileButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.textSecondary,
    },
    resultsBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radii.pill,
      marginBottom: spacing.xs,
    },
    resultsBadgeText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.textSecondary,
    },
    sortSection: {
      marginBottom: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          boxShadow: colors.boxShadows.light,
        },
      }),
    },
    sortDropdownTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: `all ${DESIGN_TOKENS.animations.duration.fast}ms ${DESIGN_TOKENS.animations.easing.default}`,
        },
      }),
    },
    sortDropdownTriggerHover: Platform.select({
      web: {
        backgroundColor: colors.surfaceMuted,
      } as any,
    }),
    sortDropdownTriggerActive: {
      backgroundColor: colors.primarySoft,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sortDropdownTriggerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    sortDropdownIcon: {
      width: 32,
      height: 32,
      borderRadius: radii.md,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sortDropdownTextContainer: {
      flex: 1,
    },
    sortDropdownLabel: {
      fontSize: typography.sizes.xs,
      color: colors.textMuted,
      fontWeight: typography.weights.medium as any,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sortDropdownValue: {
      fontSize: typography.sizes.sm,
      color: colors.text,
      fontWeight: typography.weights.semibold as any,
      marginTop: 2,
    },
    sortDropdownChevron: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sortDropdownContent: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.xs,
      backgroundColor: colors.surface,
      gap: 2,
    },
    sortOption: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: 'transparent',
      marginBottom: 0,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.md,
      ...Platform.select({
        web: {
          transition: `all ${DESIGN_TOKENS.animations.duration.fast}ms ${DESIGN_TOKENS.animations.easing.default}`,
        },
      }),
    },
    sortOptionCompact: {
      paddingVertical: 8,
      paddingHorizontal: spacing.sm,
      minHeight: 40,
    },
    sortOptionSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryAlpha30,
    },
    sortOptionHover: Platform.select({
      web: {
        backgroundColor: colors.surfaceMuted,
      } as any,
    }),
    sortIconContainer: {
      width: 24,
      height: 24,
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sortIconContainerSelected: {
      backgroundColor: colors.primaryAlpha30,
    },
    sortCheckIcon: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sortOptionTextSelected: {
      color: colors.primaryDark,
      fontWeight: typography.weights.semibold as any,
    },
    extraFilters: {
      marginBottom: spacing.xs,
      gap: spacing.xs,
    },
    yearGroup: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      borderBottomWidth: 0,
      marginTop: spacing.md,
      marginBottom: 0,
      paddingTop: spacing.sm,
      paddingBottom: 0,
    },
    yearInlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    yearGroupContent: {
      marginTop: spacing.sm,
    },
    yearRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    yearLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    yearLabel: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      fontWeight: typography.weights.semibold as any,
    },
    yearInput: {
      flexBasis: 96,
      maxWidth: 96,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      fontSize: typography.sizes.sm,
      textAlign: 'center',
      alignSelf: 'flex-start',
      minHeight: 32,
      ...Platform.select({
        web: {
          outlineWidth: 0,
        },
      }),
    },
    moderationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 6,
      paddingHorizontal: spacing.xs,
      borderRadius: radii.md,
      ...Platform.select({
        web: {
          cursor: 'pointer',
        },
      }),
    },
    moderationRowSelected: {
      backgroundColor: colors.primarySoft,
    },
    moderationLabel: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    moderationLabelSelected: {
      color: colors.primaryDark,
      fontWeight: typography.weights.medium as any,
    },
    scrollView: {
      flex: 1,
      ...Platform.select({
        web: {
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        } as any,
      }),
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: spacing.lg,
    },
    filterGroup: {
      marginBottom: spacing.sm,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    filterGroupLast: {
      borderBottomWidth: 0,
      marginBottom: 0,
      paddingBottom: 0,
    },
    groupHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.xs,
      minHeight: 36,
      ...Platform.select({
        web: {
          cursor: 'pointer',
        },
      }),
    },
    groupHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flex: 1,
      minWidth: 0,
    },
    groupHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexShrink: 0,
      marginLeft: spacing.xs,
    },
    groupTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold as any,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      flexShrink: 1,
    },
    selectedBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: radii.pill,
      minWidth: 20,
      alignItems: 'center',
      flexShrink: 0,
    },
    selectedBadgeText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold as any,
      color: colors.textOnPrimary,
    },
    selectedSummaryRow: {
      marginBottom: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.md,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      gap: 2,
    },
    selectedSummaryLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold as any,
      color: colors.primaryText,
    },
    selectedSummaryText: {
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
      lineHeight: 16,
      fontWeight: typography.weights.medium as any,
    },
    groupContent: {
      marginTop: spacing.xs,
      overflow: 'hidden',
    },
    filterOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.md,
      marginBottom: spacing.xxs,
      minHeight: 44,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: `all ${DESIGN_TOKENS.animations.duration.fast}ms ${DESIGN_TOKENS.animations.easing.default}`,
        },
      }),
    },
    filterOptionHover: Platform.select({
      web: {
        backgroundColor: colors.surfaceMuted,
        transform: 'translateX(2px)',
      } as any,
    }),
    filterOptionSelected: {
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
    },
    filterOptionText: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.text,
      marginLeft: spacing.sm,
      fontWeight: typography.weights.regular as any,
    },
    sortOptionText: {
      flex: 1,
      fontSize: typography.sizes.md,
      color: colors.text,
      marginLeft: spacing.sm,
      fontWeight: typography.weights.medium as any,
    },
    filterOptionTextSelected: {
      color: colors.primaryDark,
      fontWeight: typography.weights.medium as any,
    },
    filterOptionCount: {
      fontSize: typography.sizes.xs,
      color: colors.textMuted,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: radii.pill,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: radii.sm,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    radioLarge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    radioChecked: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    radioDotLarge: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    applyButtonContainer: {
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    applyButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: radii.pill,
      alignItems: 'center',
    },
    applyButtonText: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold as any,
      color: colors.textOnPrimary,
    },
  });
};

export default ModernFilters;
