import React, { useEffect, useMemo } from 'react'
import { Dimensions, Platform } from 'react-native'
import { useIsFocused, useLocalSearchParams, useNavigation, useRouter } from 'expo-router'

import QuestCountryLandingSections from '@/components/quests/QuestCountryLandingSections'
import {
  getQuestLandingRouteParam,
  QUEST_LANDING_DESCRIPTION_META_TARGETS,
  QUEST_LIST_ROUTE,
  QuestLandingGrid,
  QuestLandingHeader,
  QuestLandingLoading,
  QuestLandingScroll,
  QuestLandingSectionTitle,
  renderQuestLandingStructuredData,
  useQuestLandingHeadMeta,
  useQuestLandingSsgFallbackCleanup,
} from '@/components/quests/QuestLandingLayout'
import type { QuestLandingMetaTarget } from '@/components/quests/QuestLandingLayout'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { useQuestCatalogResponsiveModel } from '@/hooks/useQuestCatalogResponsiveModel'
import { useQuestReturnVisit } from '@/hooks/useQuestReturnVisit'
import { useQuestsList } from '@/hooks/useQuestsApi'
import { useBreakpoints } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { useLocale, useTranslation } from '@/i18n/LocaleProvider'
import { getStyles } from '@/screens/tabs/QuestsScreen.styles'
import { QUESTS_GRID_WEB_GAP, QUESTS_LANDING_CONTENT_WIDTH } from '@/constants/questLayout'
import { pluralizeQuest } from '@/screens/tabs/questsShared'
import { buildQuestCountryLandingGroups } from '@/utils/questCountryLanding'

import { buildBrandedSeoTitle } from '@/utils/questSeo'
import { buildCanonicalUrl, buildOgImageUrl, QUESTS_OG_IMAGE_PATH } from '@/utils/seo'

const COUNTRY_HEADER_BLOCK_STYLE = { gap: 8, width: '100%', maxWidth: 840 } as const

export default function QuestsByCountryScreen() {
  useQuestReturnVisit()

  const params = useLocalSearchParams<{ country?: string | string[] }>()
  const countryParam = getQuestLandingRouteParam(params.country).trim().toLowerCase()
  const router = useRouter()
  const navigation = useNavigation()
  const isFocused = useIsFocused()
  const colors = useThemedColors()
  const { locale } = useLocale()
  const { t } = useTranslation()
  const { quests, loading } = useQuestsList()

  const countryGroups = useMemo(
    () => buildQuestCountryLandingGroups(quests, { locale }),
    [locale, quests],
  )
  const country = useMemo(
    () => countryGroups.find((candidate) => candidate.countryAlias === countryParam) ?? null,
    [countryGroups, countryParam],
  )
  const countryQuests = useMemo(() => country?.quests ?? [], [country])

  useEffect(() => {
    if (Platform.OS !== 'web' || (!loading && !country)) router.replace(QUEST_LIST_ROUTE)
  }, [country, loading, router])

  useEffect(() => {
    if (country?.countryName) navigation.setOptions({ title: country.countryName })
  }, [country?.countryName, navigation])

  const { width: bpWidth, isMobile } = useBreakpoints()
  const height = Platform.OS === 'web' ? 0 : Dimensions.get('window').height
  const s = useMemo(() => getStyles(colors, bpWidth, height), [bpWidth, colors, height])
  const catalogModel = useQuestCatalogResponsiveModel(countryQuests.length, { hasSidebar: false, contentMaxWidth: QUESTS_LANDING_CONTENT_WIDTH, columnGap: QUESTS_GRID_WEB_GAP })
  const countryName = country?.countryName || countryParam
  const canonical = buildCanonicalUrl(`/quests/country/${country?.countryAlias || countryParam}`)
  const seoTitle = useMemo(
    () => buildBrandedSeoTitle(t('quests:app.tabs.quests.country.index.seoTitle', {
      value1: countryName,
    })),
    [countryName, t],
  )
  const seoDescription = useMemo(
    () => t('quests:app.tabs.quests.country.index.metaDescription', {
      value1: countryName,
      value2: pluralizeQuest(countryQuests.length),
      value3: country?.cities.length ?? 0,
    }),
    [country?.cities.length, countryName, countryQuests.length, t],
  )
  const managedMetaTargets = useMemo<QuestLandingMetaTarget[]>(() => [
    ...QUEST_LANDING_DESCRIPTION_META_TARGETS.map((target) => ({ ...target, content: seoDescription })),
    {
      selector: 'meta[property="og:url"]',
      attributes: { property: 'og:url' },
      content: canonical,
    },
  ], [canonical, seoDescription])
  useQuestLandingHeadMeta(Boolean(country) && isFocused && Platform.OS === 'web', managedMetaTargets)
  // Статический блок страны из SSG (`section[data-ssg-quest-country]`) — сосед #root,
  // гидратация его не снимает; стиль `rnw-styles-ready` лишь прячет его, и в DOM
  // оставался второй, скрытый H1. Снимаем, когда экран страны нарисован (#2087).
  useQuestLandingSsgFallbackCleanup(!loading && Boolean(country) && isFocused && Platform.OS === 'web', 'country')

  const structuredData = useMemo(() => {
    if (!country || countryQuests.length === 0) return null
    return renderQuestLandingStructuredData({
      quests: countryQuests,
      name: t('quests:app.tabs.quests.country.index.title', { value1: countryName }),
      crumbName: countryName,
      catalogCrumbName: t('quests:screens.tabs.QuestsSeoIntroFaq.eyebrow'),
      canonical,
      keyPrefix: 'quests-country',
    })
  }, [canonical, country, countryName, countryQuests, t])

  if (loading || !country || Platform.OS !== 'web') {
    return <QuestLandingLoading styles={s} colors={colors} />
  }

  return (
    <QuestLandingScroll styles={s} isMobile={isMobile}>
      {isFocused ? (
        <InstantSEO
          headKey={`quests-country-${country.countryAlias}`}
          title={seoTitle}
          description={seoDescription}
          canonical={canonical}
          ogType="website"
          image={buildOgImageUrl(QUESTS_OG_IMAGE_PATH)}
          additionalTags={structuredData}
        />
      ) : null}

      <QuestLandingHeader
        colors={colors}
        backLabel={t('quests:app.tabs.quests.country.index.back')}
        eyebrowIcon="globe"
        eyebrow={t('quests:app.tabs.quests.country.index.eyebrow')}
        title={t('quests:app.tabs.quests.country.index.title', { value1: countryName })}
        lead={t('quests:app.tabs.quests.country.index.lead', {
          value1: countryName,
          value2: pluralizeQuest(countryQuests.length),
        })}
        meta={
          <>
            {pluralizeQuest(countryQuests.length)} · {t('quests:app.tabs.quests.country.index.cityCount', {
              value1: country.cities.length,
            })}
          </>
        }
        blockStyle={COUNTRY_HEADER_BLOCK_STYLE}
      />

      <QuestCountryLandingSections country={country} />

      <QuestLandingSectionTitle colors={colors}>
        {t('quests:app.tabs.quests.country.index.routesTitle', { value1: countryName })}
      </QuestLandingSectionTitle>
      <QuestLandingGrid
        styles={s}
        quests={countryQuests}
        cardColumns={catalogModel.cardColumns}
        cardWidth={catalogModel.cardWidth}
      />
    </QuestLandingScroll>
  )
}
