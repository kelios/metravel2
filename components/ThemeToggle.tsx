/**
 * ThemeToggle Component
 * Компонент для переключения между светлой, темной и автоматической темой
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme, useThemedColors } from '@/hooks/useTheme';
import type { Theme } from '@/hooks/useTheme';

interface ThemeToggleProps {
  /** Компактный режим без рамки */
  compact?: boolean;
  /** Вертикальное расположение кнопок */
  layout?: 'horizontal' | 'vertical';
  /** Показывать подписи */
  showLabels?: boolean;
}

export default function ThemeToggle({
  compact = false,
  layout = 'horizontal',
  showLabels = true,
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const colors = useThemedColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: layout === 'horizontal' ? 'row' : 'column',
          gap: compact ? 6 : 8,
          padding: compact ? 0 : 12,
          backgroundColor: compact ? 'transparent' : colors.surface,
          borderRadius: 12,
          borderWidth: compact ? 0 : 1,
          borderColor: colors.border,
        },
        button: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: compact ? 6 : 8,
          paddingVertical: compact ? 6 : 8,
          paddingHorizontal: compact ? 10 : 12,
          borderRadius: 8,
          backgroundColor: colors.surfaceMuted,
          borderWidth: 1,
          borderColor: colors.border,
          minWidth: layout === 'horizontal' ? (compact ? 70 : 80) : undefined,
          justifyContent: 'center',
        },
        buttonActive: {
          backgroundColor: colors.primary,
          borderColor: colors.primaryDark,
        },
        buttonHover: {
          backgroundColor: colors.surfaceElevated,
        },
        label: {
          fontSize: compact ? 13 : 14,
          fontWeight: '500',
          color: colors.text,
        },
        labelActive: {
          color: colors.textOnPrimary,
        },
        iconWrapper: {
          width: compact ? 16 : 20,
          height: compact ? 16 : 20,
          alignItems: 'center',
          justifyContent: 'center',
        },
      }),
    [colors, compact, layout]
  );

  const themeOptions: Array<{ value: Theme; icon: string; label: string }> = [
    { value: 'light', icon: 'sun', label: 'Светлая' },
    { value: 'dark', icon: 'moon', label: 'Темная' },
    { value: 'auto', icon: 'monitor', label: 'Авто' },
  ];

  return (
    <View style={styles.container}>
      {themeOptions.map((option) => {
        const isActive = theme === option.value;

        return (
          <Pressable
            key={option.value}
            onPress={() => setTheme(option.value)}
            style={({ hovered }) => [
              styles.button,
              isActive && styles.buttonActive,
              (hovered && !isActive) && styles.buttonHover,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ checked: isActive }}
            accessibilityLabel={`Выбрать тему: ${option.label}`}
            testID={`theme-toggle-${option.value}`}
            {...(Platform.OS === 'web'
              ? {
                  // @ts-ignore
                  'aria-label': `Выбрать тему: ${option.label}`,
                  // @ts-ignore
                  'aria-checked': isActive,
                }
              : {})}
          >
            <View style={styles.iconWrapper}>
              <Feather name={option.icon as any} size={compact ? 16 : 20} color={isActive ? colors.textOnPrimary : colors.text} />
            </View>
            {showLabels && (
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {option.label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
