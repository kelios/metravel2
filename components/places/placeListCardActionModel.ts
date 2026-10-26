import type Feather from '@expo/vector-icons/Feather'

import { SEMANTIC_ACTION_ICON } from '@/components/navigation/navigationActionMeta'
import type { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

import type { ActionChip } from './PlaceListCard.types'

type ActionModelInput = {
  /** #2778: ≤3 подписанных действия в ряду (главное + до двух), остальное — «⋯». */
  actionBudget?: boolean
  addButtonPlacement: 'button' | 'row'
  addLabel: string
  colors: ReturnType<typeof useThemedColors>
  hasCoord: boolean
  inlineActions: ActionChip[]
  isAdding: boolean
  isCompactActionCard: boolean
  isSaved: boolean
  mapActions: ActionChip[]
  onAddPoint?: () => void
  onCopyCoord?: () => void
  onShare?: () => void
  menuActions: ActionChip[]
  popupAligned: boolean
  quickActions: ActionChip[]
  relatedTravelUrl?: string | null
  showActionRow: boolean
  showAddButton: boolean
  showTitleInContent: boolean
}

/** Подписанных действий в ряду при `actionBudget`, не считая «⋯» и «Сохранить». */
export const PLACE_CARD_VISIBLE_PRIMARY_ACTIONS = 2

export function buildPlaceListCardActionModel({
  actionBudget = false,
  addButtonPlacement,
  addLabel,
  colors,
  hasCoord,
  inlineActions,
  isAdding,
  isCompactActionCard,
  isSaved,
  mapActions,
  onAddPoint,
  onCopyCoord,
  onShare,
  menuActions,
  popupAligned,
  quickActions,
  relatedTravelUrl,
  showActionRow,
  showAddButton,
  showTitleInContent,
}: ActionModelInput) {
  const overlayAddInline = isCompactActionCard && addButtonPlacement === 'row'
  // #2778 (PLACE-CARD-ACTION-OVERLOAD): бюджет действует на компактной
  // popup-aligned карточке (`/places`, «Места рядом»). В ряду — главное действие
  // и вторичные с полными подписями, всего не больше трёх вместе с «Сохранить»;
  // координаты, Telegram, лишние ссылки и навигаторы — пункты «⋯».
  const budgeted = actionBudget && isCompactActionCard && popupAligned
  const showTitleShare = !budgeted && popupAligned && hasCoord && Boolean(onShare)
  const showSaveTile = popupAligned && Boolean(onAddPoint)
  const savedColor = colors.success ?? colors.primaryDark ?? colors.primary
  const saveLabel = isSaved
    ? i18nT('map:components.places.PlaceListCard.sohraneno_d848c817')
    : addLabel
  const saveIcon: keyof typeof Feather.glyphMap | undefined = isAdding
    ? undefined
    : isSaved
      ? 'check'
      : 'bookmark'
  const saveIconColor = isSaved ? savedColor : colors.textMuted
  const shareOverflowAction: ActionChip | null =
    isCompactActionCard && !showTitleShare && hasCoord && onShare
      ? {
          key: 'share',
          label: i18nT('map:components.places.PlaceListCard.telegram_5a2f6e04'),
          icon: SEMANTIC_ACTION_ICON.telegramShare,
          onPress: onShare,
          accessibilityLabel: i18nT('map:components.places.PlaceListCard.podelitsya_v_telegram_a5cebf19'),
          title: i18nT('map:components.places.PlaceListCard.podelitsya_v_telegram_a5cebf19'),
        }
      : null
  const visibleMapActions = isCompactActionCard ? [] : mapActions
  const primaryActions = budgeted ? [...inlineActions, ...quickActions] : []
  const primarySlots = PLACE_CARD_VISIBLE_PRIMARY_ACTIONS
  const visibleInlineActions = budgeted
    ? primaryActions.slice(0, primarySlots)
    : isCompactActionCard
      ? popupAligned ? inlineActions : []
      : inlineActions
  const copyOverflowAction: ActionChip | null =
    budgeted && hasCoord && onCopyCoord
      ? {
          key: 'copy-coord',
          label: i18nT('map:components.places.PlaceListCard.skopirovat_koordinaty_6eaf9e07'),
          icon: 'copy',
          onPress: onCopyCoord,
        }
      : null
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
  const showRowAddButton =
    showAddButton && addButtonPlacement === 'row' && Boolean(onAddPoint) && !overlayAddInline
  const showRowQuickActions = !budgeted && popupAligned && quickActions.length > 0
  const hasActionRow = showActionRow && (
    showRowQuickActions ||
    showCopyChip ||
    showShareChip ||
    showSaveTile ||
    visibleMapActions.length > 0 ||
    visibleInlineActions.length > 0 ||
    overflowActions.length > 0 ||
    showRowAddButton
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
    overlayAddInline,
    saveIcon,
    saveIconColor,
    saveLabel,
    savedColor,
    showInlineRelatedTravelActions: !popupAligned && Boolean(relatedTravelUrl) && showTitleInContent,
    showRowAddButton,
    showCopyChip,
    showRowQuickActions,
    showSaveTile,
    showShareChip,
    showTitleShare,
    visibleInlineActions,
    visibleMapActions,
  }
}
