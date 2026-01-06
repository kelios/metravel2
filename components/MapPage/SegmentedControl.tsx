// components/MapPage/SegmentedControl.tsx
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import MapIcon from './MapIcon';

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
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  accessibilityLabel,
  compact = false,
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
        return (
          <Pressable
            key={key}
            testID={`segmented-${key}`}
            style={({ pressed }) => [
              styles.segment,
              active && styles.segmentActive,
              pressed && styles.segmentPressed,
            ]}
            onPress={() => onChange(key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={label}
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
          </Pressable>
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
