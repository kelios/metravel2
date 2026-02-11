import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useResponsive } from '@/hooks/useResponsive';
import { usePanelController } from '@/hooks/usePanelController';

const PANEL_COLLAPSED_KEY = 'metravel_map_panel_collapsed';
const PANEL_WIDTH_KEY = 'metravel_map_panel_width';
const PANEL_MIN_WIDTH = 300;
const PANEL_MAX_WIDTH_RATIO = 0.5; // 50vw
const PANEL_DEFAULT_WIDTH = 384;

function readPanelCollapsed(): boolean {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(PANEL_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function writePanelCollapsed(collapsed: boolean): void {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PANEL_COLLAPSED_KEY, String(collapsed));
  } catch {
    // noop
  }
}

function readPanelWidth(): number {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return PANEL_DEFAULT_WIDTH;
  try {
    const v = localStorage.getItem(PANEL_WIDTH_KEY);
    if (v) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= PANEL_MIN_WIDTH) return n;
    }
  } catch { /* noop */ }
  return PANEL_DEFAULT_WIDTH;
}

function writePanelWidth(w: number): void {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
  try { localStorage.setItem(PANEL_WIDTH_KEY, String(Math.round(w))); } catch { /* noop */ }
}

type PressableRef = React.ElementRef<typeof View>;
type ViewRef = React.ElementRef<typeof View>;

interface UseMapPanelStateOptions {
  isMobile: boolean;
}

/**
 * Хук для управления состоянием панелей карты.
 * Управляет боковой панелью, вкладками и фокусом.
 */
export function useMapPanelState({ isMobile }: UseMapPanelStateOptions) {
  const isFocused = useIsFocused();
  const { isPanelVisible, openPanel, closePanel, panelStyle, overlayStyle } = usePanelController(isMobile);

  const [rightPanelTab, setRightPanelTab] = useState<'filters' | 'travels'>('filters');
  // On web, start map loading immediately — no need for rAF delay.
  const [mapReady, setMapReady] = useState(Platform.OS === 'web');

  // Desktop panel collapse (persisted)
  const [isDesktopCollapsed, setDesktopCollapsed] = useState(() => readPanelCollapsed());

  // Desktop panel width (persisted)
  const [desktopPanelWidth, setDesktopPanelWidth] = useState(() => readPanelWidth());
  const resizeRafRef = useRef<number | null>(null);
  const widthPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dispatchMapResize = useCallback(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (resizeRafRef.current != null) return;

    resizeRafRef.current = requestAnimationFrame(() => {
      resizeRafRef.current = null;
      window.dispatchEvent(new Event('resize'));
    });
  }, []);

  const schedulePersistPanelWidth = useCallback((width: number) => {
    if (Platform.OS !== 'web') return;
    if (widthPersistTimerRef.current) clearTimeout(widthPersistTimerRef.current);
    widthPersistTimerRef.current = setTimeout(() => {
      writePanelWidth(width);
      widthPersistTimerRef.current = null;
    }, 200);
  }, []);

  const onResizePanelWidth = useCallback((newWidth: number) => {
    const maxW = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.innerWidth * PANEL_MAX_WIDTH_RATIO
      : 600;
    const clamped = Math.max(PANEL_MIN_WIDTH, Math.min(newWidth, maxW));
    setDesktopPanelWidth((prev) => {
      if (Math.abs(prev - clamped) < 1) return prev;
      return clamped;
    });
    schedulePersistPanelWidth(clamped);
    if (!isMobile) {
      dispatchMapResize();
    }
  }, [dispatchMapResize, isMobile, schedulePersistPanelWidth]);

  const toggleDesktopCollapse = useCallback(() => {
    setDesktopCollapsed((prev) => {
      const next = !prev;
      writePanelCollapsed(next);
      if (!isMobile) {
        dispatchMapResize();
      }
      return next;
    });
  }, [dispatchMapResize, isMobile]);

  const lastIsMobileRef = useRef(isMobile);
  const filtersTabRef = useRef<PressableRef>(null);
  const panelRef = useRef<ViewRef>(null);

  // Синхронизация панели с режимом (mobile/desktop)
  useEffect(() => {
    if (lastIsMobileRef.current === isMobile) return;
    lastIsMobileRef.current = isMobile;

    if (isMobile) {
      closePanel();
    } else {
      openPanel();
    }
  }, [isMobile, openPanel, closePanel]);

  // Инициализация mapReady с задержкой для анимации
  useEffect(() => {
    if (mapReady) return;
    const frame = requestAnimationFrame(() => setMapReady(true));
    return () => cancelAnimationFrame(frame);
  }, [mapReady]);

  // Resize event for desktop web map when panel visibility changes
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (isMobile) return;
    dispatchMapResize();
  }, [dispatchMapResize, isPanelVisible, isMobile]);

  useEffect(() => {
    return () => {
      if (resizeRafRef.current != null) {
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
      if (widthPersistTimerRef.current) {
        clearTimeout(widthPersistTimerRef.current);
        widthPersistTimerRef.current = null;
      }
    };
  }, []);

  // Blur активного элемента при уходе со страницы
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (isFocused) return;

    const active = document.activeElement as HTMLElement | null;
    if (active && typeof active.blur === 'function') {
      active.blur();
    }
  }, [isFocused]);

  // Блокировка скролла body на mobile при открытой панели
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (!isMobile) return;

    const body = document.body;
    const prevOverflow = body.style.overflow;

    if (isPanelVisible) {
      body.style.overflow = 'hidden';
    } else {
      body.style.overflow = prevOverflow || '';
    }

    return () => {
      body.style.overflow = prevOverflow || '';
    };
  }, [isMobile, isPanelVisible]);

  // Автофокус на вкладку фильтров при открытии панели на mobile
  useEffect(() => {
    if (!isMobile || !isPanelVisible) return;

    const id = requestAnimationFrame(() => {
      const node = filtersTabRef.current;
      node?.focus?.();
    });

    return () => cancelAnimationFrame(id);
  }, [isMobile, isPanelVisible]);

  const selectFiltersTab = useCallback(() => setRightPanelTab('filters'), []);
  const selectTravelsTab = useCallback(() => setRightPanelTab('travels'), []);

  const closeRightPanel = useCallback(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const active = document.activeElement as HTMLElement | null;
      if (active && typeof active.blur === 'function') {
        active.blur();
      }
    }
    closePanel();
  }, [closePanel]);

  return useMemo(() => ({
    // State
    isFocused,
    mapReady,
    rightPanelTab,
    rightPanelVisible: isPanelVisible,
    isDesktopCollapsed,
    desktopPanelWidth,

    // Actions
    selectFiltersTab,
    selectTravelsTab,
    openRightPanel: openPanel,
    closeRightPanel,
    toggleDesktopCollapse,
    onResizePanelWidth,

    // Styles
    panelStyle,
    overlayStyle,

    // Refs
    filtersTabRef,
    panelRef,
  }), [
    isFocused,
    mapReady,
    rightPanelTab,
    isPanelVisible,
    isDesktopCollapsed,
    desktopPanelWidth,
    selectFiltersTab,
    selectTravelsTab,
    openPanel,
    closeRightPanel,
    toggleDesktopCollapse,
    onResizePanelWidth,
    panelStyle,
    overlayStyle,
    filtersTabRef,
    panelRef,
  ]);
}

/**
 * Хук для определения responsive параметров карты.
 */
export function useMapResponsive() {
  const { isPhone, isLargePhone, width } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  return useMemo(() => ({
    isMobile,
    width,
  }), [isMobile, width]);
}
