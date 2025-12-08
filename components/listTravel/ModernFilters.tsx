// ModernFilters.tsx - Современный компонент фильтров
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
import { Feather } from '@expo/vector-icons';
import { MODERN_DESIGN_TOKENS } from '@/styles/modernRedesign';

const { colors, spacing, radii, typography, shadows, animations } = MODERN_DESIGN_TOKENS;

interface FilterOption {
  id: string;
  name: string;
  count?: number;
}

interface FilterGroup {
  key: string;
  title: string;
  options: FilterOption[];
  multiSelect?: boolean;
  icon?: string;
}

interface ModernFiltersProps {
  filterGroups: FilterGroup[];
  selectedFilters: Record<string, string[]>;
  onFilterChange: (groupKey: string, optionId: string) => void;
  onClearAll: () => void;
  resultsCount?: number;
  isCompact?: boolean;
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
  year,
  onYearChange,
  showModeration,
  moderationValue,
  onToggleModeration,
  onApply,
  onClose,
}) => {
  const isNarrowWeb = Platform.OS === 'web' && Dimensions.get('window').width <= 768;
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
          duration: animations.duration.base,
          useNativeDriver: false,
        }).start();
      } else {
        next.add(groupKey);
        Animated.timing(animated, {
          toValue: 1,
          duration: animations.duration.base,
          useNativeDriver: false,
        }).start();
      }
      return next;
    });
  }, [animatedValues]);

  const activeFiltersCount = useMemo(() => {
    return Object.values(selectedFilters).reduce((sum, filters) => sum + filters.length, 0);
  }, [selectedFilters]);

  const FilterCheckbox = ({ checked }: { checked: boolean }) => (
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked && <Feather name="check" size={12} color="#fff" />}
    </View>
  );

  const FilterRadio = ({ checked }: { checked: boolean }) => (
    <View style={[styles.radio, checked && styles.radioChecked]}>
      {checked && <View style={styles.radioDot} />}
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        isCompact && styles.containerCompact,
        Platform.OS !== 'web' && styles.containerMobile,
        Platform.OS === 'web' && isNarrowWeb && styles.containerWebFull,
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onClose && (
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Закрыть фильтры"
            >
              <Feather name="x" size={18} color={colors.neutral[600]} />
            </Pressable>
          )}
          <Text style={styles.headerTitle}>Фильтры</Text>
        </View>
        {activeFiltersCount > 0 && (
          <Pressable onPress={onClearAll} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>
              Очистить ({activeFiltersCount})
            </Text>
          </Pressable>
        )}
      </View>

      {/* Toggle all groups */}
      <Pressable
        onPress={() => {
          const allKeys = filterGroups.map(g => g.key);
          const allExpanded = allKeys.every(key => expandedGroups.has(key));
          const next = new Set<string>();

          allKeys.forEach(key => {
            // Инициализируем анимационные значения при необходимости
            if (!animatedValues[key]) {
              animatedValues[key] = new Animated.Value(allExpanded ? 1 : 0);
            }
            const animated = animatedValues[key];
            Animated.timing(animated, {
              toValue: allExpanded ? 0 : 1,
              duration: animations.duration.base,
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
        <Text style={styles.toggleAllButtonText}>
          {filterGroups.every(g => expandedGroups.has(g.key)) ? 'Свернуть все' : 'Развернуть все'}
        </Text>
      </Pressable>

      {/* Moderation (admin) */}
      <View style={styles.extraFilters}>
        {showModeration && onToggleModeration && (
          <Pressable
            onPress={onToggleModeration}
            style={styles.moderationRow}
          >
            <Feather
              name={moderationValue === 0 ? 'check-square' : 'square'}
              size={16}
              color={colors.neutral[600]}
            />
            <Text style={styles.moderationLabel}>Только на модерации</Text>
          </Pressable>
        )}
      </View>

      {/* Results Count Badge */}
      {resultsCount !== undefined && (
        <View style={styles.resultsBadge}>
          <Feather name="search" size={14} color={colors.neutral[500]} />
          <Text style={styles.resultsBadgeText}>
            Найдено: {resultsCount}
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
          const selectedCount = selectedFilters[group.key]?.length || 0;
          
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
                    <Feather 
                      name={group.icon as any} 
                      size={16} 
                      color={colors.neutral[600]} 
                    />
                  )}
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  {selectedCount > 0 && (
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedBadgeText}>{selectedCount}</Text>
                    </View>
                  )}
                </View>
                <Feather
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.neutral[400]}
                />
              </Pressable>

              {/* Group Options */}
              {isExpanded && (
                <Animated.View 
                  style={[
                    styles.groupContent,
                    {
                      opacity: animatedValues[group.key],
                      maxHeight: animatedValues[group.key].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 500],
                      }),
                    }
                  ]}
                >
                  {group.options.map(option => {
                    const isSelected = selectedFilters[group.key]?.includes(option.id);
                    
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
                          <FilterCheckbox checked={isSelected} />
                        ) : (
                          <FilterRadio checked={isSelected} />
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
      </ScrollView>

      {/* Year as compact inline row at the bottom */}
      {onYearChange && (
        <View style={[styles.filterGroup, styles.filterGroupLast, styles.yearGroup]}>
          <View style={styles.yearInlineRow}>
            <View style={styles.yearLabelContainer}>
              <Feather 
                name="calendar" 
                size={16} 
                color={colors.neutral[600]} 
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.default,
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    ...Platform.select({
      web: {
        ...shadows.sm,
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
    backgroundColor: colors.surface.default,
    // Убираем web‑тени/карточный вид на native
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  containerWebFull: {
    width: '100%',
    maxWidth: '100%',
    height: '100%',
    borderRadius: 0,
    position: 'relative',
    top: 0,
    maxHeight: 'none',
    boxShadow: 'none',
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
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[800],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  closeButton: {
    padding: spacing.xs,
  },
  toggleAllButton: {
    marginBottom: spacing.sm,
  },
  toggleAllButtonText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
  },
  clearButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.neutral[100],
  },
  clearButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  resultsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.neutral[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    marginBottom: spacing.md,
  },
  resultsBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[700],
  },
  extraFilters: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  yearGroup: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
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
    fontSize: typography.fontSize.sm,
    color: colors.neutral[700],
    fontWeight: typography.fontWeight.semibold,
  },
  yearInput: {
    flexBasis: 96,
    maxWidth: 96,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[50],
    fontSize: typography.fontSize.sm,
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
    gap: spacing.xs,
  },
  moderationLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[500],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  filterGroup: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
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
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[700],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedBadge: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.pill,
    minWidth: 20,
    alignItems: 'center',
  },
  selectedBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: '#fff',
  },
  groupContent: {
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
    marginBottom: spacing.xxs,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: `all ${animations.duration.fast}ms ${animations.easing.ease}`,
        ':hover': {
          backgroundColor: colors.neutral[50],
        },
      },
    }),
  },
  filterOptionSelected: {
    backgroundColor: colors.primary[50],
  },
  filterOptionText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.neutral[600],
    marginLeft: spacing.sm,
  },
  filterOptionTextSelected: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.medium,
  },
  filterOptionCount: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[400],
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  radioChecked: {
    borderColor: colors.primary[500],
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[500],
  },
  applyButtonContainer: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  applyButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: '#fff',
  },
});

export default ModernFilters;
