import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

import { useThemedColors } from '@/hooks/useTheme'

import {
  DescriptionSkeleton,
} from '@/components/travel/TravelDetailSkeletons'
import type { Travel } from '@/src/types/types'

import type { AnchorsMap } from '../TravelDetailsTypes'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { withLazy } from '../TravelDetailsLazy'
import { CollapsibleSection } from './CollapsibleSection'
import { LazyYouTube } from './LazyYouTubeSection'

const TravelDescription = withLazy(() => import('@/components/travel/TravelDescription'))

const DescriptionFallback = () => {
  const styles = useTravelDetailsStyles()
  return (
    <View style={styles.fallback}>
      <DescriptionSkeleton />
    </View>
  )
}

export const TravelDetailsContentSection: React.FC<{
  travel: Travel
  isMobile: boolean
  forceOpenKey: string | null
  anchors: AnchorsMap
  scrollRef: any
}> = ({ travel, isMobile, anchors, forceOpenKey, scrollRef }) => {
  const styles = useTravelDetailsStyles()
  const colors = useThemedColors()
  type InsightKey = 'recommendation' | 'plus' | 'minus'

  const stripHtml = useCallback((value?: string | null) => {
    if (!value) return ''
    return value
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }, [])

  const extractSnippets = useCallback(
    (value?: string | null, maxSentences = 1) => {
      const text = stripHtml(value)
      if (!text) return ''
      const matches = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []
      const parts = matches.map((p) => p.trim()).filter(Boolean)
      return parts.slice(0, Math.max(1, maxSentences)).join(' ')
    },
    [stripHtml]
  )

  const hasRecommendation = Boolean(travel.recommendation?.trim())
  const hasPlus = Boolean(travel.plus?.trim())
  const hasMinus = Boolean(travel.minus?.trim())

  const insightConfigs = useMemo(
    () =>
      [
        hasRecommendation && {
          key: 'recommendation' as InsightKey,
          label: 'Советы',
        },
        hasPlus && {
          key: 'plus' as InsightKey,
          label: 'Понравилось',
        },
        hasMinus && {
          key: 'minus' as InsightKey,
          label: 'Не зашло',
        },
      ].filter(Boolean) as Array<{ key: InsightKey; label: string }>,
    [hasRecommendation, hasPlus, hasMinus]
  )

  const shouldUseMobileInsights = isMobile && insightConfigs.length > 0
  const [mobileInsightKey, setMobileInsightKey] = useState<InsightKey | null>(() =>
    shouldUseMobileInsights ? insightConfigs[0]?.key ?? null : null
  )

  const defaultInsightKey = shouldUseMobileInsights ? insightConfigs[0]?.key ?? null : null

  useEffect(() => {
    if (!shouldUseMobileInsights) {
      if (mobileInsightKey !== null) {
        setMobileInsightKey(null)
      }
      return
    }

    if (
      forceOpenKey &&
      (forceOpenKey === 'recommendation' || forceOpenKey === 'plus' || forceOpenKey === 'minus')
    ) {
      if (mobileInsightKey !== forceOpenKey) {
        setMobileInsightKey(forceOpenKey as InsightKey)
      }
      return
    }

    if (!mobileInsightKey && defaultInsightKey) {
      setMobileInsightKey(defaultInsightKey)
    }
  }, [defaultInsightKey, forceOpenKey, mobileInsightKey, shouldUseMobileInsights])

  const buildInsightControl = useCallback(
    (key: InsightKey) =>
      shouldUseMobileInsights
        ? {
            open: mobileInsightKey === key,
            onToggle: () => setMobileInsightKey((prev) => (prev === key ? null : key)),
          }
        : {},
    [mobileInsightKey, shouldUseMobileInsights]
  )

  const decisionSummary = useMemo(() => {
    const items: Array<{ label: string; text: string; tone: 'info' | 'positive' | 'negative' }> = []
    const rec = extractSnippets(travel.recommendation, 2)
    const plus = extractSnippets(travel.plus, 1)
    const minus = extractSnippets(travel.minus, 1)

    if (rec) items.push({ label: 'Полезно', text: rec, tone: 'info' })
    if (plus) items.push({ label: 'Плюс', text: plus, tone: 'positive' })
    if (minus) items.push({ label: 'Минус', text: minus, tone: 'negative' })

    return items.slice(0, 3)
  }, [extractSnippets, travel.minus, travel.plus, travel.recommendation])

  const decisionTips = useMemo(() => {
    type TipItem = { text: string; level: 0 | 1 }

    const splitToBullets = (text: string): TipItem[] => {
      const normalized = text
        .replace(/\r\n/g, '\n')
        .replace(/(&nbsp;|&#160;)/gi, ' ')
        .replace(/\u00a0/g, ' ')
        .replace(/\u2022/g, '•')
        .replace(/\s+/g, ' ')
        .trim()

      const withListBreaks = normalized
        .replace(/\s+(?=\d{1,2}\s*[).]\s+)/g, '\n')
        .replace(/\s+(?=[-–—]\s+)/g, '\n')

      const lines = withListBreaks
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)

      const items: TipItem[] = []

      const pushOrAppend = (level: 0 | 1, value: string) => {
        const v = value.trim()
        if (!v) return
        if (level === 0) {
          items.push({ text: v, level: 0 })
          return
        }
        items.push({ text: v, level: 1 })
      }

      const splitInlineSubBullets = (mainText: string): { main: string; subs: string[] } => {
        const cleaned = mainText.trim()
        if (!cleaned) return { main: '', subs: [] }

        const parts = cleaned
          .split(/\s+[-–—]\s+/g)
          .map((p) => p.trim())
          .filter(Boolean)

        if (parts.length <= 1) return { main: cleaned, subs: [] }
        return { main: parts[0] ?? '', subs: parts.slice(1) }
      }

      let inNumbered = false

      for (const lineRaw of lines) {
        const line = lineRaw.replace(/^•\s*/, '').trim()
        const numberedMatch = line.match(/^(\d{1,2})\s*[).]\s+(.*)$/)

        if (numberedMatch) {
          inNumbered = true
          const rest = (numberedMatch[2] ?? '').trim()
          const { main, subs } = splitInlineSubBullets(rest)
          pushOrAppend(0, main)
          subs.forEach((s) => pushOrAppend(1, s))
          continue
        }

        const subMatch = line.match(/^[-–—]\s+(.*)$/)
        if (subMatch) {
          pushOrAppend(1, subMatch[1] ?? '')
          continue
        }

        if (inNumbered && items.length > 0) {
          const idxFromEnd = [...items].reverse().findIndex((x) => x.level === 0)
          if (idxFromEnd !== -1) {
            const absoluteIndex = items.length - 1 - idxFromEnd
            items[absoluteIndex] = {
              ...items[absoluteIndex],
              text: `${items[absoluteIndex].text} ${line}`.trim(),
            }
            continue
          }
        }

        const fromSemicolons = line
          .split(/\s*;\s+/g)
          .map((s) => s.trim())
          .filter(Boolean)

        if (fromSemicolons.length > 1) {
          fromSemicolons.forEach((s) => pushOrAppend(0, s))
          continue
        }

        const sentences = line
          .split(/(?<=[.!?])\s+/g)
          .map((s) => s.trim())
          .filter(Boolean)

        sentences.forEach((s) => pushOrAppend(0, s))
      }

      return items
    }

    const tips = decisionSummary
      .flatMap((item) => splitToBullets(item.text))
      .map((t) => ({ ...t, text: t.text.replace(/^[-–—•]\s*/, '').trim() }))
      .filter((t) => Boolean(t.text))

    return tips.slice(0, 8)
  }, [decisionSummary])

  const scrollToTop = useCallback(() => {
    try {
      const scrollViewAny = scrollRef.current as any
      const node: any =
        (typeof scrollViewAny?.getScrollableNode === 'function' && scrollViewAny.getScrollableNode()) ||
        scrollViewAny?._scrollNode ||
        scrollViewAny?._innerViewNode ||
        scrollViewAny?._nativeNode ||
        scrollViewAny?._domNode ||
        null

      if (node) {
        const before = Number(node.scrollTop ?? 0)
        let didCall = false
        try {
          if (typeof node.scrollTo === 'function') {
            node.scrollTo({ top: 0, behavior: 'smooth' })
            didCall = true
          }
        } catch {
          void 0
        }

        try {
          const afterObj = Number(node.scrollTop ?? 0)
          if (typeof node.scrollTo === 'function' && (!didCall || Math.abs(afterObj - before) < 1)) {
            node.scrollTo(0, 0)
            didCall = true
          }
        } catch {
          void 0
        }

        try {
          const afterNum = Number(node.scrollTop ?? 0)
          if (!didCall || Math.abs(afterNum - before) < 1) {
            node.scrollTop = 0
          }
        } catch {
          void 0
        }

        return
      }
    } catch {
      void 0
    }

    if (typeof window !== 'undefined') {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } catch {
        try {
          window.scrollTo(0, 0)
        } catch {
          void 0
        }
      }
    }
  }, [scrollRef])

  return (
    <>
      {travel.description && (
        <Suspense fallback={<DescriptionFallback />}>
          <View
            ref={anchors.description}
            collapsable={false}
            accessibilityLabel="Описание маршрута"
            {...(Platform.OS === 'web' ? { 'data-section-key': 'description' } : {})}
          >
            <CollapsibleSection
              title={travel.name}
              initiallyOpen
              forceOpen={forceOpenKey === 'description'}
              iconName="menu-book"
              highlight="info"
            >
              <View style={styles.descriptionContainer}>
                <View style={styles.descriptionIntroWrapper}>
                  <Text style={styles.descriptionIntroTitle}>Описание маршрута</Text>
                  <Text style={styles.descriptionIntroText}>
                    {`${travel.number_days || 0} ${
                      travel.number_days === 1
                        ? 'день'
                        : travel.number_days < 5
                        ? 'дня'
                        : 'дней'
                    }`}
                    {travel.countryName ? ` · ${travel.countryName}` : ''}
                    {travel.monthName ? ` · лучший сезон: ${travel.monthName.toLowerCase()}` : ''}
                  </Text>
                </View>

                {decisionTips.length > 0 && (
                  <View style={styles.decisionSummaryBox}>
                    <Text style={styles.decisionSummaryTitle}>Полезные советы перед поездкой</Text>
                    <View style={styles.decisionSummaryList}>
                      {decisionTips.map((tip, idx) =>
                        tip.level === 0 ? (
                          <View key={`tip-${idx}`} style={styles.decisionSummaryBulletRow}>
                            <MaterialIcons
                              name="lightbulb-outline"
                              size={14}
                              color={colors.textMuted}
                              style={styles.decisionSummaryBulletIcon}
                              accessibilityElementsHidden
                            />
                            <Text style={styles.decisionSummaryBulletText}>{tip.text}</Text>
                          </View>
                        ) : (
                          <View key={`tip-${idx}`} style={styles.decisionSummarySubBulletRow}>
                            <MaterialIcons
                              name="circle"
                              size={6}
                              color={colors.textMuted}
                              style={styles.decisionSummarySubBulletIcon}
                              accessibilityElementsHidden
                            />
                            <Text style={styles.decisionSummarySubBulletText}>{tip.text}</Text>
                          </View>
                        )
                      )}
                    </View>
                  </View>
                )}

                <TravelDescription title={travel.name} htmlContent={travel.description} noBox />

                {Platform.OS === 'web' && (
                  <Pressable
                    onPress={scrollToTop}
                    style={styles.backToTopWrapper}
                    accessibilityRole="button"
                    accessibilityLabel="Назад к началу страницы"
                  >
                    <Text style={styles.backToTopText}>Назад к началу</Text>
                  </Pressable>
                )}
              </View>
            </CollapsibleSection>
          </View>
        </Suspense>
      )}

      {travel.youtube_link && (
        <View
          style={[styles.sectionContainer, styles.contentStable]}
          ref={anchors.video}
          collapsable={false}
          accessibilityLabel="Видео маршрута"
          {...(Platform.OS === 'web' ? { 'data-section-key': 'video' } : {})}
        >
          <Text style={styles.sectionHeaderText}>Видео</Text>
          <Text style={styles.sectionSubtitle}>Одно нажатие — и ролик начнёт проигрываться</Text>
          <View style={{ marginTop: 12 }}>
            <LazyYouTube url={travel.youtube_link} />
          </View>
        </View>
      )}

      {shouldUseMobileInsights && (
        <View
          accessibilityLabel="Быстрый доступ к разделам"
          style={[styles.sectionContainer, styles.mobileInsightTabsWrapper]}
        >
          <Text style={styles.mobileInsightLabel}>Быстрый доступ к разделам</Text>
          <View style={styles.mobileInsightTabs}>
            {insightConfigs.map((section) => (
              <Pressable
                key={section.key}
                onPress={() => setMobileInsightKey(section.key)}
                style={[
                  styles.mobileInsightChip,
                  mobileInsightKey === section.key && styles.mobileInsightChipActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Показать раздел ${section.label}`}
              >
                <Text
                  style={[
                    styles.mobileInsightChipText,
                    mobileInsightKey === section.key && styles.mobileInsightChipTextActive,
                  ]}
                >
                  {section.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {travel.recommendation && (
        <Suspense fallback={<DescriptionFallback />}>
          <View
            ref={anchors.recommendation}
            collapsable={false}
            accessibilityLabel="Рекомендации"
            {...(Platform.OS === 'web' ? { 'data-section-key': 'recommendation' } : {})}
          >
            <CollapsibleSection
              title="Рекомендации"
              initiallyOpen={!isMobile}
              forceOpen={!isMobile && forceOpenKey === 'recommendation'}
              iconName="tips-and-updates"
              highlight="info"
              badgeLabel="Опыт автора"
              {...buildInsightControl('recommendation')}
            >
              <View style={styles.descriptionContainer}>
                <TravelDescription title="Рекомендации" htmlContent={travel.recommendation} noBox />
              </View>
            </CollapsibleSection>
          </View>
        </Suspense>
      )}

      {travel.plus && (
        <Suspense fallback={<DescriptionFallback />}>
          <View
            ref={anchors.plus}
            collapsable={false}
            accessibilityLabel="Плюсы"
            {...(Platform.OS === 'web' ? { 'data-section-key': 'plus' } : {})}
          >
            <CollapsibleSection
              title="Плюсы"
              initiallyOpen={!isMobile}
              forceOpen={!isMobile && forceOpenKey === 'plus'}
              iconName="thumb-up-alt"
              highlight="positive"
              badgeLabel="Что понравилось"
              {...buildInsightControl('plus')}
            >
              <View style={styles.descriptionContainer}>
                <TravelDescription title="Плюсы" htmlContent={travel.plus} noBox />
              </View>
            </CollapsibleSection>
          </View>
        </Suspense>
      )}

      {travel.minus && (
        <Suspense fallback={<DescriptionFallback />}>
          <View
            ref={anchors.minus}
            collapsable={false}
            accessibilityLabel="Минусы"
            {...(Platform.OS === 'web' ? { 'data-section-key': 'minus' } : {})}
          >
            <CollapsibleSection
              title="Минусы"
              initiallyOpen={!isMobile}
              forceOpen={!isMobile && forceOpenKey === 'minus'}
              iconName="thumb-down-alt"
              highlight="negative"
              badgeLabel="Что смутило"
              {...buildInsightControl('minus')}
            >
              <View style={styles.descriptionContainer}>
                <TravelDescription title="Минусы" htmlContent={travel.minus} noBox />
              </View>
            </CollapsibleSection>
          </View>
        </Suspense>
      )}
    </>
  )
}
