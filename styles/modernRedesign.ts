// modernRedesign.ts - Modern UI Redesign Styles
import { StyleSheet, Platform } from 'react-native';

// Modern Color Palette inspired by Airbnb, Pinterest, Notion
export const MODERN_COLORS = {
  // Primary Blues
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  
  // Neutral Grays
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
  
  // Accent Colors
  accent: {
    amber: '#f59e0b',
    green: '#10b981',
    red: '#ef4444',
    purple: '#8b5cf6',
    pink: '#ec4899',
    teal: '#14b8a6',
  },
  
  // Semantic Colors
  semantic: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  
  // Surface Colors
  surface: {
    default: '#ffffff',
    raised: '#fafafa',
    overlay: 'rgba(255, 255, 255, 0.95)',
    muted: '#f8fafc',
  },
};

// Modern Spacing System
export const MODERN_SPACING = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
};

// Modern Border Radii
export const MODERN_RADII = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  pill: 9999,
};

// Modern Shadows
export const MODERN_SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 25,
    elevation: 8,
  },
};

// Web-specific box shadows
export const MODERN_BOX_SHADOWS = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px rgba(0, 0, 0, 0.07)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px rgba(0, 0, 0, 0.12)',
  inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
  focus: `0 0 0 4px ${MODERN_COLORS.primary[100]}`,
};

// Modern Typography
export const MODERN_TYPOGRAPHY = {
  fontFamily: {
    sans: Platform.select({
      web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      default: undefined,
    }),
    mono: Platform.select({
      web: "'JetBrains Mono', 'SF Mono', monospace",
      default: undefined,
    }),
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  fontWeight: {
    normal: '400' as any,
    medium: '500' as any,
    semibold: '600' as any,
    bold: '700' as any,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
    loose: 2,
  },
};

// Modern Animation Timings
export const MODERN_ANIMATIONS = {
  duration: {
    instant: 100,
    fast: 150,
    base: 250,
    slow: 350,
    slower: 500,
  },
  easing: {
    ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
};

// Modern Component Styles
export const modernStyles = StyleSheet.create({
  // Container Styles
  container: {
    flex: 1,
    backgroundColor: MODERN_COLORS.neutral[50],
  },
  
  contentContainer: {
    paddingHorizontal: MODERN_SPACING.lg,
    paddingVertical: MODERN_SPACING.xl,
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  
  // Card Styles
  cardMinimal: {
    backgroundColor: MODERN_COLORS.surface.default,
    borderRadius: MODERN_RADII.xl,
    overflow: 'hidden',
    ...MODERN_SHADOWS.sm,
    ...Platform.select({
      web: {
        transition: `all ${MODERN_ANIMATIONS.duration.base}ms ${MODERN_ANIMATIONS.easing.ease}`,
        cursor: 'pointer',
      },
    }),
  },
  
  cardRich: {
    backgroundColor: MODERN_COLORS.surface.default,
    borderRadius: MODERN_RADII['2xl'],
    overflow: 'hidden',
    ...MODERN_SHADOWS.md,
    ...Platform.select({
      web: {
        transition: `all ${MODERN_ANIMATIONS.duration.base}ms ${MODERN_ANIMATIONS.easing.ease}`,
      },
    }),
  },
  
  cardHover: Platform.select({
    web: {
      transform: [{ translateY: -4 }],
      ...MODERN_SHADOWS.lg,
    },
    default: {},
  }),
  
  // Button Styles
  buttonPrimary: {
    backgroundColor: MODERN_COLORS.primary[500],
    paddingHorizontal: MODERN_SPACING.lg,
    paddingVertical: MODERN_SPACING.sm,
    borderRadius: MODERN_RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        transition: `all ${MODERN_ANIMATIONS.duration.fast}ms ${MODERN_ANIMATIONS.easing.ease}`,
        cursor: 'pointer',
      },
    }),
  },
  
  buttonSecondary: {
    backgroundColor: MODERN_COLORS.neutral[100],
    paddingHorizontal: MODERN_SPACING.lg,
    paddingVertical: MODERN_SPACING.sm,
    borderRadius: MODERN_RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: MODERN_COLORS.neutral[200],
  },
  
  buttonGhost: {
    paddingHorizontal: MODERN_SPACING.md,
    paddingVertical: MODERN_SPACING.xs,
    borderRadius: MODERN_RADII.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Input Styles
  inputField: {
    backgroundColor: MODERN_COLORS.surface.muted,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: MODERN_RADII.lg,
    paddingHorizontal: MODERN_SPACING.md,
    paddingVertical: MODERN_SPACING.sm,
    fontSize: MODERN_TYPOGRAPHY.fontSize.base,
    color: MODERN_COLORS.neutral[800],
    ...Platform.select({
      web: {
        transition: `all ${MODERN_ANIMATIONS.duration.fast}ms ${MODERN_ANIMATIONS.easing.ease}`,
        outlineWidth: 0,
      },
    }),
  },
  
  inputFocused: {
    borderColor: MODERN_COLORS.primary[500],
    backgroundColor: MODERN_COLORS.surface.default,
    ...Platform.select({
      web: {
        boxShadow: MODERN_BOX_SHADOWS.focus,
      },
    }),
  },
  
  // Search Bar Styles
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MODERN_COLORS.surface.muted,
    borderRadius: MODERN_RADII.pill,
    paddingHorizontal: MODERN_SPACING.md,
    height: 48,
    ...Platform.select({
      web: {
        transition: `all ${MODERN_ANIMATIONS.duration.base}ms ${MODERN_ANIMATIONS.easing.ease}`,
      },
    }),
  },
  
  searchBarFocused: {
    backgroundColor: MODERN_COLORS.surface.default,
    ...MODERN_SHADOWS.md,
    ...Platform.select({
      web: {
        boxShadow: `${MODERN_BOX_SHADOWS.md}, ${MODERN_BOX_SHADOWS.focus}`,
      },
    }),
  },
  
  // Filter Sidebar Styles
  filterSidebar: {
    width: 280,
    backgroundColor: MODERN_COLORS.surface.default,
    borderRadius: MODERN_RADII.xl,
    padding: MODERN_SPACING.lg,
    ...MODERN_SHADOWS.sm,
  },
  
  filterGroup: {
    marginBottom: MODERN_SPACING.lg,
    paddingBottom: MODERN_SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: MODERN_COLORS.neutral[100],
  },
  
  filterGroupLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  
  filterTitle: {
    fontSize: MODERN_TYPOGRAPHY.fontSize.sm,
    fontWeight: MODERN_TYPOGRAPHY.fontWeight.semibold,
    color: MODERN_COLORS.neutral[800],
    marginBottom: MODERN_SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: MODERN_SPACING.xs,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: `opacity ${MODERN_ANIMATIONS.duration.fast}ms ${MODERN_ANIMATIONS.easing.ease}`,
      },
    }),
  },
  
  // Badge Styles
  badge: {
    paddingHorizontal: MODERN_SPACING.xs,
    paddingVertical: MODERN_SPACING.xxs,
    borderRadius: MODERN_RADII.pill,
    backgroundColor: MODERN_COLORS.neutral[100],
  },
  
  badgePrimary: {
    backgroundColor: MODERN_COLORS.primary[100],
  },
  
  badgeSuccess: {
    backgroundColor: MODERN_COLORS.accent.green + '20',
  },
  
  badgeWarning: {
    backgroundColor: MODERN_COLORS.accent.amber + '20',
  },
  
  // Typography Styles
  heading1: {
    fontSize: MODERN_TYPOGRAPHY.fontSize['3xl'],
    fontWeight: MODERN_TYPOGRAPHY.fontWeight.bold,
    color: MODERN_COLORS.neutral[900],
    lineHeight: MODERN_TYPOGRAPHY.fontSize['3xl'] * MODERN_TYPOGRAPHY.lineHeight.tight,
  },
  
  heading2: {
    fontSize: MODERN_TYPOGRAPHY.fontSize['2xl'],
    fontWeight: MODERN_TYPOGRAPHY.fontWeight.semibold,
    color: MODERN_COLORS.neutral[800],
    lineHeight: MODERN_TYPOGRAPHY.fontSize['2xl'] * MODERN_TYPOGRAPHY.lineHeight.tight,
  },
  
  heading3: {
    fontSize: MODERN_TYPOGRAPHY.fontSize.xl,
    fontWeight: MODERN_TYPOGRAPHY.fontWeight.semibold,
    color: MODERN_COLORS.neutral[800],
    lineHeight: MODERN_TYPOGRAPHY.fontSize.xl * MODERN_TYPOGRAPHY.lineHeight.normal,
  },
  
  bodyText: {
    fontSize: MODERN_TYPOGRAPHY.fontSize.base,
    fontWeight: MODERN_TYPOGRAPHY.fontWeight.normal,
    color: MODERN_COLORS.neutral[600],
    lineHeight: MODERN_TYPOGRAPHY.fontSize.base * MODERN_TYPOGRAPHY.lineHeight.normal,
  },
  
  caption: {
    fontSize: MODERN_TYPOGRAPHY.fontSize.sm,
    fontWeight: MODERN_TYPOGRAPHY.fontWeight.normal,
    color: MODERN_COLORS.neutral[500],
    lineHeight: MODERN_TYPOGRAPHY.fontSize.sm * MODERN_TYPOGRAPHY.lineHeight.normal,
  },
  
  // Layout Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -MODERN_SPACING.xs,
  },
  
  gridItem: {
    paddingHorizontal: MODERN_SPACING.xs,
    marginBottom: MODERN_SPACING.md,
  },
  
  // Responsive Utilities
  // Note: Media queries should be handled at component level with useWindowDimensions hook
  // These are placeholder styles for responsive behavior
  hideOnMobile: {
    // Will be conditionally applied based on screen width in components
  },
  
  showOnMobile: {
    // Will be conditionally applied based on screen width in components
  },
});

// Export all modern design tokens
export const MODERN_DESIGN_TOKENS = {
  colors: MODERN_COLORS,
  spacing: MODERN_SPACING,
  radii: MODERN_RADII,
  shadows: MODERN_SHADOWS,
  boxShadows: MODERN_BOX_SHADOWS,
  typography: MODERN_TYPOGRAPHY,
  animations: MODERN_ANIMATIONS,
};

export default modernStyles;
