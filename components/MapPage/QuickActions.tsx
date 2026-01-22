// components/MapPage/QuickActions.tsx
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import MapIcon from './MapIcon';
import Button from '@/components/ui/Button';

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
  hideReset?: boolean;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  onReset,
  onFitBounds,
  onSaveFilters,
  totalPoints,
  hasFilters,
  hideReset = false,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const actions: QuickAction[] = useMemo(() => {
    const result: QuickAction[] = [];

    if (!hideReset && onReset && hasFilters) {
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
  }, [hideReset, onReset, onFitBounds, onSaveFilters, totalPoints, hasFilters]);

  if (actions.length === 0) {
    return null;
  }

  return (
    <View style={styles.quickActions}>
      {actions.map((action, index) => (
        <Button
          key={index}
          testID={`quick-action-${action.icon}`}
          label={action.label}
          icon={<MapIcon name={action.icon} size={18} color={colors.text} />}
          onPress={action.onPress}
          accessibilityLabel={action.accessibilityLabel || action.label}
          size="sm"
          variant="secondary"
        />
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
});

export default QuickActions;
