import { useMemo } from 'react';
import { View, Pressable, StyleSheet, Platform, ViewStyle } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export const Toggle: React.FC<ToggleProps> = ({ 
  value, 
  onValueChange, 
  disabled = false,
  style 
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      style={[
        styles.toggle,
        value && styles.toggleActive,
        disabled && styles.toggleDisabled,
        style
      ]}
      onPress={() => !disabled && onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
    >
      <View 
        style={[
          styles.thumb,
          value && styles.thumbActive
        ]} 
      />
    </Pressable>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.disabled,
    padding: 2,
    justifyContent: 'center',
    transition: Platform.OS === 'web' ? 'background-color 0.2s' : undefined,
  } as any,
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleDisabled: {
    opacity: 0.5,
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: colors.boxShadows.light, transition: 'transform 0.2s' } as any)
      : { ...colors.shadows.light }),
  },
  thumbActive: {
    transform: [{ translateX: 22 }],
  },
});
