import { useCallback } from 'react'

import { useFavoriteToggle } from '@/hooks/useFavoriteToggle'
import type { Travel } from '@/types/types'
import { buildTravelPath } from '@/utils/travelSeo'
import { translate as i18nT } from '@/i18n'


export function useTravelHeroFavoriteToggleModel({
  isMobile,
  travel,
}: {
  isMobile: boolean
  travel: Travel
}) {
  const { toggle, isFavorite: checkIsFavorite, pending: isPending } = useFavoriteToggle()

  const isFavorite = checkIsFavorite(travel.id, 'travel')
  const favoriteButtonLabel = isFavorite ? i18nT('travel:components.travel.details.hooks.useTravelHeroFavoriteToggleModel.v_hochu_poehat_6b93d2cd') : i18nT('travel:components.travel.details.hooks.useTravelHeroFavoriteToggleModel.hochu_poehat_18236960')
  const favoriteButtonA11yLabel = isMobile
    ? favoriteButtonLabel
    : isFavorite
      ? i18nT('travel:components.travel.details.hooks.useTravelHeroFavoriteToggleModel.udalit_iz_hochu_poehat_beebb351')
      : i18nT('travel:components.travel.details.hooks.useTravelHeroFavoriteToggleModel.dobavit_v_hochu_poehat_3cd37529')

  const handleFavoriteToggle = useCallback(async () => {
    await toggle({
      id: travel.id,
      type: 'travel',
      title: travel.name,
      imageUrl: travel.travel_image_thumb_url,
      url: buildTravelPath(travel) ?? '',
      country: (travel as Record<string, unknown>).countryName as string | undefined,
      source: 'travel_hero',
    })
  }, [toggle, travel])

  return {
    favoriteButtonA11yLabel,
    favoriteButtonLabel,
    handleFavoriteToggle,
    isFavorite,
    isPending,
  }
}
