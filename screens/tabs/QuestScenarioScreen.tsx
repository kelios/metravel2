import React, { useMemo } from 'react'
import { Dimensions, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { Link, useIsFocused } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import InstantSEO from '@/components/seo/LazyInstantSEO'
import QuestsSeoIntroFaq, { type QuestFaqItem } from '@/screens/tabs/QuestsSeoIntroFaq'
import { getStyles } from '@/screens/tabs/QuestsScreen.styles'
import { useQuestsList } from '@/hooks/useQuestsApi'
import { useBreakpoints } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { buildCanonicalUrl, buildOgImageUrl, QUESTS_OG_IMAGE_PATH } from '@/utils/seo'
import { buildBrandedSeoTitle } from '@/utils/questSeo'
import { buildQuestCityAliasMap } from '@/utils/questCityAlias'
import { stringifyJsonLd } from '@/utils/jsonLd'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { LAYOUT } from '@/constants/layout'
import { translate as i18nT } from '@/i18n'

const { spacing } = DESIGN_TOKENS
const QUEST_LIST_ROUTE = '/quests'
const SCENARIO_ROUTE = '/quests/scenario'
const IS_WEB = Platform.OS === 'web'
const COLUMN_MAX_WIDTH = 760

// Explicit string-literal keys (not template literals) so the web babel plugin
// inlines the copy into the eager bundle — a key must never leak to the user
// (see __tests__/i18n/webCompileTime.test.ts).

/** Source of truth for the quest-book contents list (visible copy + ItemList). */
export function getQuestScenarioIncludes(): QuestFaqItem[] {
  return [
    { q: i18nT('quests:screens.tabs.QuestScenarioScreen.include1q'), a: i18nT('quests:screens.tabs.QuestScenarioScreen.include1a') },
    { q: i18nT('quests:screens.tabs.QuestScenarioScreen.include2q'), a: i18nT('quests:screens.tabs.QuestScenarioScreen.include2a') },
    { q: i18nT('quests:screens.tabs.QuestScenarioScreen.include3q'), a: i18nT('quests:screens.tabs.QuestScenarioScreen.include3a') },
    { q: i18nT('quests:screens.tabs.QuestScenarioScreen.include4q'), a: i18nT('quests:screens.tabs.QuestScenarioScreen.include4a') },
    { q: i18nT('quests:screens.tabs.QuestScenarioScreen.include5q'), a: i18nT('quests:screens.tabs.QuestScenarioScreen.include5a') },
  ]
}

/** Source of truth for the print steps (visible copy + HowTo JSON-LD). */
export function getQuestScenarioSteps(): QuestFaqItem[] {
  return [
    { q: i18nT('quests:screens.tabs.QuestScenarioScreen.step1q'), a: i18nT('quests:screens.tabs.QuestScenarioScreen.step1a') },
    { q: i18nT('quests:screens.tabs.QuestScenarioScreen.step2q'), a: i18nT('quests:screens.tabs.QuestScenarioScreen.step2a') },
    { q: i18nT('quests:screens.tabs.QuestScenarioScreen.step3q'), a: i18nT('quests:screens.tabs.QuestScenarioScreen.step3a') },
    { q: i18nT('quests:screens.tabs.QuestScenarioScreen.step4q'), a: i18nT('quests:screens.tabs.QuestScenarioScreen.step4a') },
  ]
}

/** Source of truth for the occasions list. */
export function getQuestScenarioOccasions(): string[] {
  return [
    i18nT('quests:screens.tabs.QuestScenarioScreen.occasion1'),
    i18nT('quests:screens.tabs.QuestScenarioScreen.occasion2'),
    i18nT('quests:screens.tabs.QuestScenarioScreen.occasion3'),
    i18nT('quests:screens.tabs.QuestScenarioScreen.occasion4'),
    i18nT('quests:screens.tabs.QuestScenarioScreen.occasion5'),
  ]
}

/** Source of truth for the DIY FAQ (visible copy + FAQPage JSON-LD). */
export function getQuestScenarioFaqItems(): QuestFaqItem[] {
  return [
    { q: i18nT('quests:screens.tabs.QuestScenarioScreen.q1'), a: i18nT('quests:screens.tabs.QuestScenarioScreen.a1') },
    { q: i18nT('quests:screens.tabs.QuestScenarioScreen.q2'), a: i18nT('quests:screens.tabs.QuestScenarioScreen.a2') },
    { q: i18nT('quests:screens.tabs.QuestScenarioScreen.q3'), a: i18nT('quests:screens.tabs.QuestScenarioScreen.a3') },
    { q: i18nT('quests:screens.tabs.QuestScenarioScreen.q4'), a: i18nT('quests:screens.tabs.QuestScenarioScreen.a4') },
    { q: i18nT('quests:screens.tabs.QuestScenarioScreen.q5'), a: i18nT('quests:screens.tabs.QuestScenarioScreen.a5') },
    { q: i18nT('quests:screens.tabs.QuestScenarioScreen.q6'), a: i18nT('quests:screens.tabs.QuestScenarioScreen.a6') },
    { q: i18nT('quests:screens.tabs.QuestScenarioScreen.q7'), a: i18nT('quests:screens.tabs.QuestScenarioScreen.a7') },
  ]
}

type CityLink = { cityId: string; name: string; path: string; count: number }

function CtaLink({
  colors,
  label,
  href,
}: {
  colors: ReturnType<typeof useThemedColors>
  label: string
  href: string
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          alignSelf: 'flex-start',
          backgroundColor: colors.primary,
          borderRadius: DESIGN_TOKENS.radii.full,
          paddingHorizontal: 20,
          paddingVertical: 12,
          ...(IS_WEB ? ({ cursor: 'pointer' } as Record<string, unknown>) : {}),
        }}
      >
        <Text style={{ color: colors.textOnPrimary, fontWeight: '800', fontSize: 15 }}>{label}</Text>
        <Feather name="arrow-right" size={16} color={colors.textOnPrimary} />
      </Pressable>
    </Link>
  )
}

function SectionHeading({ colors, text }: { colors: ReturnType<typeof useThemedColors>; text: string }) {
  return (
    <Text
      accessibilityRole="header"
      {...({ 'aria-level': 2 } as Record<string, unknown>)}
      style={{ fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.4 }}
    >
      {text}
    </Text>
  )
}

export default function QuestScenarioScreen() {
  const isFocused = useIsFocused()
  const colors = useThemedColors()
  const { quests } = useQuestsList()

  const { width: bpWidth, isMobile } = useBreakpoints()
  const height = IS_WEB ? 0 : Dimensions.get('window').height
  const s = useMemo(() => getStyles(colors, bpWidth, height), [colors, bpWidth, height])

  const includes = useMemo(() => getQuestScenarioIncludes(), [])
  const steps = useMemo(() => getQuestScenarioSteps(), [])
  const occasions = useMemo(() => getQuestScenarioOccasions(), [])
  const faqItems = useMemo(() => getQuestScenarioFaqItems(), [])

  const canonical = buildCanonicalUrl(SCENARIO_ROUTE)

  // City links keep the landing wired into the /quests/<city> cluster instead of
  // dead-ending at the catalog root.
  const cityLinks = useMemo<CityLink[]>(() => {
    const aliasMap = buildQuestCityAliasMap(quests)
    const byCity = new Map<string, CityLink>()
    for (const quest of quests) {
      if (!quest?.cityId) continue
      const existing = byCity.get(quest.cityId)
      if (existing) {
        existing.count += 1
        continue
      }
      const alias = aliasMap.get(quest.cityId)
      byCity.set(quest.cityId, {
        cityId: quest.cityId,
        name: quest.cityName || quest.cityId,
        path: `/quests/${alias || quest.cityId}`,
        count: 1,
      })
    }
    return [...byCity.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [quests])

  const seoTitle = useMemo(() => buildBrandedSeoTitle(i18nT('quests:screens.tabs.QuestScenarioScreen.title')), [])
  const seoDescription = i18nT('quests:screens.tabs.QuestScenarioScreen.metaDescription')

  const structuredData = useMemo(() => {
    const faqJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    }
    const howToJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: i18nT('quests:screens.tabs.QuestScenarioScreen.title'),
      description: i18nT('quests:screens.tabs.QuestScenarioScreen.metaDescription'),
      url: canonical,
      totalTime: 'PT10M',
      supply: [{ '@type': 'HowToSupply', name: i18nT('quests:screens.tabs.QuestScenarioScreen.supply') }],
      step: steps.map((step, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: step.q,
        text: step.a,
        url: `${canonical}#step-${index + 1}`,
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
          name: i18nT('quests:screens.tabs.QuestsSeoIntroFaq.eyebrow'),
          item: buildCanonicalUrl(QUEST_LIST_ROUTE),
        },
        { '@type': 'ListItem', position: 3, name: i18nT('quests:screens.tabs.QuestScenarioScreen.breadcrumb'), item: canonical },
      ],
    }
    return (
      <>
        <script
          key="quest-scenario-faq"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: stringifyJsonLd(faqJsonLd) }}
        />
        <script
          key="quest-scenario-howto"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: stringifyJsonLd(howToJsonLd) }}
        />
        <script
          key="quest-scenario-breadcrumb"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: stringifyJsonLd(breadcrumb) }}
        />
      </>
    )
  }, [faqItems, steps, canonical])

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={{
        padding: spacing.lg,
        gap: spacing.lg,
        // Резерв под мобильный BottomDock (абсолютный оверлей), как на городском
        // лендинге — иначе последний блок обрезается доком.
        paddingBottom: isMobile ? (LAYOUT?.tabBarHeight ?? 56) + spacing.xl : spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
      testID="quest-scenario-screen"
    >
      {isFocused ? (
        <InstantSEO
          headKey="quest-scenario"
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

      <View style={{ gap: 12, maxWidth: COLUMN_MAX_WIDTH }}>
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
          <Feather name="printer" size={13} color={colors.primaryDark} aria-hidden />
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: colors.primaryText,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            {i18nT('quests:screens.tabs.QuestScenarioScreen.eyebrow')}
          </Text>
        </View>

        <Text
          accessibilityRole="header"
          {...({ 'aria-level': 1 } as Record<string, unknown>)}
          style={{ fontSize: isMobile ? 24 : 30, fontWeight: '800', color: colors.text, letterSpacing: -0.6 }}
        >
          {i18nT('quests:screens.tabs.QuestScenarioScreen.title')}
        </Text>

        <Text style={{ fontSize: isMobile ? 14 : 16, lineHeight: isMobile ? 22 : 26, color: colors.textMuted }}>
          {i18nT('quests:screens.tabs.QuestScenarioScreen.lead')}
        </Text>

        <CtaLink colors={colors} href={QUEST_LIST_ROUTE} label={i18nT('quests:screens.tabs.QuestScenarioScreen.cta')} />
      </View>

      <View style={{ gap: 12, maxWidth: COLUMN_MAX_WIDTH }}>
        <SectionHeading colors={colors} text={i18nT('quests:screens.tabs.QuestScenarioScreen.includesTitle')} />
        {includes.map((item) => (
          <View key={item.q} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Feather name="check" size={16} color={colors.primary} style={{ marginTop: 3 }} aria-hidden />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{item.q}</Text>
              <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textMuted }}>{item.a}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: 12, maxWidth: COLUMN_MAX_WIDTH }}>
        <SectionHeading colors={colors} text={i18nT('quests:screens.tabs.QuestScenarioScreen.stepsTitle')} />
        {steps.map((step, index) => (
          <View key={step.q} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Text style={{ color: colors.textOnPrimary, fontWeight: '800', fontSize: 13 }}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{step.q}</Text>
              <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textMuted }}>{step.a}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: 10, maxWidth: COLUMN_MAX_WIDTH }}>
        <SectionHeading colors={colors} text={i18nT('quests:screens.tabs.QuestScenarioScreen.occasionsTitle')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {occasions.map((occasion) => (
            <View
              key={occasion}
              style={{
                borderRadius: DESIGN_TOKENS.radii.full,
                backgroundColor: colors.backgroundSecondary,
                borderWidth: 1,
                borderColor: colors.borderLight,
                paddingHorizontal: 12,
                paddingVertical: 7,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{occasion}</Text>
            </View>
          ))}
        </View>
      </View>

      {cityLinks.length > 0 ? (
        <View style={{ gap: 10, maxWidth: COLUMN_MAX_WIDTH }}>
          <SectionHeading colors={colors} text={i18nT('quests:screens.tabs.QuestScenarioScreen.citiesTitle')} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {cityLinks.map((city) => (
              <Link key={city.cityId} href={city.path} asChild>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={city.name}
                  style={{
                    borderRadius: DESIGN_TOKENS.radii.full,
                    backgroundColor: colors.primarySoft,
                    borderWidth: 1,
                    borderColor: colors.primaryAlpha30,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    ...(IS_WEB ? ({ cursor: 'pointer' } as Record<string, unknown>) : {}),
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primaryText }}>{city.name}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        </View>
      ) : null}

      <QuestsSeoIntroFaq
        variant="faq"
        items={faqItems}
        faqTitle={i18nT('quests:screens.tabs.QuestScenarioScreen.faqTitle')}
        testID="quest-scenario-faq"
      />

      <CtaLink colors={colors} href={QUEST_LIST_ROUTE} label={i18nT('quests:screens.tabs.QuestScenarioScreen.cta')} />
    </ScrollView>
  )
}
