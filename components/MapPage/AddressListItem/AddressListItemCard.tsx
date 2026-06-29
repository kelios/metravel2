import React from 'react'

import PlaceListCard from '@/components/places/PlaceListCard'
import { TravelCoords } from '@/types/types'

import { PLACE_CARD_STYLE, TRANSPORT_LABELS } from './constants'

type WebMapAction = {
  key: string
  label: string
  icon: 'map-pin' | 'compass' | 'navigation' | 'navigation-2'
  onPress: () => void
  title: string
}

type ListCardAction = {
  key: string
  label: string
  icon: 'navigation' | 'book-open'
  onPress: () => void
  accessibilityLabel: string
  title: string
}

type DistanceInfo = {
  distanceText: string
  travelTimeText: string
} | null

type Props = {
  travel: TravelCoords
  address?: string
  title?: string
  subtitle?: string
  coord?: string
  imgUri?: string | null
  categories: string[]
  urlTravel?: string
  articleUrl?: string
  isFavorite: boolean
  onToggleFavorite?: () => void
  onPress?: () => void
  transportMode: 'car' | 'bike' | 'foot'
  distanceInfo: DistanceInfo
  webMapActions: WebMapAction[]
  quickActions: ListCardAction[]
  inlineActions: ListCardAction[]
  handleMainPress: () => void
  openArticle: () => void
  openTelegram: () => void
  handleAddPoint: () => void | Promise<void>
  authReady: boolean
  isAuthenticated: boolean
  isAddingPoint: boolean
  pointAdded: boolean
  cardImageHeight: number
  cardWidth?: number
}

/**
 * #584 — single, photo-dominant template for the nearby-places list, identical
 * on web AND native (Android/iOS). Built on PlaceListCard → UnifiedTravelCard,
 * the same card used on the travel pages: photo is the hero (contain+blur),
 * caption/chips live BELOW the photo (not as a full-screen scrim over the
 * image), and ♥/＋ sit in the top-right corner. This replaced the old native
 * AddressListItemNative card, whose full overlay scrim + stacked text covered
 * the photo and whose no-image variant rendered a smaller "white strip" card
 * inconsistent with the photo cards (the «first card looks different» bug).
 */
const AddressListItemCard: React.FC<Props> = ({
  travel,
  address,
  title,
  subtitle,
  coord,
  imgUri,
  categories,
  urlTravel,
  articleUrl,
  isFavorite,
  onToggleFavorite,
  onPress,
  transportMode,
  distanceInfo,
  webMapActions,
  quickActions,
  inlineActions,
  handleMainPress,
  openArticle,
  openTelegram,
  handleAddPoint,
  authReady,
  isAuthenticated,
  isAddingPoint,
  pointAdded,
  cardImageHeight,
  cardWidth,
}) => {
  const categoryLabel = categories.join(', ')
  const distanceBadges = distanceInfo
    ? [distanceInfo.distanceText, `${TRANSPORT_LABELS[transportMode]} ${distanceInfo.travelTimeText}`]
    : []
  // Secondary address line (POI titles separate the clean name from the full
  // reverse-geocoded address) renders above the distance badges.
  const badges = subtitle ? [subtitle, ...distanceBadges] : distanceBadges
  const travelRecord = travel as Record<string, unknown>

  return (
    <PlaceListCard
      title={title ?? address ?? ''}
      imageUrl={imgUri}
      categoryLabel={categoryLabel || undefined}
        relatedTravelUrl={urlTravel}
      relatedTravelCountry={typeof travelRecord.countryName === 'string' ? travelRecord.countryName : undefined}
      relatedTravelCity={typeof travelRecord.cityName === 'string' ? travelRecord.cityName : undefined}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      coord={coord}
      badges={badges}
      onCardPress={handleMainPress}
      onMediaPress={
        !onPress && (articleUrl || urlTravel) ? () => openArticle() : undefined
      }
      onCopyCoord={undefined}
      onShare={coord ? openTelegram : undefined}
      mapActions={webMapActions}
      quickActions={quickActions}
      inlineActions={inlineActions}
      onAddPoint={handleAddPoint}
      addDisabled={!authReady || !isAuthenticated || isAddingPoint}
      isAdding={isAddingPoint}
      imageHeight={cardImageHeight}
      width={cardWidth}
      addLabel={pointAdded ? 'Добавлено' : 'Сохранить'}
      addButtonPlacement="row"
      compact
      popupAligned
      titleLayout="content"
      titleNumberOfLines={2}
      style={PLACE_CARD_STYLE}
      testID="map-travel-card"
    />
  )
}

export default AddressListItemCard
