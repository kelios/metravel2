import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'

import type { Travel } from '@/types/types'
import { useProgressiveLoad } from '@/hooks/useProgressiveLoading'

import type { AnchorsMap } from '../TravelDetailsTypes'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { CollapsibleSection } from './CollapsibleSection'
import { LazyYouTube } from './LazyYouTubeSection'
import { getDayLabel } from '@/services/pdf-export/utils/pluralize'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import TravelDescription from '@/components/travel/TravelDescription'

const SECTION_CONTENT_MARGIN_STYLE = { marginTop: 12 } as const
const WEB_SR_ONLY_HEADING_STYLE = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
} as const
const VIDEO_PLACEHOLDER_STYLE = {
  width: '100%',
  aspectRatio: 16 / 9,
  borderRadius: DESIGN_TOKENS.radii.md,
  overflow: 'hidden',
} as const


export const TravelDetailsContentSection: React.FC<{
  travel: Travel
  isMobile: boolean
  forceOpenKey: string | null
  anchors: AnchorsMap
}> = ({ travel, isMobile, anchors, forceOpenKey }) => {
  const styles = useTravelDetailsStyles()
  type InsightKey = 'recommendation' | 'plus' | 'minus'
  const publish = (travel as any).publish
  const moderation = (travel as any).moderation

  const shouldRenderDescriptionSection = useMemo(() => {
    const desc = typeof travel.description === 'string' ? travel.description.trim() : ''
    // For drafts we still want to show the section wrapper so the page doesn't look "stuck".
    const isDraft = publish === false || moderation === false
    return Boolean(desc) || isDraft
  }, [moderation, publish, travel.description])

  const hasRecommendation = Boolean(travel.recommendation?.trim())
  const hasPlus = Boolean(travel.plus?.trim())
  const hasMinus = Boolean(travel.minus?.trim())

  const insightConfigs = useMemo(
    () =>
      [
        hasRecommendation && {
          key: 'recommendation' as InsightKey,
          label: 'Советы',
          charCount: (travel.recommendation || '').replace(/<[^>]*>/g, '').length,
        },
        hasPlus && {
          key: 'plus' as InsightKey,
          label: 'Понравилось',
          charCount: (travel.plus || '').replace(/<[^>]*>/g, '').length,
        },
        hasMinus && {
          key: 'minus' as InsightKey,
          label: 'Не зашло',
          charCount: (travel.minus || '').replace(/<[^>]*>/g, '').length,
        },
      ].filter(Boolean) as Array<{ key: InsightKey; label: string; charCount: number }>,
    [hasRecommendation, hasPlus, hasMinus, travel.recommendation, travel.plus, travel.minus]
  )

  const readingTimeLabel = useMemo(() => {
    if (!travel.description) return ''
    const wordCount = travel.description.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length
    const minutes = Math.max(1, Math.ceil(wordCount / 200))
    return ` · ~${minutes} мин чтения`
  }, [travel.description])

  const shouldUseMobileInsights = isMobile && insightConfigs.length > 0
  const hasInsights = hasRecommendation || hasPlus || hasMinus
  const [mobileInsightKey, setMobileInsightKey] = useState<InsightKey | null>(() =>
    shouldUseMobileInsights ? insightConfigs[0]?.key ?? null : null
  )
  const { shouldLoad: shouldLoadVideo, setElementRef: setVideoRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '220px',
    threshold: 0.05,
    fallbackDelay: 1000,
    enabled: Boolean(travel.youtube_link),
  })
  const { setElementRef: setInsightsRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '260px',
    threshold: 0.05,
    fallbackDelay: 1000,
    enabled: hasInsights,
  })

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

  return (
    <>
      {shouldRenderDescriptionSection && (
        <View
          ref={anchors.description}
          testID="travel-details-description"
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
                  {`${travel.number_days || 0} ${getDayLabel(travel.number_days || 0)}`}
                  {travel.countryName ? ` · ${travel.countryName}` : ''}
                  {travel.monthName ? ` · лучший сезон: ${travel.monthName.toLowerCase()}` : ''}
                  {/* P2-2: Оценка времени чтения */}
                  {readingTimeLabel}
                </Text>
              </View>
              {Platform.OS === 'web' && <h2 style={WEB_SR_ONLY_HEADING_STYLE as any}>Содержание маршрута</h2>}

              <TravelDescription title={travel.name} htmlContent={travel.description || ''} noBox />

              {/* P2-3: Кнопка «Назад к началу» удалена — глобальный ScrollToTopButton достаточен */}
            </View>
          </CollapsibleSection>
        </View>
      )}

      {travel.youtube_link && (
        <View
          ref={(node) => {
            if (anchors.video && typeof anchors.video === 'object') {
              ;(anchors.video as any).current = node
            }
            setVideoRef(node)
          }}
          style={[styles.sectionContainer, styles.contentStable]}
          collapsable={false}
          accessibilityLabel="Видео маршрута"
          {...(Platform.OS === 'web' ? { 'data-section-key': 'video' } : {})}
        >
          <Text style={styles.sectionHeaderText}>Видео</Text>
          <Text style={styles.sectionSubtitle}>Одно нажатие — и ролик начнёт проигрываться</Text>
          <View style={SECTION_CONTENT_MARGIN_STYLE}>
            {shouldLoadVideo ? (
              <LazyYouTube url={travel.youtube_link} />
            ) : (
              <View style={VIDEO_PLACEHOLDER_STYLE} />
            )}
          </View>
        </View>
      )}

      {shouldUseMobileInsights && (
        <View
          accessibilityLabel="Впечатления автора"
          style={[styles.sectionContainer, styles.mobileInsightTabsWrapper]}
        >
          <Text style={styles.mobileInsightLabel}>Впечатления автора</Text>
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
                {section.charCount > 0 && (
                  <Text
                    style={[
                      styles.mobileInsightChipBadge,
                      mobileInsightKey === section.key && styles.mobileInsightChipBadgeActive,
                    ]}
                  >
                    {section.charCount > 999 ? `${Math.round(section.charCount / 100) / 10}k` : section.charCount}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {hasInsights && (
        <View ref={setInsightsRef as any} collapsable={false}>
          {travel.recommendation && (
            <View
              key="recommendation"
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
          )}

          {travel.plus && (
            <View
              key="plus"
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
          )}

          {travel.minus && (
            <View
              key="minus"
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
          )}
        </View>
      )}
    </>
  )
}
