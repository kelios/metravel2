import { useMemo } from 'react';
import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { isPhoneLayout } from '@/utils/phoneLayout';
import { breakpointLayoutProps } from '@/utils/breakpointLayout';
import type { WebDataSet } from '@/utils/webProps';
import {
  HEADING_LAYOUTS,
  HEADING_LAYOUT_KEY,
  headingTypography,
  type HeadingLevel,
  type HeadingTier,
} from '@/components/ui/headingLayout';

// ─── Heading ────────────────────────────────────────────────────────────────

interface HeadingProps extends TextProps {
  level?: HeadingLevel;
  /** Переопределить цвет */
  color?: string;
  /** Переопределить выравнивание */
  align?: TextStyle['textAlign'];
}

const HEADING_WEIGHT: Record<HeadingLevel, TextStyle['fontWeight']> = { 1: '800', 2: '700', 3: '600', 4: '600' };

const HEADING_A11Y_ROLES: Record<HeadingLevel, 'header'> = { 1: 'header', 2: 'header', 3: 'header', 4: 'header' };
// #1617: every level maps to the same RN accessibilityRole="header" ->
// role="heading" on web (react-native-web has no h2/h3/h4 accessibilityRole).
// Without an explicit aria-level, react-native-web's propsToAccessibilityComponent
// defaults an unleveled role="heading" node to a literal <h1> tag regardless of
// the requested `level` — every Heading on a page, including level 2-4
// subheadings, was rendering as a real <h1> (e.g. /app: 11+ stray h1s from
// feature-card subheadings). Passing aria-level={level} makes react-native-web
// emit the matching h1..h4 tag instead.

/**
 * Ступень типографики по живому брейкпоинту (#2258). Нулевой кадр до гидратации
 * (`width = 0`) и native — `narrow`: так статический HTML совпадает с телефоном,
 * а более широкие ступени первому кадру отдаёт critical CSS из `HEADING_LAYOUTS`.
 *
 * Native всегда `narrow` независимо от ширины — наследственный долг #1788
 * («платформа решает режим»), прежде записанный в `LEGACY_ALLOWLIST`
 * `__tests__/config/layout-mode-governance.test.ts` (форма строки сменилась,
 * регэксп стража его больше не видит). Оставлен ради паритета с прежним
 * `minFontSize` на native; перевод native на ширину — отдельная задача.
 */
function resolveHeadingTier(r: {
  width?: number;
  isPhone?: boolean;
  isLargePhone?: boolean;
  isTablet?: boolean;
  isDesktop?: boolean;
}): HeadingTier {
  if (Platform.OS !== 'web') return 'narrow';
  if (r.isDesktop) return 'desktop';
  const isMobile = isPhoneLayout(r);
  if (r.isTablet && !isMobile) return 'tablet';
  if (!isMobile && typeof r.width === 'number' && r.width > 0) return 'largeTablet';
  return 'narrow';
}

/** Свой кегль/интерлиньяж/трекинг у вызывающего — его размер, CSS-ступени к узлу не цепляются. */
const ownsTypography = (style: HeadingProps['style']): boolean => {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  return Boolean(flat && (flat.fontSize != null || flat.lineHeight != null || flat.letterSpacing != null));
};

export function Heading({ level = 2, color, align, style, ...props }: HeadingProps) {
  const colors = useThemedColors();
  const responsive = useResponsive();
  const tier = resolveHeadingTier(responsive);

  const computedStyle = useMemo<TextStyle>(() => ({
    ...headingTypography(level, tier),
    fontWeight: HEADING_WEIGHT[level],
    color: color ?? colors.text,
    ...(align ? { textAlign: align } : {}),
  }), [level, tier, color, colors.text, align]);

  const { dataSet, ...rest } = props as HeadingProps & { dataSet?: WebDataSet };
  const layoutProps = ownsTypography(style)
    ? (dataSet ? { dataSet } : null)
    : breakpointLayoutProps(HEADING_LAYOUTS[0], HEADING_LAYOUT_KEY[level], dataSet ? { dataSet } : null);

  return (
    <Text
      accessibilityRole={HEADING_A11Y_ROLES[level]}
      {...({ 'aria-level': level } as Record<string, unknown>)}
      style={[computedStyle, style]}
      {...rest}
      {...layoutProps}
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



