import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import type { ThemedColors } from '@/hooks/useTheme';
import * as corner from '@/screens/tabs/mapDesktopCorner';
import { webViewStyle } from '@/utils/webProps';

type DesktopOverlayStyleArgs = {
  themedColors: ThemedColors;
  /** Row padding of the desktop shell (`mapContainer`, #2233). */
  rowPaddingLeft: number;
  rowPaddingTop: number;
  panelWidth: number;
  /** Free band of the map's top row, offsets from the map's edges (map.styles). */
  bandLeft: number;
  bandRight: number;
};

/**
 * Desktop-branch controls over the map's top row (web, iPad, Android tablets):
 * the «Искать в этой области» band (#2219) and the chevron's a11y slot (#2243).
 * Kept out of `map.styles.ts` (file complexity budget); `getStyles` spreads them.
 */
export const getDesktopOverlayStyles = ({
  themedColors,
  rowPaddingLeft,
  rowPaddingTop,
  panelWidth,
  bandLeft,
  bandRight,
}: DesktopOverlayStyleArgs) => {
  const shadowMedium = themedColors.shadows.medium;
  // The native chevron's frame in row coordinates (`collapseToggleInPanel`).
  const chevronLeft = rowPaddingLeft + panelWidth + corner.COLLAPSE_TOGGLE_OUTSET;
  const chevronTop = rowPaddingTop + corner.COLLAPSE_TOGGLE_TOP;
  return {
    // The map's top row (#2219, #2304): ONE flex row in the free band — from
    // past the chevron's reach (left) to before «Радиус» (right) — holds the
    // location-quality pill and «Искать в этой области». Two absolute pills
    // in the same band overlapped (iPad: the quality pill covered the action);
    // in a row they cannot. The action has priority: while it shows, the
    // quality pill folds to its icon; the action is centred in what is left
    // and never grows past it (`maxWidth: '100%'`, one ellipsised line).
    desktopSearchAreaBand: {
      position: 'absolute',
      top: 16,
      left: bandLeft,
      right: bandRight,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      zIndex: 1010,
    } satisfies ViewStyle,
    desktopSearchAreaSlot: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      alignItems: 'center',
    } satisfies ViewStyle,
    desktopBandQualityPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      flexShrink: 1,
      minWidth: 0,
      maxWidth: 360,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: themedColors.warningSoft,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: themedColors.warning,
      ...themedColors.shadows.light,
    } satisfies ViewStyle,
    // `locationQualityText` is `flex: 1` (phone pill spans the width); in the
    // row the pill sizes to its text, which shrinks and ellipsises instead.
    desktopBandQualityText: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: 'auto',
    } satisfies TextStyle,
    // Folded while «Искать в этой области» shows: the icon, same name for
    // screen readers (the message stays its accessibility label).
    desktopBandQualityPillCompact: {
      flexShrink: 0,
      paddingHorizontal: 10,
      paddingVertical: 10,
    } satisfies ViewStyle,
    desktopSearchAreaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      height: 44,
      maxWidth: '100%',
      borderRadius: 22,
      backgroundColor: themedColors.primary,
      ...(Platform.OS === 'web'
        ? webViewStyle({
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(15,23,42,0.18), 0 1px 4px rgba(0,0,0,0.08)',
            transition: 'background-color 0.15s ease',
          })
        : shadowMedium),
    } satisfies ViewStyle,
    desktopSearchAreaButtonText: {
      flexShrink: 1,
      color: themedColors.textOnPrimary,
      fontSize: 13,
      fontWeight: '600',
    } satisfies TextStyle,
    // #2243 — native only: the chevron's screen-reader node. Reading order
    // follows a different rule on each platform: iOS reads subviews in mount
    // order, and Fabric mounts siblings sorted by `zIndex`
    // (`ConcreteViewShadowNode.h` orderIndex, `sliceChildShadowNodeViewPairs`),
    // so the visible chevron (zIndex 1002 — it must draw over the map's edge)
    // mounted after the panel AND the map; Android sorts a container's
    // children by geometry (`ViewGroup.ViewLocationHolder`, STRIPE: vertically
    // overlapping siblings by `left`), so the chevron (left 380) came after the
    // panel (left 16). One mechanism for both: the visible chevron is hidden
    // from screen readers, and its a11y twin sits in this slot — first in the
    // tree with no zIndex (mount order), its box from the row's top-left
    // corner (left 0: first by geometry). The twin itself has the chevron's
    // frame (focus ring) and never takes a touch (`pointerEvents="none"`).
    collapseToggleLead: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: chevronLeft + corner.COLLAPSE_TOGGLE_SIZE,
      height: chevronTop + corner.COLLAPSE_TOGGLE_SIZE,
    } satisfies ViewStyle,
    collapseToggleA11y: {
      position: 'absolute',
      left: chevronLeft,
      top: chevronTop,
      width: corner.COLLAPSE_TOGGLE_SIZE,
      height: corner.COLLAPSE_TOGGLE_SIZE,
    } satisfies ViewStyle,
  };
};
