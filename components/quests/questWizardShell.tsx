import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isPrintAvailable } from '@/utils/printHtml'
import { Platform, Pressable, ScrollView, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { QuestFinalePill, QuestStepPill } from './questWizardNavigation'
import QuestRouteStrip from './QuestRouteStrip'
import { buildQuestRouteModel } from './questRouteModel'
import { resolveQuestStepNavFlags } from './questStepVisualState'
import { QuestCompactExcursions } from './questWizardSections'
import EdgeFadeScrollRow from '@/components/ui/EdgeFadeScrollRow'
import ActionTooltip from '@/components/ui/ActionTooltip'
import { useQuestFontScaleControls } from '@/stores/questFontScaleStore'
import { translate as i18nT, translatePlural } from '@/i18n'
import type { QuestCountModel, QuestPointRole } from '@/utils/questCountModel'
import { getQuestPointRoleAnnotation } from './questMapPoints'
import { describeOfflineQuestAction, type OfflineQuestDownloadState } from './questScreenHeaderModel'


type QuestNavigationStep = {
  id: string
  title: string
  pointRole?: QuestPointRole
}

// #2146: «Точка N из M» в подписи диктора — M без стартовой карточки.
const countRoutePoints = (steps: QuestNavigationStep[]): number =>
  steps.filter((step) => step.id !== 'intro').length

const getNavigationStepLabel = (step: QuestNavigationStep): string => {
  if (step.id === 'intro' || step.pointRole === 'start') {
    return i18nT('quests:components.quests.questWizardShell.start_225f7a82')
  }
  if (step.pointRole === 'optional' || step.pointRole === 'final') {
    const annotation = getQuestPointRoleAnnotation(step.title, step.pointRole)
    return annotation ? `${step.title} · ${annotation}` : step.title
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
  /**
   * #2148: телефон — название, мета и действия живут в строке экрана
   * (декларация `useQuestScreenHeader`), панель оставляет только навигацию и
   * статусы. Тот же предикат, что у строки (`useQuestWizardResponsiveModel`).
   */
  headerInScreenRow: boolean
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
  /** Статусы, требующие внимания: на телефоне — единственная строка над навигацией. */
  statusSlot?: React.ReactNode
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
}: QuestActionButtonProps) {
  const anchorRef = useRef<View>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const dismissTooltip = useCallback(() => setDismissed(true), [])
  const showTooltip = Platform.OS === 'web' && !showLabel && !disabled &&
    !dismissed && (hovered || focused)

  return (
    <Pressable
      ref={anchorRef}
      onPress={onPress}
      style={[baseStyle, !showLabel && styles.actionIconButton]}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onHoverIn={() => { setHovered(true); setDismissed(false) }}
      onHoverOut={() => setHovered(false)}
      onFocus={() => { setFocused(true); setDismissed(false) }}
      onBlur={() => setFocused(false)}
    >
      <Feather name={iconName} size={iconSize} color={iconColor} />
      {showLabel && <Text style={textStyle}>{label}</Text>}
      <ActionTooltip anchorRef={anchorRef} label={label} visible={showTooltip} onDismiss={dismissTooltip} />
    </Pressable>
  )
}

function QuestOfflineDownloadButton({
  styles,
  colors,
  state,
  onPress,
  showLabel,
}: {
  styles: any
  colors: any
  state: OfflineQuestDownloadState
  onPress: () => void
  showLabel: boolean
}) {
  // Та же таблица состояний, что у главного действия строки экрана (#2148).
  const { icon, label, accessibilityLabel } = describeOfflineQuestAction(state)
  const iconColor = state === 'done' ? colors.success : colors.textMuted

  return (
    <QuestActionButton
      styles={styles}
      label={label}
      accessibilityLabel={accessibilityLabel}
      iconName={icon}
      iconColor={iconColor}
      onPress={onPress}
      disabled={state === 'downloading'}
      baseStyle={styles.actionLabelButton}
      showLabel={showLabel}
      textStyle={styles.actionLabelText}
    />
  )
}

/**
 * Лента пилюль шагов (≥ 600 px) держит активный шаг в видимой части. Позиция
 * берётся из измеренной раскладки самих элементов: литерал ширины (35 у кружка,
 * 130 у пилюли) разошёлся с реальной шириной после #1274 и уводил активный шаг
 * за край на длинном маршруте (#2149), а ширина пилюли переменная вовсе.
 */
export function ActiveScrollNav({
  activeIndex,
  style,
  contentContainerStyle,
  children,
}: {
  /** Индекс среди детей, который держим по центру (финал — последняя пилюля). */
  activeIndex: number
  style?: any
  contentContainerStyle?: any
  children: React.ReactNode
}) {
  const scrollRef = useRef<ScrollView>(null)
  // Раскладка — в ref, а не в state: onLayout каждого элемента приходит отдельно
  // (RNW — своим setTimeout), и состояние перерисовывало бы всю ленту N раз.
  const itemLayouts = useRef(new Map<number, { x: number; width: number }>())
  const viewportWidth = useRef(0)
  const activeIndexRef = useRef(activeIndex)
  activeIndexRef.current = activeIndex

  const scrollToActive = useCallback(() => {
    const item = itemLayouts.current.get(activeIndexRef.current)
    if (!scrollRef.current || !item || viewportWidth.current <= 0) return
    const offset = Math.max(0, item.x + item.width / 2 - viewportWidth.current / 2)
    scrollRef.current.scrollTo({ x: offset, animated: true })
  }, [])

  useEffect(() => {
    scrollToActive()
  }, [activeIndex, scrollToActive])

  const onItemLayout = useCallback(
    (index: number, x: number, width: number) => {
      itemLayouts.current.set(index, { x, width })
      if (index === activeIndexRef.current) scrollToActive()
    },
    [scrollToActive],
  )

  return (
    <EdgeFadeScrollRow
      ref={scrollRef}
      style={style}
      contentContainerStyle={contentContainerStyle}
      onLayout={(e: any) => {
        viewportWidth.current = e.nativeEvent.layout.width
        scrollToActive()
      }}
    >
      {React.Children.toArray(children).map((child, index) => (
        <View
          key={(child as React.ReactElement).key ?? index}
          testID={`quest-steps-nav-item-${index}`}
          onLayout={(e) => onItemLayout(index, e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
        >
          {child}
        </View>
      ))}
    </EdgeFadeScrollRow>
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
  showCounter = true,
}: {
  styles: any
  progress: number
  completedCount: number
  stepsCount: number
  countModel: QuestCountModel
  /**
   * Включает горизонтальную компоновку; мобильный caller отдельно
   * скрывает обе подписи флагами ниже.
   */
  isMobile?: boolean
  /**
   * #1669: на телефоне счётчик уехал в ряд действий — там после переезда редких
   * кнопок в «Ещё» освободилось место, и полоса прогресса схлопывается до
   * 3px-волосины вместо собственной строки в 16px текста.
   */
  showCounter?: boolean
  /** Разбор «сколько обязательных/необязательных» — вторая строка текста, на телефоне лишняя. */
  showBreakdown?: boolean
}) {
  return (
    <View style={[styles.progressContainer, isMobile && styles.progressRowMobile]}>
      <View style={[styles.progressBar, isMobile && styles.progressBarMobile]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      {showCounter && (
        <Text style={styles.progressText}>
          {i18nT('quests:components.quests.questWizardShell.progressTasks', {
            completed: completedCount,
            total: stepsCount,
          })}
        </Text>
      )}
      {showBreakdown && countModel.source === 'explicit' && (
        <Text style={styles.progressBreakdownText}>
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
  const pointsTotal = countRoutePoints(allSteps)
  const iconOnlyActions = Platform.OS === 'web'

  return (
    <View style={styles.compactSidebar}>
      <View style={styles.compactSidebarHeader}>
        {/* Заголовок квеста — единственный H1 страницы в этой раскладке. RNW
            превращает role=heading + aria-level в настоящий тег <h1>, поэтому
            отдельный видимый блок над визардом не нужен: он дублировал этот
            заголовок и лежал во всю ширину страницы мимо контейнера. */}
        <Text
          style={styles.compactSidebarTitle}
          numberOfLines={2}
          accessibilityRole="header"
          {...({ 'aria-level': 1 } as Record<string, unknown>)}
        >
          {title}
        </Text>
        {ratingSlot ?? null}
        {completionSlot ?? null}
        <View style={styles.compactSidebarActions}>
          <QuestFontScaleControl
            styles={styles}
            colors={colors}
            showLabel={!iconOnlyActions}
          />
          {isPrintAvailable() && (
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
          )}
          <QuestActionButton
            styles={styles}
            label={i18nT('quests:components.quests.questWizardShell.skachat_gpx_a032dca6')}
            accessibilityLabel={translatePlural('quests:components.quests.questWizardShell.skachat_gpx_s_value1_tochkami_kvesta_83ac2431', offlineMapPointsCount)}
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
          const { active: isActive, done: isDone, pending: isPostponed, unlocked: isUnlocked } = resolveQuestStepNavFlags({
            stepId: step.id, index, currentIndex, unlockedIndex, answers, postponedStepIds, questFinished, showFinaleOnly,
          })

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
              position={index}
              total={pointsTotal}
              role={step.pointRole}
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
}: {
  styles: any
  colors: any
  showLabel: boolean
}) {
  const { increase, decrease, atMin, atMax } = useQuestFontScaleControls()

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
        textStyle={[styles.actionLabelText, atMax && { color: colors.disabled }]}
      />
    </>
  )
}

function QuestStepsNavigation({
  colors,
  styles,
  allSteps,
  answers,
  postponedStepIds,
  currentIndex,
  unlockedIndex,
  questFinished,
  showFinaleOnly,
  goToStep,
  onShowFinale,
  wideDesktop,
  isMobile,
}: NavigationSharedProps & { wideDesktop: boolean; isMobile: boolean }) {
  const pointsTotal = countRoutePoints(allSteps)
  const pills = allSteps.map((step, index) => {
    const { active: isActive, done: isDone, pending: isPostponed, unlocked: isUnlocked } = resolveQuestStepNavFlags({
      stepId: step.id, index, currentIndex, unlockedIndex, answers, postponedStepIds, questFinished, showFinaleOnly,
    })

    return (
      <QuestStepPill
        key={step.id}
        colors={colors}
        styles={styles}
        narrow={!wideDesktop}
        active={isActive}
        done={isDone}
        pending={isPostponed}
        unlocked={isUnlocked}
        onPress={() => {
          if (isUnlocked) goToStep(index)
        }}
        indexLabel={step.id === 'intro' ? '' : String(index)}
        isIntro={step.id === 'intro'}
        position={index}
        total={pointsTotal}
        role={step.pointRole}
        label={getNavigationStepLabel(step)}
      />
    )
  })
  const finale = (
    <QuestFinalePill
      colors={colors}
      styles={styles}
      active={showFinaleOnly}
      onPress={onShowFinale}
    />
  )

  if (wideDesktop) {
    return (
      <View style={styles.stepsGrid}>
        {pills}
        {finale}
      </View>
    )
  }
  return (
    <ActiveScrollNav
      activeIndex={showFinaleOnly ? allSteps.length : currentIndex}
      style={styles.stepsNavigation}
      contentContainerStyle={{ paddingRight: 8, paddingLeft: isMobile ? 6 : 2 }}
    >
      {pills}
      {finale}
    </ActiveScrollNav>
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
    headerInScreenRow,
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
    statusSlot,
  } = props

  const wideDesktop = screenW >= 1100
  // Модель полосы нужна только телефонной ветке (< 600 px): шире её не строим.
  const routeModel = useMemo(
    () =>
      !compactNav ? null : buildQuestRouteModel({
        allSteps,
        answers,
        postponedStepIds,
        currentIndex,
        unlockedIndex,
        questFinished,
        showFinaleOnly,
        countModel,
        completedCount,
        stepsCount,
        colors,
      }),
    [compactNav, allSteps, answers, postponedStepIds, currentIndex, unlockedIndex, questFinished, showFinaleOnly, countModel, completedCount, stepsCount, colors],
  )

  // #2148: на телефоне название (h1 строки), мета (лист (i)) и действия («⋯»,
  // офлайн) — в строке экрана. В закреплённой части остаются статусы, которые
  // требуют внимания, и навигация по маршруту: полоса < 600 px (#2149), от 600
  // до 767 px — полоса прогресса со счётчиком и пилюли.
  if (headerInScreenRow) {
    return (
      <View style={styles.header}>
        {statusSlot ? (
          <View style={styles.headerStatusRow} testID="quest-header-status">
            {statusSlot}
          </View>
        ) : null}
        {compactNav && routeModel ? (
          <QuestRouteStrip model={routeModel} onGoToStep={goToStep} onShowFinale={onShowFinale} />
        ) : (
          <>
            <QuestProgressSummary
              styles={styles}
              progress={progress}
              completedCount={completedCount}
              stepsCount={stepsCount}
              countModel={countModel}
              isMobile
              showBreakdown={false}
            />
            <QuestStepsNavigation
              {...props}
              wideDesktop={false}
              isMobile
            />
          </>
        )}
      </View>
    )
  }

  // Native не на телефоне (планшет, ландшафт) показывает подписи у кнопок.
  const showActionLabels = Platform.OS !== 'web'

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.headerIdentity}>
          <Text
            style={styles.title}
            numberOfLines={1}
            accessibilityRole="header"
            {...({ 'aria-level': 1 } as Record<string, unknown>)}
          >
            {title}
          </Text>
          {ratingSlot ?? null}
          {completionSlot ?? null}
        </View>
        <View testID="quest-header-actions" style={styles.headerActionRow}>
          <QuestFontScaleControl
            styles={styles}
            colors={colors}
            showLabel={showActionLabels}
          />
          {isPrintAvailable() && (
            <QuestActionButton
              styles={styles}
              label={i18nT('quests:components.quests.questWizardShell.pechat_76bdeffe')}
              accessibilityLabel={i18nT('quests:components.quests.questWizardShell.pechat_kvesta_f66c15e3')}
              iconName="printer"
              iconColor={colors.textMuted}
              onPress={onPrintDownload}
              baseStyle={styles.actionLabelButton}
              showLabel={showActionLabels}
              textStyle={styles.actionLabelText}
            />
          )}
          <QuestActionButton
            styles={styles}
            label={i18nT('quests:components.quests.questWizardShell.skachat_gpx_a032dca6')}
            accessibilityLabel={translatePlural('quests:components.quests.questWizardShell.skachat_gpx_s_value1_tochkami_kvesta_83ac2431', offlineMapPointsCount)}
            iconName="download"
            iconColor={offlineMapPointsCount === 0 ? colors.disabled : colors.textMuted}
            onPress={onOfflineMapDownload}
            disabled={offlineMapPointsCount === 0}
            baseStyle={styles.actionLabelButton}
            showLabel={showActionLabels}
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
            textStyle={[styles.actionLabelText, offlineMapPointsCount === 0 && { color: colors.disabled }]}
          />
          <QuestOfflineDownloadButton
            styles={styles}
            colors={colors}
            state={offlineQuestState}
            onPress={onOfflineQuestDownload}
            showLabel={showActionLabels}
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
            textStyle={styles.resetText}
            hitSlop={12}
            iconSize={13}
          />
        </View>
      </View>

      {offlineMapPointsCount > 0 && (
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
      />

      <QuestStepsNavigation {...props} wideDesktop={wideDesktop} isMobile={false} />
    </View>
  )
}
