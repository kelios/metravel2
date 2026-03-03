import React, { memo, useState } from 'react';
import { Text, Pressable, Platform } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import { FilterOption } from '../ModernFilters';
import FilterCheckbox from './FilterCheckbox';
import FilterRadio from './FilterRadio';

interface FilterOptionItemProps {
  option: FilterOption;
  isSelected: boolean;
  isMultiSelect: boolean;
  onPress: () => void;
  styles: any;
  colors: ReturnType<typeof useThemedColors>;
}

const FilterOptionItem = memo(({
  option,
  isSelected,
  isMultiSelect,
  onPress,
  styles,
  colors,
}: FilterOptionItemProps) => {
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

FilterOptionItem.displayName = 'FilterOptionItem';

export default FilterOptionItem;

