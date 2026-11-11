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
  useQuestLandingSsgFallbackCleanup,
} from '@/components/quests/QuestLandingLayout'
import TravelsForQuestSection from '@/components/quests/TravelsForQuestSection'
import type { QuestsCatalogRoute } from '@/screens/tabs/QuestsScreen'
import { getStyles } from '@/screens/tabs/QuestsScreen.styles'
import { resolveQuestCatalogAddressState } from '@/utils/questAddressState'
import { useQuestsList } from '@/hooks/useQuestsApi'
import { useQuestCityWalk } from '@/hooks/useQuestCityWalk'
import { useBreakpoints } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { buildQuestPath } from '@/utils/routePaths'
import { buildCanonicalUrl, buildOgImageUrl, QUESTS_OG_IMAGE_PATH } from '@/utils/seo'
import { buildQuestCityLandingMeta } from '@/utils/questSeo'
import { STORAGE_PENDING_CATALOG_SELECTION } from '@/utils/questCatalogSelection'
import { buildCanonicalQuestCityIndex } from '@/utils/questCityCanonical'
import {
  buildQuestCityLandingGroups,
  findNearbyQuestCityGroups,
  resolveQuestCitySegment,
} from '@/utils/questCityAlias'

import { useTranslation } from '@/i18n/LocaleProvider'
import { getFormatLocale, translatePlural } from '@/i18n'
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
// Терминальный экран редкого пути (#2896) не едет в чанке маршрута города: статический
// импорт поднял `index:quests-city` над бюджетом (ROUTE-BUNDLE-001), а нужен он
// только на неизвестном адресе — чанк грузится в момент показа.
const QuestNotFoundScreen = React.lazy(() => import('@/components/quests/QuestNotFoundScreen'))
// Ошибка загрузки каталога (#2914) — тоже отдельный ленивый чанк.
const QuestLandingLoadError = React.lazy(() => import('@/components/quests/QuestLandingLoadError'))

type Props = {
  /**
   * SSR-loader ответил «нет такого адреса» на клиентский запрос данных (#2896):
   * экран «не найдено» рисуется сразу, не дожидаясь каталога.
   */
  notFound?: boolean
  /**
   * Head опубликованной страницы города (#3236). Серверный `<title>` и описание
   * собраны тем же `buildQuestCityLandingMeta`, что и запасной путь ниже, —
   * экран ставит их как есть и не перезаписывает другим текстом. Посадочные
   * публикуются только на `locale` (RU): при другом языке интерфейса head
   * собирается запасным путём на этом языке.
   */
  projectionMeta?: { title: string; description: string; locale: string } | null
}

/**
 * Сегмент совпал с alias квеста без id (`/quests/<quest-alias>`): такой адрес
 * ведёт на канонический `/quests/<cityId>/<alias>` (#2896, п. 3). Сравнение
 * регистронезависимое, как у сегментов города.
 */
export function findQuestByAliasSegment<T extends { id: string; cityId: string }>(
  segment: string,
  quests: readonly T[],
): T | null {
  const raw = segment.trim().toLowerCase()
  if (!raw) return null
  return quests.find((quest) => quest.id.toLowerCase() === raw) ?? null
}

/**
 * `/quests/<city>` — каталог с городом из URL (#2654): тот же сайдбар, заголовок
 * и сетка, что у `/quests`, плюс SEO города и его заметки под сеткой. Возврат
 * (#1484) считает сам экран каталога.
 */
export default function QuestsByCityScreen({ notFound: loaderNotFound = false, projectionMeta: publishedMeta = null }: Props) {
  const params = useLocalSearchParams<{ city?: string | string[] }>()
  const cityParam = getQuestLandingRouteParam(params.city)
  const navigation = useNavigation()
  const router = useRouter()
  const isFocused = useIsFocused()
  const colors = useThemedColors()
  const { t, i18n } = useTranslation()
  const uiLanguage = String(i18n?.resolvedLanguage || i18n?.language || '').split('-')[0]
  const projectionMeta = publishedMeta && (!uiLanguage || publishedMeta.locale === uiLanguage) ? publishedMeta : null

  const { quests, loading, failed, refetch, refetching } = useQuestsList({ trackRefetching: true })

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

  // Сегмент — alias квеста без id: уводим на канонический адрес квеста (#2896).
  const aliasQuest = useMemo(
    () => (!loading && !resolved ? findQuestByAliasSegment(cityParam, quests) : null),
    [cityParam, loading, quests, resolved],
  )
  const aliasQuestPath = aliasQuest ? buildQuestPath(aliasQuest.cityId, aliasQuest.id) : null
  useEffect(() => {
    if (isFocused && aliasQuestPath) router.replace(aliasQuestPath as Parameters<typeof router.replace>[0])
  }, [aliasQuestPath, isFocused, router])
  // Неизвестный сегмент (не город, не alias квеста) — терминальный экран «Квест
  // не найден», а не редирект в каталог и не пустота (#2896). Маркер loader'а
  // лишь не ждёт каталога: публикация и каталог — разные источники, и город,
  // который каталог всё же разрешил, страницей «не найдено» не накрывается.
  // Упавший каталог (обрыв сети) ничего не решает: пустой список — не «такого
  // квеста нет», а ошибка с повтором (#2914). Ответ loader'а остаётся в силе.
  // Сбой фонового обновления при данных в кеше каталог не отнимает — он решает.
  // Сами состояния сводит общий контракт адреса квеста (#3227).
  const addressState = resolveQuestCatalogAddressState(
    Boolean(resolved || aliasQuestPath), loading, failed && quests.length === 0, loaderNotFound,
  )
  const notFound = addressState === 'not_found'
  const loadError = addressState === 'error'

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

  // Без опубликованной проекции (native, сборка без SSR) — тот же билдер на
  // данных, что есть у экрана: места маршрутов появляются, когда пришли бандлы.
  const fallbackMeta = useMemo(
    () => (projectionMeta ? null : buildQuestCityLandingMeta({
      cityName: cityName || cityParam,
      questTitles: cityQuests.map((quest) => quest.title),
      places: walk?.places ?? [],
      nearbyCityNames: nearbyCities.map((group) => group.cityName || group.segment),
      translate: t,
      translatePlural,
      locale: getFormatLocale(),
    })),
    [cityName, cityParam, cityQuests, nearbyCities, projectionMeta, t, walk],
  )
  const seoTitle = projectionMeta?.title ?? fallbackMeta?.title ?? ''
  const seoDescription = projectionMeta?.description ?? fallbackMeta?.description ?? ''
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

  if (notFound) {
    return (
      <Suspense fallback={<QuestLandingLoading styles={s} colors={colors} />}>
        <QuestNotFoundScreen kind="city" segment={cityParam} quests={quests} styles={s} />
      </Suspense>
    )
  }

  if (loadError) {
    return (
      <Suspense fallback={<QuestLandingLoading styles={s} colors={colors} />}>
        <QuestLandingLoadError styles={s} onRetry={refetch} retrying={refetching} />
      </Suspense>
    )
  }

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
