import { useCallback, useState } from 'react'
import { Platform } from 'react-native'

import { useAuth } from '@/context/AuthContext'
import { useFavorites } from '@/context/FavoritesContext'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import type { Travel } from '@/types/types'
import { showToast } from '@/utils/toast'
import { buildTravelPath } from '@/utils/travelSeo'

export function useTravelHeroFavoriteToggleModel({
  isMobile,
  travel,
}: {
  isMobile: boolean
  travel: Travel
}) {
  const { isAuthenticated } = useAuth()
  const { requireAuth } = useRequireAuth({ intent: 'favorite' })
  const { addFavorite, removeFavorite, isFavorite: checkIsFavorite } = useFavorites()
  const [isPending, setIsPending] = useState(false)

  const isFavorite = checkIsFavorite(travel.id, 'travel')
  const favoriteButtonLabel = isFavorite ? 'В избранном' : 'В избранное'
  const favoriteButtonA11yLabel = isMobile
    ? favoriteButtonLabel
    : isFavorite
      ? 'Удалить из избранного'
      : 'Добавить в избранное'

  const handleFavoriteToggle = useCallback(async () => {
    const isAndroidGuest = Platform.OS === 'android' && !isAuthenticated

    if (!isAuthenticated && !isAndroidGuest) {
      requireAuth()
      return
    }

    if (isPending) return
    setIsPending(true)

    try {
      if (isFavorite) {
        await removeFavorite(travel.id, 'travel')
        showToast({
          type: isAndroidGuest ? 'info' : 'success',
          text1: isAndroidGuest ? 'Удалено с этого устройства' : 'Удалено из избранного',
          visibilityTime: 2000,
        })
        return
      }

      await addFavorite({
        id: travel.id,
        type: 'travel',
        title: travel.name,
        imageUrl: travel.travel_image_thumb_url,
        url: buildTravelPath(travel) ?? '',
        country: (travel as Record<string, unknown>).countryName as
          | string
          | undefined,
      })
      showToast({
        type: 'success',
        text1: isAndroidGuest ? 'Сохранено на этом устройстве' : 'Добавлено в избранное',
        text2: isAndroidGuest ? 'Войдите, чтобы синхронизировать избранное.' : undefined,
        visibilityTime: isAndroidGuest ? 3500 : 2000,
      })
    } catch {
      showToast({
        type: 'error',
        text1: 'Не удалось обновить избранное',
        visibilityTime: 3000,
      })
    } finally {
      setIsPending(false)
    }
  }, [addFavorite, isAuthenticated, isFavorite, isPending, removeFavorite, requireAuth, travel])

  return {
    favoriteButtonA11yLabel,
    favoriteButtonLabel,
    handleFavoriteToggle,
    isFavorite,
    isPending,
  }
}
