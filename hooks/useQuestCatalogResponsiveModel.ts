import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Platform, type LayoutChangeEvent, type ViewInstance } from 'react-native'
import { useBreakpoints } from './useResponsive'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { QUESTS_GRID_MIN_COLUMN_WIDTH, QUESTS_GRID_WEB_GAP, QUESTS_LANDING_PADDING } from '@/constants/questLayout'

const { spacing } = DESIGN_TOKENS
const useWebLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

// Only what the catalog and the country landing read: map height, title sizes
// and friends were computed here and never read (#2741 dropped them).
export type QuestCatalogResponsiveModel = {
  isMobile: boolean
  cardColumns: number
  cardWidth: number
}

export type QuestCatalogResponsiveOptions = {
  /** По умолчанию сохраняется расчёт каталога; false включает сетку лендинга. */
  hasSidebar?: boolean
  /** Максимальная ширина контента без внешних отступов. */
  contentMaxWidth?: number
  /** Совпадает с зазором контейнера карточек. */
  columnGap?: number
}

/**
 * Трек CSS-сетки `repeat(auto-fill, minmax(min(100%, 380px), 1fr))`: колонок
 * столько, сколько минимумов влезает с зазорами, остаток делится поровну.
 */
export function getQuestGridTrack(containerWidth: number, columnGap = QUESTS_GRID_WEB_GAP) {
  const columns = Math.max(1, Math.floor((containerWidth + columnGap) / (QUESTS_GRID_MIN_COLUMN_WIDTH + columnGap)))
  return { columns, cardWidth: (containerWidth - columnGap * (columns - 1)) / columns }
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
    const sidebarWidth = hasSidebar ? (isTablet ? 280 : isLargeTablet ? 300 : 340) : 0
    const available = hasSidebar
      ? (isMobile ? width : Math.max(320, width - sidebarWidth - spacing.xl * 2))
      : Math.max(0, width - QUESTS_LANDING_PADDING * 2)
    const contentWidth = typeof contentMaxWidth === 'number' && Number.isFinite(contentMaxWidth)
      ? Math.min(available, contentMaxWidth)
      : available

    const landingTrack = hasSidebar ? null : getQuestGridTrack(contentWidth, columnGap)
    let cardColumns = landingTrack?.columns ?? 1
    if (hasSidebar && !isMobile && contentWidth >= 640 && questCount >= 2) {
      cardColumns = 2
    }

    let cardWidth: number
    if (landingTrack) {
      // CSS получает это же число колонок: scrollbar не меняет раскладку
      // независимо от модели, а maxWidth карточки учитывает его ширину.
      cardWidth = landingTrack.cardWidth
    } else if (isMobile) {
      cardWidth = Math.max(280, width - spacing.lg * 2)
    } else if (cardColumns >= 2) {
      const twoColWidth = Math.floor((contentWidth - columnGap) / 2)
      cardWidth = Math.max(280, Math.min(420, twoColWidth))
    } else {
      cardWidth = Math.min(600, contentWidth)
    }

    return { isMobile, cardColumns, cardWidth }
  }, [width, isMobile, isTablet, isLargeTablet, questCount, hasSidebar, contentMaxWidth, columnGap])
}

/**
 * #2005: на web карточка каталога берёт ширину трека ИЗМЕРЕННОЙ сетки. Модель
 * оценивает контейнер от вьюпорта и не знает отступов панели: на 1024 она
 * считала 660 при реальных 606 и клала карточку 318 в колонку 606. На native
 * сетка раскладывается по модели, там отдаётся `fallbackWidth`.
 */
export function useQuestGridCardWidth(fallbackWidth: number, enabled: boolean) {
  const isWeb = Platform.OS === 'web'
  const gridRef = useRef<ViewInstance>(null)
  const gridWidthRef = useRef(0)
  const [gridWidth, setGridWidth] = useState(0)

  // onLayout сетки приходит на каждое раскрытие окна по высоте. Та же ширина
  // отсекается до setState: updater `prev === next ? prev : next` всё равно
  // стоил бы React повторного прохода по панели. Ноль приходит от скрытой сетки
  // (display: none у неактивной вкладки, пока открыт квест) и не заменяет
  // последний замер: иначе возврат в каталог рисовал бы кадр с шириной модели.
  // Округление только вниз: границы колонок `k·412 − 32` целые, поэтому floor
  // сохраняет число колонок CSS, а карточка уже трека меньше чем на 1 px.
  const commitGridWidth = useCallback((width: number) => {
    const next = Math.floor(width)
    if (next <= 0 || next === gridWidthRef.current) return
    gridWidthRef.current = next
    setGridWidth(next)
  }, [])

  // Ширина — с узла, а не из события: onLayout RNW отдаёт `offsetWidth`,
  // округлённый до пикселя, и дробный контейнер у границы колонок (791.6 при
  // масштабе 125 %) стал бы 792 — две колонки вместо одной у CSS.
  const measureGrid = useCallback((fallback: number) => {
    const node: unknown = gridRef.current
    commitGridWidth(node instanceof HTMLElement ? node.getBoundingClientRect().width : fallback)
  }, [commitGridWidth])

  // Первый замер — до отрисовки: onLayout в RNW приходит из ResizeObserver
  // уже после кадра с шириной модели, это был бы видимый скачок и CLS.
  useWebLayoutEffect(() => {
    if (isWeb && enabled) measureGrid(0)
  }, [enabled, isWeb, measureGrid])

  const onGridLayout = useCallback((event: LayoutChangeEvent) => {
    if (isWeb) measureGrid(event.nativeEvent.layout.width)
  }, [isWeb, measureGrid])

  const cardWidth = isWeb && enabled && gridWidth > 0 ? getQuestGridTrack(gridWidth).cardWidth : fallbackWidth
  return { gridRef, onGridLayout, cardWidth }
}
