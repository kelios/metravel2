import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import * as RN from 'react-native';
import { useMenuState } from '@/hooks/useMenuState';

describe('useMenuState', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Мокаем анимацию, чтобы сразу устанавливать конечное значение
    jest.spyOn(RN.Animated, 'timing').mockImplementation(((value: any, config: any) => ({
      start: (cb?: () => void) => {
        value.setValue(config.toValue);
        if (cb) cb();
      },
    })) as any);
  });

  it('initializes desktop menu as open with correct width', () => {
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 1400, height: 800 } as any);

    const { result } = renderHook(() => useMenuState(false));

    expect(result.current.menuOpen).toBe(true);
    // При текущей ширине по умолчанию из setup.ts используется TABLET-ширина
    expect(result.current.menuWidth).toBe(240);
    expect(result.current.menuWidthNum).toBe(240);
  });

  it('toggles menu open/close on mobile and animates position', () => {
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
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 1280, height: 800 } as any);

    const { result } = renderHook(() => useMenuState(false));

    act(() => {
      result.current.openMenuOnDesktop();
    });

    expect(result.current.menuOpen).toBe(true);
  });
});
