import { useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'

import { ApiError } from '@/api/client'
import { Heading } from '@/components/ui/Typography'
import type { PlaceRequest } from '@/api/placeRequests'
import UpsertTravel from '@/components/travel/UpsertTravel'
import Button from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useAuth } from '@/context/AuthContext'
import { usePlaceRequest } from '@/hooks/usePlaceRequests'
import { useThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'
import { buildPlaceRequestsHref, type PlaceRequestCreateIntent } from '@/utils/placeRequestCreateIntent'
import { isPlaceRequestsPilotEnabled } from '@/utils/placeRequestsConfig'

type StatusProps = {
  intent?: PlaceRequestCreateIntent
  request?: PlaceRequest
  failed?: boolean
  onRetry?: () => void
}

export function PlaceRequestEditorUnavailable({ intent, request, failed, onRetry }: StatusProps) {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const router = useRouter()
  const article = request?.status === 'fulfilled' ? request.publicTravelUrl : null
  const pilotEnabled = isPlaceRequestsPilotEnabled()

  return (
    <View style={[styles.state, { backgroundColor: colors.background }]}>
      <Heading level={1} align="center">
        {failed ? t('places:contributions.loadError') : request?.status === 'fulfilled'
          ? t('places:contributions.fulfilled') : t('places:contributions.unavailable')}
      </Heading>
      {onRetry ? <Button label={t('places:contributions.retry')} onPress={onRetry} /> : null}
      {article ? <Button label={t('places:contributions.readStory')} onPress={() => router.push(article as Href)} /> : null}
      <Button
        label={pilotEnabled ? t('places:contributions.backToRequests') : t('navigationStatic:constants.headerNavigation.mesta_809c3d35')}
        variant="secondary"
        onPress={() => router.replace((pilotEnabled ? buildPlaceRequestsHref(intent?.source ?? 'places') : '/places') as Href)}
      />
    </View>
  )
}

type EntryProps = {
  intent: PlaceRequestCreateIntent
  hasId: boolean
}

export default function PlaceRequestEditorEntry(props: EntryProps) {
  const { userId, isAuthenticated } = useAuth()
  // Login, logout and account changes must validate a new invitation afresh.
  return <PlaceRequestEditor key={isAuthenticated ? userId : 'guest'} {...props} />
}

function PlaceRequestEditor({ intent, hasId }: EntryProps) {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const request = usePlaceRequest(intent.requestId, !hasId)
  // Keep the form mounted on harmless locale changes and background refetches.
  // A fresh editor entry still waits for a current invitation status.
  const [openedPlace, setOpenedPlace] = useState<PlaceRequest>()
  const missing = request.error instanceof ApiError && request.error.status === 404
  const closed = request.isSuccess && request.data.status !== 'open'
  if (!hasId && openedPlace && (closed || missing)) {
    setOpenedPlace(undefined)
  } else if (!openedPlace && request.isSuccess && request.data.status === 'open' && !request.isFetching) {
    setOpenedPlace(request.data)
  }
  const context = useMemo(() => ({ ...intent, place: openedPlace }), [intent, openedPlace])

  if (hasId || (openedPlace && !closed && !missing)) {
    return <UpsertTravel placeRequestContext={context} />
  }
  if (request.isPending || request.isFetching) {
    return <View style={styles.state}><ActivityIndicator color={colors.primary} accessibilityLabel={t('places:contributions.loading')} /></View>
  }
  const failed = request.isError && !missing
  return <PlaceRequestEditorUnavailable intent={intent} request={closed ? request.data : undefined} failed={failed} onRetry={failed ? () => { void request.refetch() } : undefined} />
}

const styles = StyleSheet.create({
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.md,
    padding: DESIGN_TOKENS.spacing.lg,
  },
})
