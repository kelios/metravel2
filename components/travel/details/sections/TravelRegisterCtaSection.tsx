import React, { useCallback } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import { useAuth } from '@/context/AuthContext'
import { useThemedColors } from '@/hooks/useTheme'
import { useTrackedImpression } from '@/hooks/useTrackedImpression'
import { buildRegistrationHref } from '@/utils/authNavigation'
import {
  trackRegisterCtaClicked,
  trackRegisterCtaImpression,
} from '@/utils/growthFunnelAnalytics'
import { translate as i18nT } from '@/i18n'

type TravelRegisterCtaSectionProps = {
  redirect?: string
}

export const TravelRegisterCtaSection: React.FC<TravelRegisterCtaSectionProps> = ({ redirect }) => {
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
    trackRegisterCtaClicked({ source: 'travel_article', intent: 'favorite', authState: 'guest' })
    router.push(buildRegistrationHref({ redirect, intent: 'favorite' }) as never)
  }, [redirect, router])

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
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>{ctaLabel}</Text>
      </Pressable>
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
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
})

export default React.memo(TravelRegisterCtaSection)
