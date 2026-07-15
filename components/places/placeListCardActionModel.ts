import type Feather from '@expo/vector-icons/Feather'

import { SEMANTIC_ACTION_ICON } from '@/components/navigation/navigationActionMeta'
import type { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

import type { ActionChip } from './PlaceListCard.types'

type ActionModelInput = {
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
  popupAligned: boolean
  quickActions: ActionChip[]
  relatedTravelUrl?: string | null
  showActionRow: boolean
  showAddButton: boolean
  showTitleInContent: boolean
}

export function buildPlaceListCardActionModel({
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
  popupAligned,
  quickActions,
  relatedTravelUrl,
  showActionRow,
  showAddButton,
  showTitleInContent,
}: ActionModelInput) {
  const overlayAddInline = isCompactActionCard && addButtonPlacement === 'row'
  const showTitleShare = popupAligned && hasCoord && Boolean(onShare)
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
  const visibleInlineActions = isCompactActionCard
    ? popupAligned ? inlineActions : []
    : inlineActions
  const overflowActions = isCompactActionCard
    ? [
        ...(shareOverflowAction ? [shareOverflowAction] : []),
        ...mapActions,
        ...(popupAligned ? [] : inlineActions),
      ]
    : []
  const showShareChip = !isCompactActionCard && hasCoord && Boolean(onShare)
  const showRowAddButton =
    showAddButton && addButtonPlacement === 'row' && Boolean(onAddPoint) && !overlayAddInline
  const showRowQuickActions = popupAligned && quickActions.length > 0
  const hasActionRow = showActionRow && (
    showRowQuickActions ||
    (hasCoord && Boolean(onCopyCoord)) ||
    showShareChip ||
    showSaveTile ||
    visibleMapActions.length > 0 ||
    visibleInlineActions.length > 0 ||
    overflowActions.length > 0 ||
    showRowAddButton
  )

  return {
    hasActionRow,
    overflowActionLabel: mapActions.length > 0
      ? i18nT('map:components.places.PlaceListCard.navigatsiya_fa115805')
      : i18nT('map:components.places.PlaceListCard.esche_16276b19'),
    overflowActionTitle: mapActions.length > 0
      ? i18nT('map:components.places.PlaceListCard.navigatsiya_i_deystviya_777daf07')
      : i18nT('map:components.places.PlaceListCard.esche_deystviya_6f82137f'),
    overflowActions,
    overlayAddInline,
    saveIcon,
    saveIconColor,
    saveLabel,
    savedColor,
    showInlineRelatedTravelActions: !popupAligned && Boolean(relatedTravelUrl) && showTitleInContent,
    showRowAddButton,
    showRowQuickActions,
    showSaveTile,
    showShareChip,
    showTitleShare,
    visibleInlineActions,
    visibleMapActions,
  }
}
