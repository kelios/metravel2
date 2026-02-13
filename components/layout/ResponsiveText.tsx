/**
 * ResponsiveText - текст с адаптивными размерами
 * Автоматически подстраивает размер шрифта под экран
 *
 * On web, h1–h4 variants render as actual HTML heading elements for SEO.
 * On native, all variants render as plain Text.
 */

import React from 'react';
import { Text, TextStyle, StyleSheet, Platform, StyleProp } from 'react-native';
import { useResponsiveValue } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';

const isWeb = Platform.OS === 'web';

const WEB_HEADING_TAG: Record<string, string | undefined> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
};

const FONT_SIZE_CONFIGS = {
  h1: { smallPhone: 28, phone: 32, tablet: 40, desktop: 48, default: 32 },
  h2: { smallPhone: 24, phone: 28, tablet: 32, desktop: 40, default: 28 },
  h3: { smallPhone: 20, phone: 24, tablet: 28, desktop: 32, default: 24 },
  h4: { smallPhone: 18, phone: 20, tablet: 24, desktop: 28, default: 20 },
  body: { smallPhone: 14, phone: 16, tablet: 16, desktop: 18, default: 16 },
  caption: { smallPhone: 12, phone: 14, tablet: 14, desktop: 16, default: 14 },
  small: { smallPhone: 11, phone: 12, tablet: 12, desktop: 14, default: 12 },
} as const;

const LINE_HEIGHT_CONFIGS = {
  h1: { smallPhone: 36, phone: 40, tablet: 48, desktop: 56, default: 40 },
  h2: { smallPhone: 32, phone: 36, tablet: 40, desktop: 48, default: 36 },
  h3: { smallPhone: 28, phone: 32, tablet: 36, desktop: 40, default: 32 },
  h4: { smallPhone: 24, phone: 28, tablet: 32, desktop: 36, default: 28 },
  body: { smallPhone: 20, phone: 24, tablet: 24, desktop: 28, default: 24 },
  caption: { smallPhone: 18, phone: 20, tablet: 20, desktop: 24, default: 20 },
  small: { smallPhone: 16, phone: 18, tablet: 18, desktop: 20, default: 18 },
} as const;

const VARIANT_TEXT_STYLES: Record<string, TextStyle> = {
  h1: { fontWeight: '800' },
  h2: { fontWeight: '700' },
  h3: { fontWeight: '600' },
  h4: { fontWeight: '600' },
  body: { fontWeight: '400' },
  caption: { fontWeight: '400' },
  small: { fontWeight: '400' },
};

interface ResponsiveTextProps {
  children: React.ReactNode;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'caption' | 'small';
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  testID?: string;
}

export default function ResponsiveText({
  children,
  variant = 'body',
  style,
  numberOfLines,
  testID,
}: ResponsiveTextProps) {
  const colors = useThemedColors();
  const fontSize = useResponsiveValue(FONT_SIZE_CONFIGS[variant] || FONT_SIZE_CONFIGS.body);
  const lineHeight = useResponsiveValue(LINE_HEIGHT_CONFIGS[variant] || LINE_HEIGHT_CONFIGS.body);

  const tag = isWeb ? WEB_HEADING_TAG[variant] : undefined;

  const mergedStyle: StyleProp<TextStyle> = [
    styles.base,
    { fontSize, lineHeight, color: colors.text },
    VARIANT_TEXT_STYLES[variant] || VARIANT_TEXT_STYLES.body,
    style,
  ];

  // On web, wrap heading text in a real HTML heading element for SEO.
  // The outer heading resets browser defaults; the inner Text keeps RN styles.
  if (tag) {
    return React.createElement(
      tag as any,
      {
        style: styles.headingReset,
        'data-testid': testID,
      },
      <Text
        style={mergedStyle}
        numberOfLines={numberOfLines}
      >
        {children}
      </Text>,
    );
  }

  return (
    <Text
      style={mergedStyle}
      numberOfLines={numberOfLines}
      testID={testID}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {},
  headingReset: {
    // Reset browser heading defaults so RN Text styles take full control
    margin: 0,
    padding: 0,
    ...(isWeb ? { display: 'contents' as any } : {}),
  },
});
