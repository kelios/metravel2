import { Pressable, type StyleProp, Text, type TextStyle, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { translate as i18nT } from '@/i18n'
import type { QuestPointRole } from '@/utils/questCountModel'

import {
  QUEST_STEP_GLYPH_ICON,
  type QuestStepNavKind,
  type QuestStepVisual,
  type QuestStepVisualColors,
  resolveQuestStepNavState,
  resolveQuestStepVisualState,
} from './questStepVisualState'

type NavigationProps = {
  colors: QuestStepVisualColors
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
  /** #2146: позиция точки в маршруте и число точек без старта — для подписи диктора. */
  position?: number
  total?: number
  role?: QuestPointRole | null
}

type StepPillProps = NavigationProps & {
  compact?: boolean
  narrow?: boolean
  isIntro?: boolean
  label: string
  indexLabel?: string
  numberOfLines?: number
  testID?: string
  kind?: QuestStepNavKind
}

type StepDotProps = NavigationProps & {
  isIntro?: boolean
  label: string
  small?: boolean
}

function resolveVisual(props: NavigationProps, kind: QuestStepNavKind): QuestStepVisual {
  return resolveQuestStepVisualState({
    state: resolveQuestStepNavState(props),
    kind,
    role: props.role,
    index: props.position ?? 0,
    total: props.total ?? 0,
    colors: props.colors,
  })
}

/** Вид состояния — заливка и контур из модели (#2146); геометрию даёт стиль-основа. */
function visualStyle(visual: QuestStepVisual) {
  return {
    backgroundColor: visual.backgroundColor,
    borderColor: visual.borderColor,
    borderWidth: visual.borderWidth,
    borderStyle: visual.borderStyle,
  }
}

function StepGlyph({ visual, text, size, textStyle }: { visual: QuestStepVisual; text: string; size: number; textStyle: StyleProp<TextStyle> }) {
  if (visual.glyph === 'number') {
    return <Text style={[textStyle, { color: visual.glyphColor }]}>{text}</Text>
  }
  return <Feather name={QUEST_STEP_GLYPH_ICON[visual.glyph]} size={size} color={visual.glyphColor} />
}

export function QuestStepPill(props: StepPillProps) {
  const {
    styles,
    onPress,
    active = false,
    unlocked = true,
    compact = false,
    narrow = false,
    isIntro = false,
    label,
    indexLabel = '',
    numberOfLines = 1,
    testID,
    kind = isIntro ? 'intro' : 'point',
  } = props
  const visual = resolveVisual(props, kind)
  // Заголовок шага на сплошной заливке берёт цвет значка (контраст держит
  // модель), на контурной — обычный текст.
  const titleColor = visual.fill === 'solid' ? visual.glyphColor : undefined
  // Видимая подпись пилюли уже несёт название старта/финала и роль точки
  // («· Точка по желанию»): диктор не должен слышать их дважды.
  const accessibilityLabel =
    kind === 'point'
      ? i18nT('quests:components.quests.questStepState.withTitle', {
          label: resolveVisual({ ...props, role: null }, kind).accessibilityLabel,
          title: label,
        })
      : visual.accessibilityLabel
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!unlocked}
      // Роль нужна именно здесь: без неё RNW рисует голый div, и `aria-label`
      // с состоянием точки скринридер не озвучивает.
      accessibilityRole="button"
      accessibilityState={{ disabled: !unlocked, selected: active }}
      accessibilityLabel={accessibilityLabel}
      style={({ hovered }) => [
        styles.stepPill,
        compact && styles.compactStepPill,
        hovered && unlocked && styles.stepPillHovered,
        narrow && styles.stepPillNarrow,
        visualStyle(visual),
        active && styles.stepPillActive,
      ]}
      hitSlop={6}
    >
      <View style={styles.stepPillGlyph}>
        <StepGlyph visual={visual} text={indexLabel} size={12} textStyle={styles.stepPillIndex} />
      </View>
      <Text
        style={[styles.stepPillTitle, titleColor ? { color: titleColor } : null]}
        numberOfLines={numberOfLines}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function QuestStepDot(props: StepDotProps) {
  const { styles, onPress, active = false, unlocked = true, isIntro = false, label, small = false } = props
  const visual = resolveVisual(props, isIntro ? 'intro' : 'point')
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
      accessibilityRole="button"
      accessibilityState={{ disabled: !unlocked, selected: active }}
      accessibilityLabel={visual.accessibilityLabel}
      style={styles.stepDotTarget}
    >
      <View style={[styles.stepDotMini, visualStyle(visual), active && styles.stepDotMiniActive, smallOverride]}>
        <StepGlyph
          visual={visual}
          text={label}
          size={small ? 10 : 12}
          textStyle={[styles.stepDotMiniText, small && { fontSize: 10 }]}
        />
      </View>
    </Pressable>
  )
}

/**
 * Вход в финал из навигации прохождения — один testID на точку и пилюлю: по нему
 * замер мобильного бюджета (#2147) открывает состояние «финал» в любой локали.
 */
export const QUEST_NAV_FINALE_TEST_ID = 'quest-nav-finale'

export function QuestFinalePill(props: NavigationProps & { compact?: boolean }) {
  return (
    <QuestStepPill
      {...props}
      kind="finale"
      label={i18nT('quests:components.quests.questWizardNavigation.final_a5ec2c03')}
      compact={props.compact}
      testID={QUEST_NAV_FINALE_TEST_ID}
    />
  )
}

export function QuestFinaleDot(props: NavigationProps) {
  const visual = resolveVisual(props, 'finale')
  return (
    <Pressable
      testID={QUEST_NAV_FINALE_TEST_ID}
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!props.active }}
      accessibilityLabel={visual.accessibilityLabel}
      style={props.styles.stepDotTarget}
    >
      <View style={[props.styles.stepDotMini, visualStyle(visual), props.active && props.styles.stepDotMiniActive]}>
        <StepGlyph visual={visual} text="" size={12} textStyle={props.styles.stepDotMiniText} />
      </View>
    </Pressable>
  )
}
