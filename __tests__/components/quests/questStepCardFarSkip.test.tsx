/**
 * #1432: у далёкой точки два разных выхода, и они не взаимозаменяемы.
 * «Пропустить точку» обещает, что квест засчитается и без неё, поэтому она
 * обязана уходить в `onSkipFarStep` — обработчик, снимающий точку с гейта
 * финала. Обычная ссылка «Пропустить» такого обещания не даёт и остаётся
 * навигацией (`onSkip`, территория #1430).
 */
import { fireEvent, render } from '@testing-library/react-native'

import { QuestStepCard } from '@/components/quests/questWizardStepCard'
import { createQuestWizardStyles } from '@/components/quests/questWizardStyles'
import { getThemedColors } from '@/constants/designSystem'
import { buildAnswerChecker } from '@/utils/questAdapters'

const colors = getThemedColors(false) as any
const styles = createQuestWizardStyles(colors, true, 390)

const farLeg = {
  meters: 1085,
  km: 1.085,
  walkMinutes: 13,
  mode: 'foot' as const,
  notable: true,
  far: true,
}

const renderFarStepCard = () => {
  const props = {
    colors,
    styles,
    step: {
      id: '5-prikurivayushchiy',
      title: 'Прикуривающий',
      location: 'Минск',
      story: 'История',
      task: 'Сколько пуговиц на шинели?',
      answer: buildAnswerChecker('range', '{"min":2,"max":5}'),
      lat: 53.9,
      lng: 27.56,
    },
    index: 5,
    attempts: 0,
    hintVisible: false,
    continueLabel: 'Дальше',
    onContinue: jest.fn(),
    onSubmit: jest.fn(),
    onWrongAttempt: jest.fn(),
    onToggleHint: jest.fn(),
    onSkip: jest.fn(),
    onSkipFarStep: jest.fn(),
    approachLeg: farLeg,
    isFarStep: true,
    canFinishHere: false,
    onFinishHere: jest.fn(),
    showMap: false,
    onToggleMap: jest.fn(),
    showLocationControls: false,
  } as any

  return { ...render(<QuestStepCard {...props} />), props }
}

describe('QuestStepCard — далёкая точка', () => {
  it('«Пропустить точку» уходит в обработчик, снимающий точку с гейта финала', () => {
    const screen = renderFarStepCard()

    fireEvent.press(screen.getByTestId('quest-step-far-skip'))

    expect(screen.props.onSkipFarStep).toHaveBeenCalledTimes(1)
    expect(screen.props.onSkip).not.toHaveBeenCalled()
  })

  it('в блоке о расстоянии нет «Завершить квест здесь», пока впереди есть близкие точки', () => {
    const screen = renderFarStepCard()

    expect(screen.queryByTestId('quest-step-finish-here')).toBeNull()
  })
})
