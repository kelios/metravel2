import React, { memo, useCallback, useMemo } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useRouter } from 'expo-router'

import PeerBadgeGiveButton from '@/components/achievements/PeerBadgeGiveButton'
import Button from '@/components/ui/Button'
import { resolveOwnerId } from '@/components/travel/compactSideBar/helpers'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useAuth } from '@/context/AuthContext'
import { useUserAchievements } from '@/hooks/useAchievementsApi'
import { useThemedColors } from '@/hooks/useTheme'
import { useTrackedImpression } from '@/hooks/useTrackedImpression'
import { useTranslation } from '@/i18n/LocaleProvider'
import type { Travel } from '@/types/types'
import { buildLoginHref, getWebRedirectPath } from '@/utils/authNavigation'
import { trackPeerBadgePromptClicked, trackPeerBadgePromptImpression } from '@/utils/growthFunnelAnalytics'

type Props = { travel: Travel; isMobile: boolean; hasArticleText: boolean }

function TravelPeerBadgePrompt({ travel, isMobile, hasArticleText }: Props) {
  const { authReady, isAuthenticated, userId } = useAuth()
  const { t } = useTranslation()
  const router = useRouter()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const authorId = Number(resolveOwnerId(travel))
  const travelId = Number(travel.id)
  const viewerId = Number(userId)
  const validTarget = Number.isSafeInteger(authorId) && authorId > 0
    && Number.isSafeInteger(travelId) && travelId > 0
  const knownViewer = Number.isSafeInteger(viewerId) && viewerId > 0
  const eligible = validTarget && hasArticleText && authReady
    && (!isAuthenticated || (knownViewer && viewerId !== authorId))
  const author = useUserAchievements(eligible && isAuthenticated ? authorId : null)
  const impression = useTrackedImpression(
    `peer-badge-prompt:${travel.id}`,
    useCallback(() => trackPeerBadgePromptImpression({ travelId }), [travelId]),
  )
  const trackClick = useCallback(() => trackPeerBadgePromptClicked({ travelId }), [travelId])
  const login = useCallback(() => {
    trackClick()
    const fallbackRedirect = `/travels/${travel.slug || travel.id}`
    router.push(buildLoginHref({
      redirect: getWebRedirectPath(fallbackRedirect),
      fallbackRedirect,
      intent: 'peer-badge',
    }) as never)
  }, [router, trackClick, travel.id, travel.slug])

  if (!eligible) return null

  const action = t('travel:peerBadgePrompt.action')
  return (
    <View
      ref={impression.ref}
      onLayout={impression.onLayout}
      style={styles.container}
      testID="travel-peer-badge-prompt"
    >
      <Text style={styles.title}>{t('travel:peerBadgePrompt.title')}</Text>
      {!isAuthenticated ? (
        <Button
          label={action}
          accessibilityLabel={action}
          icon={<Feather name="award" size={16} color={colors.primaryText} />}
          onPress={login}
          fullWidth={isMobile}
          labelNumberOfLines={0}
          variant="soft"
          testID="travel-peer-badge-prompt-action"
        />
      ) : author.isError ? (
        <View style={styles.status}>
          <Text accessibilityRole="alert" style={styles.error}>{t('common:feedback.actionError')}</Text>
          <Button
            label={t('sharedStatic:errors.retry')}
            onPress={() => { void author.refetch() }}
            loading={author.isFetching}
            variant="soft"
            testID="travel-peer-badge-prompt-retry"
          />
        </View>
      ) : !author.isSuccess || !author.data ? (
        <ActivityIndicator color={colors.primary} testID="travel-peer-badge-prompt-loading" />
      ) : (
        <PeerBadgeGiveButton
          key={`${travelId}:${authorId}:${userId}`}
          target="user"
          recipientId={authorId}
          received={author.data.peerReceived}
          label={action}
          pickerTitle={action}
          onPress={trackClick}
          fullWidth={isMobile}
          testID="travel-peer-badge-prompt-action"
        />
      )}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    marginVertical: DESIGN_TOKENS.spacing.md,
    padding: DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.surface,
    alignItems: 'flex-start',
  },
  title: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
    lineHeight: 24,
  },
  status: { gap: DESIGN_TOKENS.spacing.sm },
  error: { color: colors.textMuted, fontSize: DESIGN_TOKENS.typography.sizes.sm },
})

export default memo(TravelPeerBadgePrompt)
