/**
 * #2911: «Черновик описания» поездки — плоский текст плана, состояния loading / variants /
 * limit / unavailable, «Вставить» в пустое поле без вопроса и «Заменить» с подтверждением.
 */
import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import { AuthorDraftError } from '@/api/aiAssist/authorDraft'
import { AI_AUTHOR_DRAFT_TRIP_MIN_TEXT_CHARS } from '@/api/aiAssist/policy'
import { buildTripDraftText } from '@/components/trips/planning/tripDraftText'

const mockRequest = jest.fn()
jest.mock('@/api/aiAssist/authorDraft', () => {
  const actual = jest.requireActual('@/api/aiAssist/authorDraft')
  return { ...actual, requestAuthorDraft: (...args: unknown[]) => mockRequest(...args) }
})
jest.mock('@/utils/aiPicksConfig', () => ({ getAiPicksBaseUrl: () => 'https://assist.test' }))
const mockConfirm = jest.fn()
jest.mock('@/utils/confirmAction', () => ({ confirmAction: (...args: unknown[]) => mockConfirm(...args) }))
jest.mock('@/i18n', () => {
  const actual = jest.requireActual('@/i18n')
  return { ...actual, getActiveLocale: () => 'be' }
})

import TripDescriptionDraftPanel from '@/components/trips/planning/TripDescriptionDraftPanel'

const PLAN = buildTripDraftText({
  title: 'На запад',
  route: [
    { id: '1', type: 'custom', name: 'Минск', description: null, coordinates: null, placeId: null },
    { id: '2', type: 'custom', name: '  ', description: null, coordinates: null, placeId: null },
    { id: '3', type: 'place', name: 'Гродно', description: null, coordinates: null, placeId: 5 },
  ],
  startDate: '2026-06-12',
  endDate: '2026-06-13',
  transport: 'car',
})

describe('buildTripDraftText (#2911)', () => {
  it('точки по порядку без пустых, даты и транспорт; без конца — одна дата', () => {
    expect(PLAN).toBe('Название: На запад. Точки: Минск → Гродно. Даты: 2026-06-12 – 2026-06-13. Транспорт: На машине')
    expect(buildTripDraftText({ route: [], startDate: '2026-06-12', endDate: '2026-06-12', transport: 'bike' })).toBe('Даты: 2026-06-12. Транспорт: На велосипеде')
  })
})

describe('TripDescriptionDraftPanel (#2911)', () => {
  beforeEach(() => {
    mockRequest.mockReset()
    mockConfirm.mockReset()
  })

  it('короткий план: кнопка неактивна, подсказка, запросов нет', async () => {
    const screen = await render(<TripDescriptionDraftPanel planText="Точки: Минск" currentValue="" onInsert={jest.fn()} />)
    expect(screen.getByTestId('trip-description-draft-too-short').props.children).toContain(String(AI_AUTHOR_DRAFT_TRIP_MIN_TEXT_CHARS))
    await fireEvent.press(screen.getByTestId('trip-description-draft-suggest'))
    expect(mockRequest).not.toHaveBeenCalled()
  })

  it('loading → варианты kind trip; пустое поле — «Вставить» без вопроса', async () => {
    let resolve: (value: { variants: string[]; remaining: number | null }) => void = () => {}
    mockRequest.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    const onInsert = jest.fn()
    const screen = await render(<TripDescriptionDraftPanel planText={PLAN} currentValue="" onInsert={onInsert} />)
    expect(screen.queryByTestId('trip-description-draft-too-short')).toBeNull()

    await fireEvent.press(screen.getByTestId('trip-description-draft-suggest'))
    expect(screen.getByTestId('trip-description-draft-loading')).toBeTruthy()
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ baseUrl: 'https://assist.test', kind: 'trip', locale: 'be', text: PLAN }))
    expect(mockRequest.mock.calls[0][0].signal).toBeInstanceOf(AbortSignal)

    resolve({ variants: ['Едем из Минска в Гродно 12–13 июня на машине.', 'Два дня на западе.'], remaining: 3 })
    await waitFor(() => expect(screen.getByTestId('trip-description-draft-variants')).toBeTruthy())
    expect(screen.getByTestId('trip-description-draft-insert-0').props.accessibilityLabel).toBe('Вставить')
    await fireEvent.press(screen.getByTestId('trip-description-draft-insert-0'))
    expect(mockConfirm).not.toHaveBeenCalled()
    expect(onInsert).toHaveBeenCalledWith('Едем из Минска в Гродно 12–13 июня на машине.')
    expect(screen.getByTestId('trip-description-draft-inserted')).toBeTruthy()
    expect(screen.getByText('Осталось запросов сегодня: 3')).toBeTruthy()
  })

  it('непустое поле — «Заменить» с подтверждением: отказ ничего не вставляет', async () => {
    mockRequest.mockResolvedValue({ variants: ['Вариант описания поездки по западу Беларуси.'], remaining: null })
    const onInsert = jest.fn()
    const screen = await render(<TripDescriptionDraftPanel planText={PLAN} currentValue="Своё описание" onInsert={onInsert} />)
    await fireEvent.press(screen.getByTestId('trip-description-draft-suggest'))
    await waitFor(() => expect(screen.getByTestId('trip-description-draft-variants')).toBeTruthy())
    expect(screen.getByTestId('trip-description-draft-insert-0').props.accessibilityLabel).toBe('Заменить')

    mockConfirm.mockResolvedValueOnce(false)
    await fireEvent.press(screen.getByTestId('trip-description-draft-insert-0'))
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1))
    expect(mockConfirm.mock.calls[0][0]).toMatchObject({ title: 'Заменить описание?', confirmText: 'Заменить' })
    expect(onInsert).not.toHaveBeenCalled()
    expect(screen.queryByTestId('trip-description-draft-inserted')).toBeNull()

    mockConfirm.mockResolvedValueOnce(true)
    await fireEvent.press(screen.getByTestId('trip-description-draft-insert-0'))
    await waitFor(() => expect(onInsert).toHaveBeenCalledWith('Вариант описания поездки по западу Беларуси.'))
    expect(screen.getByTestId('trip-description-draft-inserted')).toBeTruthy()
  })

  it('429 limit → «лимит», 503 → «недоступен»', async () => {
    mockRequest.mockRejectedValueOnce(new AuthorDraftError('limit', 'limit', { status: 429 }))
    const screen = await render(<TripDescriptionDraftPanel planText={PLAN} currentValue="" onInsert={jest.fn()} />)
    await fireEvent.press(screen.getByTestId('trip-description-draft-suggest'))
    await waitFor(() => expect(screen.getByTestId('trip-description-draft-limit')).toBeTruthy())

    mockRequest.mockRejectedValueOnce(new AuthorDraftError('unavailable', 'down', { status: 503 }))
    await fireEvent.press(screen.getByTestId('trip-description-draft-suggest'))
    await waitFor(() => expect(screen.getByTestId('trip-description-draft-unavailable')).toBeTruthy())
  })
})
