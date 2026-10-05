import { Platform } from 'react-native';

export type DesktopBranchInsets = { top: number; left: number; right: number };
export const NO_DESKTOP_INSETS: DesktopBranchInsets = { top: 0, left: 0, right: 0 };

/**
 * Safe-area insets the desktop branch (width ≥ 768) takes itself — one rule for
 * every side. Native has no app header on /map (`app/(tabs)/_layout.tsx`), so
 * the row would start under the iPad status bar (#2172), and nothing above the
 * screen pads the sides: an Android phone in landscape (≥ 768 dp, edge-to-edge)
 * put the panel and the right-hand buttons under the camera cutout (#2233). On
 * web the page owns that space: zeros. Read by the shell row (`mapContainer`),
 * the chevron, the on-map controls and their popovers.
 */
export const getDesktopBranchInsets = (insets: {
  top: number;
  left?: number;
  right?: number;
}): DesktopBranchInsets =>
  Platform.OS === 'web'
    ? NO_DESKTOP_INSETS
    : {
        top: Math.max(0, insets.top),
        left: Math.max(0, insets.left ?? 0),
        right: Math.max(0, insets.right ?? 0),
      };
