import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing } from 'react-native'

export interface UseTravelDetailsMenuReturn {
  closeMenu: () => void
  openMenu: () => void
  toggleMenu: () => void
  isMenuOpen: boolean
  animatedX: Animated.Value
  menuWidth: number | string
  menuWidthNum: number
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function useTravelDetailsMenu(
  isMobile: boolean,
  deferAllowed: boolean,
  screenWidth: number,
): UseTravelDetailsMenuReturn {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const stableWidth = useMemo(() => {
    if (screenWidth && screenWidth > 0) return screenWidth
    if (typeof window !== 'undefined' && typeof window.innerWidth === 'number') return window.innerWidth
    return 1200
  }, [screenWidth])

  const menuWidth = useMemo(() => {
    if (isMobile) return '100%'
    const desired = Math.round(stableWidth * 0.24)
    return clamp(desired, 288, 412)
  }, [isMobile, stableWidth])

  const menuWidthNum = typeof menuWidth === 'number' ? menuWidth : 0
  const animatedX = useRef(new Animated.Value(isMobile ? -stableWidth : -menuWidthNum)).current

  const animateMenu = useCallback(
    (open: boolean) => {
      const targetValue = isMobile ? (open ? 0 : -stableWidth) : (open ? 0 : -menuWidthNum)
      Animated.timing(animatedX, {
        toValue: targetValue,
        duration: 230,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start()
    },
    [animatedX, isMobile, stableWidth, menuWidthNum]
  )

  const openMenu = useCallback(() => {
    setIsMenuOpen(true)
    animateMenu(true)
  }, [animateMenu])

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false)
    animateMenu(false)
  }, [animateMenu])

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => {
      const next = !prev
      animateMenu(next)
      return next
    })
  }, [animateMenu])

  const openMenuOnDesktop = useCallback(() => {
    if (!isMobile) {
      animatedX.setValue(0)
      setIsMenuOpen(true)
    }
  }, [animatedX, isMobile])

  useEffect(() => {
    if (!isMobile) {
      animatedX.setValue(0)
      setIsMenuOpen(true)
      return
    }

    animatedX.setValue(-stableWidth)
    setIsMenuOpen(false)
  }, [animatedX, isMobile, stableWidth])

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
