import React, { memo, useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { FilterGroup, FilterState } from '../ModernFilters';
import SortOptionItem from './SortOptionItem';

interface SortDropdownProps {
  sortGroup: FilterGroup;
  selectedFilters: FilterState;
  onFilterChange: (groupKey: string, optionId: string) => void;
  styles: any;
  colors: ReturnType<typeof useThemedColors>;
}

const SortDropdown = memo(({
  sortGroup,
  selectedFilters,
  onFilterChange,
  styles,
  colors,
}: SortDropdownProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

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
        style={({ hovered }) => [
          styles.sortDropdownTrigger,
          isExpanded && styles.sortDropdownTriggerActive,
          Platform.OS === 'web' && hovered && !isExpanded && styles.sortDropdownTriggerHover,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Сортировка: ${selectedOption?.name || 'Новые'}`}
        accessibilityState={{ expanded: isExpanded }}
      >
        <View style={styles.sortDropdownTriggerLeft}>
          <View style={styles.sortDropdownIcon}>
            <Feather name="sliders" size={14} color={colors.textMuted} />
          </View>
          <View style={styles.sortDropdownTextContainer}>
            <Text style={styles.sortDropdownLabel}>Сортировка:</Text>
            <Text style={styles.sortDropdownValue} numberOfLines={1}>
              {selectedOption?.name || 'Новые'}
            </Text>
          </View>
        </View>
        <View style={styles.sortDropdownChevron}>
          <Feather
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textMuted}
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

SortDropdown.displayName = 'SortDropdown';

export default SortDropdown;
