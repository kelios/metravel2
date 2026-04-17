import React from 'react'
import Feather from '@expo/vector-icons/Feather'
import { Platform, View } from 'react-native'

import PlaceListCard from '@/components/places/PlaceListCard'
import PointCard from '@/components/travel/PointCard'

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
  onOpenAppleMap: () => void
  onOpenGoogleMap: () => void
  onOpenMap: (coordStr: string) => void | Promise<void>
  onOpenOsmMap: () => void
  onOpenWaze?: () => void
  onOpenYandexMap: () => void
  onOpenYandexNavi?: () => void
  onPointCardPress?: (point: PointLike) => void
  onShare: (coordStr: string) => void | Promise<void>
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
  colors,
  isMobile,
  isWebGrid = false,
  item,
  itemModel,
  numColumns,
  onCopy,
  onOpenAppleMap,
  onOpenGoogleMap,
  onOpenMap,
  onOpenOsmMap,
  onOpenWaze: _onOpenWaze,
  onOpenYandexMap,
  onOpenYandexNavi: _onOpenYandexNavi,
  onPointCardPress,
  onShare,
  responsive,
  styles,
}: PointListCardRendererProps) {
  const isMobileWeb = Platform.OS === 'web' && isMobile

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
      {Platform.OS === 'web' ? (
        <PlaceListCard
          title={item.address}
          imageUrl={itemModel.imageUrl}
          categoryLabel={itemModel.categoryLabel}
          coord={item.coord}
          onCardPress={itemModel.onCardPress}
          onMediaPress={itemModel.onMediaPress}
          onCopyCoord={itemModel.onCopyCoord}
          onShare={itemModel.onShareCoord}
          mapActions={itemModel.mapActions}
          inlineActions={itemModel.inlineActions}
          onAddPoint={itemModel.handleAddPointClick}
          addLabel={isMobileWeb ? 'В мои точки' : 'Мои точки'}
          addDisabled={itemModel.addDisabled}
          isAdding={itemModel.isAdding}
          imageHeight={isWebGrid ? 220 : isMobileWeb ? 164 : 180}
          width={isWebGrid ? undefined : isMobileWeb ? undefined : 300}
          style={
            isWebGrid
              ? undefined
              : isMobileWeb
                ? MOBILE_WEB_PLACE_CARD_STYLE
                : POINT_CARD_MARGIN_STYLE
          }
          webTouchAction={isMobileWeb ? 'pan-x pan-y' : undefined}
          compact={isMobileWeb}
          testID={`travel-point-card-${item.id}`}
        />
      ) : (
        <PointCard
          point={{
            address: item.address,
            coord: item.coord,
          }}
          categoryLabel={itemModel.categoryLabel}
          imageUrl={itemModel.imageUrl}
          isMobile={isMobile}
          responsive={responsive}
          onCopy={onCopy}
          onShare={onShare}
          onOpenMap={onOpenMap}
          onOpenGoogleMap={onOpenGoogleMap}
          onOpenAppleMap={onOpenAppleMap}
          onOpenYandexMap={onOpenYandexMap}
          onOpenOsmMap={onOpenOsmMap}
          colors={colors}
          styles={styles}
          onCardPress={onPointCardPress ? itemModel.onCardPress : undefined}
          onAddPoint={itemModel.handleAddPointClick}
          addButtonLoading={itemModel.isAdding}
          addButtonDisabled={itemModel.addDisabled}
        />
      )}
    </View>
  )
})

export default PointListCardRenderer
