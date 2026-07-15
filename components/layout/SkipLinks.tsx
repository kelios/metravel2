import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


interface SkipLink {
  id: string;
  label: string;
  targetId: string;
}

interface SkipLinksProps {
  links?: SkipLink[];
  initiallyVisible?: boolean;
}

const DEFAULT_LINKS: SkipLink[] = [
  { id: 'skip-main', get label() { return i18nT('navigationStatic:components.layout.SkipLinks.pereyti_k_osnovnomu_soderzhimomu_6663999c') }, targetId: 'main-content' },
  { id: 'skip-nav', get label() { return i18nT('navigationStatic:components.layout.SkipLinks.pereyti_k_navigatsii_bb05b7ca') }, targetId: 'main-navigation' },
];

export default function SkipLinks({
  links = DEFAULT_LINKS,
  initiallyVisible = false,
}: SkipLinksProps) {
  const colors = useThemedColors();
  const [focusedIndex, setFocusedIndex] = useState(initiallyVisible ? 0 : -1);

  const handleSkip = (targetId: string) => {
    if (Platform.OS !== 'web') return;

    const target = document.getElementById(targetId);
    if (target) {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFocusedIndex(-1);
    }
  };

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
	    <View style={[styles.container, focusedIndex === -1 && styles.containerHidden]}>
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
            setTimeout(() => {
              const active = document.activeElement as HTMLElement | null;
              if (active?.dataset?.skipLink !== 'true') {
                setFocusedIndex(-1);
              }
            }, 0);
          }}
          accessibilityRole="link"
          accessibilityLabel={link.label}
          {...Platform.select({
            web: {
              // @ts-ignore -- tabIndex is a web-only attribute not in RN Pressable types
              tabIndex: 0,
              'data-skip-link': 'true',
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
  containerHidden: {
    opacity: 0,
    transform: [{ translateY: -160 }],
    pointerEvents: 'none',
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
      // @ts-ignore -- CSS pseudo-selector :focus is web-only, not in RN style types
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
