/**
 * #2885: карточка «SEO-описание» на шаге публикации — поле `meta_description` со
 * счётчиком до 160, панель помощника только под флагом, вставка вариантов в поля формы.
 */
import React, { useState } from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'

import type { TravelFormData } from '@/types/types'
import { getEmptyFormData } from '@/utils/travelFormUtils'

const mockRequest = jest.fn()
jest.mock('@/api/aiAssist/authorDraft', () => {
  const actual = jest.requireActual('@/api/aiAssist/authorDraft')
  return { ...actual, requestAuthorDraft: (...args: unknown[]) => mockRequest(...args) }
})
jest.mock('@/utils/aiPicksConfig', () => ({ getAiPicksBaseUrl: () => '' }))

import PublishSeoCard, { prependLeadParagraph } from '@/components/travel/PublishSeoCard'

const colors = { textMuted: '#777', text: '#111', border: '#ddd', background: '#fff', danger: '#b00', primaryDark: '#145', surface: '#fafafa', successDark: '#070' }
const styles = new Proxy({}, { get: () => ({}) }) as Record<string, object>

function Harness({ initial, onChange }: { initial: Partial<TravelFormData>; onChange?: (data: TravelFormData) => void }) {
  const [formData, setFormData] = useState<TravelFormData>({ ...getEmptyFormData('640'), ...initial })
  React.useEffect(() => onChange?.(formData), [formData, onChange])
  return <PublishSeoCard colors={colors} styles={styles} formData={formData} setFormData={setFormData} />
}

describe('PublishSeoCard (#2885)', () => {
  const originalFlag = process.env.EXPO_PUBLIC_AI_ASSISTANT
  afterEach(() => {
    process.env.EXPO_PUBLIC_AI_ASSISTANT = originalFlag
    mockRequest.mockReset()
  })

  it('без флага: поле и счётчик есть, панели и запросов нет; ввод меняет meta_description, перебор подсвечивается', async () => {
    delete process.env.EXPO_PUBLIC_AI_ASSISTANT
    const onChange = jest.fn()
    const screen = await render(<Harness initial={{}} onChange={onChange} />)
    expect(screen.getByTestId('travel-publish-meta-description-counter').props.children).toBe('0/160')
    expect(screen.queryByTestId('author-assistant-panel')).toBeNull()

    await fireEvent.changeText(screen.getByTestId('travel-publish-meta-description'), 'Два дня в Гродно с детьми.')
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ meta_description: 'Два дня в Гродно с детьми.' }))
    expect(screen.getByTestId('travel-publish-meta-description-counter').props.children).toBe('26/160')
    expect(screen.queryByTestId('travel-publish-meta-description-over')).toBeNull()

    await fireEvent.changeText(screen.getByTestId('travel-publish-meta-description'), 'x'.repeat(161))
    expect(screen.getByTestId('travel-publish-meta-description-over')).toBeTruthy()
    expect(screen.getByTestId('travel-publish-meta-description-counter').props.children).toBe('161/160')
    await act(async () => {})
    expect(screen.queryByTestId('author-assistant-panel')).toBeNull()
    expect(mockRequest).not.toHaveBeenCalled()
  })

  it('с флагом: панель грузится, варианты вставляются в название, первый абзац описания и SEO-описание', async () => {
    process.env.EXPO_PUBLIC_AI_ASSISTANT = '1'
    const onChange = jest.fn()
    const description = `<p>Старый <strong>абзац</strong> про Гродно.</p>${'<p>Ещё текст про замок и Неман.</p>'.repeat(60)}`
    const screen = await render(<Harness initial={{ name: 'Было', description }} onChange={onChange} />)
    await waitFor(() => expect(screen.getByTestId('author-assistant-panel')).toBeTruthy())
    expect(screen.queryByTestId('author-assistant-too-short')).toBeNull()

    mockRequest.mockResolvedValueOnce({ variants: ['Гродно за два дня'], remaining: 4 })
    await fireEvent.press(screen.getByTestId('author-assistant-suggest-title'))
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ kind: 'title', text: expect.not.stringContaining('<') }))
    await waitFor(() => expect(screen.getByTestId('author-assistant-insert-title-0')).toBeTruthy())
    await fireEvent.press(screen.getByTestId('author-assistant-insert-title-0'))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Гродно за два дня' }))

    mockRequest.mockResolvedValueOnce({ variants: ['Лид <про> Гродно & детей.'], remaining: 3 })
    await fireEvent.press(screen.getByTestId('author-assistant-suggest-lead'))
    await waitFor(() => expect(screen.getByTestId('author-assistant-insert-lead-0')).toBeTruthy())
    await fireEvent.press(screen.getByTestId('author-assistant-insert-lead-0'))
    const afterLead = onChange.mock.calls.at(-1)![0] as TravelFormData
    expect(afterLead.description).toBe(`<p>Лид &lt;про&gt; Гродно &amp; детей.</p>${description}`)

    mockRequest.mockResolvedValueOnce({ variants: ['Два дня в Гродно: замок, Неман, кафе.'], remaining: 2 })
    await fireEvent.press(screen.getByTestId('author-assistant-suggest-meta'))
    await waitFor(() => expect(screen.getByTestId('author-assistant-insert-meta-0')).toBeTruthy())
    await fireEvent.press(screen.getByTestId('author-assistant-insert-meta-0'))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ meta_description: 'Два дня в Гродно: замок, Неман, кафе.' }))
    expect(screen.getByTestId('travel-publish-meta-description').props.value).toBe('Два дня в Гродно: замок, Неман, кафе.')
  })

  it('prependLeadParagraph: экранирует лид и не трогает остальной HTML', () => {
    expect(prependLeadParagraph('', ' Лид ')).toBe('<p>Лид</p>')
    expect(prependLeadParagraph('<p class="ql-align-center">x</p>', 'a < b')).toBe('<p>a &lt; b</p><p class="ql-align-center">x</p>')
  })
})
