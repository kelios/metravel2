import React from 'react'
import { Platform, Pressable, Text, View } from 'react-native'

import type { Travel } from '@/types/types'

import type { AnchorsMap } from '../TravelDetailsTypes'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { CollapsibleSection } from './CollapsibleSection'
import { LazyYouTube } from './LazyYouTubeSection'
import { getDayLabel } from '@/services/pdf-export/utils/pluralize'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import TravelDescription from '@/components/travel/TravelDescription'
import { useTravelDetailsContentSectionModel } from '../hooks/useTravelDetailsContentSectionModel'

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
  const publish = (travel as any).publish
  const moderation = (travel as any).moderation
  const {
    buildInsightControl,
    hasInsights,
    insightConfigs,
    mobileInsightKey,
    readingTimeLabel,
    setInsightsRef,
    setMobileInsightKey,
    setVideoRef,
    shouldLoadVideo,
    shouldRenderDescriptionSection,
    shouldUseMobileInsights,
  } = useTravelDetailsContentSectionModel({
    forceOpenKey,
    isMobile,
    moderation,
    publish,
    travel,
  })

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
            coverImageUrl={travel.travel_image_thumb_url || travel.travel_image_thumb_small_url || null}
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
