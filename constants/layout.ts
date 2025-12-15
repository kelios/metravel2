/**
 * Unified metrics and layout constants for the application
 * Provides consistent spacing, breakpoints, and responsive helpers
 */

export const METRICS = {
  // Base unit for consistent spacing (8pt grid system)
  baseUnit: 8,
  
  // Spacing scale
  spacing: {
    xs: 4,   // Extra small
    s: 8,    // Small
    m: 16,   // Medium
    l: 24,   // Large
    xl: 32,  // Extra large
    xxl: 40, // Extra extra large
  },
  
  // Standard breakpoints
  breakpoints: {
    smallPhone: 0,     // 0-359px
    phone: 375,        // 360-767px
    largePhone: 414,   // 414-767px
    tablet: 768,       // 768-1023px
    largeTablet: 1024, // 1024-1279px
    desktop: 1280,     // 1280px+
  },
  
  // Border radius
  borderRadius: {
    s: 4,
    m: 8,
    l: 12,
    xl: 16,
    pill: 1000, // For pill-shaped components
    circle: 9999, // For circular components
  },
  
  // Elevation (shadow) levels
  elevation: {
    none: 0,
    s: 2,
    m: 4,
    l: 8,
    xl: 16,
  },
  
  // Animation durations
  animation: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
} as const;

// Type definitions
type Metrics = typeof METRICS;
export type Spacing = keyof Metrics['spacing'];
export type Breakpoint = keyof Metrics['breakpoints'];
export type BorderRadius = keyof Metrics['borderRadius'];
export type Elevation = keyof Metrics['elevation'];

// Helper function to get spacing value
export const getSpacing = (size: Spacing | number): number => {
  if (typeof size === 'number') return size;
  return METRICS.spacing[size] || METRICS.spacing.m;
};

// Helper function to get breakpoint value
export const getBreakpoint = (breakpoint: Breakpoint): number => {
  return METRICS.breakpoints[breakpoint];
};

// Media query helper
export const media = {
  minWidth: (breakpoint: Breakpoint) =>
    `@media (min-width: ${getBreakpoint(breakpoint)}px)`,
  maxWidth: (breakpoint: Breakpoint) =>
    `@media (max-width: ${getBreakpoint(breakpoint) - 1}px)`,
  between: (min: Breakpoint, max: Breakpoint) =>
    `@media (min-width: ${getBreakpoint(min)}px) and (max-width: ${
      getBreakpoint(max) - 1
    }px)`,
} as const;

// Common layout patterns
export const LAYOUT = {
  // Standard content padding
  contentPadding: {
    horizontal: METRICS.spacing.m,
    vertical: METRICS.spacing.m,
  },
  
  // Maximum content width for large screens
  maxContentWidth: 1440,
  
  // Standard header height
  headerHeight: 56,
  
  // Standard tab bar height
  tabBarHeight: 56,
  
  // Standard button heights
  buttonHeights: {
    small: 36,
    medium: 44,
    large: 56,
  },
  
  // Standard icon sizes
  iconSizes: {
    xs: 16,
    s: 20,
    m: 24,
    l: 32,
    xl: 40,
  },
} as const;
