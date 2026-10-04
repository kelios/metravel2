/**
 * #2146: состояние точки маршрута квеста — одна модель на токенах темы.
 * Держит пороги §10 `docs/features/mobile-screen-shell-mock.md` в светлой и
 * тёмной теме: падает при смене токена, цвета значка или формы состояния.
 *
 * До #2146 пройденный кружок давал 1,40:1 к панели и 1,45:1 к непройденному в
 * тёмной теме, цифра на нём — 1,69:1; на пройденном квесте все кружки были
 * одинаково серыми, а подписи состояния для диктора не было вовсе.
 */
import {
  type QuestStepNavState,
  type QuestStepVisual,
  resolveQuestStepNavState,
  resolveQuestStepVisualState,
} from '@/components/quests/questStepVisualState'
import { getThemedColors } from '@/constants/designSystem'
import { checkContrast } from '@/utils/a11y'

const THEMES = [
  ['light', getThemedColors(false)],
  ['dark', getThemedColors(true)],
] as const

const STATES: QuestStepNavState[] = ['done', 'current', 'available', 'locked', 'pending']
// «Закрыта» — неактивный элемент: WCAG 1.4.3/1.4.11 порог к нему не применяют.
const ENABLED = STATES.filter((state) => state !== 'locked')

// Соседи — состояния, которые встречаются рядом в одном ряду маршрута.
const NEIGHBOURS: Array<[QuestStepNavState, QuestStepNavState]> = [
  ['done', 'current'],
  ['done', 'available'],
  ['done', 'pending'],
  ['current', 'available'],
  ['current', 'pending'],
  ['available', 'locked'],
  ['available', 'pending'],
  ['locked', 'pending'],
]

const boundary = (visual: QuestStepVisual) => (visual.borderWidth > 0 ? visual.borderColor : visual.backgroundColor)
const shape = (visual: QuestStepVisual) => `${visual.fill}/${visual.glyph}`

describe('resolveQuestStepVisualState — пороги контраста (#2146)', () => {
  it.each(THEMES)('%s: цвета — hex-токены темы, не CSS-переменные и не градиенты', (_theme, colors) => {
    for (const state of STATES) {
      const visual = resolveQuestStepVisualState({ state, colors })
      for (const value of [visual.backgroundColor, visual.borderColor, visual.glyphColor]) {
        expect(value).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
  })

  it.each(THEMES)('%s: значок или номер на своей заливке ≥ 4,5:1 у активных состояний', (_theme, colors) => {
    for (const state of ENABLED) {
      const visual = resolveQuestStepVisualState({ state, colors })
      expect({ state, ratio: checkContrast(visual.glyphColor, visual.backgroundColor) >= 4.5 }).toEqual({
        state,
        ratio: true,
      })
    }
  })

  it.each(THEMES)('%s: граница точки против панели ≥ 3:1 у активных состояний', (_theme, colors) => {
    for (const state of ENABLED) {
      const visual = resolveQuestStepVisualState({ state, colors })
      expect({ state, ratio: checkContrast(boundary(visual), colors.surface) >= 3 }).toEqual({ state, ratio: true })
    }
  })

  it.each(THEMES)('%s: соседние состояния различаются яркостью ≥ 3:1 или формой — не одним цветом', (_theme, colors) => {
    for (const [a, b] of NEIGHBOURS) {
      const va = resolveQuestStepVisualState({ state: a, colors })
      const vb = resolveQuestStepVisualState({ state: b, colors })
      const byFill = checkContrast(va.backgroundColor, vb.backgroundColor) >= 3
      const byBoundary = checkContrast(boundary(va), boundary(vb)) >= 3
      const byShape = shape(va) !== shape(vb)
      expect({ pair: `${a}↔${b}`, distinct: byFill || byBoundary || byShape }).toEqual({ pair: `${a}↔${b}`, distinct: true })
    }
  })

  it.each(THEMES)('%s: пройденная — сплошной success с галочкой (а не полупрозрачная заливка)', (_theme, colors) => {
    const visual = resolveQuestStepVisualState({ state: 'done', colors })
    expect(visual).toMatchObject({ fill: 'solid', backgroundColor: colors.success, glyph: 'check' })
  })

  it('необязательная точка — пунктир у контурных состояний, сплошная заливка без контура', () => {
    const colors = getThemedColors(false)
    expect(resolveQuestStepVisualState({ state: 'available', role: 'optional', colors }).borderStyle).toBe('dashed')
    expect(resolveQuestStepVisualState({ state: 'available', role: 'required', colors }).borderStyle).toBe('solid')
    expect(resolveQuestStepVisualState({ state: 'done', role: 'optional', colors }).borderWidth).toBe(0)
  })
})

describe('resolveQuestStepVisualState — подпись для диктора (#2146)', () => {
  const colors = getThemedColors(false)

  it('называет позицию и состояние точки', () => {
    const label = (state: QuestStepNavState, role?: 'optional') =>
      resolveQuestStepVisualState({ state, index: 3, total: 14, role, colors }).accessibilityLabel
    expect(label('done')).toBe('Точка 3 из 14, пройдена')
    expect(label('current')).toBe('Точка 3 из 14, текущая')
    expect(label('available')).toBe('Точка 3 из 14, доступна')
    expect(label('locked')).toBe('Точка 3 из 14, закрыта')
    expect(label('pending')).toBe('Точка 3 из 14, отложена, ждёт ответа')
    expect(label('done', 'optional')).toBe('Точка 3 из 14, пройдена; необязательная')
  })

  it('старт и финал — со своим значком и подписью', () => {
    expect(resolveQuestStepVisualState({ state: 'current', kind: 'intro', colors })).toMatchObject({
      glyph: 'play',
      accessibilityLabel: 'Старт квеста, текущий',
    })
    expect(resolveQuestStepVisualState({ state: 'available', kind: 'finale', colors })).toMatchObject({
      glyph: 'flag',
      accessibilityLabel: 'Финал, доступен',
    })
  })
})

describe('resolveQuestStepNavState', () => {
  it('текущая сильнее пройденной, пройденная — отложенной, закрытая — доступной', () => {
    expect(resolveQuestStepNavState({ active: true, done: true })).toBe('current')
    expect(resolveQuestStepNavState({ done: true, pending: true })).toBe('done')
    expect(resolveQuestStepNavState({ pending: true, unlocked: false })).toBe('pending')
    expect(resolveQuestStepNavState({ unlocked: false })).toBe('locked')
    expect(resolveQuestStepNavState({})).toBe('available')
  })
})
