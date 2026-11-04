import { translate as i18nT } from '@/i18n'
import type { ThemedColors } from '@/hooks/useTheme'
import type { QuestPointRole } from '@/utils/questCountModel'

/**
 * #2146: одна модель «состояние точки маршрута → вид и подпись» для всех
 * поверхностей навигации прохождения (кружки, пилюли, старт, финал) на web,
 * Android и iPhone. Таблица и пороги контраста — §10
 * `docs/features/mobile-screen-shell-mock.md`; держит их
 * `__tests__/components/quests/questStepVisualState.test.ts`.
 *
 * Состояние никогда не передаётся одним цветом: пройденная несёт галочку,
 * отложенная — значок «вернуться», доступная — контур, текущая и
 * пройденная — сплошную заливку. «Пройдена» и «текущая» по яркости близки
 * (`success` и `brandDark`), поэтому галочка обязательна.
 */

export type QuestStepNavState = 'current' | 'done' | 'pending' | 'available'

export type QuestStepNavKind = 'point' | 'intro' | 'finale'

export type QuestStepGlyph = 'check' | 'number' | 'play' | 'flag' | 'return'

export type QuestStepVisualColors = Pick<
  ThemedColors,
  | 'success'
  | 'brandDark'
  | 'surface'
  | 'textMuted'
  | 'text'
  | 'textInverse'
  | 'textOnPrimary'
  | 'warning'
>

export type QuestStepVisual = {
  state: QuestStepNavState
  fill: 'solid' | 'outline'
  backgroundColor: string
  borderColor: string
  borderWidth: number
  borderStyle: 'solid' | 'dashed'
  glyph: QuestStepGlyph
  glyphColor: string
  accessibilityLabel: string
}

/** Приоритет тот же, что раньше задавал порядок массивов стилей: текущая сильнее всех. */
export function resolveQuestStepNavState({
  active = false,
  done = false,
  pending = false,
}: {
  active?: boolean
  done?: boolean
  pending?: boolean
}): QuestStepNavState {
  if (active) return 'current'
  if (done) return 'done'
  if (pending) return 'pending'
  return 'available'
}

/**
 * #2149: флаги точки маршрута из прогресса визарда — одно правило для пилюль,
 * полосы маршрута и листа «Маршрут».
 */
export function resolveQuestStepNavFlags({
  stepId,
  index,
  currentIndex,
  answers,
  postponedStepIds,
  showFinaleOnly,
}: {
  stepId: string
  index: number
  currentIndex: number
  answers: Record<string, unknown>
  postponedStepIds: ReadonlySet<string>
  showFinaleOnly: boolean
}): { active: boolean; done: boolean; pending: boolean } {
  const done = stepId !== 'intro' && !!answers[stepId]
  return {
    active: index === currentIndex && !showFinaleOnly,
    done,
    pending: !done && postponedStepIds.has(stepId),
  }
}

const STATE_LABEL_KEY: Record<QuestStepNavState, string> = {
  done: 'quests:components.quests.questStepState.state.done',
  current: 'quests:components.quests.questStepState.state.current',
  available: 'quests:components.quests.questStepState.state.available',
  pending: 'quests:components.quests.questStepState.state.pending',
}

// Старт и финал — мужской род («текущий», «доступен»); у них нет состояний
// «пройдена» и «отложена», но модель не падает, если их передадут.
const STATE_LABEL_KEY_M: Record<QuestStepNavState, string> = {
  ...STATE_LABEL_KEY,
  current: 'quests:components.quests.questStepState.stateM.current',
  available: 'quests:components.quests.questStepState.stateM.available',
}

/** Слово состояния в роде места: «пройдена» у точки, «текущий» у старта и финала. */
export function questStepStateWord(state: QuestStepNavState, kind: QuestStepNavKind): string {
  return i18nT(kind === 'point' ? STATE_LABEL_KEY[state] : STATE_LABEL_KEY_M[state])
}

/** «Точка 3 из 14» / «Старт квеста» / «Финал» — одно место для полосы, листа и подписей. */
export function questStepPlaceLabel(kind: QuestStepNavKind, index: number, total: number): string {
  if (kind === 'intro') return i18nT('quests:components.quests.questStepState.intro')
  if (kind === 'finale') return i18nT('quests:components.quests.questStepState.finale')
  return i18nT('quests:components.quests.questStepState.point', { index, total })
}

function buildAccessibilityLabel(
  state: QuestStepNavState,
  kind: QuestStepNavKind,
  index: number,
  total: number,
  role: QuestPointRole | null | undefined,
): string {
  const base = i18nT('quests:components.quests.questStepState.label', {
    place: questStepPlaceLabel(kind, index, total),
    state: questStepStateWord(state, kind),
  })
  return kind === 'point' && role === 'optional'
    ? i18nT('quests:components.quests.questStepState.withOptional', { label: base })
    : base
}

function kindGlyph(kind: QuestStepNavKind): QuestStepGlyph {
  if (kind === 'intro') return 'play'
  if (kind === 'finale') return 'flag'
  return 'number'
}

export function resolveQuestStepVisualState({
  state,
  kind = 'point',
  role,
  index = 0,
  total = 0,
  colors,
}: {
  state: QuestStepNavState
  kind?: QuestStepNavKind
  role?: QuestPointRole | null
  index?: number
  total?: number
  colors: QuestStepVisualColors
}): QuestStepVisual {
  const accessibilityLabel = buildAccessibilityLabel(state, kind, index, total, role)
  // Пунктир — признак необязательной точки у контурных состояний; у сплошной
  // заливки контура нет, роль остаётся в подписи.
  const outlineStyle: 'solid' | 'dashed' = kind === 'point' && role === 'optional' ? 'dashed' : 'solid'

  switch (state) {
    case 'done':
      return {
        state,
        fill: 'solid',
        backgroundColor: colors.success,
        borderColor: colors.success,
        borderWidth: 0,
        borderStyle: 'solid',
        glyph: 'check',
        glyphColor: colors.textInverse,
        accessibilityLabel,
      }
    case 'current':
      return {
        state,
        fill: 'solid',
        backgroundColor: colors.brandDark,
        borderColor: colors.brandDark,
        borderWidth: 0,
        borderStyle: 'solid',
        glyph: kindGlyph(kind),
        glyphColor: colors.textOnPrimary,
        accessibilityLabel,
      }
    case 'pending':
      return {
        state,
        fill: 'outline',
        backgroundColor: colors.surface,
        borderColor: colors.warning,
        borderWidth: 2,
        borderStyle: outlineStyle,
        glyph: 'return',
        glyphColor: colors.warning,
        accessibilityLabel,
      }
    case 'available':
    default:
      return {
        state: 'available',
        fill: 'outline',
        backgroundColor: colors.surface,
        borderColor: colors.textMuted,
        borderWidth: 1.5,
        borderStyle: outlineStyle,
        glyph: kindGlyph(kind),
        glyphColor: colors.text,
        accessibilityLabel,
      }
  }
}

/** Feather-имя значка; `number` рисуется текстом и сюда не попадает. */
export const QUEST_STEP_GLYPH_ICON: Record<Exclude<QuestStepGlyph, 'number'>, 'check' | 'play' | 'flag' | 'corner-up-left'> = {
  check: 'check',
  play: 'play',
  flag: 'flag',
  return: 'corner-up-left',
}
