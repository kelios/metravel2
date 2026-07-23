import type React from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type Feather from '@expo/vector-icons/Feather'
import type { PlaceRating } from '@/utils/placesCatalog'

type WebCardStyle = Omit<ViewStyle, 'width' | 'maxWidth'> & {
  width?: ViewStyle['width'] | string
  maxWidth?: ViewStyle['maxWidth'] | string
}

export type ActionChip = {
  key: string
  label: string
  icon: keyof typeof Feather.glyphMap
  onPress: () => void
  accessibilityLabel?: string
  title?: string
}

export type PlaceListCardProps = {
  title: string
  imageUrl?: string | null
  categoryLabel?: string | null
  coord?: string | null
  badges?: string[]
  onCardPress?: () => void
  onMediaPress?: () => void
  onCopyCoord?: () => void
  onShare?: () => void
  mapActions?: ActionChip[]
  inlineActions?: ActionChip[]
  quickActions?: ActionChip[]
  onAddPoint?: () => void
  addDisabled?: boolean
  isAdding?: boolean
  isSaved?: boolean
  addLabel?: string
  width?: number
  imageHeight?: number
  eagerImage?: boolean
  testID?: string
  style?: StyleProp<WebCardStyle>
  showActionRow?: boolean
  showAddButton?: boolean
  addButtonPlacement?: 'button' | 'row'
  webTouchAction?: string
  compact?: boolean
  titleLayout?: 'overlay' | 'content'
  titleNumberOfLines?: number
  popupAligned?: boolean
  relatedTravelUrl?: string | null
  relatedTravelId?: number | null
  relatedTravelCountry?: string | null
  relatedTravelCity?: string | null
  isFavorite?: boolean
  onToggleFavorite?: () => void
  /** External rating (2GIS/TripAdvisor/…). When present, a gold rating pill is
   *  shown over the top-left of the photo. Ignored in popup-aligned layout. */
  rating?: PlaceRating | null
  /** Interactive rating row rendered in the card body (own MeTravel rating). */
  ratingSlot?: React.ReactNode
}
