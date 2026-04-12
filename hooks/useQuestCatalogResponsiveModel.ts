import { useMemo } from 'react'
import { useResponsive } from './useResponsive'
import { DESIGN_TOKENS } from '@/constants/designSystem'

const { spacing } = DESIGN_TOKENS

export type QuestCatalogResponsiveModel = {
  isMobile: boolean
  isSmallPhone: boolean
  isTablet: boolean
  screenWidth: number
  sidebarWidth: number
  cardColumns: number
  cardWidth: number
  gridMinColumnWidth: number
  mapHeight: number
  cardImageHeight: number
  headerTitleSize: number
  contentTitleSize: number
}

export function useQuestCatalogResponsiveModel(questCount: number) {
  const { width, isMobile, isTablet, isLargeTablet } = useResponsive()

  return useMemo<QuestCatalogResponsiveModel>(() => {
    const isSmallPhone = width < 360

    const sidebarWidth = isTablet ? 280 : isLargeTablet ? 300 : 340
    const contentWidth = isMobile
      ? width
      : Math.max(320, width - sidebarWidth - spacing.xl * 2)

    let cardColumns = 1
    if (!isMobile && contentWidth >= 640 && questCount >= 2) {
      cardColumns = 2
    }

    let cardWidth: number
    if (isMobile) {
      cardWidth = Math.max(280, width - spacing.lg * 2)
    } else if (cardColumns >= 2) {
      const twoColWidth = Math.floor((contentWidth - spacing.lg) / 2)
      cardWidth = Math.max(280, Math.min(420, twoColWidth))
    } else {
      cardWidth = Math.min(600, contentWidth)
    }

    const gridMinColumnWidth = cardColumns >= 2 ? 300 : contentWidth

    const mapHeight = isMobile
      ? Math.min(420, Math.max(280, width * 0.7))
      : Math.min(620, Math.max(400, width * 0.35))

    const cardImageHeight = isMobile ? 220 : 260

    const headerTitleSize = isMobile ? 20 : 26
    const contentTitleSize = isMobile ? 20 : 28

    return {
      isMobile,
      isSmallPhone,
      isTablet,
      screenWidth: width,
      sidebarWidth,
      cardColumns,
      cardWidth,
      gridMinColumnWidth,
      mapHeight,
      cardImageHeight,
      headerTitleSize,
      contentTitleSize,
    }
  }, [width, isMobile, isTablet, isLargeTablet, questCount])
}
