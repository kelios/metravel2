import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useResponsive } from '@/hooks/useResponsive';
import { usePanelController } from '@/hooks/usePanelController';

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
  const [mapReady, setMapReady] = useState(false);

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

  // Resize event для web при изменении панели
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    window.dispatchEvent(new Event('resize'));
  }, [isPanelVisible, isMobile]);

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

  return {
    // State
    isFocused,
    mapReady,
    rightPanelTab,
    rightPanelVisible: isPanelVisible,

    // Actions
    selectFiltersTab,
    selectTravelsTab,
    openRightPanel: openPanel,
    closeRightPanel,

    // Styles
    panelStyle,
    overlayStyle,

    // Refs
    filtersTabRef,
    panelRef,
  };
}

/**
 * Хук для определения responsive параметров карты.
 */
export function useMapResponsive() {
  const { isPhone, isLargePhone, width } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  return {
    isMobile,
    width,
  };
}

