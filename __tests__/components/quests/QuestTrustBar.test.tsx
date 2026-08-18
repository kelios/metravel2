/**
 * #1480: раскрытие об ИИ на стартовом экране квеста свёрнуто в строку рядом с
 * проверяемыми фактами о маршруте, а «Сообщить о неточности» уходит в реальный
 * контракт обратной связи (`sendFeedback` → POST /api/feedback/).
 */
import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'

const mockSendFeedback = jest.fn()
const mockShowToastMessage = jest.fn()

jest.mock('@/api/misc', () => ({
  sendFeedback: (...args: any[]) => mockSendFeedback(...args),
}))
jest.mock('@/utils/toast', () => ({
  showToastMessage: (...args: any[]) => mockShowToastMessage(...args),
}))

import QuestTrustBar from '@/components/quests/QuestTrustBar'

const renderBar = () =>
  render(
    <QuestTrustBar
      pointsCount={7}
      questTitle="Город на сваях"
      questId="amsterdam-on-piles"
      cityId="45"
    />,
  )

describe('QuestTrustBar', () => {
  beforeEach(() => {
    mockSendFeedback.mockReset()
    mockShowToastMessage.mockReset()
    mockSendFeedback.mockResolvedValue('ok')
  })

  it('показывает факты маршрута и держит раскрытие об ИИ свёрнутым', () => {
    const { getByText, getByTestId, queryByTestId } = renderBar()

    expect(getByText('7 точек')).toBeTruthy()
    expect(getByText('Точки сверены с картой')).toBeTruthy()

    expect(getByTestId('quest-ai-disclosure-toggle')).toBeTruthy()
    // Полный текст предупреждения не занимает первый экран, пока его не раскрыли.
    expect(queryByTestId('quest-ai-disclosure')).toBeNull()
    expect(queryByTestId('quest-report-inaccuracy')).toBeNull()
  })

  it('раскрывает полный текст и кнопку отчёта по нажатию на строку', () => {
    const { getByTestId, getByText } = renderBar()

    fireEvent.press(getByTestId('quest-ai-disclosure-toggle'))

    expect(getByTestId('quest-ai-disclosure')).toBeTruthy()
    expect(getByText(/подготовлены с использованием искусственного интеллекта/)).toBeTruthy()
    expect(getByTestId('quest-report-inaccuracy')).toBeTruthy()
  })

  it('отправляет отчёт о неточности с контекстом квеста', async () => {
    const { getByTestId, queryByTestId } = renderBar()

    fireEvent.press(getByTestId('quest-ai-disclosure-toggle'))
    fireEvent.press(getByTestId('quest-report-inaccuracy'))

    fireEvent.changeText(getByTestId('quest-inaccuracy-report-name'), 'Игрок')
    fireEvent.changeText(getByTestId('quest-inaccuracy-report-email'), 'player@example.com')
    fireEvent.changeText(getByTestId('quest-inaccuracy-report-message'), 'Точка 3 стоит на парковке')
    fireEvent.press(getByTestId('quest-inaccuracy-report-consent'))

    await act(async () => {
      fireEvent.press(getByTestId('quest-inaccuracy-report-submit'))
      await Promise.resolve()
    })

    expect(mockSendFeedback).toHaveBeenCalledTimes(1)
    const [name, email, message] = mockSendFeedback.mock.calls[0]
    expect(name).toBe('Игрок')
    expect(email).toBe('player@example.com')
    expect(message).toContain('Город на сваях')
    expect(message).toContain('/quests/45/amsterdam-on-piles')
    expect(message).toContain('Точка 3 стоит на парковке')

    // Форма закрывается, игрок получает подтверждение.
    expect(queryByTestId('quest-inaccuracy-report-modal')).toBeNull()
    expect(mockShowToastMessage).toHaveBeenCalled()
  })

  it('не отправляет отчёт без согласия на обработку данных', async () => {
    const { getByTestId } = renderBar()

    fireEvent.press(getByTestId('quest-ai-disclosure-toggle'))
    fireEvent.press(getByTestId('quest-report-inaccuracy'))

    fireEvent.changeText(getByTestId('quest-inaccuracy-report-name'), 'Игрок')
    fireEvent.changeText(getByTestId('quest-inaccuracy-report-email'), 'player@example.com')
    fireEvent.changeText(getByTestId('quest-inaccuracy-report-message'), 'Ошибка в дате')

    await act(async () => {
      fireEvent.press(getByTestId('quest-inaccuracy-report-submit'))
      await Promise.resolve()
    })

    expect(mockSendFeedback).not.toHaveBeenCalled()
    expect(getByTestId('quest-inaccuracy-report-error')).toBeTruthy()
  })
})
