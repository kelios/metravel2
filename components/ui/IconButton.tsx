import React, { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, Platform, Text, type StyleProp, type ViewStyle } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  testID?: string;
  style?: StyleProp<ViewStyle>;
  showLabel?: boolean;
  showTooltip?: boolean;
  tooltipPlacement?: 'bottom' | 'left';
  /**
   * Режим «видимый круг меньше тач-таргета» (#1739): сама кнопка остаётся
   * рамкой `size` (44/48dp), а видимой поверхностью становится плоский круг
   * `visualSize` внутри неё. Рамка прозрачна и вынесена в отрицательные поля,
   * поэтому в layout кнопка занимает ровно `visualSize` — ряды не растут, как
   * не растут они у потребителей `hitSlop`, но в отличие от него нажатие
   * ловится всей рамкой. Значение `>= size` игнорируется.
   *
   * ВАЖНО про родителя: «touch area never extends past the parent view bounds»
   * (та же оговорка, что у `hitSlop` в документации RN), поэтому часть рамки,
   * вышедшая за границы родителя, нажатие не поймает. Родитель обязан дать
   * запас `(size - visualSize) / 2` отступом или свободным местом — так это
   * сделано у `lightPointRow` (paddingVertical 6 при visualSize 32). Ряд без
   * padding обрезает рамку до видимого круга, и выигрыш остаётся только на web.
   *
   * В режиме `showLabel` проп не действует: там кнопка и так растянута подписью.
   */
  visualSize?: number;
  /** Стиль видимого круга в режиме `visualSize` (фон и т.п.); `style` при этом — стиль рамки. */
  visualStyle?: StyleProp<ViewStyle>;
}

const spacing = DESIGN_TOKENS.spacing;
const radii = DESIGN_TOKENS.radii;

/**
 * Размер иконочной кнопки = её тач-таргет: `Pressable` здесь и есть видимая
 * поверхность, внешней рамки над ним нет. Поэтому размеры не могут быть ниже
 * принятого в проекте floor 44dp (#1280, семейство #192 → #1044 → #1271 → #1274).
 *
 * Было 36/42 с комментарием «минимальная ширина для touch-целей» — минимум был
 * задан, но НИЖЕ нормы, и его наследовали все потребители примитива.
 * `md` — дефолт, поэтому он поднят до рекомендованных Android 48dp.
 *
 * ВАЖНО: проп `style` потребителя применяется ПОСЛЕ этих значений и может их
 * перебить в меньшую сторону. Такие места ловит `npm run guard:touch-targets`.
 */
export const ICON_BUTTON_TOUCH_TARGET_BY_SIZE = { sm: 44, md: 48 } as const;
const TOUCH_TARGET_BY_SIZE = ICON_BUTTON_TOUCH_TARGET_BY_SIZE;

const getBoxShadows = (colors: ThemedColors) => {
  const themed = colors as unknown as { boxShadows?: typeof DESIGN_TOKENS.shadows };
  return themed.boxShadows ?? DESIGN_TOKENS.shadows;
};

function IconButton({
  icon,
  label,
  active = false,
  onPress,
  disabled = false,
  size = 'md',
  testID,
  style,
  showLabel = false,
  showTooltip = true,
  tooltipPlacement = 'bottom',
  visualSize,
  visualStyle,
}: IconButtonProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [hovered, setHovered] = useState(false);
  const dimension = TOUCH_TARGET_BY_SIZE[size];
  const handlePress = disabled ? undefined : onPress
  const visualInset = visualSize != null && visualSize < dimension ? (dimension - visualSize) / 2 : 0;
  const hasVisualFrame = visualInset > 0;
  const surfaceColor = active ? colors.primary : colors.surface;
  const isHovered = !disabled && hovered && Platform.OS === 'web';

  if (showLabel) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, selected: active }}
        disabled={disabled}
        onPress={handlePress}
        testID={testID}
        android_ripple={!disabled ? { color: 'rgba(0,0,0,0.12)', borderless: false } : undefined}
        style={({ pressed, hovered }) => [
          styles.labeledBase,
          globalFocusStyles.focusable,
          {
            minHeight: dimension,
            borderRadius: radii.lg,
            backgroundColor: active ? colors.primary : colors.surface,
          },
          style,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
          !disabled && hovered && Platform.OS === 'web' && styles.hovered,
        ]}
      >
        <View style={styles.icon}>{icon}</View>
        <Text
          style={[
            styles.labelText,
            { color: active ? colors.textOnPrimary : colors.text },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={handlePress}
      testID={testID}
      android_ripple={!disabled ? { color: 'rgba(0,0,0,0.12)', borderless: true } : undefined}
      onHoverIn={Platform.OS === 'web' ? () => setHovered(true) : undefined}
      onHoverOut={Platform.OS === 'web' ? () => setHovered(false) : undefined}
      style={({ pressed }) => [
        hasVisualFrame ? styles.frame : styles.base,
        globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
        {
          width: dimension,
          height: dimension,
          minWidth: dimension, // ✅ ИСПРАВЛЕНИЕ: Минимальная ширина для touch-целей
          minHeight: dimension, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
        },
        hasVisualFrame
          ? { margin: -visualInset }
          : {
              borderRadius: radii.lg,
              backgroundColor: surfaceColor,
              // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
            },
        style,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        isHovered && styles.hovered,
      ]}
    >
      {hasVisualFrame ? (
        <View
          testID={testID ? `${testID}-visual` : undefined}
          style={[
            styles.visual,
            {
              width: visualSize,
              height: visualSize,
              borderRadius: radii.pill,
              backgroundColor: isHovered ? colors.primarySoft : surfaceColor,
            },
            visualStyle,
          ]}
        >
          <View style={styles.icon}>{icon}</View>
        </View>
      ) : (
        <View style={styles.icon}>{icon}</View>
      )}
      {Platform.OS === 'web' && showTooltip && hovered && !disabled ? (
        <View
          style={[
            styles.tooltip,
            tooltipPlacement === 'left' ? styles.tooltipLeft : styles.tooltipBottom,
            { backgroundColor: colors.text },
          ]}
        >
          <Text style={[styles.tooltipText, { color: colors.surface }]}>{label}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const getStyles = (colors: ThemedColors) => {
  const boxShadows = getBoxShadows(colors);

  return StyleSheet.create({
    labeledBase: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: spacing.sm,
      marginHorizontal: spacing.xs / 2,
      shadowColor: colors.text,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 6,
      elevation: 2,
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          boxShadow: boxShadows.light,
        },
      }),
    },
    labelText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '600' as any,
    },
    base: {
      // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: spacing.xs / 2,
      shadowColor: colors.text,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 6,
      elevation: 2,
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          boxShadow: boxShadows.light,
          overflow: 'visible',
          // @ts-ignore -- CSS pseudo-selector :hover is web-only, not in RN style types
          ':hover': {
            backgroundColor: colors.primarySoft,
            transform: 'scale(1.05)',
          },
        },
      }),
    },
    // Прозрачная рамка тач-таргета режима `visualSize`: без фона и тени, сам
    // видимый круг — `visual` ниже. `overflow: visible` — чтобы тултип не резался.
    frame: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      ...Platform.select({
        web: {
          cursor: 'pointer',
          overflow: 'visible',
        },
      }),
    },
    // Видимый круг плоский: он живёт внутри панелей и полей ввода, где тень
    // «парящей» кнопки не нужна; фон переопределяется через `visualStyle`.
    visual: {
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        web: {
          transition: 'background-color 0.2s ease',
        },
      }),
    },
    hovered: {
      ...Platform.select({
        web: {
          zIndex: 2,
        },
      }),
    },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltip: {
    position: 'absolute',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    minWidth: 120,
    maxWidth: 180,
    zIndex: 9999,
    pointerEvents: 'none',
    ...Platform.select({
      web: {
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        boxShadow: boxShadows.heavy,
      },
    }),
  },
  tooltipBottom: {
    top: '100%',
    marginTop: 4,
    right: 0,
  },
  tooltipLeft: {
    right: '100%',
    top: -10,
    marginRight: 4,
  },
  tooltipText: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    lineHeight: DESIGN_TOKENS.typography.sizes.xs + 4,
    fontWeight: '500' as any,
    textAlign: 'left',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  });
};

export default memo(IconButton);
