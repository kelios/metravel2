import React from 'react'
import Feather from '@expo/vector-icons/Feather'
import { Platform, View } from 'react-native'

import PlaceListCard from '@/components/places/PlaceListCard'

type PointLike = {
  id: string
  address: string
  coord: string
}

type ItemModel = {
  addDisabled: boolean
  categoryLabel?: string
  handleAddPointClick: (event?: { stopPropagation?: () => void }) => void
  imageUrl?: string
  inlineActions: Array<{
    icon: keyof typeof Feather.glyphMap
    key: string
    label: string
    onPress: () => void
    title?: string
  }>
  isAdding: boolean
  mapActions: Array<{
    icon: keyof typeof Feather.glyphMap
    key: string
    label: string
    onPress: () => void
    title?: string
  }>
  onCardPress?: () => void
  onCopyCoord?: () => void
  onMediaPress?: () => void
  onShareCoord?: () => void
}

type PointListCardRendererProps = {
  colors: {
    textOnDark: string
    textOnPrimary: string
  }
  isMobile: boolean
  isWebGrid?: boolean
  item: PointLike
  itemModel: ItemModel
  numColumns: number
  onCopy: (coordStr: string) => void | Promise<void>
  onOpenMap: (coordStr: string) => void | Promise<void>
  onPointCardPress?: (point: PointLike) => void
  onShare: (coordStr: string) => void | Promise<void>
  relatedTravelUrl?: string
  responsive: {
    coordSize: number
    imageMinHeight: number
    titleSize: number
  }
  styles: Record<string, any>
}

const POINT_CARD_MARGIN_STYLE = { marginRight: 16 }
const MOBILE_WEB_PLACE_CARD_STYLE = {
  width: 'min(320px, calc(100vw - 40px))',
  maxWidth: 'min(320px, calc(100vw - 40px))',
  marginRight: 16,
} as const

const PointListCardRenderer = React.memo(function PointListCardRenderer({
  isMobile,
  isWebGrid = false,
  item,
  itemModel,
  numColumns,
  onCopy,
  onShare,
  relatedTravelUrl,
  styles,
}: PointListCardRendererProps) {
  const isMobileWeb = Platform.OS === 'web' && isMobile

  const cardStyle = isWebGrid
    ? undefined
    : isMobileWeb
      ? MOBILE_WEB_PLACE_CARD_STYLE
      : Platform.OS === 'web'
        ? POINT_CARD_MARGIN_STYLE
        : undefined
  const cardImageHeight = isWebGrid ? 220 : isMobileWeb ? 164 : isMobile ? 320 : 180

  return (
    <View
      style={[
        styles.col,
        Platform.OS === 'web'
          ? isWebGrid
            ? styles.colWebGrid
            : styles.colHorizontal
          : numColumns === 2
            ? styles.col2
            : styles.col1,
      ]}
    >
      <PlaceListCard
        title={item.address}
        imageUrl={itemModel.imageUrl}
        categoryLabel={itemModel.categoryLabel}
        coord={item.coord}
        onCardPress={itemModel.onCardPress}
        onMediaPress={itemModel.onMediaPress}
        onCopyCoord={itemModel.onCopyCoord ?? (() => onCopy(item.coord))}
        onShare={itemModel.onShareCoord ?? (() => onShare(item.coord))}
        mapActions={itemModel.mapActions}
        inlineActions={itemModel.inlineActions}
        onAddPoint={itemModel.handleAddPointClick}
        addLabel={isMobileWeb || (Platform.OS !== 'web' && isMobile) ? 'В мои точки' : 'Мои точки'}
        addDisabled={itemModel.addDisabled}
        isAdding={itemModel.isAdding}
        imageHeight={cardImageHeight}
        width={isWebGrid ? undefined : isMobileWeb ? undefined : Platform.OS === 'web' ? 300 : undefined}
        style={cardStyle}
        webTouchAction={isMobileWeb ? 'pan-x pan-y' : undefined}
        compact={isMobileWeb || (Platform.OS !== 'web' && isMobile)}
        titleLayout="content"
        titleNumberOfLines={2}
        relatedTravelUrl={relatedTravelUrl}
        testID={`travel-point-card-${item.id}`}
      />
    </View>
  )
})

export default PointListCardRenderer
