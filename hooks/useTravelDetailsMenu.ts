import { useEffect, useMemo } from 'react'

import { useMenuState } from '@/hooks/useMenuState'

export interface UseTravelDetailsMenuReturn {
  closeMenu: () => void
  openMenu: () => void
  toggleMenu: () => void
  isMenuOpen: boolean
  animatedX: ReturnType<typeof useMenuState>['animatedX']
  menuWidth: ReturnType<typeof useMenuState>['menuWidth']
  menuWidthNum: ReturnType<typeof useMenuState>['menuWidthNum']
}

export function useTravelDetailsMenu(isMobile: boolean, deferAllowed: boolean): UseTravelDetailsMenuReturn {
  const { closeMenu, openMenu, toggleMenu, isMenuOpen, animatedX, menuWidth, menuWidthNum, openMenuOnDesktop } = useMenuState(isMobile)

  useEffect(() => {
    if (deferAllowed && !isMobile) {
      openMenuOnDesktop()
    }
  }, [deferAllowed, isMobile, openMenuOnDesktop])

  return useMemo(() => ({
    closeMenu,
    openMenu,
    toggleMenu,
    isMenuOpen,
    animatedX,
    menuWidth,
    menuWidthNum,
  }), [closeMenu, openMenu, toggleMenu, isMenuOpen, animatedX, menuWidth, menuWidthNum])
}
