/**
 * Структурная отметка «точка изменилась» (#1579, backend #1577).
 */

import { render, fireEvent, waitFor } from '@testing-library/react-native'

import QuestStepInaccuracyAction from '@/components/quests/QuestStepInaccuracyAction'

const mockReport = jest.fn()
const mockRequireAuth = jest.fn()
let mockIsAuthenticated = true

jest.mock('@/api/questStepInaccuracy', () => ({
  reportQuestStepInaccuracy: (...args: unknown[]) => mockReport(...args),
}))

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    authReady: true,
    requireAuth: mockRequireAuth,
  }),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    text: '#111827',
    textMuted: '#6b7280',
    surface: '#ffffff',
    backgroundSecondary: '#f3f4f6',
    borderLight: '#e5e7eb',
    primary: '#2563eb',
    primaryText: '#1d4ed8',
    danger: '#dc2626',
  }),
}))

describe('QuestStepInaccuracyAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAuthenticated = true
    mockReport.mockResolvedValue({ stepId: 903, created: true, reportCount: 1, needsReview: false })
  })

  it('sends a structured flag addressed by the numeric step pk', async () => {
    const view = render(<QuestStepInaccuracyAction stepNumericId={903} />)
    fireEvent.press(view.getByTestId('quest-step-inaccuracy-button'))

    await waitFor(() => expect(mockReport).toHaveBeenCalledWith(903))
    expect(view.getByTestId('quest-step-inaccuracy-message')).toHaveTextContent(
      'Спасибо, отметка отправлена — точку проверим.',
    )
    // Отметка стоит: кнопки больше нет, второе нажатие невозможно.
    expect(view.queryByTestId('quest-step-inaccuracy-button')).toBeNull()
  })

  it('says the point is already flagged when the server answers with an existing report', async () => {
    mockReport.mockResolvedValue({ stepId: 903, created: false, reportCount: 2, needsReview: true })

    const view = render(<QuestStepInaccuracyAction stepNumericId={903} />)
    fireEvent.press(view.getByTestId('quest-step-inaccuracy-button'))

    await waitFor(() =>
      expect(view.getByTestId('quest-step-inaccuracy-message')).toHaveTextContent(
        'Вы уже отмечали эту точку.',
      ),
    )
  })

  it('routes a guest into the existing auth entry without sending anything', () => {
    mockIsAuthenticated = false

    const view = render(<QuestStepInaccuracyAction stepNumericId={903} />)
    fireEvent.press(view.getByTestId('quest-step-inaccuracy-button'))

    expect(mockRequireAuth).toHaveBeenCalledTimes(1)
    expect(mockReport).not.toHaveBeenCalled()
  })

  it('reports a network failure without breaking the run and allows a retry', async () => {
    mockReport.mockRejectedValueOnce(new Error('network'))

    const view = render(<QuestStepInaccuracyAction stepNumericId={903} />)
    fireEvent.press(view.getByTestId('quest-step-inaccuracy-button'))

    await waitFor(() =>
      expect(view.getByTestId('quest-step-inaccuracy-message')).toHaveTextContent(
        'Не удалось отправить отметку. Попробуйте позже.',
      ),
    )
    // Прохождение не тронуто: действие осталось доступным.
    expect(view.getByTestId('quest-step-inaccuracy-button')).toBeTruthy()

    fireEvent.press(view.getByTestId('quest-step-inaccuracy-button'))
    await waitFor(() => expect(mockReport).toHaveBeenCalledTimes(2))
  })
})
