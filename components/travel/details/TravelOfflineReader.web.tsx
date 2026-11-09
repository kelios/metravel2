import { useMemo, type ComponentProps } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTravelDetails } from '@/hooks/useTravelDetails'
import { useThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { asBottomDimension, useScrollBottomPadding } from '@/components/layout/bottomChromeInset'
import TravelDescriptionHtml from '@/components/travel/TravelDescriptionHtml.web'
import PointList from '@/components/travel/PointList'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { sanitizeRichText } from '@/utils/sanitizeRichText'
import { demoteRichTextPageHeadings } from '@/utils/richTextHeadings'
import { toInertHtml } from '@/utils/inertHtml'
import { webTouchScrollStyle } from '@/utils'
import { LoadError } from './TravelDetailsErrorStates'
import { getTravelDetailsSeoMetadata } from './hooks/travelDetailsContainerViewModel'
import type { Travel } from '@/types/types'

type ReadablePoint = Exclude<Travel['travelAddress'][number], string> & Partial<{ address: string; coord: string }>

/** The saved public content uses the same text/point renderers without online widgets. */
export default function TravelOfflineReader() {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const router = useRouter()
  const bottomPadding = useScrollBottomPadding(DESIGN_TOKENS.spacing.lg)
  const { travel, slug, isLoading, error, refetch } = useTravelDetails()
  const styles = useMemo(() => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: DESIGN_TOKENS.spacing.md, paddingBottom: asBottomDimension(bottomPadding), gap: DESIGN_TOKENS.spacing.lg },
    errorContainer: { padding: DESIGN_TOKENS.spacing.lg, gap: DESIGN_TOKENS.spacing.md },
    errorTitle: { color: colors.text, fontSize: DESIGN_TOKENS.typography.sizes.lg },
    errorText: { color: colors.textMuted },
    label: { color: colors.textMuted },
    heading: { color: colors.text, fontSize: DESIGN_TOKENS.typography.sizes.xl, fontWeight: '700' },
    subheading: { color: colors.text, fontSize: DESIGN_TOKENS.typography.sizes.lg, fontWeight: '600' },
  }), [bottomPadding, colors])
  const html = useMemo(() => toInertHtml(demoteRichTextPageHeadings(sanitizeRichText(
    travel?.rich_text?.description?.safe_html ?? travel?.description ?? '',
  ))), [travel?.description, travel?.rich_text?.description?.safe_html])
  const seo = travel ? getTravelDetailsSeoMetadata(travel, slug) : null
  const points = useMemo<ComponentProps<typeof PointList>['points']>(() =>
    (travel?.travelAddress ?? []).map((raw, index) => {
      if (typeof raw === 'string') return { id: String(index), address: raw, coord: '' }
      const point: ReadablePoint = raw
      return {
        ...point,
        id: String(point.id ?? index),
        address: point.address?.trim() || point.name?.trim() || '',
        coord: point.coord?.trim() || point.coords?.trim() || (point.lat != null && point.lng != null ? `${point.lat},${point.lng}` : ''),
      }
    }), [travel?.travelAddress])

  if (isLoading) return <View style={styles.safeArea}><ActivityIndicator color={colors.primaryDark} /></View>
  if (!travel) return <LoadError
    styles={styles}
    seoBlock={null}
    errorMessage={error?.message}
    onRetry={refetch}
    onGoHome={() => router.push('/search')}
    onOpenSaved={() => router.push('/offline')}
  />

  return (
    <ScrollView testID="travel-offline-reader" style={[styles.safeArea, webTouchScrollStyle]} contentContainerStyle={styles.content}>
      <InstantSEO title={seo?.readyTitle ?? travel.name} description={seo?.readyDesc ?? ''} canonical={seo?.canonicalUrl} />
      <Text style={styles.label}>{t('offline:availableOffline')}</Text>
      <Text accessibilityRole="header" aria-level={1} style={styles.heading}>{travel.name}</Text>
      <View testID="travel-details-description">
        <TravelDescriptionHtml html={html} fullWidth={false} />
      </View>
      {travel.travelAddress?.length > 0 && <View testID="travel-details-points">
        <Text accessibilityRole="header" aria-level={2} style={styles.subheading}>{t('travel:components.travel.details.sections.TravelPointsBlock.koordinaty_mest_149babcb')}</Text>
        <PointList
          points={points}
          baseUrl={travel.url}
          baseTravelId={travel.id}
          travelName={travel.name}
          addressImages={travel.media?.address_images}
        />
      </View>}
    </ScrollView>
  )
}
