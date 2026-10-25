import React, { Suspense, useCallback, useEffect, useMemo } from 'react'
import { Dimensions, Platform, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { useIsFocused } from 'expo-router'

import { useDockReservePx } from '@/components/layout/bottomChromeInset'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import QuestCityLandingSections from '@/components/quests/QuestCityLandingSections'
import {
  getQuestLandingRouteParam,
  QUEST_LANDING_DESCRIPTION_META_TARGETS,
  QuestLandingLoading,
  renderQuestLandingStructuredData,
  useQuestLandingHeadMeta,
  useQuestLandingNotFoundRedirect,
  useQuestLandingSsgFallbackCleanup,
} from '@/components/quests/QuestLandingLayout'
import TravelsForQuestSection from '@/components/quests/TravelsForQuestSection'
import type { QuestsCatalogRoute } from '@/screens/tabs/QuestsScreen'
import { pluralizeQuest } from '@/screens/tabs/questsShared'
import { getStyles } from '@/screens/tabs/QuestsScreen.styles'
import { useQuestsList } from '@/hooks/useQuestsApi'
import { useQuestCityWalk } from '@/hooks/useQuestCityWalk'
import { useBreakpoints } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { buildCanonicalUrl, buildOgImageUrl, QUESTS_OG_IMAGE_PATH } from '@/utils/seo'
import { buildBrandedSeoTitle } from '@/utils/questSeo'
import { STORAGE_PENDING_CATALOG_SELECTION } from '@/utils/questCatalogSelection'
import { buildCanonicalQuestCityIndex } from '@/utils/questCityCanonical'
import {
  buildQuestCityLandingGroups,
  findNearbyQuestCityGroups,
  resolveQuestCitySegment,
} from '@/utils/questCityAlias'

import { useTranslation } from '@/i18n/LocaleProvider'
import { shellRouteMetadata } from '@/utils/seoRoutes/routeMetadata'

const CITY_FOOTER_STYLE = { gap: 16, marginTop: 24 } as const

// The catalog screen is reached from two routes. A static import from both made
// Metro hoist it into a route-similarity shared chunk that /profile also loads
// eagerly (+10 KB brotli, measured on the prod build); a single dynamic import
// root keeps it a standalone chunk that only quest pages fetch. The fetch starts
// when this route module evaluates, in parallel with the quest list, instead of
// after it (data -> chunk was a sequential waterfall on a cold visit).
let questsScreenModule: ReturnType<typeof loadQuestsScreen> | null = null
function loadQuestsScreen() {
  return import('@/screens/tabs/QuestsScreenRoute')
}
function preloadQuestsScreen() {
  questsScreenModule ??= loadQuestsScreen()
  return questsScreenModule
}
if (Platform.OS === 'web' && typeof window !== 'undefined') void preloadQuestsScreen()
const QuestsScreen = React.lazy(preloadQuestsScreen)

/**
 * `/quests/<city>` — каталог с городом из URL (#2654): тот же сайдбар, заголовок
 * и сетка, что у `/quests`, плюс SEO города и его заметки под сеткой. Возврат
 * (#1484) считает сам экран каталога.
 */
export default function QuestsByCityScreen() {
  const params = useLocalSearchParams<{ city?: string | string[] }>()
  const cityParam = getQuestLandingRouteParam(params.city)
  const navigation = useNavigation()
  const router = useRouter()
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
  // Срез каталога — канонический id города в индексе сайдбара, иначе экран
  // нормализовал бы выбор и счёл бы это уходом со страницы.
  const canonicalCityIdById = useMemo(() => buildCanonicalQuestCityIndex(quests).canonicalCityIdById, [quests])
  const toCatalogCityId = useCallback((cityId: string) => canonicalCityIdById[cityId] ?? cityId, [canonicalCityIdById])
  const selectionId = cityGroup ? toCatalogCityId(cityGroup.cityIds[0]) : null
  const nearbyCities = useMemo(
    () => (cityGroup ? findNearbyQuestCityGroups(cityGroup, cityGroups, { limit: 4 }) : []),
    [cityGroup, cityGroups],
  )
  // Заметки о местах города приходят из бандлов его квестов и дописывают
  // страницу до самостоятельного содержания (#1569). Секции города рисуются
  // только на вебе, поэтому и запросы бандлов живут там же.
  const { walk, settled: walkSettled } = useQuestCityWalk(cityQuests, {
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
  useQuestLandingNotFoundRedirect(!loading && !resolved)

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

  const { width: bpWidth } = useBreakpoints()
  const height = Platform.OS === 'web' ? 0 : Dimensions.get('window').height
  const dockPx = useDockReservePx()
  const s = useMemo(() => getStyles(colors, bpWidth, height, dockPx), [colors, bpWidth, height, dockPx])

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

  // Другой город — его собственная страница; любой другой срез живёт в
  // `/quests` и передаётся туда одноразовым ключом каталога (#1794).
  const handleLeave = useCallback((id: string) => {
    const target = cityGroups.find((group) => group.cityIds.some((cityId) => toCatalogCityId(cityId) === id))
    if (target) {
      router.push(`/quests/${target.segment}`)
      return
    }
    void AsyncStorage.setItem(STORAGE_PENDING_CATALOG_SELECTION, id)
      .catch(() => undefined)
      .then(() => router.push('/quests'))
  }, [cityGroups, router, toCatalogCityId])

  const seo = useMemo(() => (
    <InstantSEO
      headKey={`quests-city-${canonicalSegment}`}
      title={seoTitle}
      description={seoDescription}
      canonical={canonical}
      ogType="website"
      image={buildOgImageUrl(QUESTS_OG_IMAGE_PATH)}
      additionalTags={structuredData}
    />
  ), [canonical, canonicalSegment, seoDescription, seoTitle, structuredData])

  // Подвал города встаёт одним блоком, когда набор заметок окончателен: заметки
  // идут первыми, и секции, нарисованные до них, уезжали бы вниз (#2754).
  const footer = useMemo(() => (cityGroup && Platform.OS === 'web' && walkSettled ? (
    <View style={CITY_FOOTER_STYLE}>
      <QuestCityLandingSections city={cityGroup} nearbyCities={nearbyCities} walk={walk} />
      <TravelsForQuestSection
        cityName={cityGroup.cityName}
        countryName={cityGroup.countryName}
        countryCode={cityGroup.countryCode}
        coords={cityCoords}
      />
    </View>
  ) : null), [cityCoords, cityGroup, nearbyCities, walk, walkSettled])

  const route = useMemo<QuestsCatalogRoute>(
    () => ({ selectionId, onLeave: handleLeave, seo, footer }),
    [footer, handleLeave, selectionId, seo],
  )

  if (loading || !cityGroup) {
    return <QuestLandingLoading styles={s} colors={colors} />
  }

  return (
    <Suspense fallback={<QuestLandingLoading styles={s} colors={colors} />}>
      <QuestsScreen route={route} />
    </Suspense>
  )
}

// #2740: head статического HTML объявляет маршрут (Expo SDK 58 пишет его из
// generateMetadata, helmet в экспорт больше не попадает); строки те же, что у экрана
export function generateMetadata() {
  return shellRouteMetadata()
}
