// components/MapPage/QuickActions.tsx
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface QuickAction {
  icon: string;
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  show?: boolean;
}

interface QuickActionsProps {
  onReset?: () => void;
  onFitBounds?: () => void;
  onSaveFilters?: () => void;
  totalPoints: number;
  hasFilters: boolean;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  onReset,
  onFitBounds,
  onSaveFilters,
  totalPoints,
  hasFilters,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const actions: QuickAction[] = useMemo(() => {
    const result: QuickAction[] = [];

    if (onReset && hasFilters) {
      result.push({
        icon: 'refresh',
        label: 'Сбросить',
        onPress: onReset,
        accessibilityLabel: 'Сбросить все фильтры',
        show: true,
      });
    }

    if (onFitBounds && totalPoints > 0) {
      result.push({
        icon: 'zoom-out-map',
        label: `Показать все (${totalPoints})`,
        onPress: onFitBounds,
        accessibilityLabel: `Показать все ${totalPoints} мест на карте`,
        show: true,
      });
    }

    if (onSaveFilters && hasFilters) {
      result.push({
        icon: 'bookmark-outline',
        label: 'Сохранить',
        onPress: onSaveFilters,
        accessibilityLabel: 'Сохранить текущие фильтры',
        show: true,
      });
    }

    return result.filter(a => a.show);
  }, [onReset, onFitBounds, onSaveFilters, totalPoints, hasFilters]);

  if (actions.length === 0) {
    return null;
  }

  return (
    <View style={styles.quickActions}>
      {actions.map((action, index) => (
        <Pressable
          key={index}
          testID={`quick-action-${action.icon}`}
          style={({ pressed }) => [
            styles.quickAction,
            pressed && styles.quickActionPressed,
          ]}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel || action.label}
        >
          <Icon name={action.icon} size={18} color={colors.text} />
          <Text style={styles.quickActionText}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
};

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    flexWrap: 'wrap',
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  quickActionText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
});

export default QuickActions;
