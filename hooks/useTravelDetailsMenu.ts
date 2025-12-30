import { useEffect } from 'react'

import { useMenuState } from '@/hooks/useMenuState'

export interface UseTravelDetailsMenuReturn {
  closeMenu: () => void
  animatedX: ReturnType<typeof useMenuState>['animatedX']
  menuWidth: ReturnType<typeof useMenuState>['menuWidth']
  menuWidthNum: ReturnType<typeof useMenuState>['menuWidthNum']
}

export function useTravelDetailsMenu(isMobile: boolean, deferAllowed: boolean): UseTravelDetailsMenuReturn {
  const { closeMenu, animatedX, menuWidth, menuWidthNum, openMenuOnDesktop } = useMenuState(isMobile)

  useEffect(() => {
    if (deferAllowed && !isMobile) {
      openMenuOnDesktop()
    }
  }, [deferAllowed, isMobile, openMenuOnDesktop])

  return {
    closeMenu,
    animatedX,
    menuWidth,
    menuWidthNum,
  }
}
