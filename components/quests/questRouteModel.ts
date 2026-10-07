import { translate as i18nT } from '@/i18n'
import type { QuestCountModel, QuestPointRole } from '@/utils/questCountModel'

import { getQuestPointRoleAnnotation } from './questMapPoints'
import {
  type QuestStepNavKind,
  type QuestStepNavState,
  type QuestStepVisual,
  type QuestStepVisualColors,
  questStepPlaceLabel,
  questStepStateWord,
  resolveQuestStepNavFlags,
  resolveQuestStepNavState,
  resolveQuestStepVisualState,
} from './questStepVisualState'

/**
 * #2149: полоса маршрута и лист «Маршрут» на телефоне — одна модель поверх
 * модели состояния точки (#2146). Позиция («Точка 12 из 14») и прогресс по
 * обязательным («Задания 10/11») берутся отсюда и только отсюда: раньше кружок
 * нумеровал все точки, а счётчик — только обязательные, и связи между числами
 * игрок не видел. Макет — §11 `docs/features/mobile-screen-shell-mock.md`.
 */

export type QuestRouteStep = { id: string; title: string; pointRole?: QuestPointRole }

export type QuestRoutePosition = { kind: QuestStepNavKind; index: number; total: number }

export type QuestRouteSegment = {
  key: string
  role: QuestPointRole | null
  visual: QuestStepVisual
}

export type QuestRouteRow = {
  key: string
  kind: QuestStepNavKind
  /** Индекс в `allSteps`; у финала `-1`. */
  stepIndex: number
  /** Номер в маркере: позиция точки, у старта и финала пусто (значок). */
  numberLabel: string
  title: string
  /** «Обязательная точка · пройдена» — вторая строка строки листа. */
  detail: string
  visual: QuestStepVisual
  disabled: boolean
  accessibilityLabel: string
}

export type QuestRouteModel = {
  position: QuestRoutePosition
  tasks: { completed: number; total: number } | null
  /** «Точка 12 из 14 · Задания: 10 / 11» — видимый текст полосы. */
  stripText: string
  stripAccessibilityLabel: string
  segments: QuestRouteSegment[]
  rows: QuestRouteRow[]
}

export type BuildQuestRouteModelInput = {
  allSteps: readonly QuestRouteStep[]
  answers: Record<string, unknown>
  postponedStepIds: ReadonlySet<string>
  currentIndex: number
  unlockedIndex: number
  questFinished: boolean
  showFinaleOnly: boolean
  countModel: QuestCountModel
  completedCount: number
  stepsCount: number
  colors: QuestStepVisualColors
}

const isIntroStep = (step: QuestRouteStep) => step.id === 'intro'

export function buildQuestRouteModel(input: BuildQuestRouteModelInput): QuestRouteModel {
  const { allSteps, answers, postponedStepIds, currentIndex, unlockedIndex, questFinished, showFinaleOnly, colors } =
    input
  const hasIntro = allSteps.length > 0 && isIntroStep(allSteps[0])
  const total = allSteps.filter((step) => !isIntroStep(step)).length
  // Номер точки — позиция в маршруте без стартовой карточки (как в карточке шага).
  const pointNumber = (stepIndex: number) => (hasIntro ? stepIndex : stepIndex + 1)

  const position: QuestRoutePosition = showFinaleOnly
    ? { kind: 'finale', index: 0, total }
    : hasIntro && currentIndex === 0
      ? { kind: 'intro', index: 0, total }
      : { kind: 'point', index: pointNumber(currentIndex), total }

  const tasks =
    input.countModel.source === 'explicit' ? { completed: input.completedCount, total: input.stepsCount } : null

  const placeText = questStepPlaceLabel(position.kind, position.index, position.total)
  const stripText = tasks
    ? i18nT('quests:components.quests.questRoute.stripText', {
        position: placeText,
        tasks: i18nT('quests:components.quests.questWizardShell.progressTasks', tasks),
      })
    : placeText
  const title = i18nT('quests:components.quests.questRoute.title')
  const stripAccessibilityLabel = tasks
    ? i18nT('quests:components.quests.questRoute.stripA11y', {
        title,
        position: placeText,
        tasks: i18nT('quests:components.quests.questRoute.tasksA11y', tasks),
      })
    : i18nT('quests:components.quests.questRoute.stripA11yNoTasks', { title, position: placeText })

  const segments: QuestRouteSegment[] = []
  const rows: QuestRouteRow[] = []

  allSteps.forEach((step, stepIndex) => {
    const kind: QuestStepNavKind = isIntroStep(step) ? 'intro' : 'point'
    const state: QuestStepNavState = resolveQuestStepNavState(
      resolveQuestStepNavFlags({
        stepId: step.id,
        index: stepIndex,
        currentIndex,
        unlockedIndex,
        answers,
        postponedStepIds,
        questFinished,
        showFinaleOnly,
      }),
    )
    const number = pointNumber(stepIndex)
    const role = step.pointRole ?? null
    const visual = resolveQuestStepVisualState({ state, kind, role, index: number, total, colors })
    if (kind === 'point') segments.push({ key: step.id, role, visual })

    // Роль — отдельной строкой в листе, поэтому в подписи модели её нет.
    const baseLabel = resolveQuestStepVisualState({ state, kind, role: null, index: number, total, colors })
      .accessibilityLabel
    const roleLabel = kind === 'point' ? getQuestPointRoleAnnotation(step.title, role ?? undefined) : null
    rows.push(
      buildRow({
        key: step.id,
        kind,
        stepIndex,
        numberLabel: kind === 'point' ? String(number) : '',
        title: kind === 'intro' ? questStepPlaceLabel('intro', 0, total) : step.title,
        stateWord: questStepStateWord(state, kind),
        roleLabel,
        baseLabel,
        visual,
      }),
    )
  })

  const finaleState = resolveQuestStepNavState({ active: showFinaleOnly })
  const finaleVisual = resolveQuestStepVisualState({ state: finaleState, kind: 'finale', total, colors })
  rows.push(
    buildRow({
      key: 'finale',
      kind: 'finale',
      stepIndex: -1,
      numberLabel: '',
      title: questStepPlaceLabel('finale', 0, total),
      stateWord: questStepStateWord(finaleState, 'finale'),
      roleLabel: null,
      baseLabel: finaleVisual.accessibilityLabel,
      visual: finaleVisual,
    }),
  )

  return { position, tasks, stripText, stripAccessibilityLabel, segments, rows }
}

function buildRow({
  key,
  kind,
  stepIndex,
  numberLabel,
  title,
  stateWord,
  roleLabel,
  baseLabel,
  visual,
}: {
  key: string
  kind: QuestStepNavKind
  stepIndex: number
  numberLabel: string
  title: string
  stateWord: string
  roleLabel: string | null
  baseLabel: string
  visual: QuestStepVisual
}): QuestRouteRow {
  const disabled = visual.state === 'locked'
  const detail = roleLabel
    ? i18nT('quests:components.quests.questRoute.rowDetail', { role: roleLabel, state: stateWord })
    : stateWord
  // Строка старта и финала уже называется «Старт квеста»/«Финал» — без повтора.
  let label = kind === 'point' ? i18nT('quests:components.quests.questStepState.withTitle', { title, label: baseLabel }) : baseLabel
  if (roleLabel) label = i18nT('quests:components.quests.questRoute.withRole', { label, role: roleLabel })
  if (disabled) label = i18nT('quests:components.quests.questRoute.lockedReason', { label })
  return { key, kind, stepIndex, numberLabel, title, detail, visual, disabled, accessibilityLabel: label }
}
