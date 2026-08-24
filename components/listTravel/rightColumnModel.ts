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
/*
 * #1487 (пересмотр 2026-08-24): медиа-слот карточки — единый квадрат
 * (`CARD_MEDIA_SLOT_RATIO`, решение владельца: каталог — ровная сетка), поэтому
 * высота строки снова ОДНО число: ширина карточки + ~87 px контента + gap.
 * Замер прода 2026-08-23 для квадратного ряда: desktop 1280 (3 колонки,
 * карточка 396) — 483; mobile 390 (одна колонка, карточка 368) — 455.
 */
export const WEB_ROW_HEIGHT_MOBILE = 455
export const WEB_ROW_HEIGHT_DESKTOP = 483
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
 * 560 давало 336 dp назад при карточке ~300 dp. #1487 (пересмотр 2026-08-24)
 * сделал медиа-бокс квадратным по ширине карточки: на типовых 360–412 dp
 * экранах медиа ≈ 330–380 dp, плюс ~90 dp контента — карточка выросла до
 * ~420–470 dp, и 336 dp запаса назад снова меньше ОДНОЙ карточки (ровно тот
 * рецикл-дефект, от которого уходили). Порог выводится из той же арифметики,
 * что и прежние 560: 0.6 × d ≥ 470 → d ≥ 784; вперёд 1.4 × 800 = 1120 dp ≈
 * 2.4 карточки. Окно остаётся ограниченным: 1120 ≤ 4 × 470.
 */
const NATIVE_LIST_DRAW_DISTANCE = 800

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
 *
 * Проверено на живом проде 2026-08-10 (трейс 1160 px вниз и обратно, throttle
 * 1.6 Мбит/150 мс): ниже опускать нечего. Начальная стоимость обложек —
 * ступенька, которая упирается не в drawDistance, а в горизонт выборки
 * `loading="lazy"`: desktop даёт 15 запросов / 996 930 байт на любом значении от
 * 560 до 720, mobile — 6 / 345 907 на любом от 500 до 600. Минимально проходящие
 * 560/500 стоят ровно столько же, но ломают инвариант «одна строка позади»
 * (`0.6 × d ≥ высота строки`), а следующая ступень вниз (420) уже даёт заливку
 * доминантным цветом на обеих ширинах. Регрессия — `#1263 search list scroll
 * reveal` в `e2e/prod-media-smoke.spec.ts`.
 *
 * #1487 поднял высоту строки, поэтому пересняты и значения. Свип `#1263` на
 * живом проде 2026-08-23 через `E2E_1263_DRAW_DISTANCE` (тот же трейс и тот же
 * закреплённый транспорт), числа — `afterReturn` requests/bytes:
 *   desktop: 720 → 18 / 2 924 169; 760 → 18 / 2 924 169; 820 → 18 / 2 924 169.
 *     Плато держится до 820 включительно, то есть новая строка 483 покупается
 *     БЕСПЛАТНО (`0.6 × 820 = 492 ≥ 483`).
 *   mobile:  600 → 6 / 775 560; 760 → 7 / 998 542; 820 → 8 / 1 101 624.
 *     Плато обрывается между 600 и 760: каждая ступень мостит ещё одну обложку
 *     вперёд. 760 — минимальное значение, закрывающее строку 455
 *     (`0.6 × 760 = 456 ≥ 455`), и оно на один запрос дешевле 820.
 * Оба значения держат окно ограниченным: `1.4 × d ≤ 4 × высота строки`.
 */
const WEB_LIST_DRAW_DISTANCE_MOBILE = 760
const WEB_LIST_DRAW_DISTANCE_DESKTOP = 820

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
