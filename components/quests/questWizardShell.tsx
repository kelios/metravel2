import React, { useEffect, useRef } from 'react'
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
  } = props

  return (
    <View style={styles.compactSidebar}>
      <View style={styles.compactSidebarHeader}>
        <Text style={styles.compactSidebarTitle} numberOfLines={2}>{title}</Text>
        {pioneerSlot ?? null}
        {ratingSlot ?? null}
        {completionSlot ?? null}
        <View style={styles.compactSidebarActions}>
          <Pressable
            onPress={onPrintDownload}
            style={styles.actionLabelButton}
            accessibilityRole="button"
            accessibilityLabel="Печать квеста"
          >
            <Feather name="download" size={15} color={colors.textMuted} />
            <Text style={styles.actionLabelText}>Печать</Text>
          </Pressable>
          <Pressable
            onPress={onOfflineMapDownload}
            style={styles.actionLabelButton}
            disabled={offlineMapPointsCount === 0}
            accessibilityRole="button"
            accessibilityLabel={`Скачать GPX с ${offlineMapPointsCount} точками квеста`}
          >
            <Feather name="download" size={15} color={offlineMapPointsCount === 0 ? colors.disabled : colors.textMuted} />
            <Text style={[styles.actionLabelText, offlineMapPointsCount === 0 && { color: colors.disabled }]}>Скачать GPX</Text>
          </Pressable>
          <Pressable
            onPress={onOfflineMapOpenInApp}
            style={styles.actionLabelButton}
            disabled={offlineMapPointsCount === 0}
            accessibilityRole="button"
            accessibilityLabel="Открыть точки квеста в приложении карт"
          >
            <Feather name="external-link" size={15} color={offlineMapPointsCount === 0 ? colors.disabled : colors.textMuted} />
            <Text style={[styles.actionLabelText, offlineMapPointsCount === 0 && { color: colors.disabled }]}>Открыть в приложении</Text>
          </Pressable>
          <Pressable
            onPress={onReset}
            style={styles.resetButton}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Сбросить прогресс"
          >
            <Feather name="rotate-ccw" size={13} color={colors.textMuted} />
            <Text style={styles.resetText}>Сбросить</Text>
          </Pressable>
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

        {city && Platform.OS === 'web' && (
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
            <Pressable
              onPress={onPrintDownload}
              style={[styles.actionLabelButton, isMobile && styles.actionIconButton]}
              accessibilityRole="button"
              accessibilityLabel="Печать квеста"
            >
              <Feather name="download" size={15} color={colors.textMuted} />
              {!isMobile && <Text style={styles.actionLabelText}>Печать</Text>}
            </Pressable>
          )}
          <Pressable
            onPress={onOfflineMapDownload}
            style={[styles.actionLabelButton, isMobile && styles.actionIconButton]}
            disabled={offlineMapPointsCount === 0}
            accessibilityRole="button"
            accessibilityLabel={`Скачать GPX с ${offlineMapPointsCount} точками квеста`}
          >
            <Feather name="download" size={15} color={offlineMapPointsCount === 0 ? colors.disabled : colors.textMuted} />
            {!isMobile && <Text style={[styles.actionLabelText, offlineMapPointsCount === 0 && { color: colors.disabled }]}>Скачать GPX</Text>}
          </Pressable>
          <Pressable
            onPress={onOfflineMapOpenInApp}
            style={[styles.actionLabelButton, isMobile && styles.actionIconButton]}
            disabled={offlineMapPointsCount === 0}
            accessibilityRole="button"
            accessibilityLabel="Открыть точки квеста в приложении карт"
          >
            <Feather name="external-link" size={15} color={offlineMapPointsCount === 0 ? colors.disabled : colors.textMuted} />
            {!isMobile && <Text style={[styles.actionLabelText, offlineMapPointsCount === 0 && { color: colors.disabled }]}>Открыть в приложении</Text>}
          </Pressable>
          <Pressable
            onPress={onReset}
            style={[styles.resetButton, isMobile && styles.actionIconButton]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Сбросить прогресс"
          >
            <Feather name="rotate-ccw" size={13} color={colors.textMuted} />
            {!isMobile && <Text style={styles.resetText}>Сбросить</Text>}
          </Pressable>
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
