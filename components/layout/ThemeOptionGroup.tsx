import { useMemo, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';

export interface ThemeOptionGroupOption<T extends string> {
  value: T;
  label: string;
  /** Иконка под цвет состояния: активная кнопка — текст на primary, иначе обычный текст. */
  renderIcon: (size: number, color: string) => ReactNode;
}

interface ThemeOptionGroupProps<T extends string> {
  options: ReadonlyArray<ThemeOptionGroupOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** `testID` группы; кнопка получает `${testID}-${value}`. */
  testID: string;
  /** Текст для `accessibilityLabel`/`aria-label` кнопки. */
  getAccessibilityLabel: (option: ThemeOptionGroupOption<T>) => string;
  /** Компактный режим без рамки */
  compact?: boolean;
  /** Вертикальное расположение кнопок */
  layout?: 'horizontal' | 'vertical';
  /** Показывать подписи */
  showLabels?: boolean;
}

/**
 * Ряд radio-кнопок переключателя оформления. Общая геометрия для
 * `ThemeToggle` (светлая/тёмная/авто) и `SeasonalThemeToggle` (#2376), чтобы
 * оба ряда в меню выглядели одним контролом и чинились в одном месте.
 */
export default function ThemeOptionGroup<T extends string>({
  options,
  value,
  onChange,
  testID,
  getAccessibilityLabel,
  compact = false,
  layout = 'horizontal',
  showLabels = true,
}: ThemeOptionGroupProps<T>) {
  const colors = useThemedColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: layout === 'horizontal' ? 'row' : 'column',
          // Ряд укладывается в контейнер, а не распирает его: с длинной подписью
          // (PL «Automatyczny», кнопка 132 px) три кнопки шире панели меню на
          // 320 px, и правая обрезалась краем панели (#2244).
          flexWrap: layout === 'horizontal' ? 'wrap' : undefined,
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
          // Высота задавалась только паддингом и давала 30dp (#1297).
          minHeight: 44,
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

  const iconSize = compact ? 16 : 20;

  return (
    <View style={styles.container} testID={testID}>
      {options.map((option) => {
        const isActive = value === option.value;
        const accessibilityLabel = getAccessibilityLabel(option);

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ hovered }) => [
              styles.button,
              isActive && styles.buttonActive,
              (hovered && !isActive) && styles.buttonHover,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ checked: isActive }}
            accessibilityLabel={accessibilityLabel}
            testID={`${testID}-${option.value}`}
            {...(Platform.OS === 'web'
              ? // web-only ARIA: RN Pressable types не знают aria-label/aria-checked
                ({ 'aria-label': accessibilityLabel, 'aria-checked': isActive } as Record<string, unknown>)
              : {})}
          >
            <View style={styles.iconWrapper}>
              {option.renderIcon(iconSize, isActive ? colors.textOnPrimary : colors.text)}
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
