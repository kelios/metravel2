import React, { useEffect, useMemo } from 'react'
import { ActivityIndicator, Dimensions, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { Link, useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { useIsFocused } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import InstantSEO from '@/components/seo/LazyInstantSEO'
import QuestCard from '@/screens/tabs/QuestCard'
import { pluralizeQuest } from '@/screens/tabs/questsShared'
import { getStyles } from '@/screens/tabs/QuestsScreen.styles'
import { useQuestsList } from '@/hooks/useQuestsApi'
import { useQuestCatalogResponsiveModel } from '@/hooks/useQuestCatalogResponsiveModel'
import { useBreakpoints } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { buildCanonicalUrl, buildOgImageUrl, QUESTS_OG_IMAGE_PATH } from '@/utils/seo'
import { buildBrandedSeoTitle } from '@/utils/questSeo'
import { resolveQuestCitySegment } from '@/utils/questCityAlias'
import { stringifyJsonLd } from '@/utils/jsonLd'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { translate as i18nT } from '@/i18n'

const { spacing } = DESIGN_TOKENS
const QUEST_LIST_ROUTE = '/quests'

const getRouteParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default function QuestsByCityScreen() {
  const params = useLocalSearchParams<{ city?: string | string[] }>()
  const cityParam = getRouteParam(params.city)
  const router = useRouter()
  const navigation = useNavigation()
  const isFocused = useIsFocused()
  const colors = useThemedColors()

  const { quests, loading } = useQuestsList()

  const resolved = useMemo(
    () => (loading ? null : resolveQuestCitySegment(cityParam, quests)),
    [cityParam, quests, loading],
  )

  const cityQuests = useMemo(
    () => (resolved ? quests.filter((q) => q.cityId === resolved.cityId) : []),
    [quests, resolved],
  )

  const cityName = cityQuests[0]?.cityName || ''
  const canonicalSegment = resolved ? resolved.alias || resolved.cityId : cityParam
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

  const { width: bpWidth } = useBreakpoints()
  const height = Platform.OS === 'web' ? 0 : Dimensions.get('window').height
  const s = useMemo(() => getStyles(colors, bpWidth, height), [colors, bpWidth, height])
  const catalogModel = useQuestCatalogResponsiveModel(cityQuests.length)

  const seoTitle = useMemo(
    () => buildBrandedSeoTitle(i18nT('quests:app.tabs.quests.city.index.title', { value1: cityName || cityParam })),
    [cityName, cityParam],
  )
  const seoDescription = useMemo(
    () => i18nT('quests:app.tabs.quests.city.index.metaDescription', {
      value1: cityName || cityParam,
      value2: pluralizeQuest(cityQuests.length),
    }),
    [cityName, cityParam, cityQuests.length],
  )

  const structuredData = useMemo(() => {
    if (!resolved || cityQuests.length === 0) return null
    const itemList = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: i18nT('quests:app.tabs.quests.city.index.title', { value1: cityName || cityParam }),
      url: canonical,
      numberOfItems: cityQuests.length,
      itemListElement: cityQuests.map((quest, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: buildCanonicalUrl(`/quests/${quest.cityId}/${quest.id}`),
        name: quest.title,
      })),
    }
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'MeTravel', item: buildCanonicalUrl('/') },
        { '@type': 'ListItem', position: 2, name: i18nT('quests:screens.tabs.QuestsSeoIntroFaq.eyebrow'), item: buildCanonicalUrl('/quests') },
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
  }, [resolved, cityQuests, cityName, cityParam, canonical])

  if (loading || !resolved) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  const heading = i18nT('quests:app.tabs.quests.city.index.title', { value1: cityName || cityParam })

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
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
          accessibilityLabel={i18nT('quests:app.tabs.quests.city.index.back')}
        >
          <Feather name="arrow-left" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>
            {i18nT('quests:app.tabs.quests.city.index.back')}
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
            {i18nT('quests:app.tabs.quests.city.index.eyebrow')}
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
          {i18nT('quests:app.tabs.quests.city.index.lead', { value1: cityName || cityParam })}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSubtle }}>
          {pluralizeQuest(cityQuests.length)}
        </Text>
      </View>

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
    </ScrollView>
  )
}
