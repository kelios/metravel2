/**
 * ResponsiveText - текст с адаптивными размерами
 * Автоматически подстраивает размер шрифта под экран
 */

import React from 'react';
import { Text, TextStyle, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsiveValue } from '@/hooks/useResponsive';

interface ResponsiveTextProps {
  children: React.ReactNode;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'caption' | 'small';
  style?: TextStyle;
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
  const fontSize = useResponsiveValue(getFontSizeConfig(variant));
  const lineHeight = useResponsiveValue(getLineHeightConfig(variant));

  return (
    <Text
      style={[
        styles.base,
        { fontSize, lineHeight },
        getVariantStyle(variant),
        style,
      ]}
      numberOfLines={numberOfLines}
      testID={testID}
    >
      {children}
    </Text>
  );
}

function getFontSizeConfig(variant: string) {
  const configs = {
    h1: { smallPhone: 28, phone: 32, tablet: 40, desktop: 48, default: 32 },
    h2: { smallPhone: 24, phone: 28, tablet: 32, desktop: 40, default: 28 },
    h3: { smallPhone: 20, phone: 24, tablet: 28, desktop: 32, default: 24 },
    h4: { smallPhone: 18, phone: 20, tablet: 24, desktop: 28, default: 20 },
    body: { smallPhone: 14, phone: 16, tablet: 16, desktop: 18, default: 16 },
    caption: { smallPhone: 12, phone: 14, tablet: 14, desktop: 16, default: 14 },
    small: { smallPhone: 11, phone: 12, tablet: 12, desktop: 14, default: 12 },
  };
  return configs[variant as keyof typeof configs] || configs.body;
}

function getLineHeightConfig(variant: string) {
  const configs = {
    h1: { smallPhone: 36, phone: 40, tablet: 48, desktop: 56, default: 40 },
    h2: { smallPhone: 32, phone: 36, tablet: 40, desktop: 48, default: 36 },
    h3: { smallPhone: 28, phone: 32, tablet: 36, desktop: 40, default: 32 },
    h4: { smallPhone: 24, phone: 28, tablet: 32, desktop: 36, default: 28 },
    body: { smallPhone: 20, phone: 24, tablet: 24, desktop: 28, default: 24 },
    caption: { smallPhone: 18, phone: 20, tablet: 20, desktop: 24, default: 20 },
    small: { smallPhone: 16, phone: 18, tablet: 18, desktop: 20, default: 18 },
  };
  return configs[variant as keyof typeof configs] || configs.body;
}

function getVariantStyle(variant: string): TextStyle {
  const styles: Record<string, TextStyle> = {
    h1: { fontWeight: '800' },
    h2: { fontWeight: '700' },
    h3: { fontWeight: '600' },
    h4: { fontWeight: '600' },
    body: { fontWeight: '400' },
    caption: { fontWeight: '400' },
    small: { fontWeight: '400' },
  };
  return styles[variant] || styles.body;
}

const styles = StyleSheet.create({
  base: {
    color: DESIGN_TOKENS.colors.text,
  },
});
