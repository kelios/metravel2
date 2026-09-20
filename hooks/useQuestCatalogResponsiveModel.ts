import { useMemo } from 'react'
import { useBreakpoints } from './useResponsive'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { QUESTS_GRID_MIN_COLUMN_WIDTH, QUESTS_LANDING_PADDING } from '@/constants/questLayout'

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

export type QuestCatalogResponsiveOptions = {
  /** По умолчанию сохраняется расчёт каталога; false включает сетку лендинга. */
  hasSidebar?: boolean
  /** Максимальная ширина контента без внешних отступов. */
  contentMaxWidth?: number
  /** Совпадает с зазором контейнера карточек. */
  columnGap?: number
}

export function useQuestCatalogResponsiveModel(
  questCount: number,
  { hasSidebar = true, contentMaxWidth, columnGap = spacing.lg }: QuestCatalogResponsiveOptions = {},
) {
  // #1826: только ширина. `useResponsive()` подписывает на полный снимок и
  // возвращает `true` на изменении ОДНОЙ высоты, а на мобильном вебе высота
  // меняется покадрово от клавиатуры и адресной строки — экран каталога
  // перерисовывался на каждый кадр и рвал ввод в поиске. Высоту эта модель не
  // читает ни разу, так что подписка на неё была чистой платой без пользы.
  const { width, isMobile, isTablet, isLargeTablet } = useBreakpoints()

  return useMemo<QuestCatalogResponsiveModel>(() => {
    const isSmallPhone = width < 360

    const sidebarWidth = hasSidebar ? (isTablet ? 280 : isLargeTablet ? 300 : 340) : 0
    const available = hasSidebar
      ? (isMobile ? width : Math.max(320, width - sidebarWidth - spacing.xl * 2))
      : Math.max(0, width - QUESTS_LANDING_PADDING * 2)
    const contentWidth = typeof contentMaxWidth === 'number' && Number.isFinite(contentMaxWidth)
      ? Math.min(available, contentMaxWidth)
      : available

    let cardColumns = 1
    if (!hasSidebar && !isMobile) {
      cardColumns = Math.max(1, Math.floor((contentWidth + columnGap) / (QUESTS_GRID_MIN_COLUMN_WIDTH + columnGap)))
    } else if (hasSidebar && !isMobile && contentWidth >= 640 && questCount >= 2) {
      cardColumns = 2
    }

    let cardWidth: number
    if (!hasSidebar) {
      // CSS получает это же число колонок: scrollbar не меняет раскладку
      // независимо от модели, а maxWidth карточки учитывает его ширину.
      cardWidth = (contentWidth - columnGap * (cardColumns - 1)) / cardColumns
    } else if (isMobile) {
      cardWidth = Math.max(280, width - spacing.lg * 2)
    } else if (cardColumns >= 2) {
      const twoColWidth = Math.floor((contentWidth - columnGap) / 2)
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
  }, [width, isMobile, isTablet, isLargeTablet, questCount, hasSidebar, contentMaxWidth, columnGap])
}
