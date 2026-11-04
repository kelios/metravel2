import React, { memo, useCallback } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'

import Button from '@/components/ui/Button'
import { TravelDetailsDeferredTransition } from '@/components/travel/details/TravelDetailsDeferredTransition'
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

function TravelArticleShareTripActions({
  travel,
  isMobile,
  authState,
}: TravelArticleShareTripCtaProps & { authState: GrowthAuthState | null }) {
  const hidden = authState === null
  const router = useRouter()
  const { t } = useTranslation()
  const label = t('travel:articleShareTrip.action')
  const fullLabel = t('travel:articleShareTrip.fullAction')
  const impression = useTrackedImpression(
    `article-share-trip:${travel.id}:${authState}`,
    useCallback(() => {
      if (!authState) return
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
    if (!authState) return
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
      ref={hidden ? undefined : impression.ref}
      onLayout={hidden ? undefined : impression.onLayout}
      style={[styles.container, !isMobile && styles.containerRow, hidden && styles.hidden]}
      pointerEvents={hidden ? 'none' : undefined}
      aria-hidden={hidden || undefined}
      testID={hidden ? undefined : 'travel-article-share-trip'}
    >
      <Button
        disabled={hidden}
        label={label}
        accessibilityLabel={label}
        onPress={handleNotePress}
        variant="soft"
        fullWidth={isMobile}
        labelNumberOfLines={0}
        style={styles.button}
        testID={hidden ? undefined : 'travel-article-share-trip-button'}
      />
      <Button
        disabled={hidden}
        label={fullLabel}
        accessibilityLabel={fullLabel}
        onPress={handleFullPress}
        variant="ghost"
        fullWidth={isMobile}
        labelNumberOfLines={0}
        style={styles.button}
        testID={hidden ? undefined : 'travel-article-share-trip-full-button'}
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

  const showActions = authReady && (!isAuthenticated || Boolean(userId?.trim())) && !isOwner
  const authState = isAuthenticated ? 'authenticated' : 'guest'
  const actions = showActions ? (
    <TravelArticleShareTripActions key={`${travel.id}:${authState}`} travel={travel} isMobile={isMobile} authState={authState} />
  ) : null
  if (Platform.OS !== 'web') return actions

  // Keep the reader's position when a late owner check releases the reserved row.
  const reserve = isOwner ? null : (
    <TravelArticleShareTripActions travel={travel} isMobile={isMobile} authState={null} />
  )
  return (
    <TravelDetailsDeferredTransition
      key={travel.id}
      testID="travel-article-share-trip-transition"
      isMobile={isMobile}
      pending={false}
      placeholder={reserve}
      runtimeFrameReady
      allowEmptyRuntime
    >
      {actions ?? reserve}
    </TravelDetailsDeferredTransition>
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
  hidden: { opacity: 0 },
  button: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
})

export default TravelArticleShareTripCta
