import { useRouter, type Href } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { Platform, Pressable, StyleSheet, View } from 'react-native'

import type { PlaceRequest } from '@/api/placeRequests'
import Button from '@/components/ui/Button'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { Body, Caption, Heading } from '@/components/ui/Typography'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { useTrackedImpression } from '@/hooks/useTrackedImpression'
import { useTranslation } from '@/i18n/LocaleProvider'
import { openExternalUrl } from '@/utils/externalLinks'
import { trackPlaceContribution } from '@/utils/placeContributionAnalytics'
import { buildPlaceRequestCreateHref, type PlaceContributionSource } from '@/utils/placeRequestCreateIntent'

export default function PlaceRequestCard({
  request,
  regionLabel,
  source,
  onReadMore,
}: {
  request: PlaceRequest
  regionLabel: string
  source: PlaceContributionSource
  /** In a collection the history is clamped and opens the place's own view. */
  onReadMore?: () => void
}) {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const { isMobile } = useResponsive()
  const router = useRouter()
  const { id, name, description, preview, publicTravelUrl, status } = request
  const isOpen = status === 'open'
  const impression = useTrackedImpression(`place-contribution:${source}:${id}`, () => {
    if (isOpen) trackPlaceContribution('impression', { source, requestId: id })
  })
  const mediaHeight = source === 'map'
    ? 220
    : onReadMore
      ? (isMobile ? 240 : 280)
      : (isMobile ? 300 : 420)

  function openEditor() {
    trackPlaceContribution('cta', { source, requestId: id, mode: 'full', action: 'create' })
    router.push(buildPlaceRequestCreateHref({ requestId: id, source }, 'full') as Href)
  }

  function openMap() {
    trackPlaceContribution('cta', { source, requestId: id, action: 'map' })
    router.push({
      pathname: '/map',
      params: { place_request_id: id },
    })
  }

  const statusLabel = isOpen
    ? t('places:contributions.statusOpen')
    : status === 'fulfilled'
      ? t('places:contributions.fulfilled')
      : t('places:contributions.unavailable')

  return (
    <View
      ref={impression.ref}
      onLayout={impression.onLayout}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        Platform.OS === 'web'
          ? styles.cardShadow
          : { shadowColor: colors.text, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
      ]}
      testID={`place-request-card-${id}`}
    >
      <View style={styles.media}>
        <ImageCardMedia
          src={preview?.url ?? null}
          alt={preview ? name : ''}
          height={mediaHeight}
          width="100%"
          fit="contain"
          blurBackground
          optimizeWeb={false}
        />
        <View
          style={[styles.badge, { backgroundColor: colors.surface, borderColor: colors.border }]}
          pointerEvents="none"
        >
          <Feather
            name={isOpen ? 'heart' : status === 'fulfilled' ? 'check' : 'info'}
            size={14}
            color={isOpen ? colors.primaryDark : colors.textMuted}
          />
          <Body variant="small" numberOfLines={1} color={isOpen ? colors.primaryText : colors.textMuted}>
            {statusLabel}
          </Body>
        </View>
      </View>
      <View style={styles.content}>
        <View style={styles.copy}>
          <Heading level={3}>{name}</Heading>
          <Body variant="small" muted>
            {request.categoryName ? `${regionLabel} · ${request.categoryName}` : regionLabel}
          </Body>
          {description ? (
            <View style={styles.section}>
              <Caption>{t('places:contributions.aboutPlace')}</Caption>
              <Body numberOfLines={onReadMore ? DESCRIPTION_PREVIEW_LINES : undefined}>{description}</Body>
              {onReadMore ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`${t('places:contributions.readMore')}: ${name}`}
                  onPress={onReadMore}
                  style={styles.creditLink}
                  testID={`place-request-read-more-${request.id}`}
                >
                  <Body variant="small" color={colors.primaryText}>{t('places:contributions.readMore')}</Body>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {preview ? (
            <View style={styles.credit}>
              <Caption numberOfLines={2}>{preview.credit}</Caption>
              <View style={styles.creditLinks}>
                <Pressable accessibilityRole="link" onPress={() => { void openExternalUrl(preview.sourceUrl) }} style={styles.creditLink}>
                  <Body variant="small" color={colors.primaryText}>{t('places:contributions.source')}</Body>
                </Pressable>
                <Pressable accessibilityRole="link" onPress={() => { void openExternalUrl(preview.licenseUrl) }} style={styles.creditLink}>
                  <Body variant="small" color={colors.primaryText}>{t('places:contributions.license')}</Body>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
        <View style={styles.actions}>
          {isOpen ? (
            <>
              <Button label={t('places:contributions.writeArticle')} onPress={openEditor} style={styles.actionButton} />
              {source !== 'map' && (
                <Button label={t('places:contributions.viewMap')} onPress={openMap} variant="secondary" style={styles.actionButton} />
              )}
            </>
          ) : status === 'fulfilled' && publicTravelUrl ? (
            <Button label={t('places:contributions.readStory')} onPress={() => router.push(publicTravelUrl as Href)} style={styles.actionButton} />
          ) : null}
        </View>
      </View>
    </View>
  )
}

const DESCRIPTION_PREVIEW_LINES = 4

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: DESIGN_TOKENS.radii.xl,
    overflow: 'hidden',
  },
  cardShadow: { boxShadow: DESIGN_TOKENS.shadows.card },
  media: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: DESIGN_TOKENS.spacing.sm,
    left: DESIGN_TOKENS.spacing.sm,
    zIndex: 2,
    maxWidth: '88%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 1,
  },
  content: {
    flex: 1,
    gap: DESIGN_TOKENS.spacing.md,
    padding: DESIGN_TOKENS.spacing.md,
    paddingTop: DESIGN_TOKENS.spacing.sm,
  },
  copy: { gap: DESIGN_TOKENS.spacing.xs },
  section: { gap: DESIGN_TOKENS.spacing.xxs, marginTop: DESIGN_TOKENS.spacing.xs },
  credit: { marginTop: DESIGN_TOKENS.spacing.xs, gap: DESIGN_TOKENS.spacing.xxs },
  creditLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.md },
  creditLink: { minHeight: DESIGN_TOKENS.touchTarget.minHeight, justifyContent: 'center' },
  actions: {
    marginTop: 'auto',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  actionButton: { maxWidth: '100%', flexShrink: 1 },
})
