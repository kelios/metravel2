import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { ActivityIndicator, Dimensions, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { Link, useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { useIsFocused } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import InstantSEO from '@/components/seo/LazyInstantSEO'
import QuestCityLandingSections from '@/components/quests/QuestCityLandingSections'
import TravelsForQuestSection from '@/components/quests/TravelsForQuestSection'
import QuestCard from '@/screens/tabs/QuestCard'
import { pluralizeQuest } from '@/screens/tabs/questsShared'
import { getStyles } from '@/screens/tabs/QuestsScreen.styles'
import { useQuestsList } from '@/hooks/useQuestsApi'
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
import { buildQuestPath } from '@/utils/routePaths'
import { stringifyJsonLd } from '@/utils/jsonLd'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { LAYOUT } from '@/constants/layout'
import { useTranslation } from '@/i18n/LocaleProvider'

const { spacing } = DESIGN_TOKENS
const QUEST_LIST_ROUTE = '/quests'
const useWebLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

type MetaTarget = {
  selector: string
  attributes: Record<string, string>
}

const getRouteParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

const syncSingleMetaContent = (
  selector: string,
  attributes: Record<string, string>,
  content: string,
) => {
  const nodes = Array.from(document.querySelectorAll(selector)) as HTMLMetaElement[]
  nodes.slice(1).forEach((node) => node.remove())

  const meta = nodes[0] ?? document.createElement('meta')
  for (const [name, value] of Object.entries(attributes)) meta.setAttribute(name, value)
  if (meta.content !== content) meta.content = content
  if (!meta.parentNode) document.head.appendChild(meta)
}

const DESCRIPTION_META_TARGETS: MetaTarget[] = [
  { selector: 'meta[name="description"]', attributes: { name: 'description' } },
  { selector: 'meta[property="og:description"]', attributes: { property: 'og:description' } },
  { selector: 'meta[name="twitter:description"]', attributes: { name: 'twitter:description' } },
]

export default function QuestsByCityScreen() {
  // #1484: возвратное напоминание ведёт именно на лендинг города, поэтому
  // возврат считается и здесь, а не только в общем каталоге.
  useQuestReturnVisit()

  const params = useLocalSearchParams<{ city?: string | string[] }>()
  const cityParam = getRouteParam(params.city)
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
  useWebLayoutEffect(() => {
    if (!cityGroup || !isFocused || Platform.OS !== 'web' || typeof document === 'undefined') return
    document
      .querySelectorAll('section[data-ssg-quest-city="true"]')
      .forEach((section) => section.remove())
    document
      .querySelectorAll('style[data-ssg-quest-city-style="true"]')
      .forEach((style) => style.remove())
  }, [cityGroup, isFocused])

  const { width: bpWidth, isMobile } = useBreakpoints()
  const height = Platform.OS === 'web' ? 0 : Dimensions.get('window').height
  const s = useMemo(() => getStyles(colors, bpWidth, height), [colors, bpWidth, height])
  const catalogModel = useQuestCatalogResponsiveModel(cityQuests.length)

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
  const previousDescriptionsRef = useRef<Array<{
    selector: string
    attributes: Record<string, string>
    content: string | null
  }> | null>(null)

  useEffect(() => {
    if (!cityGroup || !isFocused || Platform.OS !== 'web' || typeof document === 'undefined') {
      return undefined
    }

    if (!previousDescriptionsRef.current) {
      previousDescriptionsRef.current = DESCRIPTION_META_TARGETS.map((target) => ({
        ...target,
        content: document.querySelector<HTMLMetaElement>(target.selector)?.content ?? null,
      }))
    }

    // Expo Head keeps the root fallback description next to the route tag on
    // direct web entry. Keep the focused city page authoritative for crawlers
    // and link previews, just as LazyInstantSEO already does for canonical.
    const syncDescription = () => {
      for (const { selector, attributes } of DESCRIPTION_META_TARGETS) {
        syncSingleMetaContent(selector, attributes, seoDescription)
      }
    }

    syncDescription()
    const observer = new MutationObserver(syncDescription)
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['content'],
    })
    const timeout = window.setTimeout(() => observer.disconnect(), 5000)

    return () => {
      window.clearTimeout(timeout)
      observer.disconnect()
      for (const { selector, attributes, content } of previousDescriptionsRef.current ?? []) {
        if (content !== null) {
          syncSingleMetaContent(selector, attributes, content)
        } else {
          document.querySelectorAll(selector).forEach((node) => node.remove())
        }
      }
    }
  }, [cityGroup, isFocused, seoDescription])

  const structuredData = useMemo(() => {
    if (!cityGroup || cityQuests.length === 0) return null
    // #1185: квест без cityId/id давал в разметке ссылку `/quests/undefined/undefined`
    // — поисковик получал заведомо битый URL. Такие позиции в список не попадают.
    const listedQuests = cityQuests
      .map((quest) => ({ quest, path: buildQuestPath(quest.cityId, quest.id) }))
      .filter((entry): entry is { quest: typeof entry.quest; path: string } => Boolean(entry.path))
    if (listedQuests.length === 0) return null
    const itemList = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: t('quests:app.tabs.quests.city.index.title', { value1: cityName || cityParam }),
      url: canonical,
      numberOfItems: listedQuests.length,
      itemListElement: listedQuests.map(({ quest, path }, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: buildCanonicalUrl(path),
        name: quest.title,
      })),
    }
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'MeTravel', item: buildCanonicalUrl('/') },
        { '@type': 'ListItem', position: 2, name: t('quests:screens.tabs.QuestsSeoIntroFaq.eyebrow'), item: buildCanonicalUrl('/quests') },
        { '@type': 'ListItem', position: 3, name: cityName || cityParam, item: canonical },
      ],
    }
    return (
      <>
        <script
          key="quests-city-itemlist"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: stringifyJsonLd(itemList) }}
        />
        <script
          key="quests-city-breadcrumb"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: stringifyJsonLd(breadcrumb) }}
        />
      </>
    )
  }, [cityGroup, cityQuests, cityName, cityParam, canonical, t])

  if (loading || !cityGroup) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  const heading = t('quests:app.tabs.quests.city.index.title', { value1: cityName || cityParam })

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={{
        padding: spacing.lg,
        gap: spacing.md,
        // Резерв под мобильный BottomDock (абсолютный оверлей): без него
        // последняя карточка города обрезается доком.
        paddingBottom: isMobile ? (LAYOUT?.tabBarHeight ?? 56) + spacing.xl : spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
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

      <Link href={QUEST_LIST_ROUTE} asChild>
        <Pressable
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 }}
          accessibilityRole="link"
          accessibilityLabel={t('quests:app.tabs.quests.city.index.back')}
        >
          <Feather name="arrow-left" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>
            {t('quests:app.tabs.quests.city.index.back')}
          </Text>
        </Pressable>
      </Link>

      <View style={{ gap: 8, maxWidth: 760 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            alignSelf: 'flex-start',
            borderRadius: DESIGN_TOKENS.radii.full,
            backgroundColor: colors.primarySoft,
            borderWidth: 1,
            borderColor: colors.primaryAlpha30,
            paddingHorizontal: 12,
            paddingVertical: 5,
          }}
        >
          <Feather name="compass" size={13} color={colors.primaryDark} aria-hidden />
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primaryText, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {t('quests:app.tabs.quests.city.index.eyebrow')}
          </Text>
        </View>
        <Text
          accessibilityRole="header"
          {...({ 'aria-level': 1 } as Record<string, unknown>)}
          style={{ fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.6 }}
        >
          {heading}
        </Text>
        <Text style={{ fontSize: 15, lineHeight: 23, color: colors.textMuted }}>
          {t('quests:app.tabs.quests.city.index.lead', { value1: cityName || cityParam })}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSubtle }}>
          {pluralizeQuest(cityQuests.length)}
        </Text>
      </View>

      {Platform.OS === 'web' ? (
        <>
          <QuestCityLandingSections city={cityGroup} nearbyCities={nearbyCities} />
          <Text
            accessibilityRole="header"
            {...({ 'aria-level': 2 } as Record<string, unknown>)}
            style={{ fontSize: 20, fontWeight: '800', color: colors.text }}
          >
            {t('quests:app.tabs.quests.city.index.routesTitle', { value1: cityName || cityParam })}
          </Text>
        </>
      ) : null}

      <View style={s.questsGrid}>
        {cityQuests.map((quest, index) => (
          <QuestCard
            key={quest.id}
            styles={s}
            cityId={quest.cityId}
            quest={quest}
            cardWidth={catalogModel.cardWidth}
            index={index}
          />
        ))}
      </View>

      {Platform.OS === 'web' ? (
        <TravelsForQuestSection
          cityName={cityGroup.cityName}
          countryName={cityGroup.countryName}
          countryCode={cityGroup.countryCode}
          coords={cityCoords}
        />
      ) : null}
    </ScrollView>
  )
}
