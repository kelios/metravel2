/**
 * Кастомный хук для управления состоянием бокового меню
 * Изолирует логику меню от UI-компонентов
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Animated, Easing } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';

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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function useMenuState(isMobile: boolean): UseMenuStateReturn {
  const { width } = useResponsive();
  const [menuOpen, setMenuOpen] = useState(false);

  const stableWidth = useMemo(() => {
    if (width && width > 0) return width;
    if (typeof window !== 'undefined' && typeof window.innerWidth === 'number') return window.innerWidth;
    return 1200;
  }, [width]);

  const menuWidth = useMemo(() => {
    if (isMobile) return '100%';
    // Web/desktop: allow the sidebar to grow beyond 350px on wide screens.
    // Keep a reasonable range so it doesn't dominate the layout.
    // Examples: 1200px -> 336px, 1440px -> 403px, 1600px -> 448px.
    const desired = Math.round(stableWidth * 0.28);
    return clamp(desired, 320, 480);
  }, [isMobile, stableWidth]);

  const menuWidthNum = typeof menuWidth === 'number' ? menuWidth : 0;

  const animatedX = useRef(new Animated.Value(isMobile ? -stableWidth : -menuWidthNum)).current;

  const animateMenu = useCallback(
    (open: boolean) => {
      const targetValue = isMobile ? (open ? 0 : -stableWidth) : (open ? 0 : -menuWidthNum);
      Animated.timing(animatedX, {
        toValue: targetValue,
        duration: 230,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [animatedX, isMobile, stableWidth, menuWidthNum]
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

