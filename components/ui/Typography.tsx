/**
 * TYPO-03: Унифицированные типографические компоненты
 * RESP-04: Fluid typography — размеры адаптируются плавно между мобайлом и desktop
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
import { useResponsive } from '@/hooks/useResponsive';

// ─── RESP-04: Fluid typography helper ────────────────────────────────────────
// Возвращает размер шрифта адаптированный к текущему breakpoint
// min (mobile) → max (desktop) через 3 промежуточных значения

function fluidSize(
  minSize: number,
  maxSize: number,
  breakpoint: { isMobile: boolean; isTablet: boolean; isDesktop: boolean },
): number {
  const { isMobile, isTablet, isDesktop } = breakpoint;
  if (isDesktop) return maxSize;
  if (isTablet) return Math.round(minSize + (maxSize - minSize) * 0.65);
  if (!isMobile) return Math.round(minSize + (maxSize - minSize) * 0.35); // large phone
  return minSize;
}

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
  { minFontSize: number; maxFontSize: number; fontWeight: TextStyle['fontWeight']; lineHeightRatio: number; letterSpacing: number }
> = {
  1: { minFontSize: 22, maxFontSize: 32, fontWeight: '800', lineHeightRatio: 1.2, letterSpacing: -0.8 },
  2: { minFontSize: 18, maxFontSize: 24, fontWeight: '700', lineHeightRatio: 1.25, letterSpacing: -0.5 },
  3: { minFontSize: 16, maxFontSize: 20, fontWeight: '600', lineHeightRatio: 1.3, letterSpacing: -0.3 },
  4: { minFontSize: 14, maxFontSize: 16, fontWeight: '600', lineHeightRatio: 1.375, letterSpacing: -0.1 },
};

const HEADING_A11Y_ROLES: Record<HeadingLevel, 'header'> = { 1: 'header', 2: 'header', 3: 'header', 4: 'header' };

export function Heading({ level = 2, color, align, style, ...props }: HeadingProps) {
  const colors = useThemedColors();
  const config = HEADING_CONFIG[level];
  const { isPhone, isLargePhone, isTablet, isDesktop } = useResponsive();
  const isMobile = Platform.OS !== 'web' || isPhone || isLargePhone;
  const bp = { isMobile, isTablet: isTablet && !isMobile, isDesktop };

  const computedStyle = useMemo<TextStyle>(() => {
    const fontSize = Platform.OS === 'web'
      ? fluidSize(config.minFontSize, config.maxFontSize, bp)
      : config.minFontSize;
    return {
      fontSize,
      fontWeight: config.fontWeight,
      lineHeight: Math.round(fontSize * config.lineHeightRatio),
      letterSpacing: isMobile
        ? Math.max(config.letterSpacing * 0.7, -0.5)
        : config.letterSpacing,
      color: color ?? colors.text,
      ...(align ? { textAlign: align } : {}),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, bp.isMobile, bp.isTablet, bp.isDesktop, color, colors.text, align, isMobile]);

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



