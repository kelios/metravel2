import React, { useCallback } from 'react'
import { Pressable, View } from 'react-native'

import { Text } from '@/ui/paper'
import { useFavorites } from '@/context/FavoritesContext'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { showToast } from '@/utils/toast'

import AddressListItem from '../AddressListItem'
import { SwipeableListItem } from '../SwipeableListItem'
import {
  getTravelItemId,
  getTravelItemSubtitle,
  getTravelItemTitle,
  IS_WEB,
} from './helpers'
import type { TravelListStyles } from './styles'

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
  const { addFavorite, removeFavorite, isFavorite: isFavoriteInContext } = useFavorites()
  const { isAuthenticated, requireAuth } = useRequireAuth({ intent: 'favorite' })

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
            accessibilityLabel={`Открыть место: ${getTravelItemTitle(item)}`}
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
            if (!isAuthenticated) {
              requireAuth()
              return
            }
            const action = ctxIsFavorite
              ? removeFavorite(itemId as string | number, 'travel')
              : addFavorite({
                  id: itemId as string | number,
                  type: 'travel',
                  title: item?.address || item?.name || item?.title || 'Место',
                  url:
                    item?.urlTravel || item?.articleUrl || `/travels/${itemId}`,
                  imageUrl: item?.travelImageThumbUrl || item?.imageUrl,
                })
            void Promise.resolve(action).catch(() => {
              void showToast({
                type: 'error',
                text1: 'Не удалось обновить избранное',
                position: 'bottom',
              })
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
      addFavorite,
      removeFavorite,
      isFavoriteInContext,
      isAuthenticated,
      requireAuth,
    ],
  )
}
