import { Platform } from 'react-native'

import { TravelCoords } from '@/types/types'

export const isWebPlatform = () => Platform.OS === 'web'

export const PRESSED_OPACITY = { opacity: 0.85 }
export const PLACE_CARD_STYLE = { margin: 8 }

export type Props = {
  travel: TravelCoords
  isMobile?: boolean
  onPress?: () => void
  onHidePress?: () => void
  userLocation?: { latitude: number; longitude: number } | null
  transportMode?: 'car' | 'bike' | 'foot'
  isFavorite?: boolean
  onToggleFavorite?: () => void
  onBuildRoute?: () => void
  /**
   * Viewport width supplied by the list. Lifted out of a per-row
   * useWindowDimensions so a resize doesn't re-subscribe every visible card.
   */
  screenWidth?: number
}
