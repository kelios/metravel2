/**
 * #1633: ссылка «Пропустить» переносит игрока вперёд, но точку с гейта финала
 * НЕ снимает — в отличие от «Пропустить точку» (#1432) и приглашения уйти со
 * сломанного шага (#1430). До этой правки игрок доходил до последней точки
 * маршрута и упирался в тупик: финала нет, объяснения нет, выхода нет.
 * Разбор прохождений 24–28.08.2026: 4 из 6 закончились ровно так, 0 засчитано.
 */
import { fireEvent, render } from '@testing-library/react-native'

import { QuestStepCard } from '@/components/quests/questWizardStepCard'
import { createQuestWizardStyles } from '@/components/quests/questWizardStyles'
import { getThemedColors } from '@/constants/designSystem'
import { buildAnswerChecker } from '@/utils/questAdapters'

const colors = getThemedColors(false) as any
const styles = createQuestWizardStyles(colors, true, 390)

const renderCard = (overrides: Record<string, unknown> = {}) => {
  const props = {
    colors,
    styles,
    step: {
      id: '7-simeonovskiy-sobor',
      title: 'Свято-Симеоновский собор',
      location: 'Брест',
      story: 'История',
      task: 'Сколько куполов?',
      answer: buildAnswerChecker('range', '{"min":4,"max":6}'),
      lat: 52.09,
      lng: 23.69,
    },
    index: 7,
    attempts: 0,
    hintVisible: false,
    continueLabel: 'К финалу',
    onContinue: jest.fn(),
    onSubmit: jest.fn(),
    onWrongAttempt: jest.fn(),
    onToggleHint: jest.fn(),
    onSkip: jest.fn(),
    onSkipFarStep: jest.fn(),
    onSkipStuckStep: jest.fn(),
    onFinishHere: jest.fn(),
    onGoToStep: jest.fn(),
    showMap: false,
    onToggleMap: jest.fn(),
    showLocationControls: false,
    pendingBehind: [{ id: '5-nikolaevskaya-cerkov', title: 'Свято-Николаевская церковь', index: 1 }],
    ...overrides,
  } as any

  return { ...render(<QuestStepCard {...props} />), props }
}

describe('QuestStepCard — долг маршрута перед финалом', () => {
  it('называет отложенную точку и даёт вернуться к ней', () => {
    const screen = renderCard()

    expect(screen.getByTestId('quest-step-pending-notice')).toBeTruthy()
    fireEvent.press(screen.getByTestId('quest-step-pending-go-5-nikolaevskaya-cerkov'))

    expect(screen.props.onGoToStep).toHaveBeenCalledWith(1)
  })

  it('даёт выход на финал, не завися от блока далёкой точки', () => {
    // «Завершить квест здесь» до #1633 рисовалась только внутри блока о
    // расстоянии (`showFarStepBlock`), поэтому игрок в тупике её не видел.
    const screen = renderCard({ isFarStep: false, approachLeg: null, canFinishHere: false })

    fireEvent.press(screen.getByTestId('quest-step-pending-finish'))

    expect(screen.props.onFinishHere).toHaveBeenCalledTimes(1)
  })

  it('молчит, когда долга нет', () => {
    const screen = renderCard({ pendingBehind: [] })

    expect(screen.queryByTestId('quest-step-pending-notice')).toBeNull()
  })

  it('молчит на уже отвеченной точке: там место занимает переход к финалу', () => {
    const screen = renderCard({ savedAnswer: '5' })

    expect(screen.queryByTestId('quest-step-pending-notice')).toBeNull()
  })
})
