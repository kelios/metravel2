import { Platform } from 'react-native';
import { METRICS } from '@/constants/layout';

export interface QuickFilterChip {
  id: string;
  label: string;
  active?: boolean;
}

export function getStickySearchViewportState(params: {
  isJestEnv: boolean;
  isLargePhone: boolean;
  isPhone: boolean;
  width: number;
}) {
  const effectiveWidth =
    Platform.OS === 'web' && !params.isJestEnv && typeof window !== 'undefined'
      ? window.innerWidth
      : params.width;

  return {
    isMac:
      Platform.OS === 'web' &&
      typeof navigator !== 'undefined' &&
      /Mac|iPhone|iPad/.test(navigator.platform),
    // Must match isMobileDevice threshold in listTravelBaseModel (BREAKPOINTS.TABLET = 1024).
    // At 768–1023px sidebar is hidden, so the filter button must be visible.
    isMobile:
      Platform.OS === 'web'
        ? effectiveWidth < METRICS.breakpoints.largeTablet
        : params.isPhone || params.isLargePhone,
  };
}

export function getStickySearchShortcutLabel(isMac: boolean) {
  return isMac ? '⌘K' : 'Ctrl+K';
}

export function getStickySearchUiState(params: {
  hasActiveFilters: boolean;
  isMobile: boolean;
  isSearchPending?: boolean;
  onClearAll?: () => void;
  resultsCount?: number;
  search: string;
}) {
  const showPendingState = !!params.isSearchPending;
  const showResultsCount =
    params.resultsCount !== undefined &&
    params.resultsCount > 0 &&
    !params.isMobile &&
    !showPendingState;

  return {
    shouldReserveDesktopClearAllSlot: Platform.OS === 'web' && !params.isMobile && !!params.onClearAll,
    shouldReserveDesktopResultsSlot: Platform.OS === 'web' && !params.isMobile,
    showClearAll:
      !!params.onClearAll && (params.hasActiveFilters || params.search.length > 0) && !params.isMobile,
    showPendingState,
    showResultsCount,
  };
}
