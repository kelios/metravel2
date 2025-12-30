// components/SkipLinks.tsx
// ✅ УЛУЧШЕНИЕ: Skip links для улучшения доступности навигации с клавиатуры

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

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

const palette = DESIGN_TOKENS.colors;

export default function SkipLinks({ links = DEFAULT_LINKS }: SkipLinksProps) {
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
            styles.link,
            focusedIndex === index && styles.linkFocused,
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
          <Text style={styles.linkText}>{link.label}</Text>
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
    gap: 8,
    padding: 8,
  },
  link: {
    backgroundColor: palette.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.medium,
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        // @ts-ignore
        ':focus': {
          outline: `3px solid ${palette.primary}`,
          outlineOffset: 2,
        },
      },
    }),
  },
  linkFocused: {
    backgroundColor: palette.primary,
    opacity: 0.9,
    transform: [{ scale: 1.05 }],
  },
  linkText: {
    color: palette.textOnPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
