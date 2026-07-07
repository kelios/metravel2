import { useCallback, useState } from 'react'

import { useAuth } from '@/context/AuthContext'
import { useFavorites } from '@/context/FavoritesContext'
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
  const { addFavorite, removeFavorite, isFavorite: checkIsFavorite } = useFavorites()
  const [isPending, setIsPending] = useState(false)

  const isFavorite = checkIsFavorite(travel.id, 'travel')
  const favoriteButtonLabel = isFavorite ? 'В «Хочу поехать»' : 'Хочу поехать'
  const favoriteButtonA11yLabel = isMobile
    ? favoriteButtonLabel
    : isFavorite
      ? 'Удалить из «Хочу поехать»'
      : 'Добавить в «Хочу поехать»'

  const handleFavoriteToggle = useCallback(async () => {
    const isGuest = !isAuthenticated

    if (isPending) return
    setIsPending(true)

    try {
      if (isFavorite) {
        await removeFavorite(travel.id, 'travel')
        showToast({
          type: isGuest ? 'info' : 'success',
          text1: isGuest ? 'Удалено с этого устройства' : 'Удалено из «Хочу поехать»',
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
        text1: isGuest ? 'Сохранено на этом устройстве' : 'Добавлено в «Хочу поехать»',
        text2: isGuest ? 'Войдите, чтобы синхронизировать «Хочу поехать».' : undefined,
        visibilityTime: isGuest ? 3500 : 2000,
      })
    } catch {
      showToast({
        type: 'error',
        text1: 'Не удалось обновить «Хочу поехать»',
        visibilityTime: 3000,
      })
    } finally {
      setIsPending(false)
    }
  }, [addFavorite, isAuthenticated, isFavorite, isPending, removeFavorite, travel])

  return {
    favoriteButtonA11yLabel,
    favoriteButtonLabel,
    handleFavoriteToggle,
    isFavorite,
    isPending,
  }
}
