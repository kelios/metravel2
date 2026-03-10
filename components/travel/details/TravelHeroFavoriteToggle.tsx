import React, { useCallback } from 'react'
import { Platform, Pressable, Text } from 'react-native'

import Feather from '@expo/vector-icons/Feather'

import { useAuth } from '@/context/AuthContext'
import { useFavorites } from '@/context/FavoritesContext'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useThemedColors } from '@/hooks/useTheme'
import type { Travel } from '@/types/types'
import { showToast } from '@/utils/toast'

import { useTravelDetailsHeroStyles } from './TravelDetailsHeroStyles'

export const TravelHeroFavoriteToggle: React.FC<{
  travel: Travel
  isMobile: boolean
}> = ({ travel, isMobile }) => {
  const styles = useTravelDetailsHeroStyles()
  const colors = useThemedColors()
  const { isAuthenticated } = useAuth()
  const { requireAuth } = useRequireAuth({ intent: 'favorite' })
  const { addFavorite, removeFavorite, isFavorite: checkIsFavorite } = useFavorites()

  const isFavorite = checkIsFavorite(travel.id, 'travel')
  const favoriteButtonLabel = isFavorite ? 'В избранном' : 'В избранное'
  const favoriteButtonA11yLabel = isMobile
    ? favoriteButtonLabel
    : isFavorite
      ? 'Удалить из избранного'
      : 'Добавить в избранное'

  const handleFavoriteToggle = useCallback(async () => {
    if (!isAuthenticated) {
      requireAuth()
      return
    }
    try {
      if (isFavorite) {
        await removeFavorite(travel.id, 'travel')
        showToast({
          type: 'success',
          text1: 'Удалено из избранного',
          visibilityTime: 2000,
        })
      } else {
        await addFavorite({
          id: travel.id,
          type: 'travel',
          title: travel.name,
          imageUrl: travel.travel_image_thumb_url,
          url: `/travels/${(travel as Record<string, unknown>).slug || travel.id}`,
          country: (travel as Record<string, unknown>).countryName as
            | string
            | undefined,
        })
        showToast({
          type: 'success',
          text1: 'Добавлено в избранное',
          visibilityTime: 2000,
        })
      }
    } catch {
      showToast({
        type: 'error',
        text1: 'Не удалось обновить избранное',
        visibilityTime: 3000,
      })
    }
  }, [addFavorite, isAuthenticated, isFavorite, removeFavorite, requireAuth, travel])

  return (
    <Pressable
      onPress={handleFavoriteToggle}
      style={[
        styles.heroFavoriteBtn,
        isFavorite && styles.heroFavoriteBtnActive,
        isMobile && styles.heroFavoriteBtnMobile,
      ]}
      accessibilityRole="button"
      accessibilityLabel={favoriteButtonA11yLabel}
    >
      <Feather
        name="heart"
        size={20}
        color={isFavorite ? colors.textOnDark : colors.textOnDark}
      />
      {isMobile || Platform.OS !== 'web' ? (
        <Text
          style={[
            styles.heroFavoriteBtnLabel,
            isFavorite && styles.heroFavoriteBtnLabelActive,
          ]}
        >
          {favoriteButtonLabel}
        </Text>
      ) : null}
    </Pressable>
  )
}

export default React.memo(TravelHeroFavoriteToggle)
