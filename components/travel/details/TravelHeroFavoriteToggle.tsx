import React from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import type { Travel } from '@/types/types'

import { useTravelDetailsHeroStyles } from './TravelDetailsHeroStyles'
import { useTravelHeroFavoriteToggleModel } from './hooks/useTravelHeroFavoriteToggleModel'
import { translate as i18nT } from '@/i18n'
import { useTranslation } from '@/i18n/LocaleProvider'


export const TravelHeroFavoriteToggle: React.FC<{
  travel: Travel
  isMobile: boolean
}> = ({ travel, isMobile }) => {
  const styles = useTravelDetailsHeroStyles()
  const colors = useThemedColors()
  const { isAuthenticated } = useAuth()
  const { t } = useTranslation()
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

  // Гостю подсказка о входе — не постоянный текст под кнопкой: нажатие само
  // ведёт на вход с намерением «сохранить» (`useFavoriteToggle`), а смысл
  // получает скринридер через общий Button.accessibilityHint.
  const guestSaveHint = isAuthenticated
    ? undefined
    : t('travel:components.travel.details.TravelHeroFavoriteToggle.guestSaveHint')
  if (Platform.OS === 'web') {
    return (
      <View style={webStyles.container}>
        <Button
          testID="travel-first-screen-favorite"
          label={favoriteButtonLabel}
          accessibilityLabel={favoriteButtonA11yLabel}
          accessibilityHint={guestSaveHint}
          onPress={handleFavoriteToggle}
          disabled={isPending}
          variant={isFavorite ? 'primary' : 'outline'}
          size="md"
          style={webStyles.button}
          icon={<Feather name="heart" size={16} color={isFavorite ? colors.textOnPrimary : colors.primary} />}
        />
      </View>
    )
  }

  return (
    <Pressable
      onPress={handleFavoriteToggle}
      disabled={isPending}
      style={({ hovered }) => [
        styles.heroFavoriteBtn,
        isFavorite && styles.heroFavoriteBtnActive,
        isMobile && styles.heroFavoriteBtnMobile,
        hovered && styles.heroFavoriteBtnHovered,
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
      {!isMobile ? (
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

const webStyles = StyleSheet.create({
  container: { alignItems: 'flex-start' },
  button: { minHeight: DESIGN_TOKENS.touchTarget.minHeight },
})

export default React.memo(TravelHeroFavoriteToggle)
