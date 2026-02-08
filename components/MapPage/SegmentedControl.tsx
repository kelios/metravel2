// components/MapPage/SegmentedControl.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, View, Text, StyleSheet } from 'react-native';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import MapIcon from './MapIcon';
import CardActionPressable from '@/components/ui/CardActionPressable';

interface SegmentedControlOption {
  key: string;
  label: string;
  icon?: string;
  badge?: number; // Количество для отображения в badge
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

  const activeIndex = options.findIndex((o) => o.key === value);
  const pillAnim = useRef(new Animated.Value(activeIndex >= 0 ? activeIndex : 0)).current;

  useEffect(() => {
    const idx = options.findIndex((o) => o.key === value);
    if (idx < 0) return;
    Animated.spring(pillAnim, {
      toValue: idx,
      friction: 8,
      tension: 60,
      useNativeDriver: false,
    }).start();
  }, [value, options, pillAnim]);

  const count = options.length || 1;
  const pillLeft = pillAnim.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: options.map((_, i) => `${(i / count) * 100}%`),
    extrapolate: 'clamp',
  });

  return (
    <View
      style={styles.segmentedControl}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={[
          styles.pill,
          {
            width: `${100 / count}%` as any,
            left: pillLeft as any,
          },
        ]}
        pointerEvents="none"
      />
      {options.map(({ key, label, icon, badge }) => {
        const active = value === key;
        const isDisabled = disabled || disabledKeys.includes(key);
        return (
          <CardActionPressable
            key={key}
            testID={`segmented-${key}`}
            style={({ pressed }) => [
              styles.segment,
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
            accessibilityLabel={badge ? `${label} (${badge})` : label}
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
            {typeof badge === 'number' && badge > 0 && (
              <View style={[
                styles.badge,
                active && styles.badgeActive,
              ]}>
                <Text style={[
                  styles.badgeText,
                  active && styles.badgeTextActive,
                ]}>
                  {badge > 99 ? '99+' : badge}
                </Text>
              </View>
            )}
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
    position: 'relative',
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    borderRadius: 6,
    backgroundColor: colors.primary,
    ...(Platform.OS === 'web' ? ({ transition: 'left 0.2s ease' } as any) : null),
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: compact ? 6 : 4,
    paddingVertical: compact ? 10 : 8,
    paddingHorizontal: compact ? 12 : 8,
    borderRadius: 6,
    minWidth: compact ? 80 : 0,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  segmentPressed: {
    opacity: 0.6,
  },
  segmentDisabled: {
    opacity: 0.5,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  badgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  badgeTextActive: {
    color: colors.textOnPrimary,
  },
});

export default React.memo(SegmentedControl);
