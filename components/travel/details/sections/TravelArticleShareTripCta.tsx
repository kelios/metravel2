import React, { memo, useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'

import Button from '@/components/ui/Button'
import { resolveOwnerId } from '@/components/travel/compactSideBar/helpers'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useAuth } from '@/context/AuthContext'
import { useTrackedImpression } from '@/hooks/useTrackedImpression'
import { useTranslation } from '@/i18n/LocaleProvider'
import type { Travel } from '@/types/types'
import { buildRegistrationHref } from '@/utils/authNavigation'
import {
  trackContentCreateCtaClicked,
  trackContentCreateCtaImpression,
  type GrowthAuthState,
} from '@/utils/growthFunnelAnalytics'
import { buildTravelArticleCreateHref } from '@/utils/travelArticleCreateIntent'

type TravelArticleShareTripCtaProps = {
  travel: Travel
  isMobile: boolean
}

function VisibleTravelArticleShareTripCta({
  travel,
  isMobile,
  authState,
}: TravelArticleShareTripCtaProps & { authState: GrowthAuthState }) {
  const router = useRouter()
  const { t } = useTranslation()
  const label = t('travel:articleShareTrip.action')
  const createHref = buildTravelArticleCreateHref(travel)
  const impression = useTrackedImpression(
    `article-share-trip:${travel.id}:${authState}`,
    useCallback(() => {
      trackContentCreateCtaImpression({
        contentType: 'route',
        source: 'travel_article',
        intent: 'share-trip',
        sourceTravelId: travel.id,
        authState,
      })
    }, [authState, travel.id]),
  )

  const handlePress = useCallback(() => {
    trackContentCreateCtaClicked({
      contentType: 'route',
      source: 'travel_article',
      intent: 'share-trip',
      sourceTravelId: travel.id,
      authState,
      action: authState === 'guest' ? 'register' : 'create',
    })
    router.push((authState === 'guest'
      ? buildRegistrationHref({ redirect: createHref, intent: 'share-trip' })
      : createHref) as never)
  }, [authState, createHref, router, travel.id])

  return (
    <View
      ref={impression.ref}
      onLayout={impression.onLayout}
      style={styles.container}
      testID="travel-article-share-trip"
    >
      <Button
        label={label}
        accessibilityLabel={label}
        onPress={handlePress}
        variant="soft"
        fullWidth={isMobile}
        labelNumberOfLines={0}
        style={styles.button}
        testID="travel-article-share-trip-button"
      />
    </View>
  )
}

export const TravelArticleShareTripCta = memo(function TravelArticleShareTripCta({
  travel,
  isMobile,
}: TravelArticleShareTripCtaProps) {
  const { authReady, isAuthenticated, userId } = useAuth()
  const ownerId = resolveOwnerId(travel) ?? travel.user?.id
  const isOwner = isAuthenticated && userId != null && ownerId != null
    && String(userId).trim() === String(ownerId).trim()

  if (!authReady || (isAuthenticated && !userId?.trim()) || isOwner) return null

  const authState = isAuthenticated ? 'authenticated' : 'guest'
  return (
    <VisibleTravelArticleShareTripCta
      key={`${travel.id}:${authState}`}
      travel={travel}
      isMobile={isMobile}
      authState={authState}
    />
  )
})

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  button: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
})

export default TravelArticleShareTripCta
