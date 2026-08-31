/**
 * Точка входа отметки «точка изменилась» живёт на карточке шага (#1579).
 *
 * Проверяется именно монтирование внутри реальной карточки: действие
 * адресуется числовым PK, которого у синтетического интро и у офлайн-бандла
 * нет, — там кнопки быть не должно вовсе.
 */
import { render, fireEvent, waitFor } from '@testing-library/react-native'

import { QuestStepCard } from '@/components/quests/questWizardStepCard'
import { createQuestWizardStyles } from '@/components/quests/questWizardStyles'
import { getThemedColors } from '@/constants/designSystem'
import { buildAnswerChecker } from '@/utils/questAdapters'

const mockReport = jest.fn()

jest.mock('@/api/questStepInaccuracy', () => ({
  reportQuestStepInaccuracy: (...args: unknown[]) => mockReport(...args),
}))

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ isAuthenticated: true, authReady: true, requireAuth: jest.fn() }),
}))

const colors = getThemedColors(false) as any
const styles = createQuestWizardStyles(colors, true, 390)

const cardElement = (step: Record<string, unknown>) => (
    <QuestStepCard
      {...({
        colors,
        styles,
        step: {
          title: 'Прикуривающий',
          location: 'Минск',
          story: 'История',
          task: 'Сколько пуговиц?',
          answer: buildAnswerChecker('range', '{"min":2,"max":5}'),
          lat: 53.9,
          lng: 27.56,
          ...step,
        },
        index: 3,
        attempts: 0,
        hintVisible: false,
        continueLabel: 'Дальше',
        onContinue: jest.fn(),
        onSubmit: jest.fn(),
        onWrongAttempt: jest.fn(),
        onToggleHint: jest.fn(),
        onSkip: jest.fn(),
        onSkipFarStep: jest.fn(),
        onSkipStuckStep: jest.fn(),
        showMap: false,
        onToggleMap: jest.fn(),
        showLocationControls: false,
      } as any)}
    />
  )

const renderCard = (step: Record<string, unknown>) => render(cardElement(step))

describe('quest step card inaccuracy entry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReport.mockResolvedValue({ stepId: 903, created: true, reportCount: 1, needsReview: false })
  })

  it('offers the structured flag on a real route point', () => {
    const view = renderCard({ id: '5-prikurivayushchiy', numericId: 903 })

    expect(view.getByTestId('quest-step-inaccuracy-button')).toBeTruthy()
    // Подпись отличает назначение от свободнотекстовой формы #1480
    // («Сообщить о неточности»), иначе игрок выберет наугад.
    expect(view.getByLabelText('Точка изменилась')).toBeTruthy()
  })

  it('does not offer it without a numeric pk — there is nothing to address', () => {
    const view = renderCard({ id: '5-prikurivayushchiy' })
    expect(view.queryByTestId('quest-step-inaccuracy-button')).toBeNull()
  })

  it('does not offer it on the synthetic intro step', () => {
    const view = renderCard({ id: 'intro', numericId: 900 })
    expect(view.queryByTestId('quest-step-inaccuracy-button')).toBeNull()
  })

  it('does not carry the flag outcome of one point over to the next one', async () => {
    // Карточка шага НЕ перемонтируется при переходе между точками — она сама
    // сбрасывает своё состояние эффектом на `step.id`. Без собственной
    // идентичности у действия следующая точка открывалась бы с чужим
    // «спасибо, отметка отправлена» и вообще без кнопки.
    const view = renderCard({ id: '5-prikurivayushchiy', numericId: 903 })
    fireEvent.press(view.getByTestId('quest-step-inaccuracy-button'))

    await waitFor(() =>
      expect(view.getByTestId('quest-step-inaccuracy-message')).toHaveTextContent(
        'Спасибо, отметка отправлена — точку проверим.',
      ),
    )

    view.rerender(cardElement({ id: '6-yakub-kolas', numericId: 904 }))

    expect(view.queryByTestId('quest-step-inaccuracy-message')).toBeNull()
    expect(view.getByTestId('quest-step-inaccuracy-button')).toBeTruthy()

    fireEvent.press(view.getByTestId('quest-step-inaccuracy-button'))
    await waitFor(() => expect(mockReport).toHaveBeenLastCalledWith(904))
  })
})
