import React from 'react'
import { Platform, Pressable, Text } from 'react-native'

import Feather from '@expo/vector-icons/Feather'

import { useThemedColors } from '@/hooks/useTheme'
import type { Travel } from '@/types/types'

import { useTravelDetailsHeroStyles } from './TravelDetailsHeroStyles'
import { useTravelHeroFavoriteToggleModel } from './hooks/useTravelHeroFavoriteToggleModel'

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
  } = useTravelHeroFavoriteToggleModel({
    isMobile,
    travel,
  })

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
