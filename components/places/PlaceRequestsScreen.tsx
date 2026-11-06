import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'

import { ApiError } from '@/api/client'
import { ResponsiveContainer } from '@/components/layout'
import { asBottomDimension, useScrollBottomPadding } from '@/components/layout/bottomChromeInset'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import { Body, Heading } from '@/components/ui/Typography'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useHydrationReady } from '@/hooks/useHydrationReady'
import { usePlaceRequest, usePlaceRequests } from '@/hooks/usePlaceRequests'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { formatNumber } from '@/i18n'
import { useTranslation } from '@/i18n/LocaleProvider'
import {
  buildPlaceRequestsHref,
  normalizePlaceContributionSource,
  normalizePlaceRequestId,
  normalizePlaceRequestRegion,
  PLACE_REQUESTS_PATH,
} from '@/utils/placeRequestCreateIntent'
import { buildCanonicalUrl } from '@/utils/seo'
import { SCREEN_CONTENT_FIRST_PROPS } from '@/utils/screenContentMarker'

import PlaceRequestCard from './PlaceRequestCard'

const REGION_LABELS = {
  brest: 'places:contributions.regions.brest',
  vitebsk: 'places:contributions.regions.vitebsk',
  gomel: 'places:contributions.regions.gomel',
  grodno: 'places:contributions.regions.grodno',
  minsk: 'places:contributions.regions.minsk',
  mogilev: 'places:contributions.regions.mogilev',
} as const
const REGIONS = Object.keys(REGION_LABELS) as (keyof typeof REGION_LABELS)[]
const STEPS = [
  'places:contributions.stepPhoto',
  'places:contributions.stepStory',
  'places:contributions.stepPublish',
] as const

export default function PlaceRequestsScreen() {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const router = useRouter()
  const { isMobile, isDesktop } = useResponsive()
  const bottomPadding = useScrollBottomPadding(DESIGN_TOKENS.spacing.xl)
  const searchParams = useLocalSearchParams()
  const hydrationReady = useHydrationReady()
  // The static document has no query parameters. Wait for hydration before
  // selecting a route mode or fetching, so a detail link never loads the list.
  const params = hydrationReady ? searchParams : undefined
  const source = normalizePlaceContributionSource(params?.source)
  const selectedRegion = normalizePlaceRequestRegion(params?.region)
  const requestId = normalizePlaceRequestId(params?.request)
  const isDetail = params?.request !== undefined
  const collection = usePlaceRequests(hydrationReady && !isDetail)
  const detail = usePlaceRequest(requestId)
  const items = hydrationReady ? collection.data ?? [] : []
  const regions = [...new Set([...REGIONS, ...items.map(({ region }) => region)])]
  const visibleItems = selectedRegion ? items.filter(({ region }) => region === selectedRegion) : items
  const isUnavailable = isDetail && (!requestId || detail.error instanceof ApiError && detail.error.status === 404)
  const currentQuery = isDetail ? detail : collection
  const gridItemWidth = isDesktop ? '32%' : isMobile ? '100%' : '48%'

  const getRegionLabel = (value: string) => {
    const region = REGIONS.find((entry) => entry === value)
    return region ? t(REGION_LABELS[region]) : value
  }

  function clearDetail() {
    router.replace(buildPlaceRequestsHref(source, { region: selectedRegion }) as Href)
  }

  const invitationCards = isDetail ? (detail.data ? [detail.data] : []) : visibleItems
  const showError = hydrationReady && !isUnavailable && currentQuery.isError
  const isPending = !hydrationReady || (!isUnavailable && currentQuery.isPending)

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: asBottomDimension(bottomPadding) }}
      testID="place-requests-screen"
    >
      <InstantSEO
        title={t('places:contributions.seoTitle')}
        description={t('places:contributions.seoDescription')}
        canonical={buildCanonicalUrl(PLACE_REQUESTS_PATH)}
        robots="noindex, follow"
      />
      <ResponsiveContainer maxWidth="xl" style={styles.page}>
        <View style={styles.hero} {...SCREEN_CONTENT_FIRST_PROPS}>
          <View style={[styles.heroIcon, { backgroundColor: colors.primarySoft }]}>
            <Feather name="heart" color={colors.primaryText} size={24} />
          </View>
          <Heading level={1}>{t('places:contributions.title')}</Heading>
          <Body variant="large" muted>{t('places:contributions.intro')}</Body>
        </View>

        <View style={styles.collection}>
          <Heading level={2}>{t('places:contributions.placesTitle')}</Heading>
          {isDetail ? (
            <Button label={t('places:contributions.backToRequests')} onPress={clearDetail} variant="secondary" />
          ) : (
            <View style={styles.filters}>
              <Chip label={t('places:contributions.allRegions')} selected={!selectedRegion} onPress={() => router.setParams({ region: undefined })} />
              {regions.map((region) => (
                <Chip
                  key={region}
                  label={getRegionLabel(region)}
                  selected={region === selectedRegion}
                  onPress={() => router.setParams({ region })}
                />
              ))}
            </View>
          )}

          {isUnavailable || isPending || showError || !invitationCards.length ? (
            <View accessibilityLiveRegion="polite" style={styles.state}>
              {isPending ? <ActivityIndicator color={colors.primary} /> : null}
              <Body muted>
                {isUnavailable ? t('places:contributions.unavailable')
                  : isPending ? t('places:contributions.loading')
                    : showError ? t('places:contributions.loadError')
                      : selectedRegion ? t('places:contributions.emptyRegion') : t('places:contributions.empty')}
              </Body>
              {showError ? (
                <Button label={t('places:contributions.retry')} onPress={() => { void currentQuery.refetch() }} />
              ) : !isDetail && !isPending && selectedRegion ? (
                <Button label={t('places:contributions.resetFilter')} onPress={() => router.setParams({ region: undefined })} variant="secondary" />
              ) : null}
            </View>
          ) : (
            <View style={styles.grid}>
              {invitationCards.map((request) => (
                <View key={request.id} style={{ width: gridItemWidth }}>
                  <PlaceRequestCard request={request} regionLabel={getRegionLabel(request.region)} source={source} />
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.steps}>
          <Heading level={2}>{t('places:contributions.stepsTitle')}</Heading>
          {STEPS.map((step, index) => (
            <View key={step} style={styles.step}>
              <Body variant="strong" color={colors.primaryText}>{formatNumber(index + 1)}.</Body>
              <Body style={styles.stepText}>{t(step)}</Body>
            </View>
          ))}
        </View>
      </ResponsiveContainer>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { gap: DESIGN_TOKENS.spacing.lg },
  hero: { maxWidth: 740, gap: DESIGN_TOKENS.spacing.sm },
  heroIcon: {
    width: DESIGN_TOKENS.touchTarget.minHeight,
    height: DESIGN_TOKENS.touchTarget.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: DESIGN_TOKENS.radii.full,
  },
  collection: { gap: DESIGN_TOKENS.spacing.md },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.sm },
  state: { gap: DESIGN_TOKENS.spacing.sm, alignItems: 'flex-start', paddingVertical: DESIGN_TOKENS.spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: '2%', rowGap: DESIGN_TOKENS.spacing.md },
  steps: { gap: DESIGN_TOKENS.spacing.sm, maxWidth: 740 },
  step: { flexDirection: 'row', gap: DESIGN_TOKENS.spacing.sm },
  stepText: { flex: 1 },
})
