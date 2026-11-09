import { SEMANTIC_ACTION_ICON } from '@/components/navigation/navigationActionMeta'
import { translate as i18nT } from '@/i18n'

import type { ActionChip } from './PlaceListCard.types'

type ActionModelInput = {
  /** #2778: ≤3 подписанных действия в ряду (главное + до двух), остальное — «⋯». */
  actionBudget?: boolean
  hasCoord: boolean
  inlineActions: ActionChip[]
  isCompactActionCard: boolean
  mapActions: ActionChip[]
  onCopyCoord?: () => void
  onShare?: () => void
  menuActions: ActionChip[]
  popupAligned: boolean
  quickActions: ActionChip[]
  /**
   * Ссылка на готовую книгу места. Идёт в ряд/лист вместе с остальными действиями,
   * то есть под тем же бюджетом плиток; карточке без ряда действий — отдельной иконкой.
   */
  relatedBookAction?: ActionChip | null
  relatedTravelUrl?: string | null
  showActionRow: boolean
  showTitleInContent: boolean
}

/** Пункт «Скопировать координаты» — общий для «⋯» карточки и строки места (#3142). */
export const buildCopyCoordAction = (onPress: () => void): ActionChip => ({
  key: 'copy-coord',
  label: i18nT('map:components.places.PlaceListCard.skopirovat_koordinaty_6eaf9e07'),
  icon: 'copy',
  onPress,
})

/** Пункт «Поделиться в Telegram» листа «⋯»; `label` короткий для плитки ряда. */
export const buildTelegramShareAction = (onPress: () => void, label?: string): ActionChip => ({
  key: 'share',
  label: label ?? i18nT('map:components.places.PlaceListCard.podelitsya_v_telegram_a5cebf19'),
  icon: SEMANTIC_ACTION_ICON.telegramShare,
  onPress,
  accessibilityLabel: i18nT('map:components.places.PlaceListCard.podelitsya_v_telegram_a5cebf19'),
  title: i18nT('map:components.places.PlaceListCard.podelitsya_v_telegram_a5cebf19'),
})

/**
 * Плиток в ряду при `actionBudget` ВСЕГО — вместе со входом в лист «Навигация и
 * действия» (#2778, приёмка: четыре плитки на 320 резали подписи). «Сохранить»
 * в ряду больше нет: точку сохраняет ♥ на фото (08.11.2026).
 */
export const PLACE_CARD_ROW_TILE_BUDGET = 3

export function buildPlaceListCardActionModel({
  relatedBookAction = null,
  ...input
}: ActionModelInput) {
  const base = buildRowModel(input)
  // Книга не заводит ряд действий там, где его не было (карточка остаётся компактной).
  if (!relatedBookAction || !base.hasActionRow) {
    return { ...base, showStandaloneRelatedBook: Boolean(relatedBookAction) }
  }
  return {
    ...buildRowModel({ ...input, inlineActions: [...input.inlineActions, relatedBookAction] }),
    showStandaloneRelatedBook: false,
  }
}

function buildRowModel({
  actionBudget = false,
  hasCoord,
  inlineActions,
  isCompactActionCard,
  mapActions,
  onCopyCoord,
  onShare,
  menuActions,
  popupAligned,
  quickActions,
  relatedTravelUrl,
  showActionRow,
  showTitleInContent,
}: Omit<ActionModelInput, 'relatedBookAction'>) {
  // #2778 (PLACE-CARD-ACTION-OVERLOAD): бюджет действует на компактной
  // popup-aligned карточке (`/places`, «Места рядом»). В ряду — главное действие
  // и вторичные с полными подписями, всего не больше трёх;
  // координаты, Telegram, лишние ссылки и навигаторы — пункты «⋯».
  const budgeted = actionBudget && isCompactActionCard && popupAligned
  const showTitleShare = !budgeted && popupAligned && hasCoord && Boolean(onShare)
  const shareOverflowAction: ActionChip | null =
    isCompactActionCard && !showTitleShare && hasCoord && onShare
      ? buildTelegramShareAction(onShare, i18nT('map:components.places.PlaceListCard.telegram_5a2f6e04'))
      : null
  const visibleMapActions = isCompactActionCard ? [] : mapActions
  const primaryActions = budgeted ? [...inlineActions, ...quickActions] : []
  const copyOverflowAction: ActionChip | null =
    budgeted && hasCoord && onCopyCoord ? buildCopyCoordAction(onCopyCoord) : null
  // Всё, что живёт только в листе, — навигаторы, координаты, Telegram, правка.
  const sheetOnlyCount =
    mapActions.length + (copyOverflowAction ? 1 : 0) + (shareOverflowAction ? 1 : 0) + menuActions.length
  // Плитка листа нужна, если в нём что-то есть или основные не влезают целиком.
  const needsSheet = sheetOnlyCount > 0 || primaryActions.length > PLACE_CARD_ROW_TILE_BUDGET
  const primarySlots = Math.max(0, PLACE_CARD_ROW_TILE_BUDGET - (needsSheet ? 1 : 0))
  const visibleInlineActions = budgeted
    ? primaryActions.slice(0, primarySlots)
    : isCompactActionCard
      ? popupAligned ? inlineActions : []
      : inlineActions
  // Бюджет: сначала то, что не влезло в ряд, потом навигаторы и служебное.
  const budgetOverflow = budgeted
    ? [
        ...primaryActions.slice(primarySlots),
        ...mapActions,
        ...(copyOverflowAction ? [copyOverflowAction] : []),
        ...(shareOverflowAction ? [shareOverflowAction] : []),
      ]
    : null
  const overflowActions = [
    ...(budgetOverflow ??
      (isCompactActionCard
        ? [
            ...(shareOverflowAction ? [shareOverflowAction] : []),
            ...mapActions,
            ...(popupAligned ? [] : inlineActions),
          ]
        : [])),
    // #2101: правка/удаление объекта — «⋯» на любой раскладке, destructive последним.
    ...menuActions,
  ]
  const overflowHasMapActions = isCompactActionCard && mapActions.length > 0
  const showShareChip = !isCompactActionCard && hasCoord && Boolean(onShare)
  const showCopyChip = !budgeted && hasCoord && Boolean(onCopyCoord)
  const showRowQuickActions = !budgeted && popupAligned && quickActions.length > 0
  const hasActionRow = showActionRow && (
    showRowQuickActions ||
    showCopyChip ||
    showShareChip ||
    visibleMapActions.length > 0 ||
    visibleInlineActions.length > 0 ||
    overflowActions.length > 0
  )

  return {
    hasActionRow,
    overflowActionLabel: overflowHasMapActions
      ? i18nT('map:components.places.PlaceListCard.navigatsiya_fa115805')
      : i18nT('map:components.places.PlaceListCard.esche_16276b19'),
    overflowActionTitle: overflowHasMapActions
      ? i18nT('map:components.places.PlaceListCard.navigatsiya_i_deystviya_777daf07')
      : i18nT('map:components.places.PlaceListCard.esche_deystviya_6f82137f'),
    overflowActions,
    overflowHasMapActions,
    showInlineRelatedTravelActions: !popupAligned && Boolean(relatedTravelUrl) && showTitleInContent,
    showCopyChip,
    showRowQuickActions,
    showShareChip,
    showTitleShare,
    visibleInlineActions,
    visibleMapActions,
  }
}
