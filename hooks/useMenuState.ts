/**
 * Кастомный хук для управления состоянием бокового меню
 * Изолирует логику меню от UI-компонентов
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Animated, Easing, useWindowDimensions } from 'react-native';

export interface UseMenuStateReturn {
  menuOpen: boolean;
  toggleMenu: () => void;
  closeMenu: () => void;
  animatedX: Animated.Value;
  animateMenu: (open: boolean) => void;
  menuWidth: number | string;
  menuWidthNum: number;
  openMenuOnDesktop: () => void;
}

const MENU_WIDTH_DESKTOP = 280;
const MENU_WIDTH_TABLET = 240;

export function useMenuState(isMobile: boolean): UseMenuStateReturn {
  const { width } = useWindowDimensions();
  const [menuOpen, setMenuOpen] = useState(false);

  const menuWidth = useMemo(() => {
    if (isMobile) return '100%';
    return width >= 1200 ? MENU_WIDTH_DESKTOP : MENU_WIDTH_TABLET;
  }, [isMobile, width]);

  const menuWidthNum = typeof menuWidth === 'number' ? menuWidth : 0;

  const animatedX = useRef(new Animated.Value(isMobile ? -width : -menuWidthNum)).current;

  const animateMenu = useCallback(
    (open: boolean) => {
      const targetValue = isMobile ? (open ? 0 : -width) : (open ? 0 : -menuWidthNum);
      Animated.timing(animatedX, {
        toValue: targetValue,
        duration: 230,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [animatedX, isMobile, width, menuWidthNum]
  );

  const toggleMenu = useCallback(() => {
    const newState = !menuOpen;
    setMenuOpen(newState);
    animateMenu(newState);
  }, [menuOpen, animateMenu]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    animateMenu(false);
  }, [animateMenu]);

  // ✅ АРХИТЕКТУРА: Автоматически открываем меню на десктопе
  useEffect(() => {
    if (!isMobile) {
      animatedX.setValue(0);
      setMenuOpen(true);
    }
  }, [isMobile, animatedX]);

  // ✅ АРХИТЕКТУРА: Экспортируем функцию для внешнего управления (для deferAllowed)
  const openMenuOnDesktop = useCallback(() => {
    if (!isMobile) {
      animatedX.setValue(0);
      setMenuOpen(true);
    }
  }, [isMobile, animatedX]);

  return {
    menuOpen,
    toggleMenu,
    closeMenu,
    animatedX,
    animateMenu,
    menuWidth,
    menuWidthNum,
    openMenuOnDesktop,
  };
}

