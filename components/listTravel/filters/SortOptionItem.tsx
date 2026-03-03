import React, { memo, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { FilterOption } from '../ModernFilters';

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

interface SortOptionItemProps {
  option: FilterOption;
  isSelected: boolean;
  onPress: () => void;
  styles: any;
  colors: ReturnType<typeof useThemedColors>;
  isCompact?: boolean;
}

const SortOptionItem = memo(({
  option,
  isSelected,
  onPress,
  styles,
  colors,
  isCompact = false,
}: SortOptionItemProps) => {
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

SortOptionItem.displayName = 'SortOptionItem';

export { getSortIcon, SORT_ICONS };
export default SortOptionItem;

