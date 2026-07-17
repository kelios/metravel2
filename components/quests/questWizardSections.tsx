import React, { Suspense } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import AffiliateOffers from '@/components/affiliate/AffiliateOffers'
import { getAffiliateOffers } from '@/components/affiliate/affiliateConfig'
import { BadgeUnlockToast } from '@/components/achievements'
import { useThemedColors } from '@/hooks/useTheme'
import { useQuestCompletionMeta } from '@/hooks/useQuestCompletionMeta'
import { useQuestRatingMutation } from '@/hooks/useQuestRating'
import QuestPioneerBlock from './QuestPioneerBlock'
import QuestReviewSection from './QuestReviewSection'
import type { QuestMapApp } from './questWizardHelpers'

import {
  BelkrajWidgetLazy,
  NativeQuestVideoLazy,
  QuestFullMapLazy,
  QuestWebVideo,
} from './questWizardMedia'
import { translate as i18nT } from '@/i18n'


type PointLike = {
  id?: string
  title?: string
  image?: unknown
  lat: number
  lng: number
}

type CityLike = {
  name?: string
  lat: number
  lng: number
  countryCode?: string
}

type FinaleLike = {
  text: string
  video?: any
  poster?: any
}

type SharedProps = {
  colors: any
  styles: any
}

export function QuestDesktopMapPanel({
  colors: _colors,
  styles,
  currentStep,
  steps,
  compactDesktopLayout,
  useWideInlineLayout,
  desktopNavExpanded,
  setDesktopNavExpanded,
  showMap,
  toggleMap,
  openCurrentStepInMap,
  copyCurrentStepCoords,
  activeStepIndex,
  closeLoopRoute = false,
}: SharedProps & {
  currentStep: PointLike
  steps: PointLike[]
  compactDesktopLayout: boolean
  useWideInlineLayout: boolean
  desktopNavExpanded: boolean
  setDesktopNavExpanded: React.Dispatch<React.SetStateAction<boolean>>
  showMap: boolean
  toggleMap: () => void
  openCurrentStepInMap: (app: QuestMapApp) => void
  copyCurrentStepCoords: () => void
  activeStepIndex?: number
  /** Кольцевой квест: карта и экспорт замыкают маршрут «финиш → старт». */
  closeLoopRoute?: boolean
}) {
  return (
    <View
      style={[
        styles.fullMapSection,
        useWideInlineLayout && (compactDesktopLayout ? styles.compactDesktopSide : styles.desktopSide),
      ]}
    >
      {useWideInlineLayout && currentStep.id !== 'intro' && (
        <View style={styles.mapTopControls}>
          <View style={styles.navRow}>
            <Pressable
              style={styles.navButton}
              onPress={() => openCurrentStepInMap(Platform.OS === 'ios' ? 'apple' : 'google')}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={i18nT('quests:components.quests.questWizardSections.otkryt_navigatsiyu_d146fb23')}
            >
              <Text style={styles.navButtonText}>{i18nT('quests:components.quests.questWizardSections.navigatsiya_7f87f2af')}</Text>
            </Pressable>
            <Pressable
              style={styles.navToggle}
              onPress={() => setDesktopNavExpanded((value) => !value)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={desktopNavExpanded ? i18nT('quests:components.quests.questWizardSections.skryt_varianty_navigatsii_6e9ab15c') : i18nT('quests:components.quests.questWizardSections.pokazat_varianty_navigatsii_60e8c5e0')}
            >
              <Text style={styles.navToggleText}>{desktopNavExpanded ? '▲' : '▼'}</Text>
            </Pressable>
            <Pressable
              style={styles.coordsButton}
              onPress={copyCurrentStepCoords}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={i18nT('quests:components.quests.questWizardSections.kopirovat_koordinaty_value1_value2_60440820', { value1: currentStep.lat.toFixed(4), value2: currentStep.lng.toFixed(4) })}
            >
              <Text style={styles.coordsButtonText}>{currentStep.lat.toFixed(4)}, {currentStep.lng.toFixed(4)}</Text>
            </Pressable>
            {Boolean(currentStep.image) && (
              <Pressable
                style={styles.photoToggle}
                onPress={toggleMap}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={showMap ? i18nT('quests:components.quests.questWizardSections.skryt_foto_50539a5e') : i18nT('quests:components.quests.questWizardSections.pokazat_foto_e60f3e8b')}
              >
                <Text style={styles.photoToggleText}>{showMap ? i18nT('quests:components.quests.questWizardSections.skryt_foto_50539a5e') : i18nT('quests:components.quests.questWizardSections.foto_e73dc2af')}</Text>
              </Pressable>
            )}
          </View>
          {desktopNavExpanded && (
            <View style={styles.navDropdown}>
              <Pressable style={styles.navOption} onPress={() => { openCurrentStepInMap('google'); setDesktopNavExpanded(false) }}><Text style={styles.navOptionText}>{i18nT('quests:components.quests.questWizardSections.google_maps_0f9e8da2')}</Text></Pressable>
              {Platform.OS === 'ios' && (<Pressable style={styles.navOption} onPress={() => { openCurrentStepInMap('apple'); setDesktopNavExpanded(false) }}><Text style={styles.navOptionText}>{i18nT('quests:components.quests.questWizardSections.apple_maps_2428622f')}</Text></Pressable>)}
              <Pressable style={styles.navOption} onPress={() => { openCurrentStepInMap('organic'); setDesktopNavExpanded(false) }}><Text style={styles.navOptionText}>{i18nT('quests:components.quests.questWizardSections.organic_maps_6ac256f3')}</Text></Pressable>
              <Pressable style={styles.navOption} onPress={() => { openCurrentStepInMap('waze'); setDesktopNavExpanded(false) }}><Text style={styles.navOptionText}>{i18nT('quests:components.quests.questWizardSections.waze_31869b49')}</Text></Pressable>
              <Pressable style={styles.navOption} onPress={() => { openCurrentStepInMap('yandex'); setDesktopNavExpanded(false) }}><Text style={styles.navOptionText}>{i18nT('quests:components.quests.questWizardSections.yandeks_navigator_2bb0ac00')}</Text></Pressable>
              <Pressable style={styles.navOption} onPress={() => { openCurrentStepInMap('mapsme'); setDesktopNavExpanded(false) }}><Text style={styles.navOptionText}>{i18nT('quests:components.quests.questWizardSections.maps_me_e9291555')}</Text></Pressable>
              <Pressable style={styles.navOption} onPress={() => { openCurrentStepInMap('osm'); setDesktopNavExpanded(false) }}><Text style={styles.navOptionText}>{i18nT('quests:components.quests.questWizardSections.openstreetmap_b6740d2b')}</Text></Pressable>
            </View>
          )}
        </View>
      )}

      <Suspense fallback={<QuestMapSkeleton />}>
        <QuestFullMapLazy
          steps={steps}
          closeLoop={closeLoopRoute}
          height={useWideInlineLayout ? (compactDesktopLayout ? 460 : 520) : 360}
          title={i18nT('quests:components.quests.questWizardSections.karta_kvesta_159fe057')}
          activeStepIndex={activeStepIndex}
          // На native превью-карта внутри вертикального ScrollView не должна
          // перехватывать свайп страницы (F-7): панорамирование — только в
          // fullscreen. На web скролл-конфликта нет, карта остаётся интерактивной.
          interactive={Platform.OS === 'web'}
        />
      </Suspense>
    </View>
  )
}

export function QuestExcursionsInline({
  styles,
  city,
  title,
}: SharedProps & {
  city: CityLike
  title: string
}) {
  return (
    <View style={styles.excursionsSection}>
      <View style={styles.excursionsDivider} />
      <View style={styles.excursionsCard}>
        <View style={styles.excursionsHeader}>
          <Text style={styles.excursionsTitle}>{i18nT('quests:components.quests.questWizardSections.ekskursii_ryadom_46600fc1')}</Text>
          <Text style={styles.excursionsSubtitle}>{i18nT('quests:components.quests.questWizardSections.otkroyte_bolshe_s_mestnymi_gidami_048b2051')}</Text>
        </View>
        <Suspense fallback={null}>
          <BelkrajWidgetLazy
            points={[{ id: 1, address: city.name ?? title, lat: city.lat, lng: city.lng }]}
            countryCode={city.countryCode}
            className="belkraj-slot"
          />
        </Suspense>
      </View>
    </View>
  )
}

export function QuestExcursionsSidebar({
  styles,
  city,
  title,
}: SharedProps & {
  city: CityLike
  title: string
}) {
  return (
    <View style={styles.excursionsSidebar}>
      <View style={styles.excursionsSidebarInner}>
        <Text style={styles.excursionsTitle}>{i18nT('quests:components.quests.questWizardSections.ekskursii_ryadom_46600fc1')}</Text>
        <Text style={styles.excursionsSubtitle}>{i18nT('quests:components.quests.questWizardSections.otkroyte_bolshe_s_mestnymi_gidami_048b2051')}</Text>
        <View style={styles.excursionsSidebarWidget}>
          <Suspense fallback={null}>
            <BelkrajWidgetLazy
              points={[{ id: 1, address: city.name ?? title, lat: city.lat, lng: city.lng }]}
              countryCode={city.countryCode}
              className="belkraj-slot"
            />
          </Suspense>
        </View>
      </View>
    </View>
  )
}

export function QuestCompactExcursions({
  styles,
  city,
  title,
}: SharedProps & {
  city: CityLike
  title: string
}) {
  return (
    <View style={styles.compactExcursionsSection}>
      <View style={styles.compactExcursionsHeader}>
        <Text style={styles.excursionsTitle}>{i18nT('quests:components.quests.questWizardSections.ekskursii_ryadom_46600fc1')}</Text>
        <Text style={styles.excursionsSubtitle}>{i18nT('quests:components.quests.questWizardSections.otkroyte_bolshe_s_mestnymi_gidami_048b2051')}</Text>
      </View>
      <Suspense fallback={null}>
        <BelkrajWidgetLazy
          points={[{ id: 1, address: city.name ?? title, lat: city.lat, lng: city.lng }]}
          countryCode={city.countryCode}
          className="belkraj-slot"
        />
      </Suspense>
    </View>
  )
}

export function QuestNativeAffiliateSection({
  styles,
  city,
  questId,
}: SharedProps & {
  city: CityLike
  questId?: string
}) {
  const context = {
    city: city.name,
    countryCode: city.countryCode,
    travelId: questId ? `quest-${questId}` : undefined,
  }

  if (getAffiliateOffers(context).length === 0) return null

  return (
    <View style={styles.excursionsSection} testID="quest-affiliate-section">
      <View style={styles.excursionsDivider} />
      <View style={styles.excursionsCard}>
        <View style={styles.excursionsHeader}>
          <Text style={styles.excursionsTitle}>{i18nT('quests:components.quests.questWizardSections.ekskursii_ryadom_46600fc1')}</Text>
          <Text style={styles.excursionsSubtitle}>{i18nT('quests:components.quests.questWizardSections.otkroyte_bolshe_s_mestnymi_gidami_048b2051')}</Text>
        </View>
        <AffiliateOffers {...context} />
      </View>
    </View>
  )
}

function QuestFinaleCompletionLine({
  styles,
  questId,
  questNumericId,
}: {
  styles: any
  questId: string
  questNumericId?: number
}) {
  const { completionsCount } = useQuestCompletionMeta(questId, questNumericId)
  if (completionsCount <= 0) return null
  return (
    <Text style={[styles.completionText, { opacity: 0.85 }]}>
      {i18nT('quests:components.quests.questWizardSections.completionCountWithYou', { count: completionsCount })}</Text>
  )
}

function QuestFinaleFeedback({
  questId,
  questNumericId,
}: {
  questId?: string
  questNumericId?: number
}) {
  const { userRating, isSubmitting: isRatingSubmitting, rate } =
    useQuestRatingMutation(questNumericId)

  if (!questId) return null

  return (
    <QuestReviewSection
      questId={questId}
      questNumericId={questNumericId}
      userRating={userRating}
      onRate={rate}
      isRatingSubmitting={isRatingSubmitting}
    />
  )
}

export function QuestFinalePanel({
  colors: _colors,
  styles,
  finale,
  allCompleted,
  completedCount,
  stepsCount,
  frameW,
  youtubeEmbedUri,
  videoOk,
  videoUri,
  posterUri,
  handleVideoError,
  handleVideoRetry,
  setVideoOk,
  onContinue,
  questId,
  questNumericId,
}: SharedProps & {
  finale: FinaleLike
  allCompleted: boolean
  completedCount: number
  stepsCount: number
  frameW: number
  youtubeEmbedUri?: string
  videoOk: boolean
  videoUri?: string
  posterUri?: string
  handleVideoError: () => void
  handleVideoRetry: () => void
  setVideoOk: React.Dispatch<React.SetStateAction<boolean>>
  onContinue?: () => void
  questId?: string
  questNumericId?: number
}) {
  return (
    <View style={styles.completionScreen}>
      {allCompleted ? (
        <View style={styles.finaleContent}>
          <Text style={styles.completionTitle}>{i18nT('quests:components.quests.questWizardSections.kvest_zavershen_6d9d9233')}</Text>

          {questId ? (
            <>
              <QuestPioneerBlock questId={questId} questNumericId={questNumericId} />
              <BadgeUnlockToast />
            </>
          ) : null}

          {finale.video && (
            <View
              style={[
                styles.videoFrame,
                {
                  width: '100%',
                  maxWidth: frameW,
                  aspectRatio: 16 / 9,
                },
              ]}
            >
              {Platform.OS === 'web' ? (
                youtubeEmbedUri ? (
                  <iframe
                    src={youtubeEmbedUri}
                    width="100%"
                    height="100%"
                    style={{ border: 'none', display: 'block' }}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    title={i18nT('quests:components.quests.questWizardSections.video_kvesta_5a8205e2')}
                  />
                ) : videoOk ? (
                  <QuestWebVideo src={videoUri} poster={posterUri} onError={handleVideoError} />
                ) : (
                  <>
                    {posterUri ? (
                      <ImageCardMedia
                        src={posterUri}
                        fit="contain"
                        blurBackground
                        allowCriticalWebBlur
                        blurRadius={18}
                        style={StyleSheet.absoluteFillObject as any}
                        alt={i18nT('quests:components.quests.questWizardSections.poster_video_kvesta_c8f64bd3')}
                      />
                    ) : null}
                    <View style={styles.videoFallbackOverlay}>
                      <Text style={styles.videoFallbackText}>{i18nT('quests:components.quests.questWizardSections.ne_udalos_vosproizvesti_video_poprobuyte_esc_eaa4ac08')}</Text>
                      <Pressable onPress={handleVideoRetry} style={styles.videoRetryBtn} hitSlop={8}>
                        <Text style={styles.videoRetryText}>{i18nT('quests:components.quests.questWizardSections.povtorit_6c2cf666')}</Text>
                      </Pressable>
                    </View>
                  </>
                )
              ) : (
                <Suspense fallback={null}>
                  <NativeQuestVideoLazy
                    source={typeof finale.video === 'string' ? { uri: finale.video } : finale.video}
                    posterSource={typeof finale.poster === 'string' ? { uri: finale.poster } : finale.poster}
                    usePoster={!!finale.poster}
                    style={StyleSheet.absoluteFill}
                    useNativeControls
                    shouldPlay={false}
                    isLooping={false}
                    onError={() => setVideoOk(false)}
                  />
                </Suspense>
              )}
            </View>
          )}

          <Text style={styles.completionText}>{finale.text}</Text>

          {questId ? (
            <QuestFinaleCompletionLine
              styles={styles}
              questId={questId}
              questNumericId={questNumericId}
            />
          ) : null}

          <QuestFinaleFeedback questId={questId} questNumericId={questNumericId} />
        </View>
      ) : (
        <>
          <Text style={[styles.completionText, { opacity: 0.8 }]}>
            {i18nT('quests:components.quests.questWizardSections.chtoby_otkryt_priz_i_video_zavershite_vse_sh_fd0438f8')}{completedCount} {i18nT('quests:components.quests.questWizardSections.iz_277be07e')}{stepsCount}.
          </Text>
          {onContinue && (
            <Pressable
              style={styles.primaryButton}
              onPress={onContinue}
              accessibilityRole="button"
              accessibilityLabel={i18nT('quests:components.quests.questWizardSections.prodolzhit_kvest_4cc1b452')}
            >
              <Text style={styles.buttonText}>{i18nT('quests:components.quests.questWizardSections.prodolzhit_kvest_4cc1b452')}</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  )
}

function QuestMapSkeleton() {
  const colors = useThemedColors()
  return (
    <View style={{ height: 300, borderRadius: 16, backgroundColor: colors.backgroundSecondary, overflow: 'hidden' }}>
      <View style={{ flex: 1, opacity: 0.6, backgroundColor: colors.borderLight }} />
    </View>
  )
}
