import { useRouter, type Href } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { Pressable, StyleSheet, View } from 'react-native'

import type { PlaceRequest } from '@/api/placeRequests'
import Button from '@/components/ui/Button'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { Body, Heading } from '@/components/ui/Typography'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useTrackedImpression } from '@/hooks/useTrackedImpression'
import { useTranslation } from '@/i18n/LocaleProvider'
import type { TravelPublicationFormat } from '@/types/types'
import { openExternalUrl } from '@/utils/externalLinks'
import { trackPlaceContribution } from '@/utils/placeContributionAnalytics'
import { buildPlaceRequestCreateHref, type PlaceContributionSource } from '@/utils/placeRequestCreateIntent'

export default function PlaceRequestCard({
  request,
  regionLabel,
  source,
}: {
  request: PlaceRequest
  regionLabel: string
  source: PlaceContributionSource
}) {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const router = useRouter()
  const { id, name, preview, publicTravelUrl, status } = request
  const isOpen = status === 'open'
  const impression = useTrackedImpression(`place-contribution:${source}:${id}`, () => {
    if (isOpen) trackPlaceContribution('impression', { source, requestId: id })
  })

  function openEditor(mode: TravelPublicationFormat) {
    trackPlaceContribution('cta', { source, requestId: id, mode, action: 'create' })
    router.push(buildPlaceRequestCreateHref({ requestId: id, source }, mode) as Href)
  }

  function openMap() {
    trackPlaceContribution('cta', { source, requestId: id, action: 'map' })
    router.push({
      pathname: '/map',
      params: { lat: String(request.lat), lng: String(request.lng), radius: '5', place_request_id: id },
    })
  }

  return (
    <View
      ref={impression.ref}
      onLayout={impression.onLayout}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      testID={`place-request-card-${id}`}
    >
      <ImageCardMedia
        src={preview?.url ?? null}
        alt={preview ? name : ''}
        height={176}
        width="100%"
        fit="contain"
        blurBackground
        optimizeWeb={false}
      />
      <View style={styles.content}>
        <View style={styles.status}>
          <Feather name={isOpen ? 'heart' : 'info'} size={15} color={colors.primaryText} />
          <Body variant="small" color={colors.primaryText}>
            {isOpen ? t('places:contributions.statusOpen') : status === 'fulfilled'
              ? t('places:contributions.fulfilled') : t('places:contributions.unavailable')}
          </Body>
        </View>
        <Heading level={3}>{name}</Heading>
        <Body variant="small" muted>{request.categoryName ? `${regionLabel} · ${request.categoryName}` : regionLabel}</Body>
        <Body>{request.prompt}</Body>
        {preview ? (
          <View style={styles.credit}>
            <Body variant="small" muted>{preview.credit}</Body>
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
        <View style={styles.actions}>
          {isOpen ? (
            <>
              <Button label={t('places:contributions.writeNote')} onPress={() => openEditor('note')} fullWidth />
              <Button label={t('places:contributions.writeArticle')} onPress={() => openEditor('full')} variant="ghost" fullWidth />
              <Button label={t('places:contributions.viewMap')} onPress={openMap} variant="secondary" fullWidth />
            </>
          ) : status === 'fulfilled' && publicTravelUrl ? (
            <Button label={t('places:contributions.readStory')} onPress={() => router.push(publicTravelUrl as Href)} fullWidth />
          ) : null}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: DESIGN_TOKENS.radii.xl,
    overflow: 'hidden',
  },
  content: { flex: 1, gap: DESIGN_TOKENS.spacing.sm, padding: DESIGN_TOKENS.spacing.md },
  status: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs },
  credit: { marginTop: DESIGN_TOKENS.spacing.xs },
  creditLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.md },
  creditLink: { minHeight: DESIGN_TOKENS.touchTarget.minHeight, justifyContent: 'center' },
  actions: { marginTop: 'auto', gap: DESIGN_TOKENS.spacing.xs },
})
