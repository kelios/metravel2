import { useState } from 'react';
import { Platform } from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import { getListTravelViewportState } from '../listTravelBaseModel';

export const useListTravelViewportState = (initialViewportWidth?: number) => {
  const {
    width: responsiveWidth,
    isPhone,
    isLargePhone,
    isTablet: isTabletSize,
    isDesktop: isDesktopSize,
    isPortrait,
  } = useResponsive();
  // Lazy web routes mount after the parent route has already hydrated. Their
  // own hydration-safe responsive hook deliberately reports width=0 for one
  // render, which would briefly select the full-width overlay layout. Reuse the
  // parent route's already-live width for that first render so the sidebar and
  // result column start in their final desktop geometry.
  const rawWidth =
    Platform.OS === 'web' && responsiveWidth <= 0 && (initialViewportWidth ?? 0) > 0
      ? initialViewportWidth!
      : responsiveWidth;
  const viewportState = getListTravelViewportState({
    isDesktopSize,
    isLargePhone,
    isPhone,
    isPortrait,
    isTabletSize,
    rawWidth,
  });

  // Mobile browser chrome can change the viewport by a few pixels. Preserve the
  // existing hysteresis so card geometry only updates after a meaningful change.
  const [width, setWidth] = useState(viewportState.width);
  if (Math.abs(viewportState.width - width) > 50) {
    setWidth(viewportState.width);
  }

  return { viewportState, width };
};
