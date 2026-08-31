import { Pressable, Text, View } from 'react-native'
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
  /**
   * Точка отложена ссылкой «Пропустить»: игрок ушёл дальше, ответа нет, с гейта
   * финала она не снята (#1633). Состояние обязано отличаться и от «пройдена»,
   * и от «ещё впереди» — иначе долг маршрута в списке не виден вовсе.
   */
  pending?: boolean
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
  pending = false,
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
      // Роль нужна именно здесь: без неё RNW рисует голый div, и `aria-label`
      // с состоянием точки скринридер не озвучивает — метка долга оказалась бы
      // видна только зрячему и только цветом.
      accessibilityRole="button"
      accessibilityState={{ disabled: !unlocked }}
      accessibilityLabel={
        pending && !done
          ? i18nT('quests:components.quests.questWizardNavigation.postponedLabel', { value1: label })
          : undefined
      }
      style={[
        styles.stepPill,
        compact && styles.compactStepPill,
        styles.stepPillUnlocked,
        narrow && styles.stepPillNarrow,
        done && !active && styles.stepPillDone,
        pending && !active && !done && styles.stepPillPending,
        active && styles.stepPillActive,
        !unlocked && styles.stepPillLocked,
      ]}
      hitSlop={6}
    >
      {isIntro || (pending && !done && !active) ? (
        <Feather
          name={isIntro ? 'play' : 'corner-up-left'}
          size={12}
          color={(active || done) ? colors.textOnPrimary : colors.primaryText}
          style={{ marginRight: isIntro ? 8 : 5 }}
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
  pending = false,
  unlocked = true,
  isIntro = false,
  label,
  small = false,
}: StepDotProps) {
  const smallOverride = small ? { width: 28, height: 28, borderRadius: 14 } : undefined
  // Нажимается прозрачная рамка 44dp (`stepDotTarget`), внутри неё — прежний
  // видимый кружок 26–28dp. До #1274 Pressable был размером с кружок и добирал
  // область через hitSlop, но ряд точек обтягивает их по высоте, а на Android
  // hitSlop потомка проверяется только после попадания внутрь родителя — весь
  // вертикальный добор срезался, и точка оставалась 26dp (регресс #192).
  return (
    <Pressable
      onPress={onPress}
      disabled={!unlocked}
      // Роль нужна именно здесь: без неё RNW рисует голый div, и `aria-label`
      // с состоянием точки скринридер не озвучивает — метка долга оказалась бы
      // видна только зрячему и только цветом.
      accessibilityRole="button"
      accessibilityState={{ disabled: !unlocked }}
      accessibilityLabel={
        pending && !done
          ? i18nT('quests:components.quests.questWizardNavigation.postponedLabel', { value1: label })
          : undefined
      }
      style={styles.stepDotTarget}
    >
      <View
        style={[
          styles.stepDotMini,
          unlocked && styles.stepDotMiniUnlocked,
          done && !active && styles.stepDotMiniDone,
          pending && !active && !done && styles.stepDotMiniPending,
          active && styles.stepDotMiniActive,
          !unlocked && styles.stepDotMiniLocked,
          smallOverride,
        ]}
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
      </View>
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
    <Pressable onPress={props.onPress} style={props.styles.stepDotTarget}>
      <View
        style={[props.styles.stepDotMini, props.active ? props.styles.stepDotMiniActive : props.styles.stepDotMiniUnlocked]}
      >
        <Text style={[props.styles.stepDotMiniText, props.active && { color: props.colors.textOnPrimary }]}>{i18nT('quests:components.quests.questWizardNavigation.f_67cbee49')}</Text>
      </View>
    </Pressable>
  )
}
