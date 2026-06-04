import { useMemo } from 'react';
import { Platform } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { calculateColumns } from '@/components/listTravel/utils/listTravelHelpers';
import { BREAKPOINTS } from '@/components/listTravel/utils/listTravelConstants';

interface UseProfileGridArgs {
  width: number;
  isPhone: boolean;
  isLargePhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPortrait: boolean;
  insets: EdgeInsets;
  maxContentWidth: number;
}

export function useProfileGrid({
  width,
  isPhone,
  isLargePhone,
  isTablet,
  isDesktop,
  isPortrait,
  insets,
  maxContentWidth,
}: UseProfileGridArgs) {
  const isDesktopWeb = Platform.OS === 'web' && isDesktop;

  const effectiveWidth = Math.max(0, width || 0);
  const contentWidth = Platform.OS === 'web'
    ? Math.min(effectiveWidth, maxContentWidth)
    : effectiveWidth;

  const isMobileDevice = isPhone || isLargePhone || (isTablet && isPortrait);
  const isCardsSingleColumn = contentWidth < BREAKPOINTS.MOBILE;

  const gapSize = useMemo(() => {
    if (contentWidth < BREAKPOINTS.XS) return 6;
    if (contentWidth < BREAKPOINTS.SM) return 8;
    if (contentWidth < BREAKPOINTS.MOBILE) return 10;
    if (contentWidth < BREAKPOINTS.TABLET) return 12;
    if (contentWidth < BREAKPOINTS.DESKTOP) return 14;
    return 16;
  }, [contentWidth]);

  const contentPadding = useMemo(() => {
    if (contentWidth < BREAKPOINTS.XS) return 12;
    if (contentWidth < BREAKPOINTS.SM) return 8;
    if (contentWidth < BREAKPOINTS.MOBILE) return 10;
    if (contentWidth < BREAKPOINTS.TABLET) return 12;
    if (contentWidth < BREAKPOINTS.DESKTOP) return 12;
    if (contentWidth < BREAKPOINTS.DESKTOP_LARGE) return 16;
    return 20;
  }, [contentWidth]);

  const gridColumns = useMemo(() => {
    if (isCardsSingleColumn) return 1;
    const orientation = isPortrait ? 'portrait' : 'landscape';
    if (isMobileDevice) return calculateColumns(contentWidth, orientation);
    return calculateColumns(contentWidth, 'landscape');
  }, [contentWidth, isCardsSingleColumn, isMobileDevice, isPortrait]);

  const contentPaddingBottom = useMemo(() => {
    if (Platform.OS === 'web') {
      const dockVisible = isPhone || isLargePhone || isTablet;
      return (dockVisible ? 96 : 0) + 32;
    }

    return Math.max(32, (insets.bottom || 0) + 16);
  }, [insets.bottom, isLargePhone, isPhone, isTablet]);

  return {
    isDesktopWeb,
    contentWidth,
    isMobileDevice,
    isCardsSingleColumn,
    gapSize,
    contentPadding,
    gridColumns,
    contentPaddingBottom,
  };
}
