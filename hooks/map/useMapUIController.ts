/**
 * Map UI controller - manages UI state (panels, tabs, styles)
 * @module hooks/map/useMapUIController
 */

import { useMemo } from 'react';
import { Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedColors } from '@/hooks/useTheme';
import { useMapPanelState, useMapResponsive } from '@/hooks/map';
import { getStyles } from '@/src/screens/tabs/map.styles';
import { buildCanonicalUrl } from '@/utils/seo';

const HEADER_HEIGHT_WEB = 88;

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
  panelStyle: any;

  /**
   * Overlay animation style
   */
  overlayStyle: any;

  /**
   * Filters tab ref
   */
  filtersTabRef: any;

  /**
   * Panel ref
   */
  panelRef: any;

  /**
   * Themed colors
   */
  themedColors: any;

  /**
   * Component styles
   */
  styles: any;

  /**
   * Canonical URL for SEO
   */
  canonical: string;
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
    selectFiltersTab,
    selectTravelsTab,
    openRightPanel,
    closeRightPanel,
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

  return {
    isFocused,
    isMobile,
    width,
    mapReady,
    rightPanelTab,
    rightPanelVisible,
    selectFiltersTab,
    selectTravelsTab,
    openRightPanel,
    closeRightPanel,
    panelStyle,
    overlayStyle,
    filtersTabRef,
    panelRef,
    themedColors,
    styles,
    canonical,
  };
}
