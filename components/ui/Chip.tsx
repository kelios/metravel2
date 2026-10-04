import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useBreakpoints } from '@/hooks/useResponsive';
import { breakpointLayoutProps, breakpointStyle } from '@/utils/breakpointLayout';
import { CHIP_LAYOUT } from './chipLayout';

interface ChipProps {
  label: string;
  selected?: boolean;
  count?: number;
  /**
   * Число ещё грузится: слот счётчика занят невидимым «(0)», чтобы появление числа
   * не расширяло чип и не сдвигало соседние (#2114).
   */
  countPending?: boolean;
  icon?: React.ReactNode;
  /**
   * `fromTablet` — иконка видна только с ширины планшета и верна с первого кадра:
   * узел есть всегда, видимость задаёт `CHIP_LAYOUT` (React + critical CSS, #2157).
   * Условный `icon={isMobile ? undefined : …}` расширял чип после гидратации.
   */
  iconVisibility?: 'always' | 'fromTablet';
  /**
   * Фиксированный бокс иконки: догрузка шрифта иконок не меняет ширину чипа
   * (тот же приём, что `globeSlot` у `LanguageSwitcher`, #1298).
   */
  iconSlotSize?: number;
  onPress?: () => void;
  testID?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const radii = DESIGN_TOKENS.radii;
const spacing = DESIGN_TOKENS.spacing;

function Chip({
  label,
  selected = false,
  count,
  countPending = false,
  icon,
  iconVisibility = 'always',
  iconSlotSize,
  onPress,
  testID,
  disabled = false,
  style,
}: ChipProps) {
  const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Динамическая поддержка тем
  const iconSlotStyle = useMemo(
    () => (iconSlotSize ? { width: iconSlotSize, height: iconSlotSize, alignItems: 'center' as const, justifyContent: 'center' as const } : null),
    [iconSlotSize],
  );

  const styles = useMemo(() => StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      maxWidth: '100%',
      paddingHorizontal: DESIGN_TOKENS.spacing.md, // ✅ УЛУЧШЕНИЕ: Увеличен padding
      paddingVertical: DESIGN_TOKENS.spacing.sm, // ✅ УЛУЧШЕНИЕ: Увеличен padding для высоты 40px
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      gap: spacing.xs,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight, // ✅ УЛУЧШЕНИЕ: Минимальная высота для touch-целей
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: DESIGN_TOKENS.shadows.light,
        },
      }),
    },
    // Отклик мыши на web: состояние `hovered` у Pressable (RNW отдаёт его только
    // мыши, на native не приходит). Ключ-псевдокласс в StyleSheet react-native-web
    // компилирует в битое правило (#2036).
    hovered: {
      transform: [{ scale: 1.05 }],
    },
    selected: {
      backgroundColor: colors.primarySoft,
      shadowColor: colors.primary,
      shadowOpacity: 0.15,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
    },
    pressed: {
      transform: [{ scale: 0.98 }],
    },
    disabled: {
      opacity: 0.5,
    },
    label: {
      color: colors.text,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
      flexShrink: 1,
      minWidth: 0,
    },
    labelSelected: {
      color: colors.primaryText,
    },
    count: {
      color: colors.textMuted,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '500',
    },
    countSelected: {
      color: colors.primaryText,
    },
    countPending: {
      opacity: 0,
    },
    icon: {
      marginRight: spacing.xs / 2,
    },
  }), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      // Чип — toggle-кнопка: aria-pressed корректно озвучивает выбор. accessibilityState
      // не маппится в aria в RN Web (Expo 55), поэтому дублируем прямым aria-pressed.
      aria-pressed={selected}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={({ pressed, hovered }) => [
        styles.base,
        globalFocusStyles.focusable, // ✅ УЛУЧШЕНИЕ: Добавлен focus-индикатор
        selected && styles.selected,
        hovered && !disabled && styles.hovered,
        pressed && !selected && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon ? (
        iconVisibility === 'fromTablet' ? (
          <TabletIconSlot style={[styles.icon, iconSlotStyle]} testID={testID ? `${testID}-icon` : undefined}>
            {icon}
          </TabletIconSlot>
        ) : (
          <View style={[styles.icon, iconSlotStyle]} testID={testID ? `${testID}-icon` : undefined}>{icon}</View>
        )
      ) : null}
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
      {typeof count === 'number' ? (
        <Text style={[styles.count, selected && styles.countSelected]}>({count})</Text>
      ) : countPending ? (
        <Text
          style={[styles.count, styles.countPending]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          testID={testID ? `${testID}-count-pending` : undefined}
        >
          (0)
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Слот иконки «от ширины планшета»: узел есть на любой ширине, видимость — из
 * `CHIP_LAYOUT` (React по живой ширине, первый кадр — critical CSS, #2157).
 * Отдельный компонент, чтобы на ширину подписывались только такие чипы.
 */
function TabletIconSlot({ style, testID, children }: { style: StyleProp<ViewStyle>; testID?: string; children: React.ReactNode }) {
  const { width } = useBreakpoints();
  return (
    <View
      style={[style, breakpointStyle(CHIP_LAYOUT, 'tabletIcon', width >= CHIP_LAYOUT.minWidth)]}
      {...breakpointLayoutProps(CHIP_LAYOUT, 'tabletIcon')}
      testID={testID}
    >
      {children}
    </View>
  );
}

export default memo(Chip);
