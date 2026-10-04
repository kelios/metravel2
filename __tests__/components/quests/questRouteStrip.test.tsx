/**
 * #2149: полоса маршрута и лист «Маршрут» на телефоне. До правки кружок
 * нумеровал все точки (1…14), счётчик «Задания» — только обязательные (из 11),
 * роль точки не была видна, а лента кружков считала ширину элемента литералом 35
 * при реальных 44 — активный шаг с 19-го уходил за край.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react-native'
import { ScrollView, StyleSheet } from 'react-native'

import QuestRouteStrip, { QUEST_ROUTE_ROW_MIN_HEIGHT } from '@/components/quests/QuestRouteStrip'
import { buildQuestRouteModel, type QuestRouteStep } from '@/components/quests/questRouteModel'
import { ActiveScrollNav } from '@/components/quests/questWizardShell'
import { getThemedColors } from '@/constants/designSystem'
import { buildQuestCountModel, type QuestPointRole } from '@/utils/questCountModel'

const colors = getThemedColors(false)

// Как luxembourg-melusina: 14 точек, 7 и 11 — по желанию, 14 — финальная.
const ROLES: QuestPointRole[] = Array.from({ length: 14 }, (_, i) =>
  i + 1 === 14 ? 'final' : i + 1 === 7 || i + 1 === 11 ? 'optional' : 'required',
)
const intro: QuestRouteStep = { id: 'intro', title: 'Intro' }
const points: QuestRouteStep[] = ROLES.map((pointRole, i) => ({ id: `p${i + 1}`, title: `Точка-${i + 1}`, pointRole }))
const allSteps = [intro, ...points]

const answered = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 'ok']))

const build = (overrides: Partial<Parameters<typeof buildQuestRouteModel>[0]> = {}) =>
  buildQuestRouteModel({
    allSteps,
    answers: answered(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p8', 'p9', 'p10', 'p11']),
    postponedStepIds: new Set(),
    currentIndex: 12,
    unlockedIndex: 12,
    questFinished: false,
    showFinaleOnly: false,
    countModel: buildQuestCountModel(points, intro),
    completedCount: 10,
    stepsCount: 11,
    colors,
    ...overrides,
  })

afterEach(cleanup)

describe('buildQuestRouteModel (#2149)', () => {
  it('позиция и задания — из одной модели: «Точка 12 из 14 · Задания: 10 / 11»', () => {
    const model = build()
    expect(model.position).toEqual({ kind: 'point', index: 12, total: 14 })
    expect(model.tasks).toEqual({ completed: 10, total: 11 })
    expect(model.stripText).toBe('Точка 12 из 14 · Задания: 10 / 11')
    expect(model.stripAccessibilityLabel).toBe('Маршрут: Точка 12 из 14, задания 10 из 11')
  })

  it('квест без явных ролей — только позиция, без «Задания»', () => {
    const plain = points.map(({ id, title }) => ({ id, title }))
    const model = build({ allSteps: [intro, ...plain], countModel: buildQuestCountModel(plain, intro) })
    expect(model.tasks).toBeNull()
    expect(model.stripText).toBe('Точка 12 из 14')
  })

  it('старт и финал называются словами, а не номером', () => {
    expect(build({ currentIndex: 0 }).stripText).toBe('Старт квеста · Задания: 10 / 11')
    expect(build({ showFinaleOnly: true }).stripText).toBe('Финал · Задания: 10 / 11')
  })

  it('сегмент на каждую точку маршрута без стартовой карточки, роль сохраняется', () => {
    const model = build()
    expect(model.segments).toHaveLength(14)
    expect(model.segments[6].role).toBe('optional')
    expect(model.segments[13].role).toBe('final')
    expect(model.segments[0].visual.state).toBe('done')
    expect(model.segments[11].visual.state).toBe('current')
    expect(model.segments[12].visual.state).toBe('locked')
  })

  it('строка на старт, каждую точку и финал; роль и состояние в подписи, у закрытой — причина', () => {
    const model = build()
    expect(model.rows.map((row) => row.kind)).toEqual(['intro', ...points.map(() => 'point'), 'finale'])
    const seventh = model.rows[7]
    expect(seventh.numberLabel).toBe('7')
    expect(seventh.detail).toBe('Точка по желанию · доступна')
    expect(seventh.accessibilityLabel).toBe('Точка-7: Точка 7 из 14, доступна; Точка по желанию')
    const locked = model.rows[13]
    expect(locked.disabled).toBe(true)
    expect(locked.accessibilityLabel).toBe(
      'Точка-13: Точка 13 из 14, закрыта; Обязательная точка. Сначала пройдите предыдущие точки',
    )
    expect(model.rows[15]).toMatchObject({ kind: 'finale', title: 'Финал', disabled: false })
  })
})

describe('QuestRouteStrip (#2149)', () => {
  const renderStrip = () => {
    const onGoToStep = jest.fn()
    const onShowFinale = jest.fn()
    const view = render(<QuestRouteStrip model={build()} onGoToStep={onGoToStep} onShowFinale={onShowFinale} />)
    return { view, onGoToStep, onShowFinale }
  }

  it('полоса — кнопка ≥ 44 pt с подписью маршрута', () => {
    const { view } = renderStrip()
    const strip = view.getByTestId('quest-route-strip')
    expect(strip.props.accessibilityLabel ?? strip.props['aria-label']).toBeDefined()
    expect(view.getByLabelText('Маршрут: Точка 12 из 14, задания 10 из 11')).toBeTruthy()
    expect((StyleSheet.flatten(strip.props.style) as any).minHeight).toBeGreaterThanOrEqual(QUEST_ROUTE_ROW_MIN_HEIGHT)
  })

  it('лист «Маршрут»: доступная точка открывается, закрытая — нет, финал — через свою строку', () => {
    const { view, onGoToStep, onShowFinale } = renderStrip()
    fireEvent.press(view.getByTestId('quest-route-strip'))

    const row = view.getByTestId('quest-route-row-p3')
    expect((StyleSheet.flatten(row.props.style) as any).minHeight).toBeGreaterThanOrEqual(QUEST_ROUTE_ROW_MIN_HEIGHT)
    fireEvent.press(row)
    expect(onGoToStep).toHaveBeenCalledWith(3)

    fireEvent.press(view.getByTestId('quest-route-strip'))
    fireEvent.press(view.getByTestId('quest-route-row-p13'))
    expect(onGoToStep).toHaveBeenCalledTimes(1)

    fireEvent.press(view.getByTestId('quest-nav-finale'))
    expect(onShowFinale).toHaveBeenCalledTimes(1)
  })
})

describe('ActiveScrollNav — активный шаг в видимой части на длинном маршруте (#2149)', () => {
  it('центрует 25-й элемент из 30 по измеренной раскладке, а не по литералу ширины', () => {
    const scrollTo = jest.spyOn(ScrollView.prototype as any, 'scrollTo').mockImplementation(() => undefined)
    const view = render(
      <ActiveScrollNav activeIndex={25}>
        {Array.from({ length: 30 }, (_, i) => (
          <ScrollView key={`item-${i}`} />
        ))}
      </ActiveScrollNav>,
    )
    act(() => {
      for (let i = 0; i < 30; i += 1) {
        fireEvent(view.getByTestId(`quest-steps-nav-item-${i}`), 'layout', {
          nativeEvent: { layout: { x: i * 126, y: 0, width: 120, height: 44 } },
        })
      }
      fireEvent(view.UNSAFE_getAllByType(ScrollView)[0], 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 44 } },
      })
    })
    // Центр 25-го: 25 × 126 + 60 − 390 / 2 = 3015.
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 3015, animated: true })
    scrollTo.mockRestore()
  })
})
