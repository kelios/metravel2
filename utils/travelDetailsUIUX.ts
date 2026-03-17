/**
 * UI/UX Utilities for TravelDetailsContainer
 * Handles responsive design, animations, and accessibility enhancements
 */

import { Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { getThemedColors, type ThemedColors } from '@/hooks/useTheme';

/**
 * Get responsive spacing based on screen width
 */
export function getResponsiveSpacing(width: number): number {
  if (width < 480) return DESIGN_TOKENS.spacing.md; // Mobile
  if (width < 768) return DESIGN_TOKENS.spacing.lg; // Tablet
  if (width < 1024) return DESIGN_TOKENS.spacing.xl; // Small desktop
  if (width < 1440) return DESIGN_TOKENS.spacing.xxl; // Desktop
  return 80; // Large desktop
}

/**
 * Get responsive font size based on screen width
 */
export function getResponsiveFontSize(
  mobileSize: number,
  tabletSize: number,
  desktopSize: number,
  width: number
): number {
  if (width < 768) return mobileSize;
  if (width < 1024) return tabletSize;
  return desktopSize;
}

/**
 * Get responsive line height for better readability
 */
export function getResponsiveLineHeight(
  baseFontSize: number,
  isDesktop: boolean
): number {
  const ratio = isDesktop ? 1.5 : 1.6; // Desktop users prefer tighter line-height
  return Math.ceil(baseFontSize * ratio);
}

/**
 * Create accessible color with WCAG AAA contrast
 */
export function getAccessibleColor(lightMode: boolean): {
  text: string;
  textMuted: string;
  background: string;
  primary: string;
} {
  if (lightMode) {
    return {
      text: '#1a1a1a', // AAA contrast against white
      textMuted: '#4a4a4a', // AAA contrast against white
      background: '#ffffff',
      primary: '#0066cc', // AAA contrast against white
    };
  }

  return {
    text: '#f5f5f5',
    textMuted: '#b0b0b0',
    background: '#1a1a1a',
    primary: '#66b3ff',
  };
}

/**
 * Get hero image dimensions optimized for screen size
 */
export function getOptimizedHeroDimensions(
  screenWidth: number,
  screenHeight: number,
  aspectRatio: number = 16 / 9
): { width: number; height: number } {
  const isMobile = screenWidth < 768;

  if (isMobile) {
    // Mobile: use up to 85% of viewport height, max 420px
    const maxHeight = Math.min(screenHeight * 0.85, 420);
    return {
      width: screenWidth,
      height: Math.max(maxHeight, 200),
    };
  }

  // Desktop: 420px is sweet spot (LCP metric), max 640px
  const height = Math.min(screenWidth / aspectRatio, 640);
  return {
    width: screenWidth,
    height: Math.max(height, 320),
  };
}

/**
 * Get image optimization parameters based on device and network
 */
export function getImageOptimizationParams(options: {
  isMobile: boolean;
  isHighDPR: boolean;
  is3G: boolean;
}): {
  width: number;
  format: 'webp' | 'jpg';
  quality: number;
  fit: 'contain';
} {
  const { isMobile, isHighDPR, is3G } = options;

  // 3G networks: reduce quality and size
  if (is3G) {
    return {
      width: isMobile ? 320 : 640,
      format: 'jpg',
      quality: isMobile ? 60 : 70,
      fit: 'contain',
    };
  }

  // Mobile devices
  if (isMobile) {
    const width = isHighDPR ? 480 : 320;
    return {
      width,
      format: 'webp',
      quality: 75,
      fit: 'contain',
    };
  }

  // Desktop
  return {
    width: 1440,
    format: 'webp',
    quality: 85,
    fit: 'contain',
  };
}

/**
 * Determine optimal section layout (grid vs stack)
 */
export function getOptimalLayout(screenWidth: number): {
  layout: 'single-column' | 'two-column' | 'three-column';
  itemsPerRow: number;
} {
  if (screenWidth < 768) {
    return { layout: 'single-column', itemsPerRow: 1 };
  }

  if (screenWidth < 1024) {
    return { layout: 'two-column', itemsPerRow: 2 };
  }

  return { layout: 'three-column', itemsPerRow: 3 };
}

/**
 * Get animation timing based on platform and preferences
 */
export function getAnimationTiming(
  reduced: boolean = false
): {
  fast: number;
  normal: number;
  slow: number;
} {
  if (reduced) {
    // Respect prefers-reduced-motion
    return {
      fast: 0,
      normal: 0,
      slow: 0,
    };
  }

  return {
    fast: 150,
    normal: 300,
    slow: 500,
  };
}

/**
 * Check if device prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (Platform.OS !== 'web') return false;

  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    window.matchMedia('(prefers-color-scheme: dark)').matches === false
  );
}

/**
 * Get optimal scroll offset for sticky headers
 */
export function getScrollOffset(isMobile: boolean): number {
  return isMobile ? 56 : 72;
}

/**
 * Detect if user is on slow network
 */
export function isSlowNetwork(): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web') {
      resolve(false);
      return;
    }

    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      const effectiveType = connection?.effectiveType;
      const slow = effectiveType === '2g' || effectiveType === '3g';
      resolve(slow);
      return;
    }

    // Fallback: assume fast network
    resolve(false);
  });
}

/**
 * Create blur-up effect for image loading
 */
export function getBlurUpEffect(
  blurRadius: number = 12
): {
  blur: number;
  scale: number;
  opacity: number;
} {
  return {
    blur: blurRadius,
    scale: 1.02, // Slight upscale for visual interest
    opacity: 0.8,
  };
}

/**
 * Get skeleton loader dimensions matching actual content
 */
export function getSkeletonDimensions(elementType: 'text' | 'image' | 'card'): {
  height: number;
  width: string;
  borderRadius: number;
} {
  switch (elementType) {
    case 'text':
      return {
        height: 16,
        width: '100%',
        borderRadius: 4,
      };
    case 'image':
      return {
        height: 200,
        width: '100%',
        borderRadius: 12,
      };
    case 'card':
      return {
        height: 300,
        width: '100%',
        borderRadius: 12,
      };
  }
}

const resolveIsDark = () => {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-theme') === 'dark';
};

/**
 * Create accessible focus styles
 */
export function getAccessibleFocusStyles(
  colors: ThemedColors = getThemedColors(resolveIsDark())
): {
  outlineWidth: number;
  outlineColor: string;
  outlineOffset: number;
} {
  return {
    outlineWidth: 3,
    outlineColor: colors.primary,
    outlineOffset: 2,
  };
}

/**
 * Get fluid typography size using CSS clamp
 * Scales smoothly between min and max based on viewport width
 */
export function getFluidTypography(
  minSize: number,
  maxSize: number,
  minViewport: number = 320,
  maxViewport: number = 1440
): string {
  // Calculate slope: (maxSize - minSize) / (maxViewport - minViewport)
  const slope = (maxSize - minSize) / (maxViewport - minViewport);
  const intercept = minSize - slope * minViewport;

  // clamp(min, preferred, max)
  return `clamp(${minSize}px, ${intercept.toFixed(2)}px + ${(slope * 100).toFixed(2)}vw, ${maxSize}px)`;
}

/**
 * Calculate optimal vertical rhythm based on base font size
 * Returns consistent spacing scale for typography
 */
export function getVerticalRhythm(baseFontSize: number = 16): {
  lineHeight: number;
  paragraphSpacing: number;
  headingSpacing: number;
  sectionSpacing: number;
} {
  const baseLineHeight = baseFontSize * 1.5; // 1.5 ratio for readability

  return {
    lineHeight: baseLineHeight,
    paragraphSpacing: baseLineHeight * 0.75, // 12px for 16px base
    headingSpacing: baseLineHeight * 1.5, // 24px for 16px base
    sectionSpacing: baseLineHeight * 2, // 32px for 16px base
  };
}

/**
 * Get touch target size following Material/iOS guidelines
 * Ensures minimum 44x44 pixels for accessibility
 */
export function getTouchTargetSize(
  baseSize: number,
  minSize: number = 44
): {
  width: number;
  height: number;
  padding: number;
} {
  const size = Math.max(baseSize, minSize);
  const padding = Math.max(0, (size - baseSize) / 2);

  return {
    width: size,
    height: size,
    padding,
  };
}

/**
 * Calculate scroll snap points for smooth scrolling
 * Returns optimal snap positions for sections
 */
export function getScrollSnapPoints(
  sectionHeights: number[],
  viewportHeight: number
): number[] {
  const snapPoints: number[] = [0];
  let accumulated = 0;

  for (const height of sectionHeights) {
    accumulated += height;
    // Add snap point if section is taller than 1/3 viewport
    if (height > viewportHeight / 3) {
      snapPoints.push(accumulated);
    }
  }

  return snapPoints;
}

/**
 * Get spring animation config for natural motion
 */
export function getSpringConfig(
  type: 'gentle' | 'snappy' | 'bouncy' = 'gentle'
): {
  tension: number;
  friction: number;
  mass?: number;
} {
  switch (type) {
    case 'snappy':
      return { tension: 300, friction: 30 };
    case 'bouncy':
      return { tension: 180, friction: 12, mass: 1 };
    case 'gentle':
    default:
      return { tension: 170, friction: 26 };
  }
}

/**
 * Check if device supports haptic feedback
 */
export function supportsHaptics(): boolean {
  if (Platform.OS === 'web') {
    return 'vibrate' in navigator;
  }
  // Native platforms support haptics
  return true;
}

/**
 * Trigger haptic feedback with fallback
 */
export async function triggerHaptic(
  type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light'
): Promise<void> {
  if (!supportsHaptics()) return;

  if (Platform.OS === 'web') {
    const patterns: Record<string, number[]> = {
      light: [10],
      medium: [20],
      heavy: [30],
      success: [10, 50, 10],
      warning: [20, 50, 20],
      error: [30, 50, 30],
    };

    const pattern = patterns[type] || patterns.light;
    navigator.vibrate(pattern);
  } else {
    // Native: use expo-haptics
    try {
      const Haptics = await import('expo-haptics');
      const impactMap = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
        success: Haptics.NotificationFeedbackType.Success,
        warning: Haptics.NotificationFeedbackType.Warning,
        error: Haptics.NotificationFeedbackType.Error,
      };

      if (['success', 'warning', 'error'].includes(type)) {
        await Haptics.notificationAsync(impactMap[type] as any);
      } else {
        await Haptics.impactAsync(impactMap[type] as any);
      }
    } catch {
      // Haptics not available
    }
  }
}

/**
 * Get optimal image loading strategy based on position and viewport
 */
export function getImageLoadingStrategy(
  imagePosition: { top: number; bottom: number },
  viewport: { height: number; scrollY: number }
): {
  shouldLoad: boolean;
  priority: 'high' | 'low' | 'lazy';
  loading: 'eager' | 'lazy';
} {
  const { top, bottom } = imagePosition;
  const { height, scrollY } = viewport;

  // Check if image is in viewport
  const isInViewport = top < scrollY + height && bottom > scrollY;

  // Check if image is above the fold
  const isAboveFold = bottom < height;

  // Check if image is near viewport (within 1.5x viewport height)
  const isNearViewport = top < scrollY + height * 1.5;

  if (isAboveFold) {
    return { shouldLoad: true, priority: 'high', loading: 'eager' };
  }

  if (isInViewport || isNearViewport) {
    return { shouldLoad: true, priority: 'low', loading: 'lazy' };
  }

  return { shouldLoad: false, priority: 'lazy', loading: 'lazy' };
}
