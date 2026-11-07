/**
 * #2885: панель «Помощник автора» на шаге публикации — состояния idle / loading /
 * variants / limit / unavailable и вставка варианта в поле через `onInsert`.
 */
import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'

import { AuthorDraftError } from '@/api/aiAssist/authorDraft'
import { AI_AUTHOR_DRAFT_PANEL_MIN_TEXT_CHARS } from '@/api/aiAssist/policy'

const mockRequest = jest.fn()
jest.mock('@/api/aiAssist/authorDraft', () => {
  const actual = jest.requireActual('@/api/aiAssist/authorDraft')
  return { ...actual, requestAuthorDraft: (...args: unknown[]) => mockRequest(...args) }
})
jest.mock('@/utils/aiPicksConfig', () => ({ getAiPicksBaseUrl: () => 'https://assist.test' }))
jest.mock('@/i18n', () => {
  const actual = jest.requireActual('@/i18n')
  return { ...actual, getActiveLocale: () => 'pl' }
})

import AuthorAssistantPanel from '@/components/travel/upsert/AuthorAssistantPanel'

const LONG_TEXT = 'Гродно, замок и Неман. '.repeat(60)

describe('AuthorAssistantPanel (#2885)', () => {
  beforeEach(() => mockRequest.mockReset())

  it('текст короче порога: кнопки неактивны, подсказка с числами, запросов нет', async () => {
    const screen = await render(<AuthorAssistantPanel text="Коротко" onInsert={jest.fn()} />)
    expect(screen.getByTestId('author-assistant-too-short').props.children).toContain(String(AI_AUTHOR_DRAFT_PANEL_MIN_TEXT_CHARS))
    await fireEvent.press(screen.getByTestId('author-assistant-suggest-title'))
    expect(mockRequest).not.toHaveBeenCalled()
    expect(screen.getByTestId('author-assistant-suggest-meta').props.accessibilityState?.disabled).toBe(true)
  })

  it('заголовок: loading → варианты → «Вставить» отдаёт kind и текст, показывает «вставлено» и остаток', async () => {
    let resolve: (value: { variants: string[]; remaining: number | null }) => void = () => {}
    mockRequest.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    const onInsert = jest.fn()
    const screen = await render(<AuthorAssistantPanel text={LONG_TEXT} onInsert={onInsert} />)
    expect(screen.queryByTestId('author-assistant-too-short')).toBeNull()

    await fireEvent.press(screen.getByTestId('author-assistant-suggest-title'))
    expect(screen.getByTestId('author-assistant-loading')).toBeTruthy()
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ baseUrl: 'https://assist.test', kind: 'title', locale: 'pl', text: LONG_TEXT }))
    // Пока идёт запрос, вторая кнопка не стартует параллельный.
    await fireEvent.press(screen.getByTestId('author-assistant-suggest-meta'))
    expect(mockRequest).toHaveBeenCalledTimes(1)

    await act(async () => resolve({ variants: ['Гродно за два дня', 'Замок над Неманом'], remaining: 4 }))
    await waitFor(() => expect(screen.getByTestId('author-assistant-variants')).toBeTruthy())
    expect(screen.getByText('Гродно за два дня')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('author-assistant-insert-title-1'))
    expect(onInsert).toHaveBeenCalledWith('title', 'Замок над Неманом')
    expect(screen.getByTestId('author-assistant-inserted')).toBeTruthy()
    expect(screen.getByText(/4/)).toBeTruthy()
  })

  it('лид: после вставки — подпись про первый абзац описания', async () => {
    mockRequest.mockResolvedValueOnce({ variants: ['Лид про Гродно и детей.'], remaining: null })
    const onInsert = jest.fn()
    const screen = await render(<AuthorAssistantPanel text={LONG_TEXT} onInsert={onInsert} />)
    await fireEvent.press(screen.getByTestId('author-assistant-suggest-lead'))
    await waitFor(() => expect(screen.getByTestId('author-assistant-insert-lead-0')).toBeTruthy())
    await fireEvent.press(screen.getByTestId('author-assistant-insert-lead-0'))
    expect(onInsert).toHaveBeenCalledWith('lead', 'Лид про Гродно и детей.')
    expect(screen.getByTestId('author-assistant-inserted').props.children).toMatch(/абзац/)
  })

  it('429 limit → состояние «лимит», 503 → «недоступен», после ошибки кнопки снова активны', async () => {
    mockRequest.mockRejectedValueOnce(new AuthorDraftError('limit', 'limit', { status: 429 }))
    const screen = await render(<AuthorAssistantPanel text={LONG_TEXT} onInsert={jest.fn()} />)
    await fireEvent.press(screen.getByTestId('author-assistant-suggest-meta'))
    await waitFor(() => expect(screen.getByTestId('author-assistant-limit')).toBeTruthy())
    expect(screen.queryByTestId('author-assistant-variants')).toBeNull()

    mockRequest.mockRejectedValueOnce(new AuthorDraftError('unavailable', 'down', { status: 503 }))
    await fireEvent.press(screen.getByTestId('author-assistant-suggest-meta'))
    await waitFor(() => expect(screen.getByTestId('author-assistant-unavailable')).toBeTruthy())
    expect(screen.queryByTestId('author-assistant-limit')).toBeNull()
    expect(mockRequest).toHaveBeenCalledTimes(2)
  })
})
