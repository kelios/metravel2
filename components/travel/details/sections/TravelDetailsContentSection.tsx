import React, { Suspense, memo, useCallback } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'

import type { Travel } from '@/types/types'

import type { AnchorsMap } from '../TravelDetailsTypes'
import { useTravelDetailsStyles } from '../TravelDetailsStyles'
import { CollapsibleSection } from './CollapsibleSection'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import TravelDescription from '@/components/travel/TravelDescription'
import { safeGetYoutubeId } from '@/utils/travelMedia'
import { resolveServerRichTextHtml } from '@/utils/serverSafeHtml'
import { useTravelDetailsContentSectionModel } from '../hooks/useTravelDetailsContentSectionModel'
import { LazyYouTube } from './LazyYouTubeSection'
import QuestForCitySection from './QuestForCitySection'
import TravelRegisterCtaSection from './TravelRegisterCtaSection'
import { translate as i18nT } from '@/i18n'


const LazyYouTubeSection = React.lazy(() =>
  Promise.resolve(import('./LazyYouTubeSection')).then((module) => ({ default: module.LazyYouTube })),
)
const YouTubeSectionComponent = Platform.OS === 'web' ? LazyYouTubeSection : LazyYouTube

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
}> = memo(function TravelDetailsContentSection({
  travel,
  isMobile,
  anchors,
  forceOpenKey,
}) {
  const styles = useTravelDetailsStyles()
  const publish = (travel as any).publish
  const moderation = (travel as any).moderation
  // #709: canonical rich_text.*.safe_html с бэка, legacy-поля — fallback для старого payload
  const descriptionContent = resolveServerRichTextHtml(travel.rich_text?.description, travel.description || '')
  const recommendationContent = resolveServerRichTextHtml(travel.rich_text?.recommendation, travel.recommendation)
  const plusContent = resolveServerRichTextHtml(travel.rich_text?.plus, travel.plus)
  const minusContent = resolveServerRichTextHtml(travel.rich_text?.minus, travel.minus)
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

  const setVideoSectionRef = useCallback(
    (node: unknown) => {
      if (anchors.video && typeof anchors.video === 'object') {
        ;(anchors.video as any).current = node
      }
      setVideoRef(node)
    },
    [anchors.video, setVideoRef],
  )

  return (
    <>
      <QuestForCitySection travel={travel} styles={styles} />

      {shouldRenderDescriptionSection && (
        <View
          ref={anchors.description}
          testID="travel-details-description"
          collapsable={false}
          accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.opisanie_marshruta_98e0c78f')}
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
                <Text style={styles.descriptionIntroText}>
                  {travel.monthName
                    ? i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.luchshiy_sezon_value1_value2_302b32f3', { value1: travel.monthName.toLowerCase(), value2: readingTimeLabel })
                    : readingTimeLabel.replace(/^ · /, '')}
                </Text>
              </View>
              <TravelRegisterCtaSection
                redirect={travel.slug ? `/travels/${travel.slug}` : undefined}
                travelId={travel.id}
                title={travel.name}
                imageUrl={travel.travel_image_thumb_url || travel.travel_image_thumb_small_url}
              />
              {Platform.OS === 'web' && <h2 style={WEB_SR_ONLY_HEADING_STYLE as any}>{i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.soderzhanie_marshruta_4fdeae71')}</h2>}

              <TravelDescription title={travel.name} htmlContent={descriptionContent.html} serverSanitized={descriptionContent.serverSanitized} noBox />

              {/* Кнопки «наверх» нет намеренно (#1023): навигацию покрывают sticky-табы секций */}
            </View>
          </CollapsibleSection>
        </View>
      )}

      {travel.youtube_link && safeGetYoutubeId(travel.youtube_link) && (
        <View
          ref={setVideoSectionRef}
          style={[styles.sectionContainer, styles.contentStable]}
          collapsable={false}
          accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.video_marshruta_f83c004c')}
          {...(Platform.OS === 'web' ? { 'data-section-key': 'video' } : {})}
        >
          <Text
            style={styles.sectionHeaderText}
            accessibilityRole={Platform.OS === 'web' ? ('heading' as any) : undefined}
            aria-level={2 as any}
          >
            {i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.video_3036068c')}</Text>
          <Text style={styles.sectionSubtitle}>{i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.odno_nazhatie_i_rolik_nachnet_proigryvatsya_9afa12cf')}</Text>
          <View style={SECTION_CONTENT_MARGIN_STYLE}>
            {shouldLoadVideo ? (
              <Suspense fallback={<View style={VIDEO_PLACEHOLDER_STYLE} />}>
                <YouTubeSectionComponent url={travel.youtube_link} />
              </Suspense>
            ) : (
              <View style={VIDEO_PLACEHOLDER_STYLE} />
            )}
          </View>
        </View>
      )}

      {shouldUseMobileInsights && (
        <View
          accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.vpechatleniya_avtora_2f076a9a')}
          style={[styles.sectionContainer, styles.mobileInsightTabsWrapper]}
        >
          <Text style={styles.mobileInsightLabel}>{i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.vpechatleniya_avtora_2f076a9a')}</Text>
          <View
            style={styles.mobileInsightTabs}
            accessibilityRole={'tablist' as any}
            accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.vpechatleniya_avtora_2f076a9a')}
          >
            {insightConfigs.map((section) => (
              <Pressable
                key={section.key}
                onPress={() => setMobileInsightKey(section.key)}
                style={[
                  styles.mobileInsightChip,
                  mobileInsightKey === section.key && styles.mobileInsightChipActive,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: mobileInsightKey === section.key }}
                accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.pokazat_razdel_value1_3669c273', { value1: section.label })}
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

      {hasInsights && (
        <View ref={setInsightsRef as any} collapsable={false}>
          {travel.recommendation && (
            <View
              key="recommendation"
              ref={anchors.recommendation}
              collapsable={false}
              accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.rekomendatsii_a20e5eec')}
              {...(Platform.OS === 'web' ? { 'data-section-key': 'recommendation' } : {})}
            >
              <CollapsibleSection
                title={i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.rekomendatsii_a20e5eec')}
                initiallyOpen={!isMobile}
                forceOpen={!isMobile && forceOpenKey === 'recommendation'}
                iconName="tips-and-updates"
                highlight="info"
                badgeLabel={i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.opyt_avtora_c4f274df')}
                {...buildInsightControl('recommendation')}
              >
                <View style={styles.descriptionContainer}>
                  <TravelDescription title={i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.rekomendatsii_a20e5eec')} htmlContent={recommendationContent.html} serverSanitized={recommendationContent.serverSanitized} noBox />
                </View>
              </CollapsibleSection>
            </View>
          )}

          {travel.plus && (
            <View
              key="plus"
              ref={anchors.plus}
              collapsable={false}
              accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.plyusy_2eafad7c')}
              {...(Platform.OS === 'web' ? { 'data-section-key': 'plus' } : {})}
            >
              <CollapsibleSection
                title={i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.plyusy_2eafad7c')}
                initiallyOpen={!isMobile}
                forceOpen={!isMobile && forceOpenKey === 'plus'}
                iconName="thumb-up-alt"
                highlight="positive"
                badgeLabel={i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.chto_ponravilos_134b7cf3')}
                {...buildInsightControl('plus')}
              >
                <View style={styles.descriptionContainer}>
                  <TravelDescription title={i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.plyusy_2eafad7c')} htmlContent={plusContent.html} serverSanitized={plusContent.serverSanitized} noBox />
                </View>
              </CollapsibleSection>
            </View>
          )}

          {travel.minus && (
            <View
              key="minus"
              ref={anchors.minus}
              collapsable={false}
              accessibilityLabel={i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.minusy_626a3d5e')}
              {...(Platform.OS === 'web' ? { 'data-section-key': 'minus' } : {})}
            >
              <CollapsibleSection
                title={i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.minusy_626a3d5e')}
                initiallyOpen={!isMobile}
                forceOpen={!isMobile && forceOpenKey === 'minus'}
                iconName="thumb-down-alt"
                highlight="negative"
                badgeLabel={i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.chto_smutilo_72420632')}
                {...buildInsightControl('minus')}
              >
                <View style={styles.descriptionContainer}>
                  <TravelDescription title={i18nT('travel:components.travel.details.sections.TravelDetailsContentSection.minusy_626a3d5e')} htmlContent={minusContent.html} serverSanitized={minusContent.serverSanitized} noBox />
                </View>
              </CollapsibleSection>
            </View>
          )}
        </View>
      )}
    </>
  )
})
