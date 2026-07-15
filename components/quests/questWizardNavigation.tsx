import { Pressable, Text } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { translate as i18nT } from '@/i18n'


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
      disabled={!unlocked}
      accessibilityState={{ disabled: !unlocked }}
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
  // Визуальный размер точки 26–28dp. hitSlop расширяет область нажатия до ~44–48dp:
  // по вертикали соседей нет — даём 12dp; по горизонтали зазор между точками 3–4dp,
  // поэтому ограничиваем 9dp, чтобы хит-зоны соседей не перекрывались чрезмерно.
  const dotHitSlop = small
    ? { top: 12, bottom: 12, left: 10, right: 10 }
    : { top: 12, bottom: 12, left: 9, right: 9 }
  return (
    <Pressable
      onPress={onPress}
      disabled={!unlocked}
      accessibilityState={{ disabled: !unlocked }}
      style={[
        styles.stepDotMini,
        unlocked && styles.stepDotMiniUnlocked,
        done && !active && styles.stepDotMiniDone,
        active && styles.stepDotMiniActive,
        !unlocked && styles.stepDotMiniLocked,
        smallOverride,
      ]}
      hitSlop={dotHitSlop}
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
      indexLabel={i18nT('quests:components.quests.questWizardNavigation.f_67cbee49')}
      label={i18nT('quests:components.quests.questWizardNavigation.final_a5ec2c03')}
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
      <Text style={[props.styles.stepDotMiniText, props.active && { color: props.colors.textOnPrimary }]}>{i18nT('quests:components.quests.questWizardNavigation.f_67cbee49')}</Text>
    </Pressable>
  )
}
