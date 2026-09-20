import { useMemo } from 'react'
import { useBreakpoints } from './useResponsive'
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

/**
 * Опции модели. `hasSidebar` — единственное, что отличает каталог `/quests` от
 * лендингов города и страны: у каталога сайдбар есть, у лендингов его нет.
 */
export type QuestCatalogResponsiveOptions = {
  /**
   * Вычитать ли из ширины экрана сайдбар каталога. По умолчанию `true` —
   * историческое поведение хука, на котором стоит `/quests`.
   *
   * #1989: знание о сайдбаре было зашито внутрь, и лендинги страны и города,
   * взявшие хук ради `cardWidth`, вместе с ним взяли вычет ЧУЖОГО сайдбара:
   * карточка считалась для узкой колонки каталога, а грид раскладывался по
   * полной ширине страницы, и между колонками зияла дыра.
   */
  hasSidebar?: boolean
  /**
   * Потолок ширины контента страницы, если он у неё свой. Лендинги страны и
   * города ограничивают колонку собственной константой (840 и 760), и без неё
   * модель делила ширину, которой на странице нет: карточка выходила шире
   * трека грида.
   */
  contentMaxWidth?: number
  /**
   * Зазор между колонками. По умолчанию `spacing.lg` — так делит native-грид;
   * web-грид каталога шире (`QUESTS_GRID_WEB_GAP`), и страница, которая рисует
   * его на web, обязана передать тот же зазор, иначе карточка и трек разойдутся.
   */
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
    const available = isMobile ? width : Math.max(320, width - sidebarWidth - spacing.xl * 2)
    const contentWidth = Number.isFinite(contentMaxWidth)
      ? Math.min(available, contentMaxWidth as number)
      : available

    let cardColumns = 1
    if (!isMobile && contentWidth >= 640 && questCount >= 2) {
      cardColumns = 2
    }

    let cardWidth: number
    if (isMobile) {
      cardWidth = Math.max(280, width - spacing.lg * 2)
    } else if (cardColumns >= 2) {
      // Ровно то же деление, что делает CSS-грид над этим же контейнером:
      // расхождение здесь и означает дыру между карточкой и её колонкой.
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
