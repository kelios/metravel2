import { useCallback, useState } from 'react'

import { useAuth } from '@/context/AuthContext'
import { useFavorites } from '@/context/FavoritesContext'
import type { Travel } from '@/types/types'
import { showToast } from '@/utils/toast'
import { buildTravelPath } from '@/utils/travelSeo'
import { translate as i18nT } from '@/i18n'


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
  const favoriteButtonLabel = isFavorite ? i18nT('travel:components.travel.details.hooks.useTravelHeroFavoriteToggleModel.v_hochu_poehat_6b93d2cd') : i18nT('travel:components.travel.details.hooks.useTravelHeroFavoriteToggleModel.hochu_poehat_18236960')
  const favoriteButtonA11yLabel = isMobile
    ? favoriteButtonLabel
    : isFavorite
      ? i18nT('travel:components.travel.details.hooks.useTravelHeroFavoriteToggleModel.udalit_iz_hochu_poehat_beebb351')
      : i18nT('travel:components.travel.details.hooks.useTravelHeroFavoriteToggleModel.dobavit_v_hochu_poehat_3cd37529')

  const handleFavoriteToggle = useCallback(async () => {
    const isGuest = !isAuthenticated

    if (isPending) return
    setIsPending(true)

    try {
      if (isFavorite) {
        await removeFavorite(travel.id, 'travel')
        showToast({
          type: isGuest ? 'info' : 'success',
          text1: isGuest ? i18nT('travel:components.travel.details.hooks.useTravelHeroFavoriteToggleModel.udaleno_s_etogo_ustroystva_976f214a') : i18nT('travel:components.travel.details.hooks.useTravelHeroFavoriteToggleModel.udaleno_iz_hochu_poehat_a28bb5fc'),
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
        text1: isGuest ? i18nT('travel:components.travel.details.hooks.useTravelHeroFavoriteToggleModel.sohraneno_na_etom_ustroystve_640e4438') : i18nT('travel:components.travel.details.hooks.useTravelHeroFavoriteToggleModel.dobavleno_v_hochu_poehat_4fea9c78'),
        text2: isGuest ? i18nT('travel:components.travel.details.hooks.useTravelHeroFavoriteToggleModel.voydite_chtoby_sinhronizirovat_hochu_poehat_97e4aa6d') : undefined,
        visibilityTime: isGuest ? 3500 : 2000,
      })
    } catch {
      showToast({
        type: 'error',
        text1: i18nT('travel:components.travel.details.hooks.useTravelHeroFavoriteToggleModel.ne_udalos_obnovit_hochu_poehat_ee35c1dc'),
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
