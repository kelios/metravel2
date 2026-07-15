import { useState } from 'react';

import { useResponsive } from '@/hooks/useResponsive';
import { getListTravelViewportState } from '../listTravelBaseModel';

export const useListTravelViewportState = () => {
  const {
    width: rawWidth,
    isPhone,
    isLargePhone,
    isTablet: isTabletSize,
    isDesktop: isDesktopSize,
    isPortrait,
  } = useResponsive();
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
