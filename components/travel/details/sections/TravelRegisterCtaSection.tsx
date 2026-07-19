import React, { useCallback } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import Button from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { useThemedColors } from '@/hooks/useTheme'
import { useTrackedImpression } from '@/hooks/useTrackedImpression'
import { buildRegistrationHref } from '@/utils/authNavigation'
import { saveGuestFavoriteIntent } from '@/utils/guestFavoriteIntent'
import {
  trackFavoriteIntentGuest,
  trackRegisterCtaClicked,
  trackRegisterCtaImpression,
} from '@/utils/growthFunnelAnalytics'
import { translate as i18nT } from '@/i18n'

type TravelRegisterCtaSectionProps = {
  redirect?: string
  travelId?: string | number
  title?: string
  imageUrl?: string
}

export const TravelRegisterCtaSection: React.FC<TravelRegisterCtaSectionProps> = ({
  redirect,
  travelId,
  title,
  imageUrl,
}) => {
  const { isAuthenticated } = useAuth()
  const colors = useThemedColors()
  const router = useRouter()
  const heading = i18nT('travel:components.travel.details.sections.TravelRegisterCtaSection.heading')
  const subtitle = i18nT('travel:components.travel.details.sections.TravelRegisterCtaSection.subtitle')
  const ctaLabel = i18nT('travel:components.travel.details.sections.TravelRegisterCtaSection.cta')
  const impression = useTrackedImpression(
    `travel_article:${redirect ?? 'unknown'}`,
    useCallback(() => {
      if (!isAuthenticated) {
        trackRegisterCtaImpression({
          source: 'travel_article',
          intent: 'favorite',
          authState: 'guest',
        })
      }
    }, [isAuthenticated]),
  )

  const handlePress = useCallback(() => {
    if (travelId != null && title && redirect) {
      trackFavoriteIntentGuest({
        itemType: 'travel',
        itemId: travelId,
        source: 'travel_article',
        url: redirect,
      })
      void saveGuestFavoriteIntent({
        id: String(travelId),
        type: 'travel',
        title,
        imageUrl,
        url: redirect,
        source: 'travel_article',
      })
    }
    trackRegisterCtaClicked({ source: 'travel_article', intent: 'favorite', authState: 'guest' })
    router.push(buildRegistrationHref({ redirect, intent: 'favorite' }) as never)
  }, [imageUrl, redirect, router, title, travelId])

  if (isAuthenticated) return null

  return (
    <View
      ref={impression.ref}
      onLayout={impression.onLayout}
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      accessibilityLabel={heading}
      accessibilityRole={Platform.OS === 'web' ? ('region' as any) : undefined}
    >
      <Text
        style={[styles.heading, { color: colors.text }]}
        accessibilityRole={Platform.OS === 'web' ? ('heading' as any) : undefined}
        aria-level={2 as any}
      >
        {heading}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      <Button
        label={ctaLabel}
        onPress={handlePress}
        variant="primary"
        accessibilityLabel={ctaLabel}
        style={styles.button}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 24,
    marginBottom: 12,
    padding: 18,
    borderWidth: 1,
    borderRadius: 8,
  },
  heading: {
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 26,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  button: {
    alignSelf: 'flex-start',
  },
})

export default React.memo(TravelRegisterCtaSection)
