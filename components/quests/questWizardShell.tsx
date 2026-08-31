import React, { useEffect, useRef, useState } from 'react'
import { Platform, Pressable, ScrollView, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import {
  QuestFinaleDot,
  QuestFinalePill,
  QuestStepDot,
  QuestStepPill,
} from './questWizardNavigation'
import { QuestCompactExcursions } from './questWizardSections'
import {
  QUEST_FONT_SCALE_STEPS,
  useQuestFontScaleStore,
} from '@/stores/questFontScaleStore'
import { translate as i18nT } from '@/i18n'
import type { QuestCountModel, QuestPointRole } from '@/utils/questCountModel'
import { getQuestPointRoleLabel } from './questMapPoints'


type QuestNavigationStep = {
  id: string
  title: string
  pointRole?: QuestPointRole
}

const getNavigationStepLabel = (step: QuestNavigationStep): string => {
  if (step.id === 'intro' || step.pointRole === 'start') {
    return i18nT('quests:components.quests.questWizardShell.start_225f7a82')
  }
  if (step.pointRole === 'optional') {
    return `${step.title} · ${getQuestPointRoleLabel(step.pointRole)}`
  }
  if (step.pointRole === 'final') {
    return `${step.title} · ${getQuestPointRoleLabel(step.pointRole)}`
  }
  return step.title
}

type QuestCityLike = {
  name?: string
  lat: number
  lng: number
  countryCode?: string
}

type NavigationSharedProps = {
  colors: any
  styles: any
  allSteps: QuestNavigationStep[]
  answers: Record<string, string>
  /** Точки, отложенные ссылкой «Пропустить»: долг маршрута, а не «ещё впереди» (#1633). */
  postponedStepIds: ReadonlySet<string>
  currentIndex: number
  unlockedIndex: number
  questFinished: boolean
  showFinaleOnly: boolean
  goToStep: (index: number) => void
  onShowFinale: () => void
}

export type OfflineQuestDownloadState = 'idle' | 'downloading' | 'done'

type QuestCompactSidebarProps = NavigationSharedProps & {
  title: string
  progress: number
  completedCount: number
  stepsCount: number
  countModel: QuestCountModel
  city?: QuestCityLike
  onReset: () => void
  onPrintDownload: () => void
  onOfflineMapDownload: () => void
  onOfflineMapOpenInApp: () => void
  offlineMapPointsCount: number
  onOfflineQuestDownload: () => void
  offlineQuestState: OfflineQuestDownloadState
  ratingSlot?: React.ReactNode
  completionSlot?: React.ReactNode
  /** Нужен блоку экскурсий для SubID партнёрских ссылок (`quest-<id>`). */
  questId?: string
  showExcursions?: boolean
}

type QuestHeaderPanelProps = NavigationSharedProps & {
  title: string
  progress: number
  completedCount: number
  stepsCount: number
  countModel: QuestCountModel
  isMobile: boolean
  screenW: number
  compactNav: boolean
  onReset: () => void
  onPrintDownload: () => void
  onOfflineMapDownload: () => void
  onOfflineMapOpenInApp: () => void
  offlineMapPointsCount: number
  onOfflineQuestDownload: () => void
  offlineQuestState: OfflineQuestDownloadState
  ratingSlot?: React.ReactNode
  completionSlot?: React.ReactNode
}

type QuestActionButtonProps = {
  styles: any
  label: string
  accessibilityLabel: string
  iconName: React.ComponentProps<typeof Feather>['name']
  iconColor: string
  onPress: () => void
  disabled?: boolean
  hitSlop?: number
  baseStyle: any
  showLabel: boolean
  textStyle?: any
  iconSize?: number
  isMobile?: boolean
}

function QuestActionButton({
  styles,
  label,
  accessibilityLabel,
  iconName,
  iconColor,
  onPress,
  disabled,
  hitSlop,
  baseStyle,
  showLabel,
  textStyle,
  iconSize = 15,
  isMobile,
}: QuestActionButtonProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const showTooltip = Platform.OS === 'web' && !isMobile && !showLabel && tooltipVisible

  return (
    <Pressable
      onPress={onPress}
      style={[baseStyle, !showLabel && styles.actionIconButton]}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onHoverIn={() => setTooltipVisible(true)}
      onHoverOut={() => setTooltipVisible(false)}
      onFocus={() => setTooltipVisible(true)}
      onBlur={() => setTooltipVisible(false)}
    >
      <Feather name={iconName} size={iconSize} color={iconColor} />
      {showLabel && <Text style={textStyle}>{label}</Text>}
      {showTooltip && (
        <Text pointerEvents="none" style={styles.actionTooltip}>
          {label}
        </Text>
      )}
    </Pressable>
  )
}

function QuestOfflineDownloadButton({
  styles,
  colors,
  state,
  onPress,
  showLabel,
  isMobile,
}: {
  styles: any
  colors: any
  state: OfflineQuestDownloadState
  onPress: () => void
  showLabel: boolean
  isMobile?: boolean
}) {
  const iconName: React.ComponentProps<typeof Feather>['name'] =
    state === 'done' ? 'check-circle' : 'download-cloud'
  const label =
    state === 'downloading'
      ? i18nT('quests:components.quests.questWizardShell.sohranyaem_5a4299e9')
      : state === 'done'
        ? i18nT('quests:components.quests.questWizardShell.sohraneno_oflayn_6e50f89e')
        : i18nT('quests:components.quests.questWizardShell.skachat_oflayn_b6488863')
  const accessibilityLabel =
    state === 'downloading'
      ? i18nT('quests:components.quests.questWizardShell.idet_sohranenie_kvesta_dlya_oflayna_a2c2314e')
      : state === 'done'
        ? i18nT('quests:components.quests.questWizardShell.kvest_sohranen_dlya_oflayna_5c4ef716')
        : i18nT('quests:components.quests.questWizardShell.skachat_kvest_dlya_oflayna_1b7e958c')
  const iconColor = state === 'done' ? colors.success : colors.textMuted

  return (
    <QuestActionButton
      styles={styles}
      label={label}
      accessibilityLabel={accessibilityLabel}
      iconName={iconName}
      iconColor={iconColor}
      onPress={onPress}
      disabled={state === 'downloading'}
      baseStyle={styles.actionLabelButton}
      showLabel={showLabel}
      isMobile={isMobile}
      textStyle={styles.actionLabelText}
    />
  )
}

function ActiveScrollNav({
  currentIndex,
  showFinaleOnly,
  screenW,
  style,
  contentContainerStyle,
  children,
}: {
  currentIndex: number
  showFinaleOnly: boolean
  screenW: number
  style?: any
  contentContainerStyle?: any
  children: React.ReactNode
}) {
  const scrollRef = useRef<ScrollView>(null)
  const activeIdx = showFinaleOnly ? -1 : currentIndex

  useEffect(() => {
    if (!scrollRef.current) return
    const pillW = screenW < 600 ? 35 : 130
    const offset = Math.max(0, activeIdx * pillW - screenW / 2 + pillW / 2)
    scrollRef.current.scrollTo({ x: offset, animated: true })
  }, [activeIdx, screenW])

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      contentContainerStyle={contentContainerStyle}
    >
      {children}
    </ScrollView>
  )
}

function QuestProgressSummary({
  styles,
  progress,
  completedCount,
  stepsCount,
  countModel,
  isMobile = false,
  showBreakdown = true,
}: {
  styles: any
  progress: number
  completedCount: number
  stepsCount: number
  countModel: QuestCountModel
  /** На телефоне счётчик встаёт в строку с полосой, чтобы не отнимать высоту. */
  isMobile?: boolean
  /** Разбор «сколько обязательных/необязательных» — вторая строка текста, на телефоне лишняя. */
  showBreakdown?: boolean
}) {
  return (
    <View style={[styles.progressContainer, isMobile && styles.progressRowMobile]}>
      <View style={[styles.progressBar, isMobile && styles.progressBarMobile]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={[styles.progressText, isMobile && styles.progressTextMobile]}>
        {i18nT('quests:components.quests.questWizardShell.progressTasks', {
          completed: completedCount,
          total: stepsCount,
        })}
      </Text>
      {showBreakdown && countModel.source === 'explicit' && (
        <Text style={styles.progressText}>
          {i18nT('quests:components.quests.questWizardShell.countBreakdown', {
            total: countModel.total,
            required: countModel.required,
            optional: countModel.optional,
            start: countModel.start,
            final: countModel.final,
          })}
        </Text>
      )}
    </View>
  )
}

export function QuestCompactSidebar(props: QuestCompactSidebarProps) {
  const {
    colors,
    styles,
    title,
    progress,
    completedCount,
    stepsCount,
    countModel,
    allSteps,
    answers,
    postponedStepIds,
    currentIndex,
    unlockedIndex,
    questFinished,
    showFinaleOnly,
    goToStep,
    onShowFinale,
    city,
    onReset,
    onPrintDownload,
    onOfflineMapDownload,
    onOfflineMapOpenInApp,
    offlineMapPointsCount,
    onOfflineQuestDownload,
    offlineQuestState,
    ratingSlot,
    completionSlot,
    showExcursions = true,
    questId,
  } = props
  const iconOnlyActions = Platform.OS === 'web'

  return (
    <View style={styles.compactSidebar}>
      <View style={styles.compactSidebarHeader}>
        <Text style={styles.compactSidebarTitle} numberOfLines={2}>{title}</Text>
        {ratingSlot ?? null}
        {completionSlot ?? null}
        <View style={styles.compactSidebarActions}>
          <QuestFontScaleControl
            styles={styles}
            colors={colors}
            showLabel={!iconOnlyActions}
          />
          <QuestActionButton
            styles={styles}
            label={i18nT('quests:components.quests.questWizardShell.pechat_76bdeffe')}
            accessibilityLabel={i18nT('quests:components.quests.questWizardShell.pechat_kvesta_f66c15e3')}
            iconName="printer"
            iconColor={colors.textMuted}
            onPress={onPrintDownload}
            baseStyle={styles.actionLabelButton}
            showLabel={!iconOnlyActions}
            textStyle={styles.actionLabelText}
          />
          <QuestActionButton
            styles={styles}
            label={i18nT('quests:components.quests.questWizardShell.skachat_gpx_a032dca6')}
            accessibilityLabel={i18nT('quests:components.quests.questWizardShell.skachat_gpx_s_value1_tochkami_kvesta_83ac2431', { value1: offlineMapPointsCount })}
            iconName="download"
            iconColor={offlineMapPointsCount === 0 ? colors.disabled : colors.textMuted}
            onPress={onOfflineMapDownload}
            disabled={offlineMapPointsCount === 0}
            baseStyle={styles.actionLabelButton}
            showLabel={!iconOnlyActions}
            textStyle={[styles.actionLabelText, offlineMapPointsCount === 0 && { color: colors.disabled }]}
          />
          <QuestActionButton
            styles={styles}
            label={i18nT('quests:components.quests.questWizardShell.otkryt_v_prilozhenii_818b6173')}
            accessibilityLabel={i18nT('quests:components.quests.questWizardShell.otkryt_tochki_kvesta_v_prilozhenii_kart_acb9e920')}
            iconName="external-link"
            iconColor={offlineMapPointsCount === 0 ? colors.disabled : colors.textMuted}
            onPress={onOfflineMapOpenInApp}
            disabled={offlineMapPointsCount === 0}
            baseStyle={styles.actionLabelButton}
            showLabel={!iconOnlyActions}
            textStyle={[styles.actionLabelText, offlineMapPointsCount === 0 && { color: colors.disabled }]}
          />
          <QuestOfflineDownloadButton
            styles={styles}
            colors={colors}
            state={offlineQuestState}
            onPress={onOfflineQuestDownload}
            showLabel={!iconOnlyActions}
          />
          <QuestActionButton
            styles={styles}
            label={i18nT('quests:components.quests.questWizardShell.sbrosit_dd613b60')}
            accessibilityLabel={i18nT('quests:components.quests.questWizardShell.sbrosit_progress_5f45dc36')}
            iconName="rotate-ccw"
            iconColor={colors.textMuted}
            onPress={onReset}
            baseStyle={styles.resetButton}
            showLabel={!iconOnlyActions}
            textStyle={styles.resetText}
            hitSlop={12}
            iconSize={13}
          />
        </View>
      </View>

      <QuestProgressSummary
        styles={styles}
        progress={progress}
        completedCount={completedCount}
        stepsCount={stepsCount}
        countModel={countModel}
      />

      <ScrollView
        style={styles.compactStepsList}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.compactStepsListContent}
      >
        {allSteps.map((step, index) => {
          const isActive = index === currentIndex && !showFinaleOnly
          const isDone = !!answers[step.id] && step.id !== 'intro'
          const isPostponed = !isDone && postponedStepIds.has(step.id)
          const isUnlocked = index <= unlockedIndex || !!answers[step.id] || questFinished

          return (
            <QuestStepPill
              key={step.id}
              colors={colors}
              styles={styles}
              compact
              active={isActive}
              done={isDone}
              pending={isPostponed}
              unlocked={isUnlocked}
              onPress={() => {
                if (isUnlocked) goToStep(index)
              }}
              indexLabel={String(index)}
              isIntro={step.id === 'intro'}
              label={getNavigationStepLabel(step)}
              numberOfLines={2}
            />
          )
        })}

        <QuestFinalePill
          colors={colors}
          styles={styles}
          compact
          active={showFinaleOnly}
          onPress={onShowFinale}
        />

        {showExcursions && city && Platform.OS === 'web' && (
          <QuestCompactExcursions
            colors={colors}
            styles={styles}
            city={city}
            title={title}
            questId={questId}
          />
        )}
      </ScrollView>
    </View>
  )
}

function QuestFontScaleControl({
  styles,
  colors,
  showLabel,
  isMobile,
}: {
  styles: any
  colors: any
  showLabel: boolean
  isMobile?: boolean
}) {
  const fontScale = useQuestFontScaleStore((s) => s.fontScale)
  const increase = useQuestFontScaleStore((s) => s.increase)
  const decrease = useQuestFontScaleStore((s) => s.decrease)

  const atMin = fontScale <= QUEST_FONT_SCALE_STEPS[0]
  const atMax = fontScale >= QUEST_FONT_SCALE_STEPS[QUEST_FONT_SCALE_STEPS.length - 1]

  return (
    <>
      <QuestActionButton
        styles={styles}
        label={i18nT('quests:components.quests.questWizardShell.menshe_shrift_c69667d7')}
        accessibilityLabel={i18nT('quests:components.quests.questWizardShell.umenshit_shrift_d50aaa89')}
        iconName="zoom-out"
        iconColor={atMin ? colors.disabled : colors.textMuted}
        onPress={decrease}
        disabled={atMin}
        baseStyle={styles.actionLabelButton}
        showLabel={showLabel}
        isMobile={isMobile}
        textStyle={[styles.actionLabelText, atMin && { color: colors.disabled }]}
      />
      <QuestActionButton
        styles={styles}
        label={i18nT('quests:components.quests.questWizardShell.bolshe_shrift_9ed58ce7')}
        accessibilityLabel={i18nT('quests:components.quests.questWizardShell.uvelichit_shrift_b327d021')}
        iconName="zoom-in"
        iconColor={atMax ? colors.disabled : colors.textMuted}
        onPress={increase}
        disabled={atMax}
        baseStyle={styles.actionLabelButton}
        showLabel={showLabel}
        isMobile={isMobile}
        textStyle={[styles.actionLabelText, atMax && { color: colors.disabled }]}
      />
    </>
  )
}

export function QuestHeaderPanel(props: QuestHeaderPanelProps) {
  const {
    colors,
    styles,
    title,
    progress,
    completedCount,
    stepsCount,
    countModel,
    allSteps,
    answers,
    postponedStepIds,
    currentIndex,
    unlockedIndex,
    questFinished,
    showFinaleOnly,
    goToStep,
    onShowFinale,
    isMobile,
    screenW,
    compactNav,
    onReset,
    onPrintDownload,
    onOfflineMapDownload,
    onOfflineMapOpenInApp,
    offlineMapPointsCount,
    onOfflineQuestDownload,
    offlineQuestState,
    ratingSlot,
    completionSlot,
  } = props

  const wideDesktop = screenW >= 1100
  const showActionLabels = Platform.OS !== 'web' && !isMobile
  const hasHeaderMeta = Boolean(ratingSlot || completionSlot)

  return (
    <View style={styles.header}>
      <View style={[styles.headerRow, isMobile && styles.headerRowMobile]}>
        {(!isMobile || hasHeaderMeta) && (
          <View
            style={[
              styles.headerIdentity,
              isMobile && styles.headerIdentityMobile,
            ]}
          >
            {!isMobile && (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            )}
            {ratingSlot ?? null}
            {completionSlot ?? null}
          </View>
        )}
        <View
          testID="quest-header-actions"
          style={[
            styles.headerActionRow,
            isMobile && styles.headerActionRowMobile,
          ]}
        >
          <QuestFontScaleControl
            styles={styles}
            colors={colors}
            showLabel={showActionLabels}
            isMobile={isMobile}
          />
          {Platform.OS === 'web' && (
            <QuestActionButton
              styles={styles}
              label={i18nT('quests:components.quests.questWizardShell.pechat_76bdeffe')}
              accessibilityLabel={i18nT('quests:components.quests.questWizardShell.pechat_kvesta_f66c15e3')}
              iconName="printer"
              iconColor={colors.textMuted}
              onPress={onPrintDownload}
              baseStyle={styles.actionLabelButton}
              showLabel={showActionLabels}
              isMobile={isMobile}
              textStyle={styles.actionLabelText}
            />
          )}
          <QuestActionButton
            styles={styles}
            label={i18nT('quests:components.quests.questWizardShell.skachat_gpx_a032dca6')}
            accessibilityLabel={i18nT('quests:components.quests.questWizardShell.skachat_gpx_s_value1_tochkami_kvesta_83ac2431', { value1: offlineMapPointsCount })}
            iconName="download"
            iconColor={offlineMapPointsCount === 0 ? colors.disabled : colors.textMuted}
            onPress={onOfflineMapDownload}
            disabled={offlineMapPointsCount === 0}
            baseStyle={styles.actionLabelButton}
            showLabel={showActionLabels}
            isMobile={isMobile}
            textStyle={[styles.actionLabelText, offlineMapPointsCount === 0 && { color: colors.disabled }]}
          />
          <QuestActionButton
            styles={styles}
            label={i18nT('quests:components.quests.questWizardShell.otkryt_v_prilozhenii_818b6173')}
            accessibilityLabel={i18nT('quests:components.quests.questWizardShell.otkryt_tochki_kvesta_v_prilozhenii_kart_acb9e920')}
            iconName="external-link"
            iconColor={offlineMapPointsCount === 0 ? colors.disabled : colors.textMuted}
            onPress={onOfflineMapOpenInApp}
            disabled={offlineMapPointsCount === 0}
            baseStyle={styles.actionLabelButton}
            showLabel={showActionLabels}
            isMobile={isMobile}
            textStyle={[styles.actionLabelText, offlineMapPointsCount === 0 && { color: colors.disabled }]}
          />
          <QuestOfflineDownloadButton
            styles={styles}
            colors={colors}
            state={offlineQuestState}
            onPress={onOfflineQuestDownload}
            showLabel={showActionLabels}
            isMobile={isMobile}
          />
          <QuestActionButton
            styles={styles}
            label={i18nT('quests:components.quests.questWizardShell.sbrosit_dd613b60')}
            accessibilityLabel={i18nT('quests:components.quests.questWizardShell.sbrosit_progress_5f45dc36')}
            iconName="rotate-ccw"
            iconColor={colors.textMuted}
            onPress={onReset}
            baseStyle={styles.resetButton}
            showLabel={showActionLabels}
            isMobile={isMobile}
            textStyle={styles.resetText}
            hitSlop={12}
            iconSize={13}
          />
        </View>
      </View>

      {!isMobile && offlineMapPointsCount > 0 && (
        <Text style={styles.exportHint}>
          {Platform.OS === 'web'
            ? i18nT('quests:components.quests.questWizardShell.skachaetsya_gpx_fayl_s_tochkami_otkroyte_ego_3208522f')
            : i18nT('quests:components.quests.questWizardShell.otkroetsya_sistemnoe_podelitsya_s_gpx_faylom_e29381e2')}
        </Text>
      )}

      <QuestProgressSummary
        styles={styles}
        progress={progress}
        completedCount={completedCount}
        stepsCount={stepsCount}
        countModel={countModel}
        isMobile={isMobile}
        showBreakdown={!isMobile}
      />

      {wideDesktop ? (
        <View style={styles.stepsGrid}>
          {allSteps.map((step, index) => {
            const isActive = index === currentIndex && !showFinaleOnly
            const isDone = !!answers[step.id] && step.id !== 'intro'
            const isPostponed = !isDone && postponedStepIds.has(step.id)
            const isUnlocked = index <= unlockedIndex || !!answers[step.id] || questFinished

            return (
              <QuestStepPill
                key={step.id}
                colors={colors}
                styles={styles}
                active={isActive}
                done={isDone}
                pending={isPostponed}
                unlocked={isUnlocked}
                onPress={() => {
                  if (isUnlocked) goToStep(index)
                }}
                indexLabel={step.id === 'intro' ? '' : String(index)}
                isIntro={step.id === 'intro'}
                label={getNavigationStepLabel(step)}
              />
            )
          })}
          <QuestFinalePill
            colors={colors}
            styles={styles}
            active={showFinaleOnly}
            onPress={onShowFinale}
          />
        </View>
      ) : (
        <ActiveScrollNav
          currentIndex={currentIndex}
          showFinaleOnly={showFinaleOnly}
          style={styles.stepsNavigation}
          contentContainerStyle={{ paddingRight: 8, paddingLeft: isMobile ? 6 : 2 }}
          screenW={screenW}
        >
          {allSteps.map((step, index) => {
            const isActive = index === currentIndex && !showFinaleOnly
            const isDone = !!answers[step.id] && step.id !== 'intro'
            const isPostponed = !isDone && postponedStepIds.has(step.id)
            const isUnlocked = index <= unlockedIndex || !!answers[step.id] || questFinished

            if (screenW < 600) {
              return (
                <QuestStepDot
                  key={step.id}
                  colors={colors}
                  styles={styles}
                  active={isActive}
                  done={isDone}
                  pending={isPostponed}
                  unlocked={isUnlocked}
                  onPress={() => {
                    if (isUnlocked) goToStep(index)
                  }}
                  label={String(index)}
                  isIntro={step.id === 'intro'}
                  small={screenW < 360}
                />
              )
            }

            return (
              <QuestStepPill
                key={step.id}
                colors={colors}
                styles={styles}
                narrow
                active={isActive}
                done={isDone}
                pending={isPostponed}
                unlocked={isUnlocked}
                onPress={() => {
                  if (isUnlocked) goToStep(index)
                }}
                indexLabel={step.id === 'intro' ? '' : String(index)}
                isIntro={step.id === 'intro'}
                label={getNavigationStepLabel(step)}
              />
            )
          })}
          {compactNav ? (
            <QuestFinaleDot
              colors={colors}
              styles={styles}
              active={showFinaleOnly}
              onPress={onShowFinale}
            />
          ) : (
            <QuestFinalePill
              colors={colors}
              styles={styles}
              active={showFinaleOnly}
              onPress={onShowFinale}
            />
          )}
        </ActiveScrollNav>
      )}

      {!isMobile && compactNav && (
        <Text style={styles.navActiveTitle} numberOfLines={1}>
          {showFinaleOnly ? i18nT('quests:components.quests.questWizardShell.final_d1c11370') : currentIndex === 0 ? i18nT('quests:components.quests.questWizardShell.start_225f7a82') : allSteps[currentIndex]?.title}
        </Text>
      )}

    </View>
  )
}
