// components/MapPage/SegmentedControl.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import MapIcon from './MapIcon';
import CardActionPressable from '@/components/ui/CardActionPressable';

interface SegmentedControlOption {
  key: string;
  label: string;
  icon?: string;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (key: string) => void;
  accessibilityLabel?: string;
  compact?: boolean;
  disabled?: boolean;
  disabledKeys?: string[];
  role?: 'radio' | 'button';
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  accessibilityLabel,
  compact = false,
  disabled = false,
  disabledKeys = [],
  role = 'radio',
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors, compact), [colors, compact]);

  return (
    <View
      style={styles.segmentedControl}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map(({ key, label, icon }) => {
        const active = value === key;
        const isDisabled = disabled || disabledKeys.includes(key);
        return (
          <CardActionPressable
            key={key}
            testID={`segmented-${key}`}
            style={({ pressed }) => [
              styles.segment,
              active && styles.segmentActive,
              pressed && styles.segmentPressed,
              isDisabled && styles.segmentDisabled,
              globalFocusStyles.focusable,
            ]}
            onPress={() => {
              if (isDisabled) return;
              onChange(key);
            }}
            disabled={isDisabled}
            accessibilityState={
              role === 'radio'
                ? ({ checked: active, disabled: isDisabled } as any)
                : ({ selected: active, disabled: isDisabled } as any)
            }
            accessibilityLabel={label}
            title={label}
            accessibilityRole={role}
          >
            {icon && (
              <MapIcon
                name={icon}
                size={16}
                color={active ? colors.textOnPrimary : colors.text}
              />
            )}
            <Text style={[
              styles.segmentText,
              active && styles.segmentTextActive,
            ]}>
              {label}
            </Text>
          </CardActionPressable>
        );
      })}
    </View>
  );
};

const getStyles = (colors: ThemedColors, compact: boolean) => StyleSheet.create({
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 2,
    marginHorizontal: compact ? 0 : 12,
    marginVertical: compact ? 4 : 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentPressed: {
    opacity: 0.8,
  },
  segmentDisabled: {
    opacity: 0.5,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  segmentTextActive: {
    color: colors.textOnPrimary,
  },
});

export default SegmentedControl;
