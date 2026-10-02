import { useCallback } from 'react';
import { Pressable, View } from 'react-native'

import { Text } from '@/ui/paper'
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle'

import AddressListItem from '../AddressListItem'
import { SwipeableListItem } from '../SwipeableListItem'
import {
  getTravelItemId,
  getTravelItemSubtitle,
  getTravelItemTitle,
  IS_WEB,
} from './helpers'
import type { TravelListStyles } from './styles'
import { translate as i18nT } from '@/i18n'


type UseTravelItemRendererArgs = {
  styles: TravelListStyles
  isMobile: boolean
  compactPreview: boolean
  buildRouteTo: (item: any) => void
  onSelectPlace?: (item: any) => void
  onHideTravel?: (id: string | number) => void
  userLocation?: { latitude: number; longitude: number } | null
  transportMode: 'car' | 'bike' | 'foot'
  screenWidth: number
  onToggleFavorite?: (id: string | number) => void
  favorites: Set<string | number>
}

export function useTravelItemRenderer({
  styles,
  isMobile,
  compactPreview,
  buildRouteTo,
  onSelectPlace,
  onHideTravel,
  userLocation,
  transportMode,
  screenWidth,
  onToggleFavorite,
  favorites,
}: UseTravelItemRendererArgs) {
  const { toggle: toggleFavorite, isFavorite: isFavoriteInContext } = useFavoriteToggle()

  return useCallback(
    ({ item }: any) => {
      const itemId = getTravelItemId(item)
      const canUseItemId = itemId !== undefined && itemId !== null
      const isFavorite = canUseItemId ? favorites.has(itemId) : false

      const onHidePress =
        onHideTravel && canUseItemId ? () => onHideTravel(itemId) : undefined

      if (!IS_WEB && isMobile && compactPreview) {
        return (
          <Pressable
            onPress={() => (onSelectPlace ?? buildRouteTo)(item)}
            style={({ pressed }) => [
              styles.compactPreviewCard,
              pressed && styles.compactPreviewCardPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={i18nT('map:components.MapPage.TravelListPanel.useTravelItemRenderer.otkryt_mesto_value1_7888779b', { value1: getTravelItemTitle(item) })}
          >
            <View style={styles.compactPreviewIcon}>
              <Text style={styles.compactPreviewIconText}>⌖</Text>
            </View>
            <View style={styles.compactPreviewText}>
              <Text style={styles.compactPreviewTitle} numberOfLines={1}>
                {getTravelItemTitle(item)}
              </Text>
              <Text style={styles.compactPreviewSubtitle} numberOfLines={1}>
                {getTravelItemSubtitle(item)}
              </Text>
            </View>
          </Pressable>
        )
      }

      // Native mobile: favorite is handled by the swipe gesture, so the card
      // itself must NOT render a favorite button (avoids a duplicate action).
      if (!IS_WEB && isMobile) {
        return (
          <SwipeableListItem
            onFavorite={
              onToggleFavorite && canUseItemId ? () => onToggleFavorite(itemId) : undefined
            }
            onBuildRoute={() => buildRouteTo(item)}
            showFavorite={!!onToggleFavorite}
            showRoute
            isFavorite={isFavorite}
          >
            <AddressListItem
              travel={item}
              isMobile={isMobile}
              onPress={() => (onSelectPlace ?? buildRouteTo)(item)}
              onHidePress={onHidePress}
              userLocation={userLocation}
              transportMode={transportMode}
              onBuildRoute={() => buildRouteTo(item)}
              screenWidth={screenWidth}
            />
          </SwipeableListItem>
        )
      }

      // Web (incl. web-mobile) and native desktop: no swipe, so expose an
      // explicit favorite toggle button on the card, backed by the favorites
      // context (the prop-based path is only used by the native swipe wrapper).
      const ctxIsFavorite =
        canUseItemId && isFavoriteInContext(itemId, 'travel')
      const handleToggleFavorite = canUseItemId
        ? () => {
            void toggleFavorite({
              id: itemId as string | number,
              type: 'travel',
              title: item?.address || item?.name || item?.title || i18nT('map:components.MapPage.TravelListPanel.useTravelItemRenderer.mesto_d8763e12'),
              url: item?.urlTravel || item?.articleUrl || `/travels/${itemId}`,
              imageUrl: item?.travelImageThumbUrl || item?.imageUrl,
              source: 'map_travel_list',
            })
          }
        : undefined

      return (
        <AddressListItem
          travel={item}
          isMobile={isMobile}
          onPress={() => (onSelectPlace ?? buildRouteTo)(item)}
          onHidePress={onHidePress}
          userLocation={userLocation}
          transportMode={transportMode}
          isFavorite={ctxIsFavorite}
          onToggleFavorite={handleToggleFavorite}
          screenWidth={screenWidth}
        />
      )
    },
    [
      isMobile,
      compactPreview,
      buildRouteTo,
      onSelectPlace,
      onHideTravel,
      userLocation,
      transportMode,
      screenWidth,
      styles,
      onToggleFavorite,
      favorites,
      toggleFavorite,
      isFavoriteInContext,
    ],
  )
}
