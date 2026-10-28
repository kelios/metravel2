import { getOnlyHost } from '@/__tests__/helpers/hostQueries'
/**
 * #1480: раскрытие об ИИ на стартовом экране квеста свёрнуто в строку рядом с
 * проверяемыми фактами о маршруте, а «Сообщить о неточности» уходит в реальный
 * контракт обратной связи (`sendFeedback` → POST /api/feedback/).
 */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, within } from '@testing-library/react-native'
import { KeyboardAvoidingView, Platform } from 'react-native'

const mockSendFeedback = jest.fn()
const mockShowToastMessage = jest.fn()

jest.mock('@/api/misc', () => ({
  sendFeedback: (...args: any[]) => mockSendFeedback(...args),
}))
jest.mock('@/utils/toast', () => ({
  showToastMessage: (...args: any[]) => mockShowToastMessage(...args),
}))

import QuestTrustBar from '@/components/quests/QuestTrustBar'

const renderBar = async () =>
  await render(
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

  it('показывает факты маршрута и держит раскрытие об ИИ свёрнутым', async () => {
    const { getByText, getByTestId, queryByTestId } = await renderBar()

    expect(getByText('7 точек')).toBeTruthy()
    expect(getByText('Точки сверены с картой')).toBeTruthy()

    expect(getByTestId('quest-ai-disclosure-toggle')).toBeTruthy()
    // Полный текст предупреждения не занимает первый экран, пока его не раскрыли.
    expect(queryByTestId('quest-ai-disclosure')).toBeNull()
    expect(queryByTestId('quest-report-inaccuracy')).toBeNull()
  })

  it('раскрывает полный текст и кнопку отчёта по нажатию на строку', async () => {
    const { getByTestId, getByText } = await renderBar()

    await fireEvent.press(getByTestId('quest-ai-disclosure-toggle'))

    expect(getByTestId('quest-ai-disclosure')).toBeTruthy()
    expect(getByText(/подготовлены с использованием искусственного интеллекта/)).toBeTruthy()
    expect(getByTestId('quest-report-inaccuracy')).toBeTruthy()
  })

  it('отправляет отчёт о неточности с контекстом квеста', async () => {
    const { getByTestId, queryByTestId } = await renderBar()

    await fireEvent.press(getByTestId('quest-ai-disclosure-toggle'))
    await fireEvent.press(getByTestId('quest-report-inaccuracy'))

    await fireEvent.changeText(getByTestId('quest-inaccuracy-report-name'), 'Игрок')
    await fireEvent.changeText(getByTestId('quest-inaccuracy-report-email'), 'player@example.com')
    await fireEvent.changeText(getByTestId('quest-inaccuracy-report-message'), 'Точка 3 стоит на парковке')
    await fireEvent.press(getByTestId('quest-inaccuracy-report-consent'))

    await act(async () => {
      await fireEvent.press(getByTestId('quest-inaccuracy-report-submit'))
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
    const { getByTestId } = await renderBar()

    await fireEvent.press(getByTestId('quest-ai-disclosure-toggle'))
    await fireEvent.press(getByTestId('quest-report-inaccuracy'))

    await fireEvent.changeText(getByTestId('quest-inaccuracy-report-name'), 'Игрок')
    await fireEvent.changeText(getByTestId('quest-inaccuracy-report-email'), 'player@example.com')
    await fireEvent.changeText(getByTestId('quest-inaccuracy-report-message'), 'Ошибка в дате')

    await act(async () => {
      await fireEvent.press(getByTestId('quest-inaccuracy-report-submit'))
      await Promise.resolve()
    })

    expect(mockSendFeedback).not.toHaveBeenCalled()
    expect(getByTestId('quest-inaccuracy-report-error')).toBeTruthy()
  })

  it('не закрывает iOS-клавиатуру при прокрутке к кнопке отправки', async () => {
    const { getByTestId, container: hostContainer } = await renderBar()

    await fireEvent.press(getByTestId('quest-ai-disclosure-toggle'))
    await fireEvent.press(getByTestId('quest-report-inaccuracy'))

    expect(getOnlyHost(hostContainer, node => node.type === "RCTScrollView").props.keyboardDismissMode).toBe('none')
  })

  it('держит кнопку отправки в закреплённом подвале вне ScrollView', async () => {
    // Регрессия #1480 (iOS-приёмка 22.08.2026): пока кнопка «Отправить» жила
    // внутри ScrollView, на iOS она перерастала maxHeight шита и уезжала под
    // клавиатуру. Подвал вне списка полей держит её над клавиатурой.
    const { getByTestId, container: hostContainer } = await renderBar()

    await fireEvent.press(getByTestId('quest-ai-disclosure-toggle'))
    await fireEvent.press(getByTestId('quest-report-inaccuracy'))

    const scrollView = getOnlyHost(hostContainer, node => node.type === "RCTScrollView")
    const scoped = within(scrollView)
    // Поля живут внутри прокручиваемого списка…
    expect(scoped.getByTestId('quest-inaccuracy-report-message')).toBeTruthy()
    // …а кнопка отправки — снаружи, в закреплённом подвале.
    expect(scoped.queryByTestId('quest-inaccuracy-report-submit')).toBeNull()
    expect(getByTestId('quest-inaccuracy-report-submit')).toBeTruthy()
  })

  it.each([
    ['android', 'height'],
    ['ios', 'padding'],
    ['web', undefined],
  ] as const)('использует для %s контракт KeyboardAvoidingView %s', async (platform, behavior) => {
    const originalPlatform = Platform.OS
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform })

    try {
      const { getByTestId } = await renderBar()
      await fireEvent.press(getByTestId('quest-ai-disclosure-toggle'))
      await fireEvent.press(getByTestId('quest-report-inaccuracy'))

      expect(mockAvoiderProps.has('report')).toBe(true)
      expect(mockAvoiderProps.get('report').behavior).toBe(behavior)
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform })
    }
  })

  it('сохраняет Autofill и связывает e-mail с узким тематическим WebKit-контрактом', async () => {
    const originalPlatform = Platform.OS
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })

    try {
      const { getByPlaceholderText, getByTestId } = await renderBar()
      await fireEvent.press(getByTestId('quest-ai-disclosure-toggle'))
      await fireEvent.press(getByTestId('quest-report-inaccuracy'))

      const emailInput = getByPlaceholderText(/e-mail/i)
      expect(emailInput.props.autoComplete).toBe('email')
      expect(emailInput.props.dataSet).toEqual({ questReportField: 'email' })
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform })
    }

    const css = fs.readFileSync(path.join(process.cwd(), 'app', 'global.css'), 'utf8')
    const selector = '[data-quest-report-field="email"]'

    expect(css).toContain(`${selector}:-webkit-autofill,`)
    expect(css).toContain(`${selector}:-webkit-autofill:hover,`)
    expect(css).toContain(`${selector}:-webkit-autofill:focus {`)

    const autofillRule = css.match(
      /\[data-quest-report-field="email"\]:-webkit-autofill,[\s\S]*?\{([\s\S]*?)\}/,
    )?.[1]
    expect(autofillRule).toContain('-webkit-text-fill-color: var(--color-text)')
    expect(autofillRule).toContain('caret-color: var(--color-text)')
    expect(autofillRule).toContain('border-color: var(--color-border)')
    expect(autofillRule).toContain('background-color: var(--color-background)')
    expect(autofillRule).toContain('var(--color-background) inset')
  })
})

// RN 0.8x отдаёт KeyboardAvoidingView геттером, поэтому подмена экспорта
// не попадает в уже связанный класс. Смотрим props самого render.
const renderKeyboardAvoidingView = KeyboardAvoidingView.prototype.render
const mockAvoiderProps = new Map<string, any>()
let restoreKeyboardAvoidingView: (() => void) | null = null
beforeEach(() => {
  mockAvoiderProps.clear()
  const spy = jest.spyOn(KeyboardAvoidingView.prototype, 'render').mockImplementation(function (this: KeyboardAvoidingView) {
    mockAvoiderProps.set('report', this.props)
    return renderKeyboardAvoidingView.call(this)
  })
  restoreKeyboardAvoidingView = () => spy.mockRestore()
})
afterEach(() => {
  restoreKeyboardAvoidingView?.()
  restoreKeyboardAvoidingView = null
})
