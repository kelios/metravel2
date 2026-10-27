import React, { memo, useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'

import Button from '@/components/ui/Button'
import { resolveOwnerId } from '@/components/travel/compactSideBar/helpers'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useAuth } from '@/context/AuthContext'
import { useTrackedImpression } from '@/hooks/useTrackedImpression'
import { useTranslation } from '@/i18n/LocaleProvider'
import type { Travel, TravelPublicationFormat } from '@/types/types'
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
  const fullLabel = t('travel:articleShareTrip.fullAction')
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

  // #2829: основной вход — короткая заметка (#2666), полный мастер — второй выбор;
  // контекст статьи (страна, место) едет в обоих.
  const openCreate = useCallback((mode: TravelPublicationFormat) => {
    const createHref = buildTravelArticleCreateHref(travel, mode)
    trackContentCreateCtaClicked({
      contentType: 'route',
      source: 'travel_article',
      intent: 'share-trip',
      sourceTravelId: travel.id,
      authState,
      action: authState === 'guest' ? 'register' : 'create',
      mode,
    })
    router.push((authState === 'guest'
      ? buildRegistrationHref({ redirect: createHref, intent: 'share-trip' })
      : createHref) as never)
  }, [authState, router, travel])
  const handleNotePress = useCallback(() => openCreate('note'), [openCreate])
  const handleFullPress = useCallback(() => openCreate('full'), [openCreate])

  return (
    <View
      ref={impression.ref}
      onLayout={impression.onLayout}
      style={[styles.container, !isMobile && styles.containerRow]}
      testID="travel-article-share-trip"
    >
      <Button
        label={label}
        accessibilityLabel={label}
        onPress={handleNotePress}
        variant="soft"
        fullWidth={isMobile}
        labelNumberOfLines={0}
        style={styles.button}
        testID="travel-article-share-trip-button"
      />
      <Button
        label={fullLabel}
        accessibilityLabel={fullLabel}
        onPress={handleFullPress}
        variant="ghost"
        fullWidth={isMobile}
        labelNumberOfLines={0}
        style={styles.button}
        testID="travel-article-share-trip-full-button"
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
    gap: DESIGN_TOKENS.spacing.xs,
    marginTop: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  containerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  button: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
})

export default TravelArticleShareTripCta
