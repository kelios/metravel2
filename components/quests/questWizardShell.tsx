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

type QuestNavigationStep = {
  id: string
  title: string
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
  currentIndex: number
  unlockedIndex: number
  allCompleted: boolean
  showFinaleOnly: boolean
  goToStep: (index: number) => void
  onShowFinale: () => void
}

type QuestCompactSidebarProps = NavigationSharedProps & {
  title: string
  progress: number
  completedCount: number
  stepsCount: number
  city?: QuestCityLike
  onReset: () => void
  onPrintDownload: () => void
  onOfflineMapDownload: () => void
  onOfflineMapOpenInApp: () => void
  offlineMapPointsCount: number
  ratingSlot?: React.ReactNode
  completionSlot?: React.ReactNode
  pioneerSlot?: React.ReactNode
  showExcursions?: boolean
}

type QuestHeaderPanelProps = NavigationSharedProps & {
  title: string
  progress: number
  completedCount: number
  stepsCount: number
  isMobile: boolean
  screenW: number
  compactNav: boolean
  onReset: () => void
  onPrintDownload: () => void
  onOfflineMapDownload: () => void
  onOfflineMapOpenInApp: () => void
  offlineMapPointsCount: number
  ratingSlot?: React.ReactNode
  completionSlot?: React.ReactNode
  pioneerSlot?: React.ReactNode
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
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const showTooltip = Platform.OS === 'web' && !showLabel && tooltipVisible

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
}: {
  styles: any
  progress: number
  completedCount: number
  stepsCount: number
}) {
  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.progressText}>
        {completedCount} / {stepsCount}
      </Text>
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
    allSteps,
    answers,
    currentIndex,
    unlockedIndex,
    allCompleted,
    showFinaleOnly,
    goToStep,
    onShowFinale,
    city,
    onReset,
    onPrintDownload,
    onOfflineMapDownload,
    onOfflineMapOpenInApp,
    offlineMapPointsCount,
    ratingSlot,
    completionSlot,
    pioneerSlot,
    showExcursions = true,
  } = props
  const iconOnlyActions = Platform.OS === 'web'

  return (
    <View style={styles.compactSidebar}>
      <View style={styles.compactSidebarHeader}>
        <Text style={styles.compactSidebarTitle} numberOfLines={2}>{title}</Text>
        {pioneerSlot ?? null}
        {ratingSlot ?? null}
        {completionSlot ?? null}
        <View style={styles.compactSidebarActions}>
          <QuestActionButton
            styles={styles}
            label="Печать"
            accessibilityLabel="Печать квеста"
            iconName="download"
            iconColor={colors.textMuted}
            onPress={onPrintDownload}
            baseStyle={styles.actionLabelButton}
            showLabel={!iconOnlyActions}
            textStyle={styles.actionLabelText}
          />
          <QuestActionButton
            styles={styles}
            label="Скачать GPX"
            accessibilityLabel={`Скачать GPX с ${offlineMapPointsCount} точками квеста`}
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
            label="Открыть в приложении"
            accessibilityLabel="Открыть точки квеста в приложении карт"
            iconName="external-link"
            iconColor={offlineMapPointsCount === 0 ? colors.disabled : colors.textMuted}
            onPress={onOfflineMapOpenInApp}
            disabled={offlineMapPointsCount === 0}
            baseStyle={styles.actionLabelButton}
            showLabel={!iconOnlyActions}
            textStyle={[styles.actionLabelText, offlineMapPointsCount === 0 && { color: colors.disabled }]}
          />
          <QuestActionButton
            styles={styles}
            label="Сбросить"
            accessibilityLabel="Сбросить прогресс"
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
      />

      <ScrollView
        style={styles.compactStepsList}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.compactStepsListContent}
      >
        {allSteps.map((step, index) => {
          const isActive = index === currentIndex && !showFinaleOnly
          const isDone = !!answers[step.id] && step.id !== 'intro'
          const isUnlocked = index <= unlockedIndex || !!answers[step.id] || allCompleted

          return (
            <QuestStepPill
              key={step.id}
              colors={colors}
              styles={styles}
              compact
              active={isActive}
              done={isDone}
              unlocked={isUnlocked}
              onPress={() => {
                if (isUnlocked) goToStep(index)
              }}
              indexLabel={String(index)}
              isIntro={step.id === 'intro'}
              label={step.id === 'intro' ? 'Старт' : step.title}
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
          />
        )}
      </ScrollView>
    </View>
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
    allSteps,
    answers,
    currentIndex,
    unlockedIndex,
    allCompleted,
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
    ratingSlot,
    completionSlot,
    pioneerSlot,
  } = props

  const wideDesktop = screenW >= 1100
  const showActionLabels = Platform.OS !== 'web' && !isMobile

  return (
    <View style={styles.header}>
      <View style={[styles.headerRow, isMobile && styles.headerRowMobile]}>
        <View style={styles.headerIdentity}>
          {!isMobile && (
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          )}
          {!isMobile && pioneerSlot ? pioneerSlot : null}
          {!isMobile && ratingSlot ? ratingSlot : null}
          {!isMobile && completionSlot ? completionSlot : null}
        </View>
        <View style={styles.headerActionRow}>
          {Platform.OS === 'web' && (
            <QuestActionButton
              styles={styles}
              label="Печать"
              accessibilityLabel="Печать квеста"
              iconName="download"
              iconColor={colors.textMuted}
              onPress={onPrintDownload}
              baseStyle={styles.actionLabelButton}
              showLabel={showActionLabels}
              textStyle={styles.actionLabelText}
            />
          )}
          <QuestActionButton
            styles={styles}
            label="Скачать GPX"
            accessibilityLabel={`Скачать GPX с ${offlineMapPointsCount} точками квеста`}
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
            label="Открыть в приложении"
            accessibilityLabel="Открыть точки квеста в приложении карт"
            iconName="external-link"
            iconColor={offlineMapPointsCount === 0 ? colors.disabled : colors.textMuted}
            onPress={onOfflineMapOpenInApp}
            disabled={offlineMapPointsCount === 0}
            baseStyle={styles.actionLabelButton}
            showLabel={showActionLabels}
            textStyle={[styles.actionLabelText, offlineMapPointsCount === 0 && { color: colors.disabled }]}
          />
          <QuestActionButton
            styles={styles}
            label="Сбросить"
            accessibilityLabel="Сбросить прогресс"
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

      {!isMobile && offlineMapPointsCount > 0 && (
        <Text style={styles.exportHint}>
          {Platform.OS === 'web'
            ? 'Скачается GPX-файл с точками — откройте его в офлайн-картах (Organic Maps, Maps.me).'
            : 'Откроется системное «Поделиться» с GPX-файлом — сохраните его в офлайн-картах (Organic Maps, Maps.me).'}
        </Text>
      )}

      <QuestProgressSummary
        styles={styles}
        progress={progress}
        completedCount={completedCount}
        stepsCount={stepsCount}
      />

      {wideDesktop ? (
        <View style={styles.stepsGrid}>
          {allSteps.map((step, index) => {
            const isActive = index === currentIndex && !showFinaleOnly
            const isDone = !!answers[step.id] && step.id !== 'intro'
            const isUnlocked = index <= unlockedIndex || !!answers[step.id] || allCompleted

            return (
              <QuestStepPill
                key={step.id}
                colors={colors}
                styles={styles}
                active={isActive}
                done={isDone}
                unlocked={isUnlocked}
                onPress={() => {
                  if (isUnlocked) goToStep(index)
                }}
                indexLabel={step.id === 'intro' ? '' : String(index)}
                isIntro={step.id === 'intro'}
                label={step.id === 'intro' ? 'Старт' : step.title}
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
            const isUnlocked = index <= unlockedIndex || !!answers[step.id] || allCompleted

            if (screenW < 600) {
              return (
                <QuestStepDot
                  key={step.id}
                  colors={colors}
                  styles={styles}
                  active={isActive}
                  done={isDone}
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
                unlocked={isUnlocked}
                onPress={() => {
                  if (isUnlocked) goToStep(index)
                }}
                indexLabel={step.id === 'intro' ? '' : String(index)}
                isIntro={step.id === 'intro'}
                label={step.id === 'intro' ? 'Старт' : step.title}
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
          {showFinaleOnly ? 'Финал' : currentIndex === 0 ? 'Старт' : allSteps[currentIndex]?.title}
        </Text>
      )}

    </View>
  )
}
