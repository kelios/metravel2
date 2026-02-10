// components/SkipLinks.tsx
// ✅ УЛУЧШЕНИЕ: Skip links для улучшения доступности навигации с клавиатуры
// ✅ МИГРАЦИЯ: Полная миграция на DESIGN_TOKENS и useThemedColors

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface SkipLink {
  id: string;
  label: string;
  targetId: string;
}

interface SkipLinksProps {
  links?: SkipLink[];
}

const DEFAULT_LINKS: SkipLink[] = [
  { id: 'skip-main', label: 'Перейти к основному содержимому', targetId: 'main-content' },
  { id: 'skip-nav', label: 'Перейти к навигации', targetId: 'main-navigation' },
  { id: 'skip-search', label: 'Перейти к поиску', targetId: 'search-input' },
];

export default function SkipLinks({ links = DEFAULT_LINKS }: SkipLinksProps) {
  const colors = useThemedColors();
  const [focusedIndex, setFocusedIndex] = useState(-1);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Показываем skip links при нажатии Tab в начале страницы
      if (e.key === 'Tab' && !e.shiftKey && document.activeElement === document.body) {
        setFocusedIndex(0);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSkip = (targetId: string) => {
    if (Platform.OS !== 'web') return;

    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFocusedIndex(-1);
    }
  };

  if (Platform.OS !== 'web' || focusedIndex === -1) {
    return null;
  }

  return (
	    <View style={styles.container}>
	      {links.map((link, index) => (
	        <Pressable
	          key={link.id}
	          style={[
	            createLinkStyle(colors) as any,
	            focusedIndex === index && (createLinkFocusedStyle(colors) as any),
	          ]}
	          onPress={() => handleSkip(link.targetId)}
	          onFocus={() => setFocusedIndex(index)}
	          onBlur={() => {
            // Скрываем при потере фокуса, если не перешли на другой skip link
            setTimeout(() => {
              if (document.activeElement?.id !== link.targetId) {
                setFocusedIndex(-1);
              }
            }, 100);
          }}
          accessibilityRole="button"
          accessibilityLabel={link.label}
          {...Platform.select({
            web: {
              // @ts-ignore
              tabIndex: 0,
            },
          })}
        >
          <Text style={createLinkTextStyle(colors)}>{link.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10000,
    flexDirection: 'column',
    gap: DESIGN_TOKENS.spacing.sm,
    padding: DESIGN_TOKENS.spacing.sm,
  },
});

const createLinkStyle = (colors: ThemedColors) => ({
  backgroundColor: colors.primary,
  paddingVertical: DESIGN_TOKENS.spacing.sm,
  paddingHorizontal: DESIGN_TOKENS.spacing.lg,
  borderRadius: DESIGN_TOKENS.radii.md,
  minHeight: DESIGN_TOKENS.touchTarget.minHeight,
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  ...Platform.select({
    web: {
      boxShadow: DESIGN_TOKENS.shadows.medium,
      transition: 'all 0.2s ease',
      cursor: 'pointer',
      // @ts-ignore
      ':focus': {
        outlineWidth: 3,
        outlineStyle: 'solid',
        outlineColor: colors.primary,
        outlineOffset: 2,
      },
    },
  }),
});

const createLinkFocusedStyle = (colors: ThemedColors) => ({
  backgroundColor: colors.primary,
  opacity: 0.9,
  transform: [{ scale: 1.05 }],
});

const createLinkTextStyle = (colors: ThemedColors) => ({
  color: colors.textOnPrimary,
  fontSize: 14,
  fontWeight: '600' as const,
});
