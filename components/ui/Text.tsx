import React, { memo } from 'react';
import { Text as RNText, StyleSheet, TextProps as RNTextProps, Platform, TextStyle } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

type TextVariant = 
  | 'h1' 
  | 'h2' 
  | 'h3' 
  | 'h4' 
  | 'body' 
  | 'bodyLarge' 
  | 'bodySmall' 
  | 'caption' 
  | 'label';

type TextColor = 
  | 'primary' 
  | 'text' 
  | 'textMuted' 
  | 'textSubtle' 
  | 'textInverse' 
  | 'success' 
  | 'warning' 
  | 'danger' 
  | 'info';

type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

interface TextComponentProps extends RNTextProps {
  variant?: TextVariant;
  color?: TextColor;
  weight?: TextWeight;
  align?: 'left' | 'center' | 'right' | 'justify';
  children: React.ReactNode;
}

/**
 * Типографический компонент с предустановленными стилями
 * 
 * Особенности:
 * - Единая типографическая шкала
 * - Цвета из дизайн-системы
 * - WCAG-совместимые контрасты
 * - Responsive font sizes
 * - Правильная line-height
 * 
 * @example
 * <Text variant="h1" color="primary">Заголовок</Text>
 * <Text variant="body" color="textMuted">Текст</Text>
 */
function TextComponent({
  variant = 'body',
  color = 'text',
  weight,
  align = 'left',
  style,
  children,
  ...props
}: TextComponentProps) {
  const variantStyle = variantStyles[variant];
  const colorStyle = { color: colorMap[color] };
  const weightStyle = weight ? { fontWeight: DESIGN_TOKENS.typography.weights[weight] as any } : {};
  const alignStyle = { textAlign: align };

  return (
    <RNText
      style={[
        styles.base,
        variantStyle,
        colorStyle,
        weightStyle,
        alignStyle,
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

const palette = DESIGN_TOKENS.colors;
const typography = DESIGN_TOKENS.typography;

const colorMap: Record<TextColor, string> = {
  primary: palette.primary,
  text: palette.text,
  textMuted: palette.textMuted,
  textSubtle: palette.textSubtle,
  textInverse: palette.textInverse,
  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,
  info: palette.info,
};

const styles = StyleSheet.create<{ base: TextStyle }>({
  base: {
    fontFamily: Platform.select({
      web: typography.fontFamily,
      default: 'System',
    }),
    color: palette.text,
    lineHeight: undefined, // Будет установлено в variantStyles
  },
});

const fontWeightValue = (key: TextWeight): TextStyle['fontWeight'] =>
  typography.weights[key] as TextStyle['fontWeight'];

const variantStyles = StyleSheet.create<Record<TextVariant, TextStyle>>({
  h1: {
    fontSize: DESIGN_TOKENS.typography.sizes.xl,
    lineHeight: 40,
    fontWeight: fontWeightValue('bold'),
    letterSpacing: -0.5,
    ...Platform.select({
      web: {
        fontSize: DESIGN_TOKENS.typography.sizes.xl,
        lineHeight: 44,
      },
    }),
  },
  h2: {
    fontSize: DESIGN_TOKENS.typography.sizes.xl,
    lineHeight: 36,
    fontWeight: fontWeightValue('bold'),
    letterSpacing: -0.3,
    ...Platform.select({
      web: {
        fontSize: DESIGN_TOKENS.typography.sizes.xl,
        lineHeight: 38,
      },
    }),
  },
  h3: {
    fontSize: typography.sizes.xl, // 24
    lineHeight: 32,
    fontWeight: fontWeightValue('semibold'),
    letterSpacing: -0.2,
  },
  h4: {
    fontSize: typography.sizes.lg, // 20
    lineHeight: 28,
    fontWeight: fontWeightValue('semibold'),
    letterSpacing: -0.1,
  },
  body: {
    fontSize: typography.sizes.md, // 16
    lineHeight: 24,
    fontWeight: fontWeightValue('regular'),
  },
  bodyLarge: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    lineHeight: 28,
    fontWeight: fontWeightValue('regular'),
  },
  bodySmall: {
    fontSize: typography.sizes.sm, // 14
    lineHeight: 20,
    fontWeight: fontWeightValue('regular'),
  },
  caption: {
    fontSize: typography.sizes.xs, // 12
    lineHeight: 16,
    fontWeight: fontWeightValue('regular'),
    letterSpacing: 0.3,
  },
  label: {
    fontSize: typography.sizes.sm, // 14
    lineHeight: 20,
    fontWeight: fontWeightValue('medium'),
    letterSpacing: 0.1,
  },
});

export default memo(TextComponent);

/**
 * Готовые компоненты для частых случаев
 */
export const Heading1 = memo(({ children, ...props }: Omit<TextComponentProps, 'variant'>) => (
  <TextComponent variant="h1" {...props}>{children}</TextComponent>
));

export const Heading2 = memo(({ children, ...props }: Omit<TextComponentProps, 'variant'>) => (
  <TextComponent variant="h2" {...props}>{children}</TextComponent>
));

export const Heading3 = memo(({ children, ...props }: Omit<TextComponentProps, 'variant'>) => (
  <TextComponent variant="h3" {...props}>{children}</TextComponent>
));

export const Heading4 = memo(({ children, ...props }: Omit<TextComponentProps, 'variant'>) => (
  <TextComponent variant="h4" {...props}>{children}</TextComponent>
));

export const Body = memo(({ children, ...props }: Omit<TextComponentProps, 'variant'>) => (
  <TextComponent variant="body" {...props}>{children}</TextComponent>
));

export const Caption = memo(({ children, ...props }: Omit<TextComponentProps, 'variant'>) => (
  <TextComponent variant="caption" {...props}>{children}</TextComponent>
));

export const Label = memo(({ children, ...props }: Omit<TextComponentProps, 'variant'>) => (
  <TextComponent variant="label" {...props}>{children}</TextComponent>
));

/**
 * Утилита для проверки WCAG контраста
 * @param textColor - Цвет текста (hex)
 * @param backgroundColor - Цвет фона (hex)
 * @returns Коэффициент контраста
 */
export function getContrastRatio(textColor: string, backgroundColor: string): number {
  const getLuminance = (hex: string): number => {
    const rgb = parseInt(hex.replace('#', ''), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;

    const [rs, gs, bs] = [r, g, b].map(c => {
      const sRGB = c / 255;
      return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const l1 = getLuminance(textColor);
  const l2 = getLuminance(backgroundColor);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Проверка соответствия WCAG AA
 * @param textColor - Цвет текста
 * @param backgroundColor - Цвет фона
 * @param fontSize - Размер шрифта в px
 * @returns true если проходит WCAG AA
 */
export function meetsWCAG_AA(
  textColor: string,
  backgroundColor: string,
  fontSize: number = 16
): boolean {
  const ratio = getContrastRatio(textColor, backgroundColor);
  const isLargeText = fontSize >= 18;

  // WCAG AA требует:
  // - 4.5:1 для обычного текста
  // - 3:1 для крупного текста (≥18px или ≥14px bold)
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}
