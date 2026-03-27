import React from 'react'
import { Pressable, Text } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

type NavigationProps = {
  colors: {
    textOnPrimary: string
    primaryText: string
  }
  styles: any
  onPress: () => void
  active?: boolean
  done?: boolean
  unlocked?: boolean
}

type StepPillProps = NavigationProps & {
  compact?: boolean
  narrow?: boolean
  isIntro?: boolean
  label: string
  indexLabel?: string
  numberOfLines?: number
}

type StepDotProps = NavigationProps & {
  isIntro?: boolean
  label: string
}

export function QuestStepPill({
  colors,
  styles,
  onPress,
  active = false,
  done = false,
  unlocked = true,
  compact = false,
  narrow = false,
  isIntro = false,
  label,
  indexLabel = '',
  numberOfLines = 1,
}: StepPillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.stepPill,
        compact && styles.compactStepPill,
        styles.stepPillUnlocked,
        narrow && styles.stepPillNarrow,
        active && styles.stepPillActive,
        done && styles.stepPillDone,
        !unlocked && styles.stepPillLocked,
      ]}
      hitSlop={6}
    >
      {isIntro ? (
        <Feather
          name="play"
          size={12}
          color={(active || done) ? colors.textOnPrimary : colors.primaryText}
          style={{ marginRight: 8 }}
        />
      ) : (
        <Text style={[styles.stepPillIndex, (active || done) && { color: colors.textOnPrimary }]}>
          {indexLabel}
        </Text>
      )}
      <Text
        style={[styles.stepPillTitle, (active || done) && { color: colors.textOnPrimary }]}
        numberOfLines={numberOfLines}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function QuestStepDot({
  colors,
  styles,
  onPress,
  active = false,
  done = false,
  unlocked = true,
  isIntro = false,
  label,
}: StepDotProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.stepDotMini,
        unlocked && styles.stepDotMiniUnlocked,
        active && styles.stepDotMiniActive,
        done && styles.stepDotMiniDone,
        !unlocked && styles.stepDotMiniLocked,
      ]}
      hitSlop={6}
    >
      {isIntro ? (
        <Feather
          name="play"
          size={12}
          color={(active || done) ? colors.textOnPrimary : colors.primaryText}
        />
      ) : (
        <Text style={[styles.stepDotMiniText, (active || done) && { color: colors.textOnPrimary }]}>
          {label}
        </Text>
      )}
    </Pressable>
  )
}

export function QuestFinalePill(props: NavigationProps & { compact?: boolean }) {
  return (
    <QuestStepPill
      {...props}
      indexLabel="Ф"
      label="Финал"
      compact={props.compact}
    />
  )
}

export function QuestFinaleDot(props: NavigationProps) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[props.styles.stepDotMini, props.active ? props.styles.stepDotMiniActive : props.styles.stepDotMiniUnlocked]}
      hitSlop={6}
    >
      <Text style={[props.styles.stepDotMiniText, props.active && { color: props.colors.textOnPrimary }]}>Ф</Text>
    </Pressable>
  )
}
