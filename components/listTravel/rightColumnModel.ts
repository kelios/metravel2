import { Platform, type ViewStyle } from 'react-native'
import type { Travel } from '@/types/types'

export const RECOMMENDATIONS_TOTAL_HEIGHT = 376
export const STABLE_PLACEHOLDER_HEIGHT = 1200
export const TOP_SCROLL_PADDING = 8

/**
 * Заявленная высота строки ленты. Один источник правды и для
 * `content-visibility` (`contain-intrinsic-size`), и для расчёта запаса
 * прокрутки ниже: если высота строки поедет, тесты lookahead упадут вместе с ней.
 */
export const WEB_ROW_HEIGHT_MOBILE = 340
export const WEB_ROW_HEIGHT_DESKTOP = 420
export const WEB_ROW_INTRINSIC_SIZE_MOBILE = `auto ${WEB_ROW_HEIGHT_MOBILE}px`
export const WEB_ROW_INTRINSIC_SIZE_DESKTOP = `auto ${WEB_ROW_HEIGHT_DESKTOP}px`

/**
 * Native lookahead FlashList для ленты карточек.
 *
 * FlashList v2 держит буфер `drawDistance * 2` и делит его по направлению скролла
 * 0.3 назад / 0.7 вперёд (`RVEngagedIndicesTrackerImpl`). Значит реальный запас
 * назад — `0.6 * drawDistance`, вперёд — `1.4 * drawDistance`.
 *
 * Замер Pixel 10 Pro (2026-08-05, `/search`): карточка поиска занимает 736–814 px
 * при DPR 2.625, то есть ~280–310 dp. При прежних 180 запас был 108 dp назад и
 * 252 dp вперёд — меньше ОДНОЙ карточки в обе стороны. Из-за этого каждый шаг
 * прокрутки рециклил ячейку: `expo-image` на смене `recyclingKey` очищает вью,
 * поэтому карточка сначала показывала плейсхолдер и только потом фото — и при
 * возврате назад на один экран картинка перерисовывалась заново (лог `[IMGDBG]`:
 * 7 `recycle` + 7 `load` вниз и те же 7 обратно за 4 свайпа).
 *
 * 560 даёт 336 dp назад (возврат на карточку не рециклит) и 784 dp вперёд
 * (следующие ~2.5 карточки успевают декодировать до появления в кадре).
 */
const NATIVE_LIST_DRAW_DISTANCE = 560

/**
 * Web lookahead выводится из той же высоты строки и того же деления буфера.
 *
 * Прежние 160/180 были короче ОДНОЙ строки: на десктопе назад оставалось
 * `0.6 × 180 = 108` px при строке 420 px, вперёд `1.4 × 180 = 252` px. Замер на
 * проде (2026-08-08, 1280×900, прокрутка на 1160 px) показал, что все 6 из 6
 * въехавших обложек имели `opacity: 0`, пустой `currentSrc` и `naturalWidth: 0`
 * через 100 мс — правильное фото появлялось только к ~600 мс. Гейт владения
 * источником из #1294 работает верно (чужое фото не показывается), но окно
 * планирования слишком короткое, и пользователь видит заливку доминантным цветом.
 *
 * Нижние границы при делении 0.6 назад / 1.4 вперёд:
 *   desktop: назад `420 / 0.6 = 700`, вперёд `(2 × 420) / 1.4 = 600` → 720
 *   mobile:  назад `340 / 0.6 ≈ 567`, вперёд `(2 × 340) / 1.4 ≈ 486` → 600
 *
 * Значения держат ровно одну строку позади и две впереди — окно ограничено и не
 * растёт с числом результатов, поэтому пагинация и бюджет байтов не страдают.
 */
const WEB_LIST_DRAW_DISTANCE_MOBILE = 600
const WEB_LIST_DRAW_DISTANCE_DESKTOP = 720

export function getRightColumnVirtualizationConfig(isWeb: boolean, isMobile: boolean) {
  if (!isWeb) {
    return { drawDistance: NATIVE_LIST_DRAW_DISTANCE }
  }

  return {
    drawDistance: isMobile ? WEB_LIST_DRAW_DISTANCE_MOBILE : WEB_LIST_DRAW_DISTANCE_DESKTOP,
  }
}

export function getRightColumnColumns(gridColumns: number, isMobile: boolean) {
  return Math.max(1, (isMobile ? 1 : gridColumns) || 1)
}

export function buildTravelRows(travels: Travel[], gridColumns: number, isMobile: boolean) {
  const cols = getRightColumnColumns(gridColumns, isMobile)
  const result: Travel[][] = []

  for (let index = 0; index < travels.length; index += cols) {
    result.push(travels.slice(index, index + cols))
  }

  return result
}

export function getRightColumnHeaderMinHeight(isMobile: boolean) {
  if (Platform.OS === 'web') {
    return isMobile ? 50 : 76
  }

  return 52
}

export function getWebRowIntrinsicSize(isMobile: boolean) {
  return isMobile ? WEB_ROW_INTRINSIC_SIZE_MOBILE : WEB_ROW_INTRINSIC_SIZE_DESKTOP
}

type RightColumnComparableProps = {
  activeConditionChips?: unknown
  activeFiltersCount: number
  cardSpacing?: number
  contentPadding: number
  getEmptyStateMessage?: unknown
  gridColumns: number
  isError: boolean
  isExport?: boolean
  isCompactToolbar?: boolean
  isMobile: boolean
  isMobileViewport?: boolean
  isRecommendationsVisible: boolean
  isSearchPending?: boolean
  onEndReached?: unknown
  onFiltersPress?: unknown
  refetch?: unknown
  renderItem: unknown
  search: string
  showEmptyState: boolean
  showInitialLoading: boolean
  showNextPageLoading: boolean
  showStatusModeToggle?: boolean
  statusMode?: string
  onStatusModeChange?: unknown
  topContent?: unknown
  total: number
  travels: Travel[]
  sortOptions?: unknown
  onSortChange?: unknown
  onDensityChange?: unknown
  primaryAction?: unknown
  sortValue?: string
  density?: string
  showDensityToggle?: boolean
}

export function areRightColumnPropsEqual(
  prev: RightColumnComparableProps,
  next: RightColumnComparableProps,
) {
  return (
    prev.search === next.search &&
    prev.total === next.total &&
    prev.travels === next.travels &&
    prev.topContent === next.topContent &&
    prev.activeConditionChips === next.activeConditionChips &&
    prev.renderItem === next.renderItem &&
    prev.gridColumns === next.gridColumns &&
    prev.isMobile === next.isMobile &&
    prev.isMobileViewport === next.isMobileViewport &&
    prev.contentPadding === next.contentPadding &&
    prev.cardSpacing === next.cardSpacing &&
    prev.showInitialLoading === next.showInitialLoading &&
    prev.isSearchPending === next.isSearchPending &&
    prev.isError === next.isError &&
    prev.isExport === next.isExport &&
    prev.isCompactToolbar === next.isCompactToolbar &&
    prev.onFiltersPress === next.onFiltersPress &&
    prev.showEmptyState === next.showEmptyState &&
    prev.showNextPageLoading === next.showNextPageLoading &&
    prev.activeFiltersCount === next.activeFiltersCount &&
    prev.isRecommendationsVisible === next.isRecommendationsVisible &&
    prev.getEmptyStateMessage === next.getEmptyStateMessage &&
    prev.onEndReached === next.onEndReached &&
    prev.refetch === next.refetch &&
    prev.sortValue === next.sortValue &&
    prev.sortOptions === next.sortOptions &&
    prev.onSortChange === next.onSortChange &&
    prev.onDensityChange === next.onDensityChange &&
    prev.primaryAction === next.primaryAction &&
    prev.density === next.density &&
    prev.showDensityToggle === next.showDensityToggle &&
    prev.statusMode === next.statusMode &&
    prev.onStatusModeChange === next.onStatusModeChange &&
    prev.showStatusModeToggle === next.showStatusModeToggle
  )
}

export function getRightColumnWebRowBaseStyle(params: {
  cardSpacing: number
  isExport: boolean
  isMobile: boolean
}): ViewStyle {
  return {
    alignItems: 'stretch',
    columnGap: params.cardSpacing,
    flexWrap: 'wrap',
    maxWidth: '100%',
    minWidth: 0,
    rowGap: params.cardSpacing,
    width: '100%',
    ...(Platform.OS === 'web' && !params.isExport
      ? ({
          containIntrinsicSize: getWebRowIntrinsicSize(params.isMobile),
          contentVisibility: 'auto',
        } as any)
      : null),
  } as ViewStyle
}
