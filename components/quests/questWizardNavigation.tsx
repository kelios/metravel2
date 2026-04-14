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
  small?: boolean
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
        done && !active && styles.stepPillDone,
        active && styles.stepPillActive,
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
  small = false,
}: StepDotProps) {
  const smallOverride = small ? { width: 28, height: 28, borderRadius: 14, marginRight: 4 } : undefined
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.stepDotMini,
        unlocked && styles.stepDotMiniUnlocked,
        done && !active && styles.stepDotMiniDone,
        active && styles.stepDotMiniActive,
        !unlocked && styles.stepDotMiniLocked,
        smallOverride,
      ]}
      hitSlop={small ? 12 : 10}
    >
      {isIntro ? (
        <Feather
          name="play"
          size={small ? 10 : 12}
          color={(active || done) ? colors.textOnPrimary : colors.primaryText}
        />
      ) : (
        <Text style={[styles.stepDotMiniText, (active || done) && { color: colors.textOnPrimary }, small && { fontSize: 10 }]}>
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
