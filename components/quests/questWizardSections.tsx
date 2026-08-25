import React, { Suspense } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import ShareQuestResultSheet, {
  type QuestResultShareSubject,
} from '@/components/quests/ShareQuestResultSheet'
import AffiliateOffers from '@/components/affiliate/AffiliateOffers'
import { getAffiliateOffers } from '@/components/affiliate/affiliateConfig'
import { canRenderBelkrajWidget } from '@/components/belkraj/belkrajAvailability'
import { BadgeUnlockToast } from '@/components/achievements'
import { useThemedColors } from '@/hooks/useTheme'
import { useQuestCompletionMeta } from '@/hooks/useQuestCompletionMeta'
import QuestNextStepSection from './QuestNextStepSection'
import QuestPioneerBlock from './QuestPioneerBlock'
import QuestReviewSection from './QuestReviewSection'
import type { QuestMapApp } from './questWizardHelpers'
import type { QuestRouteMode } from './questRouteGeometry'

import {
  BelkrajWidgetLazy,
  NativeQuestVideoLazy,
  QuestFullMapLazy,
  QuestWebVideo,
} from './questWizardMedia'
import { translate as i18nT, translatePlural } from '@/i18n'


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
  routeMode,
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
  routeMode?: QuestRouteMode
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

      {routeMode ? (
        <Suspense fallback={<QuestMapSkeleton />}>
          <QuestFullMapLazy
            steps={steps}
            closeLoop={closeLoopRoute}
            routeMode={routeMode}
            height={useWideInlineLayout ? (compactDesktopLayout ? 460 : 520) : 360}
            title={i18nT('quests:components.quests.questWizardSections.karta_kvesta_159fe057')}
            activeStepIndex={activeStepIndex}
            // На native превью-карта внутри вертикального ScrollView не должна
            // перехватывать свайп страницы (F-7): панорамирование — только в
            // fullscreen. На web скролл-конфликта нет, карта остаётся интерактивной.
            interactive={Platform.OS === 'web'}
          />
        </Suspense>
      ) : (
        <QuestMapSkeleton />
      )}
    </View>
  )
}

// Источники блока «Экскурсии рядом» для всех трёх его раскладок: карточки шага,
// правой колонки desktop и компактного сайдбара. Гейт и набор источников
// считаются здесь один раз, чтобы раскладки не разъезжались между собой.
//
// Belkraj открыт для стран из SUPPORTED_BELKRAJ_COUNTRIES (см. belkrajAvailability),
// а не только для BY: квест Кракова (PL) отдаёт краковские экскурсии. Для страны
// ВНЕ каталога (напр. Лимасол/CY) виджет молча подменил бы город на минский,
// поэтому там гейт закрыт, а его место на web занимают affiliate-офферы — блок
// остаётся полезным, а не пустеет. На native порядок прежний: виджет и офферы
// сосуществуют в одной карточке.
function useQuestExcursionSlots(city: CityLike, title: string, questId?: string) {
  const points = React.useMemo(
    () => [{ id: 1, address: city.name ?? title, lat: city.lat, lng: city.lng }],
    [city.name, city.lat, city.lng, title],
  )

  const showWidget = canRenderBelkrajWidget(points, city.countryCode)

  const affiliateContext = React.useMemo(
    () => (Platform.OS === 'web' && showWidget
      ? null
      : {
        city: city.name,
        countryCode: city.countryCode,
        travelId: questId ? `quest-${questId}` : undefined,
      }),
    [city.name, city.countryCode, questId, showWidget],
  )

  const showAffiliate = !!affiliateContext && getAffiliateOffers(affiliateContext).length > 0

  return { points, showWidget, showAffiliate, affiliateContext }
}

// Единственная секция «Экскурсии рядом» на карточке шага. Раньше партнёрские
// офферы жили в отдельной секции (QuestNativeAffiliateSection) с тем же
// заголовком и той же обвязкой, поэтому на native игрок видел «Экскурсии рядом»
// дважды подряд (#1452). Теперь оба источника — Belkraj-виджет и affiliate —
// лежат в одной карточке под одним заголовком, а сама карточка не рисуется,
// когда показывать нечего.
export function QuestExcursionsInline({
  styles,
  city,
  title,
  questId,
}: SharedProps & {
  city: CityLike
  title: string
  questId?: string
}) {
  const { points, showWidget, showAffiliate, affiliateContext } = useQuestExcursionSlots(
    city,
    title,
    questId,
  )

  if (!showWidget && !showAffiliate) return null

  return (
    <View style={styles.excursionsSection} testID="quest-excursions-section">
      <View style={styles.excursionsDivider} />
      <View style={styles.excursionsCard}>
        <View style={styles.excursionsHeader}>
          <Text style={styles.excursionsTitle}>{i18nT('quests:components.quests.questWizardSections.ekskursii_ryadom_46600fc1')}</Text>
          <Text style={styles.excursionsSubtitle}>{i18nT('quests:components.quests.questWizardSections.otkroyte_bolshe_s_mestnymi_gidami_048b2051')}</Text>
        </View>
        {showWidget && (
          <Suspense fallback={null}>
            <BelkrajWidgetLazy
              points={points}
              countryCode={city.countryCode}
              className="belkraj-slot"
            />
          </Suspense>
        )}
        {showAffiliate && affiliateContext && <AffiliateOffers {...affiliateContext} />}
      </View>
    </View>
  )
}

export function QuestExcursionsSidebar({
  styles,
  city,
  title,
  questId,
}: SharedProps & {
  city: CityLike
  title: string
  questId?: string
}) {
  const { points, showWidget, showAffiliate, affiliateContext } = useQuestExcursionSlots(
    city,
    title,
    questId,
  )

  if (!showWidget && !showAffiliate) return null

  return (
    <View style={styles.excursionsSidebar} testID="quest-excursions-sidebar">
      <View style={styles.excursionsSidebarInner}>
        <Text style={styles.excursionsTitle}>{i18nT('quests:components.quests.questWizardSections.ekskursii_ryadom_46600fc1')}</Text>
        <Text style={styles.excursionsSubtitle}>{i18nT('quests:components.quests.questWizardSections.otkroyte_bolshe_s_mestnymi_gidami_048b2051')}</Text>
        <View style={styles.excursionsSidebarWidget}>
          {showWidget && (
            <Suspense fallback={null}>
              <BelkrajWidgetLazy
                points={points}
                countryCode={city.countryCode}
                className="belkraj-slot"
              />
            </Suspense>
          )}
          {showAffiliate && affiliateContext && <AffiliateOffers {...affiliateContext} />}
        </View>
      </View>
    </View>
  )
}

export function QuestCompactExcursions({
  styles,
  city,
  title,
  questId,
}: SharedProps & {
  city: CityLike
  title: string
  questId?: string
}) {
  const { points, showWidget, showAffiliate, affiliateContext } = useQuestExcursionSlots(
    city,
    title,
    questId,
  )

  if (!showWidget && !showAffiliate) return null

  return (
    <View style={styles.compactExcursionsSection} testID="quest-compact-excursions">
      <View style={styles.compactExcursionsHeader}>
        <Text style={styles.excursionsTitle}>{i18nT('quests:components.quests.questWizardSections.ekskursii_ryadom_46600fc1')}</Text>
        <Text style={styles.excursionsSubtitle}>{i18nT('quests:components.quests.questWizardSections.otkroyte_bolshe_s_mestnymi_gidami_048b2051')}</Text>
      </View>
      {showWidget && (
        <Suspense fallback={null}>
          <BelkrajWidgetLazy
            points={points}
            countryCode={city.countryCode}
            className="belkraj-slot"
          />
        </Suspense>
      )}
      {showAffiliate && affiliateContext && <AffiliateOffers {...affiliateContext} />}
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
  cityId,
}: {
  questId?: string
  questNumericId?: number
  cityId?: string
}) {
  if (!questId) return null

  return (
    <QuestReviewSection
      questId={questId}
      questNumericId={questNumericId}
      cityId={cityId}
    />
  )
}

/** Возврат к точкам: одна кнопка и для недособранного финала, и для частичного прохождения. */
function QuestFinaleContinueButton({
  styles,
  onContinue,
  testID,
}: {
  styles: any
  onContinue?: () => void
  testID?: string
}) {
  if (!onContinue) return null
  const label = i18nT('quests:components.quests.questWizardSections.prodolzhit_kvest_4cc1b452')
  return (
    <Pressable
      style={styles.primaryButton}
      onPress={onContinue}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  )
}

/** Кнопка «Поделиться результатом» + лист шаринга. Показывается только за
 *  засчитанное прохождение — это и есть эмоциональный пик, ради которого
 *  замыкается вирусная петля ([INV2-02], #1472). */
function QuestFinaleShareAction({
  styles,
  questId,
  questNumericId,
  questTitle,
  cityId,
  completedCount,
  stepsCount,
  completionFinishedAt,
}: {
  styles: any
  questId: string
  questNumericId?: number
  questTitle: string
  cityId?: string
  completedCount: number
  stepsCount: number
  completionFinishedAt: number | null
}) {
  const colors = useThemedColors()
  const [shareVisible, setShareVisible] = React.useState(false)

  const subject = React.useMemo<QuestResultShareSubject>(
    () => ({
      questId: questNumericId ?? 0,
      questSlug: questId,
      questTitle,
      cityId,
      pointsDone: completedCount,
      pointsTotal: stepsCount,
      finishedAt: completionFinishedAt,
    }),
    [questNumericId, questId, questTitle, cityId, completedCount, stepsCount, completionFinishedAt],
  )

  const label = i18nT('questShareStatic:finaleShare.button')
  return (
    <>
      <Pressable
        style={styles.primaryButton}
        onPress={() => setShareVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID="quest-finale-share"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Feather name="share-2" size={18} color={colors.textOnPrimary} />
          <Text style={styles.buttonText}>{label}</Text>
        </View>
      </Pressable>
      <ShareQuestResultSheet
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        subject={subject}
      />
    </>
  )
}

export function QuestFinalePanel({
  colors: _colors,
  styles,
  finale,
  questFinished,
  questCompleted,
  stepsMissingForCompletion,
  finishedEarly,
  completionFinishedAt,
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
  questTitle,
  cityId,
  cityName,
  cityLat,
  cityLng,
}: SharedProps & {
  finale: FinaleLike
  /** Игрок закончил маршрут: финал показываем целиком, а не приглашение вернуться к точкам. */
  questFinished: boolean
  /** Прохождение засчитано (#1443): значок, «первопроходец» и счётчик — только здесь. */
  questCompleted: boolean
  /** Сколько точек не хватает до засчитанного прохождения. */
  stepsMissingForCompletion: number
  /** Прохождение неполное по воле игрока: пропущенная далёкая точка или финиш на месте. */
  finishedEarly: boolean
  /** Ненулевой только когда прохождение завершилось в текущей сессии. */
  completionFinishedAt: number | null
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
  /** Название квеста — для возвратного напоминания через неделю. */
  questTitle: string
  cityId?: string
  cityName?: string
  cityLat?: number
  cityLng?: number
}) {
  return (
    <View style={styles.completionScreen}>
      {questFinished ? (
        <View style={styles.finaleContent}>
          <Text style={styles.completionTitle}>
            {questCompleted
              ? i18nT('quests:components.quests.questWizardSections.kvest_zavershen_6d9d9233')
              : i18nT('quests:components.quests.questWizardSections.partialTitle')}
          </Text>

          {/* Квест закончен на месте: далёкие точки остались непройденными —
              счётчик показываем честно, а не подменяем «всё пройдено». Строка
              привязана к решению игрока, а не к «отвечено меньше, чем шагов»:
              шаг могли добавить в квест уже после прохождения (#1431). */}
          {questCompleted && finishedEarly && completedCount < stepsCount && (
            <Text style={[styles.completionText, { opacity: 0.8 }]} testID="quest-finale-partial">
              {i18nT('quests:components.quests.questWizardSections.finishedEarly', { value1: completedCount, value2: stepsCount })}
            </Text>
          )}

          {/* Пропущено больше, чем политика считает прохождением (#1443): финал и
              прогресс остаются, но игрок должен видеть, что квест НЕ засчитан и
              сколько точек до этого не хватает. */}
          {!questCompleted && (
            <Text style={[styles.completionText, { opacity: 0.8 }]} testID="quest-finale-not-credited">
              {/* Форму числа выбираем через `translatePlural`, а не отдаём i18next:
                  у Hermes на Android нет `Intl.PluralRules`, и плюрал схлопывается
                  в `_other` — «ещё 2 точек» вместо «ещё 2 точки» (#1335). */}
              {translatePlural('quests:components.quests.questWizardSections.partialNotCredited', stepsMissingForCompletion, {
                value1: completedCount,
                value2: stepsCount,
              })}
            </Text>
          )}

          {/* Значок, «первопроходец» и счётчик прохождений — только за засчитанное
              прохождение: на бэкенд в этом случае уходит `completed: true`. */}
          {questCompleted && questId ? (
            <>
              <QuestPioneerBlock questId={questId} questNumericId={questNumericId} />
              <BadgeUnlockToast />
              <QuestFinaleShareAction
                styles={styles}
                questId={questId}
                questNumericId={questNumericId}
                questTitle={questTitle}
                cityId={cityId}
                completedCount={completedCount}
                stepsCount={stepsCount}
                completionFinishedAt={completionFinishedAt}
              />
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

          {/* «Прошли N человек, включая вас» — тоже про засчитанное прохождение:
              при частичном игрока в этот счётчик бэкенд не берёт. */}
          {questCompleted && questId ? (
            <QuestFinaleCompletionLine
              styles={styles}
              questId={questId}
              questNumericId={questNumericId}
            />
          ) : null}

          {questCompleted ? (
            <QuestFinaleFeedback questId={questId} questNumericId={questNumericId} cityId={cityId} />
          ) : null}

          {/* Второе действие (#1484): коллекция города и следующий квест рядом.
              Только за засчитанное прохождение — при недоборе точек следующий
              шаг игрока не «новый квест», а возврат к пропущенным точкам. */}
          {questCompleted && (
            <QuestNextStepSection
              questId={questId}
              questTitle={questTitle}
              cityId={cityId}
              cityName={cityName}
              cityLat={cityLat}
              cityLng={cityLng}
              completionFinishedAt={completionFinishedAt}
            />
          )}

          {/* Путь назад к пропущенным точкам: порог перестанет быть недобранным,
              как только на них появятся ответы. */}
          {!questCompleted && (
            <QuestFinaleContinueButton
              styles={styles}
              onContinue={onContinue}
              testID="quest-finale-continue-partial"
            />
          )}
        </View>
      ) : (
        <>
          <Text style={[styles.completionText, { opacity: 0.8 }]}>
            {i18nT('quests:components.quests.questWizardSections.chtoby_otkryt_priz_i_video_zavershite_vse_sh_fd0438f8')}{completedCount} {i18nT('quests:components.quests.questWizardSections.iz_277be07e')}{stepsCount}.
          </Text>
          <QuestFinaleContinueButton styles={styles} onContinue={onContinue} />
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
