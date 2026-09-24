import { useMemo } from 'react';
import { Platform } from 'react-native';
import { calculateColumns } from '@/components/listTravel/utils/listTravelHelpers';
import { BREAKPOINTS } from '@/components/listTravel/utils/listTravelConstants';
import { useScrollBottomPadding } from '@/components/layout/bottomChromeInset';

interface UseProfileGridArgs {
  width: number;
  isPhone: boolean;
  isLargePhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPortrait: boolean;
  maxContentWidth: number;
}

export function useProfileGrid({
  width,
  isPhone,
  isLargePhone,
  isTablet,
  isDesktop,
  isPortrait,
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

  const contentPaddingBottom = useScrollBottomPadding(32);

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
