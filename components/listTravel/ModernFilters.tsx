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

const FilterCheckbox = memo(({ checked, checkboxStyle, checkboxCheckedStyle, checkColor }: {
  checked: boolean;
  checkboxStyle: any;
  checkboxCheckedStyle: any;
  checkColor: string;
}) => (
  <View style={[checkboxStyle, checked && checkboxCheckedStyle]}>
    {checked && <Feather name="check" size={12} color={checkColor} />}
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
  // ✅ УЛУЧШЕНИЕ: Поддержка тем через useThemedColors
  const colors = useThemedColors();
  const styles = createStyles(colors);

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

  const allGroupKeys = useMemo(() => filterGroups.map((g) => g.key), [filterGroups]);

  const areAllGroupsExpanded = useMemo(
    () => allGroupKeys.length > 0 && allGroupKeys.every((key) => expandedGroups.has(key)),
    [allGroupKeys, expandedGroups],
  );

  const resultsText = useMemo(() => {
    if (typeof resultsCount !== 'number') return '';
    const count = resultsCount;
    const mod10 = count % 10;
    const mod100 = count % 100;
    let noun = 'путешествий';
    if (mod10 === 1 && mod100 !== 11) {
      noun = 'путешествие';
    } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      noun = 'путешествия';
    }
    return `Найдено ${count} ${noun}`;
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
          const allKeys = filterGroups.map((g) => g.key);
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
            {...(Platform.OS === 'web'
              ? ({
                  title: 'Показывать только путешествия, ожидающие модерации',
                  'aria-label': 'Показывать только путешествия, ожидающие модерации',
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

      {/* Filter Groups */}
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.scrollContent}
      >
        {filterGroups.map((group, index) => {
          const isExpanded = expandedGroups.has(group.key);
          const rawSelected = selectedFilters[group.key];
          const selectedArray = Array.isArray(rawSelected) ? rawSelected : [];
          const selectedCount = selectedArray.length;
          
          return (
            <View 
              key={group.key} 
              style={[
                styles.filterGroup,
                index === filterGroups.length - 1 && styles.filterGroupLast
              ]}
            >
              {/* Group Header */}
              <Pressable
                onPress={() => toggleGroup(group.key)}
                style={styles.groupHeader}
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
                <View style={styles.iconSlot18}>
                  <Feather
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.textMuted}
                  />
                </View>
              </Pressable>

              {/* Group Options */}
              {isExpanded && (
                <Animated.View 
                  style={[
                    styles.groupContent as any,
                    {
                      opacity: animatedValues[group.key],
                      maxHeight: animatedValues[group.key].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 500],
                      }),
                    } as any
                  ]}
                >
                  {group.options.map(option => {
                    const optionId = String(option.id);
                    const isSelected = selectedArray.map(String).includes(optionId);
                    
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => onFilterChange(group.key, option.id)}
                        style={[
                          styles.filterOption,
                          isSelected && styles.filterOptionSelected
                        ]}
                      >
                        {group.multiSelect !== false ? (
                          <FilterCheckbox checked={isSelected} checkboxStyle={styles.checkbox} checkboxCheckedStyle={styles.checkboxChecked} checkColor={colors.textOnPrimary} />
                        ) : (
                          <FilterRadio checked={isSelected} radioStyle={styles.radio} radioCheckedStyle={styles.radioChecked} radioDotStyle={styles.radioDot} />
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
                        {option.count !== undefined && (
                          <Text style={styles.filterOptionCount}>
                            {option.count}
                          </Text>
                        )}
                      </Pressable>
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
      height: '100%',
      borderRadius: 0,
      position: 'relative',
      top: 0,
      maxHeight: 'none' as any,
      boxShadow: 'none' as any,
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
      color: colors.primary,
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
    },
    groupTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold as any,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    selectedBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: radii.pill,
      minWidth: 20,
      alignItems: 'center',
    },
    selectedBadgeText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold as any,
      color: colors.textOnPrimary,
    },
    groupContent: {
      marginTop: spacing.xs,
      overflow: 'hidden',
    },
    filterOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: spacing.xs,
      borderRadius: radii.md,
      marginBottom: spacing.xxs,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: `all ${DESIGN_TOKENS.animations.duration.fast}ms ${DESIGN_TOKENS.animations.easing.default}`,
        },
      }),
    },
    filterOptionSelected: {
      backgroundColor: colors.primarySoft,
    },
    filterOptionText: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginLeft: spacing.sm,
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
      width: 18,
      height: 18,
      borderRadius: radii.sm,
      borderWidth: 2,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    radio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    radioChecked: {
      borderColor: colors.primary,
    },
    radioDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
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

export default memo(ModernFilters);
