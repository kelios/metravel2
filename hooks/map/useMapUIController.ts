/**
 * Map UI controller - manages UI state (panels, tabs, styles)
 * @module hooks/map/useMapUIController
 */

import { useMemo } from 'react';
import { Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsetsSafe as useSafeAreaInsets } from '@/hooks/useSafeAreaInsetsSafe';
import { useThemedColors } from '@/hooks/useTheme';
import { useMapPanelState, useMapResponsive } from './useMapPanelState';
import { getStyles } from '@/screens/tabs/map.styles';
import { buildCanonicalUrl } from '@/utils/seo';

const HEADER_HEIGHT_WEB = 88;

type MapPanelStateResult = ReturnType<typeof useMapPanelState>;
type ThemedColors = ReturnType<typeof useThemedColors>;
type MapScreenStyles = ReturnType<typeof getStyles>;

interface UseMapUIControllerResult {
  /**
   * Is screen focused
   */
  isFocused: boolean;

  /**
   * Is mobile device
   */
  isMobile: boolean;

  /**
   * Screen width
   */
  width: number;

  /**
   * Map is ready to render
   */
  mapReady: boolean;

  /**
   * Current right panel tab
   */
  rightPanelTab: 'filters' | 'travels';

  /**
   * Is right panel visible
   */
  rightPanelVisible: boolean;

  /**
   * Select filters tab
   */
  selectFiltersTab: () => void;

  /**
   * Select travels tab
   */
  selectTravelsTab: () => void;

  /**
   * Open right panel
   */
  openRightPanel: () => void;

  /**
   * Close right panel
   */
  closeRightPanel: () => void;

  /**
   * Panel animation style
   */
  panelStyle: MapPanelStateResult['panelStyle'];

  /**
   * Overlay animation style
   */
  overlayStyle: MapPanelStateResult['overlayStyle'];

  /**
   * Filters tab ref
   */
  filtersTabRef: MapPanelStateResult['filtersTabRef'];

  /**
   * Panel ref
   */
  panelRef: MapPanelStateResult['panelRef'];

  /**
   * Themed colors
   */
  themedColors: ThemedColors;

  /**
   * Component styles
   */
  styles: MapScreenStyles;

  /**
   * Canonical URL for SEO
   */
  canonical: string;

  /**
   * Is desktop panel collapsed
   */
  isDesktopCollapsed: boolean;

  /**
   * Desktop panel width in px
   */
  desktopPanelWidth: number;

  /**
   * Toggle desktop panel collapse
   */
  toggleDesktopCollapse: () => void;

  /**
   * Resize desktop panel width
   */
  onResizePanelWidth: (width: number) => void;
}

/**
 * Manages UI state, responsive behavior, and styling
 *
 * Features:
 * - Responsive layout (mobile/desktop)
 * - Panel state management (open/close, tabs)
 * - Animation styles
 * - Theme colors and component styles
 * - SEO canonical URL
 *
 * @example
 * ```typescript
 * const {
 *   isMobile,
 *   rightPanelTab,
 *   selectFiltersTab,
 *   selectTravelsTab,
 *   styles,
 * } = useMapUIController();
 * ```
 */
export function useMapUIController(): UseMapUIControllerResult {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const themedColors = useThemedColors();

  // Responsive
  const { isMobile, width } = useMapResponsive();

  // Panel state
  const {
    isFocused,
    mapReady,
    rightPanelTab,
    rightPanelVisible,
    isDesktopCollapsed,
    desktopPanelWidth,
    selectFiltersTab,
    selectTravelsTab,
    openRightPanel,
    closeRightPanel,
    toggleDesktopCollapse,
    onResizePanelWidth,
    panelStyle,
    overlayStyle,
    filtersTabRef,
    panelRef,
  } = useMapPanelState({ isMobile });

  // Canonical URL
  const canonical = buildCanonicalUrl(pathname || '/map');

  // Styles
  const headerOffset = Platform.OS === 'web' ? HEADER_HEIGHT_WEB : 0;
  const styles = useMemo(
    () => getStyles(isMobile, insets.top, headerOffset, width, themedColors),
    [isMobile, insets.top, headerOffset, width, themedColors]
  );

  return useMemo(() => ({
    isFocused,
    isMobile,
    width,
    mapReady,
    rightPanelTab,
    rightPanelVisible,
    isDesktopCollapsed,
    desktopPanelWidth,
    selectFiltersTab,
    selectTravelsTab,
    openRightPanel,
    closeRightPanel,
    toggleDesktopCollapse,
    onResizePanelWidth,
    panelStyle,
    overlayStyle,
    filtersTabRef,
    panelRef,
    themedColors,
    styles,
    canonical,
  }), [
    isFocused,
    isMobile,
    width,
    mapReady,
    rightPanelTab,
    rightPanelVisible,
    isDesktopCollapsed,
    desktopPanelWidth,
    selectFiltersTab,
    selectTravelsTab,
    openRightPanel,
    closeRightPanel,
    toggleDesktopCollapse,
    onResizePanelWidth,
    panelStyle,
    overlayStyle,
    filtersTabRef,
    panelRef,
    themedColors,
    styles,
    canonical,
  ]);
}
