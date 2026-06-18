import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { isIOSSafariUserAgent } from '@/components/ui/ImageCardMedia';
import type { ThemedColors } from '@/hooks/useTheme';

import {
  COMPACT_IMAGE_MAX_HEIGHT_BY_BREAKPOINT,
  COMPACT_POPUP_MAX_WIDTH_BY_BREAKPOINT,
  IMAGE_ASPECT,
  IMAGE_MAX_HEIGHT_BY_BREAKPOINT,
  POPUP_MAX_WIDTH_BY_BREAKPOINT,
  SPLIT_LAYOUT_IMAGE_ASPECT,
  SPLIT_LAYOUT_MIN_POPUP_WIDTH,
  SPLIT_LAYOUT_MIN_VIEWPORT,
  getBreakpoint,
} from './constants';
import { getStyles } from './styles';

type UsePopupLayoutArgs = {
  colors: ThemedColors;
  width: number;
  imageUrl?: string | null;
  addLabel: string;
  compactLayout: boolean;
  fullscreenOnMobile: boolean;
};

export function usePopupLayout({
  colors,
  width,
  imageUrl,
  addLabel,
  compactLayout,
  fullscreenOnMobile,
}: UsePopupLayoutArgs) {
  const revealPopupImageOnLoadOnly = useMemo(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
    return isIOSSafariUserAgent(
      String(navigator.userAgent || ''),
      typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0,
    );
  }, []);

  const { width: viewportWidth } = useWindowDimensions();
  const bp = getBreakpoint(viewportWidth);
  const isNarrow = bp === 'narrow';
  const compactLabel = isNarrow ? 'Сохранить' : addLabel;
  const viewportGutter = bp === 'narrow' ? 24 : bp === 'compact' ? 32 : 48;
  const useFullscreenMobileOverlay = Platform.OS === 'web' && fullscreenOnMobile && viewportWidth <= 560;
  const useCompactLayout = compactLayout || (viewportWidth <= 420 && !useFullscreenMobileOverlay);
  const safeViewportWidth = Math.max(220, viewportWidth - viewportGutter);
  const popupWidthCap = useFullscreenMobileOverlay
    ? Math.min(480, safeViewportWidth)
    : useCompactLayout
      ? COMPACT_POPUP_MAX_WIDTH_BY_BREAKPOINT[bp]
      : POPUP_MAX_WIDTH_BY_BREAKPOINT[bp];
  const imageHeightCap = useFullscreenMobileOverlay
    ? 220
    : useCompactLayout
    ? COMPACT_IMAGE_MAX_HEIGHT_BY_BREAKPOINT[bp]
    : IMAGE_MAX_HEIGHT_BY_BREAKPOINT[bp];
  const maxPopupWidth = Math.min(width, popupWidthCap, safeViewportWidth);
  const useSplitLayout =
    Boolean(imageUrl) &&
    !useFullscreenMobileOverlay &&
    !useCompactLayout &&
    viewportWidth >= SPLIT_LAYOUT_MIN_VIEWPORT &&
    maxPopupWidth >= SPLIT_LAYOUT_MIN_POPUP_WIDTH;
  const heroWidth = useSplitLayout
    ? Math.max(100, Math.min(118, Math.round(maxPopupWidth * 0.34)))
    : maxPopupWidth;
  const heroHeight = useSplitLayout
    ? Math.max(100, Math.min(118, Math.round(heroWidth / SPLIT_LAYOUT_IMAGE_ASPECT)))
    : Math.max(
        1,
        Math.min(
          imageHeightCap,
          Math.round(heroWidth / IMAGE_ASPECT[bp])
        )
      );

  const styles = useMemo(
    () => getStyles(colors, bp, heroWidth, heroHeight, useCompactLayout, useSplitLayout),
    [colors, bp, heroWidth, heroHeight, useCompactLayout, useSplitLayout],
  );

  return {
    revealPopupImageOnLoadOnly,
    bp,
    compactLabel,
    useFullscreenMobileOverlay,
    useCompactLayout,
    maxPopupWidth,
    useSplitLayout,
    styles,
  };
}
