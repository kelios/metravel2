/**
 * TYPO-03: Унифицированные типографические компоненты
 * Heading / Body / Caption / Label — используют DESIGN_TOKENS, поддерживают тёмную тему.
 *
 * Использование:
 *   <Heading level={1}>Заголовок страницы</Heading>
 *   <Body>Обычный текст параграфа</Body>
 *   <Caption>Вспомогательная подпись</Caption>
 *   <Label>Метка поля формы</Label>
 */
import React, { useMemo } from 'react';
import { Platform, Text, type TextProps, type TextStyle } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';

// ─── Heading ────────────────────────────────────────────────────────────────

type HeadingLevel = 1 | 2 | 3 | 4;

interface HeadingProps extends TextProps {
  level?: HeadingLevel;
  /** Переопределить цвет */
  color?: string;
  /** Переопределить выравнивание */
  align?: TextStyle['textAlign'];
}

const HEADING_CONFIG: Record<
  HeadingLevel,
  { fontSize: number; mobileFontSize: number; fontWeight: TextStyle['fontWeight']; lineHeight: number; letterSpacing: number }
> = {
  1: { fontSize: 32, mobileFontSize: 24, fontWeight: '800', lineHeight: 38, letterSpacing: -0.8 },
  2: { fontSize: 24, mobileFontSize: 20, fontWeight: '700', lineHeight: 30, letterSpacing: -0.5 },
  3: { fontSize: 20, mobileFontSize: 18, fontWeight: '600', lineHeight: 26, letterSpacing: -0.3 },
  4: { fontSize: 16, mobileFontSize: 15, fontWeight: '600', lineHeight: 22, letterSpacing: -0.1 },
};

const HEADING_A11Y_ROLES: Record<HeadingLevel, 'header'> = { 1: 'header', 2: 'header', 3: 'header', 4: 'header' };

export function Heading({ level = 2, color, align, style, ...props }: HeadingProps) {
  const colors = useThemedColors();
  const config = HEADING_CONFIG[level];
  const isMobile = Platform.OS !== 'web';

  const computedStyle = useMemo<TextStyle>(() => ({
    fontSize: isMobile ? config.mobileFontSize : config.fontSize,
    fontWeight: config.fontWeight,
    lineHeight: isMobile ? Math.round(config.lineHeight * 0.9) : config.lineHeight,
    letterSpacing: isMobile ? Math.max(config.letterSpacing * 0.7, -0.5) : config.letterSpacing,
    color: color ?? colors.text,
    ...(align ? { textAlign: align } : {}),
  }), [config, isMobile, color, colors.text, align]);

  return (
    <Text
      accessibilityRole={HEADING_A11Y_ROLES[level]}
      style={[computedStyle, style]}
      {...props}
    />
  );
}

// ─── Body ───────────────────────────────────────────────────────────────────

type BodyVariant = 'default' | 'large' | 'small' | 'strong';

interface BodyProps extends TextProps {
  variant?: BodyVariant;
  color?: string;
  muted?: boolean;
  align?: TextStyle['textAlign'];
}

const BODY_CONFIG: Record<BodyVariant, { fontSize: number; fontWeight: TextStyle['fontWeight']; lineHeight: number }> = {
  default: { fontSize: DESIGN_TOKENS.typography.sizes.md,  fontWeight: '400', lineHeight: 24 },
  large:   { fontSize: DESIGN_TOKENS.typography.sizes.lg,  fontWeight: '400', lineHeight: 28 },
  small:   { fontSize: DESIGN_TOKENS.typography.sizes.sm,  fontWeight: '400', lineHeight: 20 },
  strong:  { fontSize: DESIGN_TOKENS.typography.sizes.md,  fontWeight: '600', lineHeight: 24 },
};

export function Body({ variant = 'default', color, muted = false, align, style, ...props }: BodyProps) {
  const colors = useThemedColors();
  const config = BODY_CONFIG[variant];

  const computedStyle = useMemo<TextStyle>(() => ({
    fontSize: config.fontSize,
    fontWeight: config.fontWeight,
    lineHeight: config.lineHeight,
    color: color ?? (muted ? colors.textMuted : colors.text),
    ...(align ? { textAlign: align } : {}),
  }), [config, color, muted, colors.text, colors.textMuted, align]);

  return <Text style={[computedStyle, style]} {...props} />;
}

// ─── Caption ────────────────────────────────────────────────────────────────

interface CaptionProps extends TextProps {
  color?: string;
  muted?: boolean;
  align?: TextStyle['textAlign'];
}

export function Caption({ color, muted = true, align, style, ...props }: CaptionProps) {
  const colors = useThemedColors();

  const computedStyle = useMemo<TextStyle>(() => ({
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '400',
    lineHeight: 16,
    letterSpacing: 0.2,
    color: color ?? (muted ? colors.textMuted : colors.text),
    ...(align ? { textAlign: align } : {}),
  }), [color, muted, colors.text, colors.textMuted, align]);

  return <Text style={[computedStyle, style]} {...props} />;
}

// ─── Label ──────────────────────────────────────────────────────────────────

interface LabelProps extends TextProps {
  color?: string;
  required?: boolean;
  align?: TextStyle['textAlign'];
}

export function Label({ color, required = false, align, children, style, ...props }: LabelProps) {
  const colors = useThemedColors();

  const computedStyle = useMemo<TextStyle>(() => ({
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: 0.1,
    color: color ?? colors.text,
    ...(align ? { textAlign: align } : {}),
  }), [color, colors.text, align]);

  return (
    <Text style={[computedStyle, style]} {...props}>
      {children}
      {required && (
        <Text style={{ color: colors.danger }}>{' *'}</Text>
      )}
    </Text>
  );
}

// ─── Eyebrow ────────────────────────────────────────────────────────────────
// Маленький текст-метка над заголовком (типа «Популярное», «Новое»)

interface EyebrowProps extends TextProps {
  color?: string;
  align?: TextStyle['textAlign'];
}

export function Eyebrow({ color, align, style, ...props }: EyebrowProps) {
  const colors = useThemedColors();

  // TYPO-04: Не используем uppercase для кириллицы — используем title case
  const computedStyle = useMemo<TextStyle>(() => ({
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    letterSpacing: 0.8,
    color: color ?? colors.primary,
    ...(align ? { textAlign: align } : {}),
  }), [color, colors.primary, align]);

  return <Text style={[computedStyle, style]} {...props} />;
}

// Named exports: Heading, Body, Caption, Label, Eyebrow
// Пример импорта: import { Heading, Body } from '@/components/ui/Typography';



