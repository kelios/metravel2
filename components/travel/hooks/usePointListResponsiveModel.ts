import { useMemo } from 'react';

export type PointListResponsiveModel = {
  imageMinHeight: number;
  titleSize: number;
  coordSize: number;
  aspectRatio?: number;
};

export function usePointListResponsiveModel({
  isLargeDesktop,
  isMobile,
  isTablet,
  width,
}: {
  isLargeDesktop: boolean;
  isMobile: boolean;
  isTablet: boolean;
  width: number;
}) {
  const responsive: PointListResponsiveModel = useMemo(() => {
    const aspectRatio = 4 / 3;

    let imageMinHeight = 240;
    if (isLargeDesktop) {
      imageMinHeight = 400;
    } else if (width >= 1200) {
      imageMinHeight = 360;
    } else if (width >= 1024) {
      imageMinHeight = 320;
    } else if (width >= 768) {
      imageMinHeight = 280;
    } else if (width >= 640) {
      imageMinHeight = 260;
    } else {
      imageMinHeight = 240;
    }

    let titleSize = 14;
    if (isLargeDesktop) {
      titleSize = 19;
    } else if (width >= 1200) {
      titleSize = 18;
    } else if (width >= 1024) {
      titleSize = 17;
    } else if (width >= 768) {
      titleSize = 16;
    } else if (width >= 640) {
      titleSize = 15;
    } else {
      titleSize = 14;
    }

    const coordSize = isMobile ? 12 : isTablet ? 13 : 14;

    return {
      imageMinHeight,
      titleSize,
      coordSize,
      aspectRatio,
    };
  }, [isLargeDesktop, isMobile, isTablet, width]);

  const numColumns = useMemo(() => {
    if (width >= 1024) return 2;
    if (width >= 768) return 2;
    return 1;
  }, [width]);

  return {
    numColumns,
    responsive,
  };
}
