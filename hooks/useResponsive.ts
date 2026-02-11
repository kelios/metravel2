import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { Dimensions, Platform } from 'react-native';
import { METRICS } from '@/constants/layout';

type Breakpoint = keyof typeof METRICS.breakpoints;
type Orientation = 'portrait' | 'landscape';

interface ResponsiveState {
  // Hydration state (web)
  isHydrated: boolean;

  // Screen size flags
  isSmallPhone: boolean;
  isPhone: boolean;
  isLargePhone: boolean;
  isTablet: boolean;
  isLargeTablet: boolean;
  isDesktop: boolean;
  isMobile: boolean;
  
  // Screen dimensions
  width: number;
  height: number;
  
  // Orientation
  isPortrait: boolean;
  isLandscape: boolean;
  orientation: Orientation;
  
  // Breakpoints
  breakpoints: typeof METRICS.breakpoints;
  
  // Screen size helpers
  isAtLeast: (breakpoint: Breakpoint) => boolean;
  isAtMost: (breakpoint: Breakpoint) => boolean;
  isBetween: (min: Breakpoint, max: Breakpoint) => boolean;
}

type DimensionsSnapshot = {
  width: number;
  height: number;
};

const getWebWindowSnapshot = (): DimensionsSnapshot | null => {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;
  const width = Number(window.innerWidth);
  const height = Number(window.innerHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
};

let currentSnapshot: DimensionsSnapshot = (() => {
  const webSnapshot = getWebWindowSnapshot();
  if (webSnapshot) return webSnapshot;
  const { width, height } = Dimensions.get('window');
  return { width, height };
})();

const setSnapshotIfChanged = (next: DimensionsSnapshot): boolean => {
  if (
    currentSnapshot.width === next.width &&
    currentSnapshot.height === next.height
  ) {
    return false;
  }
  currentSnapshot = next;
  return true;
};

const subscribers = new Set<() => void>();
let subscription: { remove: () => void } | null = null;

const ensureSubscription = () => {
  if (subscription) return false;
  let snapshotChanged = false;

  // Ensure we start from the actual client window dimensions.
  // On web with SSR, module-level initialization can run with incorrect dimensions.
  try {
    const webSnapshot = getWebWindowSnapshot();
    const { width, height } = webSnapshot ?? Dimensions.get('window');
    if (currentSnapshot.width !== width || currentSnapshot.height !== height) {
      currentSnapshot = { width, height };
      snapshotChanged = true;
    }
  } catch {
    // noop
  }

  const notify = () => {
    subscribers.forEach((cb) => {
      try {
        cb();
      } catch {
        // noop
      }
    });
  };

  const dimSub = Dimensions.addEventListener('change', ({ window }) => {
    if (setSnapshotIfChanged({ width: window.width, height: window.height })) {
      notify();
    }
  }) as any;

  // On web static/prod builds Dimensions can occasionally report stale/zero values.
  // Keep an additional window resize subscription as the source of truth.
  let removeWebListener: (() => void) | null = null;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    let raf = 0 as any;
    const onResize = () => {
      if (raf) return;
      raf = (window as any).requestAnimationFrame?.(() => {
        raf = 0;
        const webSnapshot = getWebWindowSnapshot();
        if (!webSnapshot) return;
        if (setSnapshotIfChanged(webSnapshot)) {
          notify();
        }
      }) ?? setTimeout(() => {
        raf = 0;
        const webSnapshot = getWebWindowSnapshot();
        if (!webSnapshot) return;
        if (setSnapshotIfChanged(webSnapshot)) {
          notify();
        }
      }, 0);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    removeWebListener = () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      try {
        if (raf && typeof (window as any).cancelAnimationFrame === 'function') {
          (window as any).cancelAnimationFrame(raf);
        }
      } catch {
        // noop
      }
      raf = 0;
    };

    // Force a sync update after attaching listeners to avoid "stuck" initial width.
    try {
      onResize();
    } catch {
      // noop
    }
  }

  subscription = {
    remove: () => {
      try {
        dimSub?.remove?.();
      } finally {
        removeWebListener?.();
      }
    },
  };
  return snapshotChanged;
};

// Fixed snapshot for SSR / hydration. During static export window is undefined
// so the server renders with {0,0}. The client must return the same value during
// hydration to avoid React error #418. After hydration, useSyncExternalStore
// switches to the live getSnapshot automatically.
const SSR_SNAPSHOT: DimensionsSnapshot = { width: 0, height: 0 };
const getServerSnapshot = () => SSR_SNAPSHOT;

// Track whether initial hydration is complete on web.
// During hydration getSnapshot must return the same value the server used ({0,0})
// to avoid React error #418. After hydration we flip the flag and notify
// subscribers so every consumer re-renders with real window dimensions.
let _hydrated = Platform.OS !== 'web';
let _hydrationScheduled = false;

const subscribe = (onStoreChange: () => void) => {
  subscribers.add(onStoreChange);
  const snapshotChanged = ensureSubscription();

  // Schedule the hydration→live switch exactly once.
  // setTimeout(0) fires after React finishes hydrating the current tree.
  if (!_hydrated && !_hydrationScheduled && Platform.OS === 'web') {
    _hydrationScheduled = true;
    setTimeout(() => {
      _hydrated = true;
      // Ensure currentSnapshot reflects real window dimensions
      const webSnap = getWebWindowSnapshot();
      if (
        webSnap &&
        (currentSnapshot.width !== webSnap.width ||
          currentSnapshot.height !== webSnap.height)
      ) {
        currentSnapshot = webSnap;
      }
      // Notify all subscribers to re-render with real dimensions
      subscribers.forEach((cb) => {
        try {
          cb();
        } catch {
          // noop
        }
      });
    }, 0);
  }

  // Do not notify synchronously during hydration — the snapshot hasn't
  // changed from React's perspective (still SSR_SNAPSHOT).
  if (snapshotChanged && _hydrated) {
    try {
      onStoreChange();
    } catch {
      // noop
    }
  }
  return () => {
    subscribers.delete(onStoreChange);
    if (subscribers.size === 0 && subscription) {
      try {
        subscription.remove();
      } finally {
        subscription = null;
      }
    }
  };
};

const getSnapshot = () => (_hydrated ? currentSnapshot : SSR_SNAPSHOT);

/**
 * Enhanced responsive hook that provides screen size and orientation information
 * with TypeScript support and performance optimizations
 * 
 * @returns {ResponsiveState} Object containing responsive state and helpers
 * 
 * @example
 * const {
 *   isMobile,
 *   isTablet,
 *   width,
 *   isPortrait,
 *   isAtLeast
 * } = useResponsive();
 * 
 * if (isTablet) {
 *   return <TabletLayout />;
 * }
 */
export function useResponsive(): ResponsiveState {
  const { width, height } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isHydrated = Platform.OS !== 'web' || (_hydrated && width > 0 && height > 0);
  const isPortrait = height > width;
  const orientation: Orientation = isPortrait ? 'portrait' : 'landscape';

  // Breakpoint checks
  const isSmallPhone = width < METRICS.breakpoints.phone;
  const isPhone = width >= METRICS.breakpoints.phone && width < METRICS.breakpoints.largePhone;
  const isLargePhone = width >= METRICS.breakpoints.largePhone && width < METRICS.breakpoints.tablet;
  const isTablet = width >= METRICS.breakpoints.tablet && width < METRICS.breakpoints.largeTablet;
  const isLargeTablet = width >= METRICS.breakpoints.largeTablet && width < METRICS.breakpoints.desktop;
  const isDesktop = width >= METRICS.breakpoints.desktop;
  const isMobile = width < METRICS.breakpoints.tablet;

  const isAtLeast = useCallback((breakpoint: Breakpoint): boolean => {
    return width >= METRICS.breakpoints[breakpoint];
  }, [width]);

  const isAtMost = useCallback((breakpoint: Breakpoint): boolean => {
    return width <= METRICS.breakpoints[breakpoint];
  }, [width]);

  const isBetween = useCallback((min: Breakpoint, max: Breakpoint): boolean => {
    return width >= METRICS.breakpoints[min] && width <= METRICS.breakpoints[max];
  }, [width]);

  return useMemo(
    () => ({
      isHydrated,
      // Screen size flags
      isSmallPhone,
      isPhone,
      isLargePhone,
      isTablet,
      isLargeTablet,
      isDesktop,
      isMobile,

      // Screen dimensions
      width,
      height,

      // Orientation
      isPortrait,
      isLandscape: !isPortrait,
      orientation,

      // Breakpoints
      breakpoints: METRICS.breakpoints,

      // Helper methods
      isAtLeast,
      isAtMost,
      isBetween,
    }),
    [
      height,
      isHydrated,
      isAtLeast,
      isAtMost,
      isBetween,
      isDesktop,
      isLargePhone,
      isLargeTablet,
      isMobile,
      isPhone,
      isPortrait,
      isSmallPhone,
      isTablet,
      orientation,
      width,
    ],
  );
}

/**
 * Hook to get responsive column count based on screen width
 * 
 * @param {Object} config - Column configuration for different breakpoints
 * @returns {number} Number of columns for the current screen size
 * 
 * @example
 * const columns = useResponsiveColumns({
 *   smallPhone: 1,   // 0-359px
 *   phone: 1,        // 360-413px
 *   largePhone: 1,   // 414-767px
 *   tablet: 2,       // 768-1023px
 *   largeTablet: 3,  // 1024-1279px
 *   desktop: 4,      // 1280px+
 *   default: 1,      // Fallback value
 * });
 */
export function useResponsiveColumns(config: {
  smallPhone?: number;
  phone?: number;
  largePhone?: number;
  tablet?: number;
  largeTablet?: number;
  desktop?: number;
  default: number; // Make default required
}): number {
  const { isSmallPhone, isPhone, isLargePhone, isTablet, isLargeTablet, isDesktop } = useResponsive();

  const defaults = {
    smallPhone: 1,
    phone: 1,
    largePhone: 1,
    tablet: 2,
    largeTablet: 3,
    desktop: 4,
  };

  const columns = { ...defaults, ...config };

  if (isDesktop) return columns.desktop ?? columns.default;
  if (isLargeTablet) return columns.largeTablet ?? columns.default;
  if (isTablet) return columns.tablet ?? columns.default;
  if (isLargePhone) return columns.largePhone ?? columns.default;
  if (isPhone) return columns.phone ?? columns.default;
  if (isSmallPhone) return columns.smallPhone ?? columns.default;
  return columns.default;
}

/**
 * Hook to get responsive values based on screen size
 * 
 * @template T - Type of the value to return
 * @param {Object} values - Values for different breakpoints
 * @param {T} [values.smallPhone] - Value for small phones (0-359px)
 * @param {T} [values.phone] - Value for phones (360-413px)
 * @param {T} [values.largePhone] - Value for large phones (414-767px)
 * @param {T} [values.tablet] - Value for tablets (768-1023px)
 * @param {T} [values.largeTablet] - Value for large tablets (1024-1279px)
 * @param {T} [values.desktop] - Value for desktops (1280px+)
 * @param {T} [values.default] - Default/fallback value
 * @returns {T | undefined} Value for the current screen size
 * 
 * @example
 * const fontSize = useResponsiveValue({
 *   smallPhone: 12,
 *   phone: 14,
 *   largePhone: 14,
 *   tablet: 16,
 *   largeTablet: 18,
 *   desktop: 20,
 *   default: 14,
 * });
 * 
 * const padding = useResponsiveValue({
 *   phone: 16,
 *   tablet: 24,
 *   default: 16,
 * });
 */
export function useResponsiveValue<T>(values: {
  smallPhone?: T;
  phone?: T;
  largePhone?: T;
  tablet?: T;
  largeTablet?: T;
  desktop?: T;
  default: T; // Make default required
}): T {
  const { 
    isSmallPhone, 
    isPhone, 
    isLargePhone, 
    isTablet, 
    isLargeTablet, 
    isDesktop 
  } = useResponsive();

  if (isDesktop && values.desktop !== undefined) return values.desktop;
  if (isLargeTablet && values.largeTablet !== undefined) return values.largeTablet;
  if (isTablet && values.tablet !== undefined) return values.tablet;
  if (isLargePhone && values.largePhone !== undefined) return values.largePhone;
  if (isPhone && values.phone !== undefined) return values.phone;
  if (isSmallPhone && values.smallPhone !== undefined) return values.smallPhone;
  return values.default;
}
