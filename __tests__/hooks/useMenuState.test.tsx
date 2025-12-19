import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import * as RN from 'react-native';
import { useMenuState } from '@/hooks/useMenuState';

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () =>
    (global as any).__mockResponsive ?? {
      width: 1024,
      height: 768,
      isSmallPhone: false,
      isPhone: false,
      isLargePhone: false,
      isTablet: false,
      isLargeTablet: false,
      isDesktop: true,
      isMobile: false,
      isPortrait: false,
      isLandscape: true,
      orientation: 'landscape',
      breakpoints: {},
      isAtLeast: () => true,
      isAtMost: () => false,
      isBetween: () => false,
    },
}));

describe('useMenuState', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (global as any).__mockResponsive = {
      width: 1024,
      height: 768,
      isSmallPhone: false,
      isPhone: false,
      isLargePhone: false,
      isTablet: false,
      isLargeTablet: false,
      isDesktop: true,
      isMobile: false,
      isPortrait: false,
      isLandscape: true,
      orientation: 'landscape',
      breakpoints: {},
      isAtLeast: () => true,
      isAtMost: () => false,
      isBetween: () => false,
    };

    // Мокаем анимацию, чтобы сразу устанавливать конечное значение
    jest.spyOn(RN.Animated, 'timing').mockImplementation(((value: any, config: any) => ({
      start: (cb?: () => void) => {
        value.setValue(config.toValue);
        if (cb) cb();
      },
    })) as any);
  });

  it('initializes desktop menu as open with correct width', () => {
    (global as any).__mockResponsive = {
      ...(global as any).__mockResponsive,
      width: 1400,
      height: 800,
    };
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 1400, height: 800 } as any);

    const { result } = renderHook(() => useMenuState(false));

    expect(result.current.menuOpen).toBe(true);
    // На десктопных ширинах используем более широкое меню
    expect(result.current.menuWidth).toBe(280);
    expect(result.current.menuWidthNum).toBe(280);
  });

  it('toggles menu open/close on mobile and animates position', () => {
    (global as any).__mockResponsive = {
      ...(global as any).__mockResponsive,
      width: 400,
      height: 800,
      isDesktop: false,
      isMobile: true,
      isPortrait: true,
      isLandscape: false,
      orientation: 'portrait',
    };
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 400, height: 800 } as any);

    const { result } = renderHook(() => useMenuState(true));

    // Изначально меню закрыто
    expect(result.current.menuOpen).toBe(false);

    // Открываем меню
    act(() => {
      result.current.toggleMenu();
    });
    expect(result.current.menuOpen).toBe(true);

    // Закрываем меню
    act(() => {
      result.current.closeMenu();
    });
    expect(result.current.menuOpen).toBe(false);
  });

  it('openMenuOnDesktop forces menu open on desktop', () => {
    (global as any).__mockResponsive = {
      ...(global as any).__mockResponsive,
      width: 1280,
      height: 800,
    };
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 1280, height: 800 } as any);

    const { result } = renderHook(() => useMenuState(false));

    act(() => {
      result.current.openMenuOnDesktop();
    });

    expect(result.current.menuOpen).toBe(true);
  });
});
