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
  // Mobile bottom-card surface (MapPlaceBottomCard): compact content WITHOUT the
  // popup's own fullscreen overlay. Unlike the desktop Leaflet popup, this card is
  // a full-width sheet, so its content must fill the parent instead of being capped
  // to the narrow Leaflet-popup width. Detected here so the desktop popup (which
  // pairs compactLayout with fullscreenOnMobile) keeps its narrow cap untouched.
  const isBottomCardLayout = compactLayout && !fullscreenOnMobile;
  const useCompactLayout = compactLayout || (viewportWidth <= 420 && !useFullscreenMobileOverlay);
  const safeViewportWidth = Math.max(220, viewportWidth - viewportGutter);
  const popupWidthCap = useFullscreenMobileOverlay
    ? Math.min(480, safeViewportWidth)
    : isBottomCardLayout
      ? safeViewportWidth
      : useCompactLayout
        ? COMPACT_POPUP_MAX_WIDTH_BY_BREAKPOINT[bp]
        : POPUP_MAX_WIDTH_BY_BREAKPOINT[bp];
  const imageHeightCap = useFullscreenMobileOverlay
    ? 220
    : useCompactLayout
    ? COMPACT_IMAGE_MAX_HEIGHT_BY_BREAKPOINT[bp]
    : IMAGE_MAX_HEIGHT_BY_BREAKPOINT[bp];
  // For the bottom card the parent (<=560px sheet) controls the real width via
  // `width: 100%`; don't clamp to the static `width` prop (default 352) which would
  // re-introduce the narrow content. The image height cap still applies below.
  const maxPopupWidth = isBottomCardLayout
    ? safeViewportWidth
    : Math.min(width, popupWidthCap, safeViewportWidth);
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
    () => getStyles(colors, bp, heroWidth, heroHeight, useCompactLayout, useSplitLayout, isBottomCardLayout),
    [colors, bp, heroWidth, heroHeight, useCompactLayout, useSplitLayout, isBottomCardLayout],
  );

  return {
    revealPopupImageOnLoadOnly,
    bp,
    compactLabel,
    useFullscreenMobileOverlay,
    useCompactLayout,
    isBottomCardLayout,
    maxPopupWidth,
    useSplitLayout,
    styles,
  };
}
