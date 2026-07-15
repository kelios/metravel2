import React from 'react'
import { Platform, Pressable, Text } from 'react-native'

import Feather from '@expo/vector-icons/Feather'

import { useThemedColors } from '@/hooks/useTheme'
import type { Travel } from '@/types/types'

import { useTravelDetailsHeroStyles } from './TravelDetailsHeroStyles'
import { useTravelHeroFavoriteToggleModel } from './hooks/useTravelHeroFavoriteToggleModel'
import { translate as i18nT } from '@/i18n'


export const TravelHeroFavoriteToggle: React.FC<{
  travel: Travel
  isMobile: boolean
}> = ({ travel, isMobile }) => {
  const styles = useTravelDetailsHeroStyles()
  const colors = useThemedColors()
  const {
    favoriteButtonA11yLabel,
    favoriteButtonLabel,
    handleFavoriteToggle,
    isFavorite,
    isPending,
  } = useTravelHeroFavoriteToggleModel({
    isMobile,
    travel,
  })

  return (
    <Pressable
      onPress={handleFavoriteToggle}
      disabled={isPending}
      style={[
        styles.heroFavoriteBtn,
        isFavorite && styles.heroFavoriteBtnActive,
        isMobile && styles.heroFavoriteBtnMobile,
        isPending && { opacity: 0.6 },
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isPending, selected: isFavorite }}
      accessibilityLabel={favoriteButtonA11yLabel}
      accessibilityHint={isFavorite ? i18nT('travel:components.travel.details.TravelHeroFavoriteToggle.ubiraet_puteshestvie_iz_hochu_poehat_bf1e9402') : i18nT('travel:components.travel.details.TravelHeroFavoriteToggle.sohranyaet_puteshestvie_v_hochu_poehat_5fa64422')}
    >
      <Feather
        name="heart"
        size={20}
        color={isFavorite ? colors.textOnPrimary : colors.textOnDark}
      />
      {!isMobile && Platform.OS !== 'web' ? (
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
