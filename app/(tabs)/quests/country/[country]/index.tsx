import React, { useEffect, useMemo, useRef } from 'react'
import { ActivityIndicator, Dimensions, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { Link, useIsFocused, useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import QuestCountryLandingSections from '@/components/quests/QuestCountryLandingSections'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { LAYOUT } from '@/constants/layout'
import { useQuestCatalogResponsiveModel } from '@/hooks/useQuestCatalogResponsiveModel'
import { useQuestReturnVisit } from '@/hooks/useQuestReturnVisit'
import { useQuestsList } from '@/hooks/useQuestsApi'
import { useBreakpoints } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { useLocale, useTranslation } from '@/i18n/LocaleProvider'
import QuestCard from '@/screens/tabs/QuestCard'
import { getStyles } from '@/screens/tabs/QuestsScreen.styles'
import { pluralizeQuest } from '@/screens/tabs/questsShared'
import { buildQuestCountryLandingGroups } from '@/utils/questCountryLanding'
import { stringifyJsonLd } from '@/utils/jsonLd'
import { buildBrandedSeoTitle } from '@/utils/questSeo'
import { buildQuestPath } from '@/utils/routePaths'
import { buildCanonicalUrl, buildOgImageUrl, QUESTS_OG_IMAGE_PATH } from '@/utils/seo'

const { spacing } = DESIGN_TOKENS
const QUEST_LIST_ROUTE = '/quests'

type MetaTarget = {
  selector: string
  attributes: Record<string, string>
}

type ManagedMetaTarget = MetaTarget & {
  content: string
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

export default function QuestsByCountryScreen() {
  useQuestReturnVisit()

  const params = useLocalSearchParams<{ country?: string | string[] }>()
  const countryParam = getRouteParam(params.country).trim().toLowerCase()
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
  const catalogModel = useQuestCatalogResponsiveModel(countryQuests.length)
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
  const managedMetaTargets = useMemo<ManagedMetaTarget[]>(() => [
    ...DESCRIPTION_META_TARGETS.map((target) => ({ ...target, content: seoDescription })),
    {
      selector: 'meta[property="og:url"]',
      attributes: { property: 'og:url' },
      content: canonical,
    },
  ], [canonical, seoDescription])
  const previousMetaRef = useRef<Array<{
    selector: string
    attributes: Record<string, string>
    content: string | null
  }> | null>(null)

  useEffect(() => {
    if (!country || !isFocused || Platform.OS !== 'web' || typeof document === 'undefined') {
      return undefined
    }

    if (!previousMetaRef.current) {
      previousMetaRef.current = managedMetaTargets.map(({ selector, attributes }) => ({
        selector,
        attributes,
        content: document.querySelector<HTMLMetaElement>(selector)?.content ?? null,
      }))
    }

    const syncMetadata = () => {
      for (const { selector, attributes, content } of managedMetaTargets) {
        syncSingleMetaContent(selector, attributes, content)
      }
    }

    syncMetadata()
    const observer = new MutationObserver(syncMetadata)
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
      for (const { selector, attributes, content } of previousMetaRef.current ?? []) {
        if (content !== null) {
          syncSingleMetaContent(selector, attributes, content)
        } else {
          document.querySelectorAll(selector).forEach((node) => node.remove())
        }
      }
      previousMetaRef.current = null
    }
  }, [country, isFocused, managedMetaTargets])

  const structuredData = useMemo(() => {
    if (!country || countryQuests.length === 0) return null
    const listedQuests = countryQuests
      .map((quest) => ({ quest, path: buildQuestPath(quest.cityId, quest.id) }))
      .filter((entry): entry is { quest: typeof entry.quest; path: string } => Boolean(entry.path))
    if (listedQuests.length === 0) return null

    const itemList = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: t('quests:app.tabs.quests.country.index.title', { value1: countryName }),
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
        {
          '@type': 'ListItem',
          position: 2,
          name: t('quests:screens.tabs.QuestsSeoIntroFaq.eyebrow'),
          item: buildCanonicalUrl('/quests'),
        },
        { '@type': 'ListItem', position: 3, name: countryName, item: canonical },
      ],
    }

    return (
      <>
        <script
          key="quests-country-itemlist"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: stringifyJsonLd(itemList) }}
        />
        <script
          key="quests-country-breadcrumb"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: stringifyJsonLd(breadcrumb) }}
        />
      </>
    )
  }, [canonical, country, countryName, countryQuests, t])

  if (loading || !country || Platform.OS !== 'web') {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={{
        padding: spacing.lg,
        gap: spacing.md,
        paddingBottom: isMobile ? (LAYOUT?.tabBarHeight ?? 56) + spacing.xl : spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
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

      <Link href={QUEST_LIST_ROUTE} asChild>
        <Pressable
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 }}
          accessibilityRole="link"
          accessibilityLabel={t('quests:app.tabs.quests.country.index.back')}
        >
          <Feather name="arrow-left" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>
            {t('quests:app.tabs.quests.country.index.back')}
          </Text>
        </Pressable>
      </Link>

      <View style={{ gap: 8, width: '100%', maxWidth: 840 }}>
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
          <Feather name="globe" size={13} color={colors.primaryDark} aria-hidden />
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primaryText, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {t('quests:app.tabs.quests.country.index.eyebrow')}
          </Text>
        </View>
        <Text
          accessibilityRole="header"
          {...({ 'aria-level': 1 } as Record<string, unknown>)}
          style={{ fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.6 }}
        >
          {t('quests:app.tabs.quests.country.index.title', { value1: countryName })}
        </Text>
        <Text style={{ fontSize: 15, lineHeight: 23, color: colors.textMuted }}>
          {t('quests:app.tabs.quests.country.index.lead', {
            value1: countryName,
            value2: pluralizeQuest(countryQuests.length),
          })}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSubtle }}>
          {pluralizeQuest(countryQuests.length)} · {t('quests:app.tabs.quests.country.index.cityCount', {
            value1: country.cities.length,
          })}
        </Text>
      </View>

      <QuestCountryLandingSections country={country} />

      <Text
        accessibilityRole="header"
        {...({ 'aria-level': 2 } as Record<string, unknown>)}
        style={{ fontSize: 20, fontWeight: '800', color: colors.text }}
      >
        {t('quests:app.tabs.quests.country.index.routesTitle', { value1: countryName })}
      </Text>
      <View style={s.questsGrid}>
        {countryQuests.map((quest, index) => (
          <QuestCard
            key={`${quest.cityId}:${quest.id}`}
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
