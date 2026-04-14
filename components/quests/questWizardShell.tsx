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
  } = props

  return (
    <View style={styles.compactSidebar}>
      <View style={styles.compactSidebarHeader}>
        <Text style={styles.compactSidebarTitle} numberOfLines={2}>{title}</Text>
        <View style={styles.compactSidebarActions}>
          <Pressable
            onPress={onPrintDownload}
            style={styles.compactIconButton}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Скачать печатную версию квеста"
          >
            <Feather name="download" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={onReset}
            style={styles.resetButton}
            hitSlop={6}
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
  } = props

  const wideDesktop = screenW >= 1100

  return (
    <View style={styles.header}>
      <View style={[styles.headerRow, isMobile && styles.headerRowMobile]}>
        <View style={styles.headerIdentity}>
          <Text style={[styles.title, isMobile && styles.titleMobile]} numberOfLines={1}>{title}</Text>
        </View>
        <View style={styles.headerActionRow}>
          {Platform.OS === 'web' && (
            <Pressable
              onPress={onPrintDownload}
              style={styles.compactIconButton}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Скачать печатную версию квеста"
            >
              <Feather name="download" size={16} color={colors.textMuted} />
            </Pressable>
          )}
          <Pressable
            onPress={onReset}
            style={styles.resetButton}
            hitSlop={6}
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
