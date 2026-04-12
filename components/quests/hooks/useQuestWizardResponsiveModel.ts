import { useMemo } from 'react'
import { Platform } from 'react-native'
import { useResponsive } from '@/hooks/useResponsive'

export type QuestWizardResponsiveModel = {
  screenW: number
  screenH: number
  isMobile: boolean
  isSmallScreen: boolean
  compactNav: boolean
  wideDesktop: boolean
  compactDesktopLayout: boolean
  useWideInlineLayout: boolean
  useWideExcursionsSidebar: boolean
  sidebarWidth: number
  mapPanelWidth: number
  answerPaneWidth: number
}

export function useQuestWizardResponsiveModel() {
  const { width, height, isMobile } = useResponsive()

  return useMemo<QuestWizardResponsiveModel>(() => {
    const isSmallScreen = width < 360
    const compactNav = width < 600
    const wideDesktop = width >= 1100
    const compactDesktopLayout = Platform.OS === 'web' && width >= 1280
    const useWideInlineLayout = wideDesktop
    const useWideExcursionsSidebar = wideDesktop && !compactDesktopLayout

    const sidebarWidth = width >= 1280 ? 340 : 300
    const mapPanelWidth = width >= 1280 ? 400 : 340
    const answerPaneWidth = Math.min(260, Math.max(200, width * 0.2))

    return {
      screenW: width,
      screenH: height,
      isMobile,
      isSmallScreen,
      compactNav,
      wideDesktop,
      compactDesktopLayout,
      useWideInlineLayout,
      useWideExcursionsSidebar,
      sidebarWidth,
      mapPanelWidth,
      answerPaneWidth,
    }
  }, [width, height, isMobile])
}
