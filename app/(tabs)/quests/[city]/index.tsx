import React, { useEffect, useMemo } from 'react'
import { Dimensions, Platform } from 'react-native'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { useIsFocused } from 'expo-router'

import InstantSEO from '@/components/seo/LazyInstantSEO'
import QuestCityLandingSections from '@/components/quests/QuestCityLandingSections'
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
import TravelsForQuestSection from '@/components/quests/TravelsForQuestSection'
import { pluralizeQuest } from '@/screens/tabs/questsShared'
import { getStyles } from '@/screens/tabs/QuestsScreen.styles'
import { QUESTS_GRID_WEB_GAP, QUESTS_LANDING_CONTENT_WIDTH } from '@/constants/questLayout'
import { useQuestsList } from '@/hooks/useQuestsApi'
import { useQuestCityWalk } from '@/hooks/useQuestCityWalk'
import { useQuestReturnVisit } from '@/hooks/useQuestReturnVisit'
import { useQuestCatalogResponsiveModel } from '@/hooks/useQuestCatalogResponsiveModel'
import { useBreakpoints } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { buildCanonicalUrl, buildOgImageUrl, QUESTS_OG_IMAGE_PATH } from '@/utils/seo'
import { buildBrandedSeoTitle } from '@/utils/questSeo'
import {
  buildQuestCityLandingGroups,
  findNearbyQuestCityGroups,
  resolveQuestCitySegment,
} from '@/utils/questCityAlias'

import { useTranslation } from '@/i18n/LocaleProvider'

const CITY_HEADER_BLOCK_STYLE = { gap: 8, maxWidth: 760 } as const

export default function QuestsByCityScreen() {
  // #1484: возвратное напоминание ведёт именно на лендинг города, поэтому
  // возврат считается и здесь, а не только в общем каталоге.
  useQuestReturnVisit()

  const params = useLocalSearchParams<{ city?: string | string[] }>()
  const cityParam = getQuestLandingRouteParam(params.city)
  const router = useRouter()
  const navigation = useNavigation()
  const isFocused = useIsFocused()
  const colors = useThemedColors()
  const { t } = useTranslation()

  const { quests, loading } = useQuestsList()

  const cityGroups = useMemo(() => buildQuestCityLandingGroups(quests), [quests])

  const resolved = useMemo(
    () => (loading ? null : resolveQuestCitySegment(cityParam, quests)),
    [cityParam, quests, loading],
  )

  const cityGroup = useMemo(
    () => (resolved ? cityGroups.find((group) => group.segment === resolved.segment) ?? null : null),
    [cityGroups, resolved],
  )
  const cityQuests = useMemo(() => cityGroup?.quests ?? [], [cityGroup])
  const nearbyCities = useMemo(
    () => (cityGroup ? findNearbyQuestCityGroups(cityGroup, cityGroups, { limit: 4 }) : []),
    [cityGroup, cityGroups],
  )
  // Заметки о местах города приходят из бандлов его квестов и дописывают
  // страницу до самостоятельного содержания (#1569). Секции города рисуются
  // только на вебе, поэтому и запросы бандлов живут там же.
  const walk = useQuestCityWalk(cityQuests, {
    enabled: Platform.OS === 'web' && Boolean(cityGroup),
  })

  const cityCoords = useMemo(
    () => cityQuests
      .filter((quest) => Number.isFinite(quest.lat) && Number.isFinite(quest.lng))
      .map((quest) => ({ lat: quest.lat, lng: quest.lng })),
    [cityQuests],
  )

  const cityName = cityGroup?.cityName || ''
  const canonicalSegment = cityGroup?.segment || cityParam
  const canonical = buildCanonicalUrl(`/quests/${canonicalSegment}`)

  // Unknown city (no quests) → fall back to the full catalog.
  useEffect(() => {
    if (!loading && !resolved) {
      router.replace(QUEST_LIST_ROUTE)
    }
  }, [loading, resolved, router])

  // Navigation/stack header title = localized city name (from the resolved
  // city_name), never the raw URL segment («4» / «minsk»). Matches the pattern
  // used by the travel details screen.
  useEffect(() => {
    if (cityName) navigation.setOptions({ title: cityName })
  }, [navigation, cityName])

  // The shared SSG fallback is a sibling of #root, so React hydration cannot
  // remove it. Once this resolved city screen owns the visible H1, discard only
  // the explicitly marked stale fallback and leave other route content alone.
  //
  // #1569: ждём и заметки о местах. Статический блок к этому моменту уже скрыт
  // стилем `rnw-styles-ready`, поэтому двойного текста на экране нет, а вот
  // снять его ДО того, как рантайм получил бандлы, значило бы на секунды
  // оставить отрендеренную страницу без того самого содержания, ради которого
  // она переписана.
  useQuestLandingSsgFallbackCleanup(Boolean(cityGroup) && isFocused && Platform.OS === 'web' && Boolean(walk), 'city')

  const { width: bpWidth, isMobile } = useBreakpoints()
  const height = Platform.OS === 'web' ? 0 : Dimensions.get('window').height
  const s = useMemo(() => getStyles(colors, bpWidth, height), [colors, bpWidth, height])
  const catalogModel = useQuestCatalogResponsiveModel(cityQuests.length, { hasSidebar: false, contentMaxWidth: QUESTS_LANDING_CONTENT_WIDTH, columnGap: QUESTS_GRID_WEB_GAP })

  const seoTitle = useMemo(
    () => buildBrandedSeoTitle(t('quests:app.tabs.quests.city.index.seoTitle', { value1: cityName || cityParam })),
    [cityName, cityParam, t],
  )
  const seoDescription = useMemo(
    () => t('quests:app.tabs.quests.city.index.metaDescription', {
      value1: cityName || cityParam,
      value2: pluralizeQuest(cityQuests.length),
    }),
    [cityName, cityParam, cityQuests.length, t],
  )
  const descriptionMetaTargets = useMemo(
    () => QUEST_LANDING_DESCRIPTION_META_TARGETS.map((target) => ({ ...target, content: seoDescription })),
    [seoDescription],
  )
  useQuestLandingHeadMeta(Boolean(cityGroup) && isFocused && Platform.OS === 'web', descriptionMetaTargets)

  const structuredData = useMemo(() => {
    if (!cityGroup || cityQuests.length === 0) return null
    return renderQuestLandingStructuredData({
      quests: cityQuests,
      name: t('quests:app.tabs.quests.city.index.title', { value1: cityName || cityParam }),
      crumbName: cityName || cityParam,
      catalogCrumbName: t('quests:screens.tabs.QuestsSeoIntroFaq.eyebrow'),
      canonical,
      keyPrefix: 'quests-city',
    })
  }, [cityGroup, cityQuests, cityName, cityParam, canonical, t])

  if (loading || !cityGroup) {
    return <QuestLandingLoading styles={s} colors={colors} />
  }

  const heading = t('quests:app.tabs.quests.city.index.title', { value1: cityName || cityParam })

  return (
    <QuestLandingScroll styles={s} isMobile={isMobile}>
      {isFocused ? (
        <InstantSEO
          headKey={`quests-city-${canonicalSegment}`}
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
        backLabel={t('quests:app.tabs.quests.city.index.back')}
        eyebrowIcon="compass"
        eyebrow={t('quests:app.tabs.quests.city.index.eyebrow')}
        title={heading}
        lead={t('quests:app.tabs.quests.city.index.lead', { value1: cityName || cityParam })}
        meta={pluralizeQuest(cityQuests.length)}
        blockStyle={CITY_HEADER_BLOCK_STYLE}
      />

      {Platform.OS === 'web' ? (
        <>
          <QuestCityLandingSections city={cityGroup} nearbyCities={nearbyCities} walk={walk} />
          <QuestLandingSectionTitle colors={colors}>
            {t('quests:app.tabs.quests.city.index.routesTitle', { value1: cityName || cityParam })}
          </QuestLandingSectionTitle>
        </>
      ) : null}

      <QuestLandingGrid
        styles={s}
        quests={cityQuests}
        cardColumns={catalogModel.cardColumns}
        cardWidth={catalogModel.cardWidth}
      />

      {Platform.OS === 'web' ? (
        <TravelsForQuestSection
          cityName={cityGroup.cityName}
          countryName={cityGroup.countryName}
          countryCode={cityGroup.countryCode}
          coords={cityCoords}
        />
      ) : null}
    </QuestLandingScroll>
  )
}
