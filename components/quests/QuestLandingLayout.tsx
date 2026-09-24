import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { ViewStyle } from 'react-native'
import { Link } from 'expo-router'
import type { Href } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { jsonLdScript } from '@/components/seo/jsonLdScript'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { LAYOUT } from '@/constants/layout'
import {
  QUESTS_LANDING_CARD_MAX_WIDTH,
  QUESTS_LANDING_CARD_MIN_WIDTH,
  QUESTS_LANDING_CONTENT_WIDTH,
  QUESTS_LANDING_PADDING,
} from '@/constants/questLayout'
import type { useThemedColors } from '@/hooks/useTheme'
import QuestCard from '@/screens/tabs/QuestCard'
import type { getStyles } from '@/screens/tabs/QuestsScreen.styles'
import type { QuestMeta } from '@/screens/tabs/questsShared'
import { buildQuestPath } from '@/utils/routePaths'
import { buildCanonicalUrl } from '@/utils/seo'

// Общий каркас лендингов города (`app/(tabs)/quests/[city]`) и страны
// (`app/(tabs)/quests/country/[country]`): шапка, секции-карточки, список ссылок
// на города, сетка карточек квестов, JSON-LD и синхронизация description в
// <head>. До #2087 обе страницы держали по копии этого кода в своём маршрутном
// чанке.

type ThemedColors = ReturnType<typeof useThemedColors>
type QuestsScreenStyles = ReturnType<typeof getStyles>

export const QUEST_LIST_ROUTE = '/quests'

const { spacing } = DESIGN_TOKENS

export const getQuestLandingRouteParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

const useWebLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * The SSG fallback of a landing (`section[data-ssg-quest-<kind>]` and its style) is a
 * sibling of #root, so React hydration cannot remove it. Once the resolved screen owns
 * the visible H1 (`enabled`), discard exactly that marked fallback and leave other route
 * content alone — otherwise the DOM keeps a second, hidden H1 (#2087).
 */
export function useQuestLandingSsgFallbackCleanup(enabled: boolean, kind: 'city' | 'country') {
  useWebLayoutEffect(() => {
    if (!enabled || typeof document === 'undefined') return
    document
      .querySelectorAll(`section[data-ssg-quest-${kind}="true"]`)
      .forEach((section) => section.remove())
    document
      .querySelectorAll(`style[data-ssg-quest-${kind}-style="true"]`)
      .forEach((style) => style.remove())
  }, [enabled, kind])
}

export type QuestLandingMetaTarget = {
  selector: string
  attributes: Record<string, string>
  content: string
}

export const QUEST_LANDING_DESCRIPTION_META_TARGETS = [
  { selector: 'meta[name="description"]', attributes: { name: 'description' } },
  { selector: 'meta[property="og:description"]', attributes: { property: 'og:description' } },
  { selector: 'meta[name="twitter:description"]', attributes: { name: 'twitter:description' } },
] as const

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

/**
 * Expo Head keeps the root fallback description next to the route tag on
 * direct web entry. While `enabled`, the focused landing stays authoritative for
 * crawlers and link previews (as LazyInstantSEO already does for canonical);
 * on blur/unmount the previous tags are restored.
 */
export function useQuestLandingHeadMeta(enabled: boolean, targets: readonly QuestLandingMetaTarget[]) {
  const previousRef = useRef<Array<{
    selector: string
    attributes: Record<string, string>
    content: string | null
  }> | null>(null)

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined

    if (!previousRef.current) {
      previousRef.current = targets.map(({ selector, attributes }) => ({
        selector,
        attributes,
        content: document.querySelector<HTMLMetaElement>(selector)?.content ?? null,
      }))
    }

    const sync = () => {
      for (const { selector, attributes, content } of targets) {
        syncSingleMetaContent(selector, attributes, content)
      }
    }

    sync()
    const observer = new MutationObserver(sync)
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
      for (const { selector, attributes, content } of previousRef.current ?? []) {
        if (content !== null) {
          syncSingleMetaContent(selector, attributes, content)
        } else {
          document.querySelectorAll(selector).forEach((node) => node.remove())
        }
      }
      previousRef.current = null
    }
  }, [enabled, targets])
}

/** ItemList + BreadcrumbList for a landing; null when no quest has a valid path. */
export function renderQuestLandingStructuredData({
  quests,
  name,
  crumbName,
  catalogCrumbName,
  canonical,
  keyPrefix,
}: {
  quests: QuestMeta[]
  name: string
  crumbName: string
  catalogCrumbName: string
  canonical: string
  keyPrefix: string
}) {
  // #1185: квест без cityId/id давал в разметке ссылку `/quests/undefined/undefined`
  // — поисковик получал заведомо битый URL. Такие позиции в список не попадают.
  const listedQuests = quests
    .map((quest) => ({ quest, path: buildQuestPath(quest.cityId, quest.id) }))
    .filter((entry): entry is { quest: QuestMeta; path: string } => Boolean(entry.path))
  if (listedQuests.length === 0) return null

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
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
      { '@type': 'ListItem', position: 2, name: catalogCrumbName, item: buildCanonicalUrl(QUEST_LIST_ROUTE) },
      { '@type': 'ListItem', position: 3, name: crumbName, item: canonical },
    ],
  }

  return (
    <>
      {jsonLdScript(itemList, { key: `${keyPrefix}-itemlist` })}
      {jsonLdScript(breadcrumb, { key: `${keyPrefix}-breadcrumb` })}
    </>
  )
}

export function QuestLandingLoading({ styles, colors }: { styles: QuestsScreenStyles; colors: ThemedColors }) {
  return (
    <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.primary} />
    </View>
  )
}

export function QuestLandingScroll({
  styles,
  isMobile,
  children,
}: {
  styles: QuestsScreenStyles
  isMobile: boolean
  children: React.ReactNode
}) {
  return (
    <ScrollView
      style={[styles.root, { flexDirection: 'column' }]}
      contentContainerStyle={{
        width: '100%',
        maxWidth: QUESTS_LANDING_CONTENT_WIDTH + QUESTS_LANDING_PADDING * 2,
        alignSelf: 'center',
        padding: QUESTS_LANDING_PADDING,
        gap: spacing.md,
        // Резерв под мобильный BottomDock (абсолютный оверлей): без него
        // последняя карточка обрезается доком.
        paddingBottom: isMobile ? (LAYOUT?.tabBarHeight ?? 56) + spacing.xl : spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  )
}

export function QuestLandingHeader({
  colors,
  backLabel,
  eyebrowIcon,
  eyebrow,
  title,
  lead,
  meta,
  blockStyle,
}: {
  colors: ThemedColors
  backLabel: string
  eyebrowIcon: React.ComponentProps<typeof Feather>['name']
  eyebrow: string
  title: string
  lead: string
  meta: React.ReactNode
  blockStyle: ViewStyle
}) {
  return (
    <>
      <Link href={QUEST_LIST_ROUTE} asChild>
        <Pressable
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 }}
          accessibilityRole="link"
          accessibilityLabel={backLabel}
        >
          <Feather name="arrow-left" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>
            {backLabel}
          </Text>
        </Pressable>
      </Link>

      <View style={blockStyle}>
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
          <Feather name={eyebrowIcon} size={13} color={colors.primaryDark} aria-hidden />
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primaryText, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {eyebrow}
          </Text>
        </View>
        <Text
          accessibilityRole="header"
          {...({ 'aria-level': 1 } as Record<string, unknown>)}
          style={{ fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.6 }}
        >
          {title}
        </Text>
        <Text style={{ fontSize: 15, lineHeight: 23, color: colors.textMuted }}>
          {lead}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSubtle }}>
          {meta}
        </Text>
      </View>
    </>
  )
}

export function QuestLandingSectionTitle({ colors, children }: { colors: ThemedColors; children: string }) {
  return (
    <Text
      accessibilityRole="header"
      {...({ 'aria-level': 2 } as Record<string, unknown>)}
      style={{ fontSize: 20, fontWeight: '800', color: colors.text }}
    >
      {children}
    </Text>
  )
}

export function QuestLandingGrid({
  styles,
  quests,
  cardColumns,
  cardWidth,
}: {
  styles: QuestsScreenStyles
  quests: QuestMeta[]
  cardColumns: number
  cardWidth: number
}) {
  return (
    <View style={[styles.questsGrid, { gridTemplateColumns: `repeat(${cardColumns}, minmax(0, 1fr))` } as ViewStyle]}>
      {quests.map((quest, index) => (
        <QuestCard
          key={`${quest.cityId}:${quest.id}`}
          styles={styles}
          cityId={quest.cityId}
          quest={quest}
          cardWidth={cardWidth}
          index={index}
        />
      ))}
    </View>
  )
}

export type QuestLandingSectionStyles = ReturnType<typeof createQuestLandingSectionStyles>

function createQuestLandingSectionStyles(colors: ThemedColors) {
  return StyleSheet.create({
    section: {
      width: '100%',
      maxWidth: 840,
      gap: 8,
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      flex: 1,
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '800',
      color: colors.text,
    },
    body: {
      fontSize: 15,
      lineHeight: 23,
      color: colors.textMuted,
    },
    note: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSubtle,
    },
    linkList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    link: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: QUESTS_LANDING_CARD_MIN_WIDTH,
      maxWidth: QUESTS_LANDING_CARD_MAX_WIDTH,
    },
    // Рамка и фон живут на ВНУТРЕННЕЙ строке: `opacity` нажатия обязана притушить карточку
    // целиком, а стиль ссылки-ребёнка `Link asChild` не умеет зависеть от `pressed`.
    // `flexGrow` тянет строку на всю высоту ссылки — соседи по ряду выше, и без него рамка
    // не дотягивалась бы до низа карточки.
    linkRow: {
      flexGrow: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 52,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    linkRowPressed: {
      opacity: 0.75,
    },
    linkText: {
      flex: 1,
      gap: 2,
    },
    linkName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    linkMeta: {
      fontSize: 12,
      color: colors.textSubtle,
    },
  })
}

export function useQuestLandingSectionStyles(colors: ThemedColors) {
  return useMemo(() => createQuestLandingSectionStyles(colors), [colors])
}

export function QuestLandingSection({
  styles,
  colors,
  testID,
  icon,
  title,
  children,
}: {
  styles: QuestLandingSectionStyles
  colors: ThemedColors
  testID: string
  icon: React.ComponentProps<typeof Feather>['name']
  title: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.titleRow}>
        <Feather name={icon} size={18} color={colors.primary} aria-hidden />
        <Text
          accessibilityRole="header"
          {...({ 'aria-level': 2 } as Record<string, unknown>)}
          style={styles.title}
        >
          {title}
        </Text>
      </View>
      {children}
    </View>
  )
}

export type QuestLandingCityLink = {
  key: string
  href: Href
  a11yLabel: string
  name: string
  meta: React.ReactNode
}

export function QuestLandingCityLinks({
  styles,
  colors,
  links,
}: {
  styles: QuestLandingSectionStyles
  colors: ThemedColors
  links: QuestLandingCityLink[]
}) {
  return (
    <View style={styles.linkList}>
      {links.map((link) => (
        // Прямому ребёнку `Link asChild` отдаётся ОДИН плоский объект стиля: Slot сливает
        // стили спредом, поэтому функция `({ pressed }) => [...]` превращается в `{}` и
        // карточка теряет всю вёрстку. Состояние нажатия живёт на внутренней строке.
        <Link key={link.key} href={link.href} asChild>
          <Pressable
            style={styles.link}
            accessibilityRole="link"
            accessibilityLabel={link.a11yLabel}
          >
            {({ pressed }) => (
              <View style={[styles.linkRow, pressed && styles.linkRowPressed]}>
                <View style={styles.linkText}>
                  <Text style={styles.linkName}>{link.name}</Text>
                  <Text style={styles.linkMeta}>{link.meta}</Text>
                </View>
                <Feather name="arrow-right" size={17} color={colors.primary} aria-hidden />
              </View>
            )}
          </Pressable>
        </Link>
      ))}
    </View>
  )
}
