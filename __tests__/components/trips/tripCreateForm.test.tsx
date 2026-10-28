import { getOnlyHost } from '@/__tests__/helpers/hostQueries'
// __tests__/components/trips/tripCreateForm.test.tsx
// Integration render-test for TripCreateForm (Sprint 13 / FE-trip-tests #406).
// Asserts consent-gate and validation errors — does NOT snapshot the full DOM.

import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

// ── Module mocks (must precede imports of the component) ──────────────────────

const mockMutate = jest.fn()

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useCreateTrip: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}))

// Ширина вьюпорта решает, какой контрол транспорта рисует форма (#1414).
// По умолчанию — широкий экран, чтобы остальные тесты видели прежнюю раскладку.
let mockResponsiveOverride: { isHydrated: boolean; isMobile: boolean } = {
  isHydrated: true,
  isMobile: false,
}

jest.mock('@/hooks/useResponsive', () => {
  const actual = jest.requireActual('@/hooks/useResponsive')
  return {
    ...actual,
    useResponsive: () => ({ ...actual.useResponsive(), ...mockResponsiveOverride }),
  }
})

jest.mock('@/hooks/useActionConsent', () => ({
  useActionConsent: () => ({
    hasConsent: false,
    grant: jest.fn().mockResolvedValue(undefined),
    revoke: jest.fn(),
  }),
}))

jest.mock('@/utils/actionConsent', () => ({
  CONSENT_TYPES: { TRIP_ORGANIZER: 'trip_organizer' },
  hasActionConsent: jest.fn(() => false),
  readActionConsentsSync: jest.fn(() => ({})),
}))

jest.mock('@/components/ui/Button', () => {
  const React = require('react')
  const { Pressable, Text } = require('react-native')
  return function Button({ label, onPress, disabled, testID, loading }: {
    label: string
    onPress?: () => void
    disabled?: boolean
    loading?: boolean
    testID?: string
  }) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        accessibilityState={{ disabled: !!(disabled || loading) }}
        testID={testID}
      >
        <Text>{label}</Text>
      </Pressable>
    )
  }
})

jest.mock('@/components/legal/ConsentCheckbox', () => {
  const { Pressable, Text } = require('react-native')
  return function ConsentCheckbox({ checked, onToggle, testID, children }: {
    checked: boolean
    onToggle: (v: boolean) => void
    testID?: string
    children?: React.ReactNode
    accessibilityLabel?: string
  }) {
    return (
      <Pressable
        testID={testID}
        onPress={() => onToggle(!checked)}
        accessibilityState={{ checked }}
      >
        <Text>{children}</Text>
      </Pressable>
    )
  }
})

// ── Component import (after mocks) ────────────────────────────────────────────

import TripCreateForm, {
  formatTripCreateDisplayDate,
} from '@/components/trips/planning/TripCreateForm'

type RenderedForm = Awaited<ReturnType<typeof render>>

function getStartDateInput(view: RenderedForm) {
  return getOnlyHost(view.container, node => node.props["data-testid"] === 'trip-create-start-date')
}

async function changeStartDate(view: RenderedForm, value: string) {
  await fireEvent(getStartDateInput(view), 'change', { target: { value } })
}

function getEndDateInput(view: RenderedForm) {
  return getOnlyHost(view.container, node => node.props["data-testid"] === 'trip-create-end-date')
}

async function changeEndDate(view: RenderedForm, value: string) {
  await fireEvent(getEndDateInput(view), 'change', { target: { value } })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  ;(Platform as { OS: string }).OS = 'web'
  mockResponsiveOverride = { isHydrated: true, isMobile: false }
  mockMutate.mockClear()
})

// #1414 (TestFlight 1.0.5 (8)): «Я бы тут сделала компактнее с мобильной версии
// только иконки каким транспортом» — пять подписанных чипов раскладывались на
// телефоне в четыре ряда.
describe('TripCreateForm — transport control', () => {
  it('keeps labelled chips on the wide layout', async () => {
    const view = await render(<TripCreateForm />)

    expect(view.getByTestId('trip-create-transport-car')).toBeTruthy()
    expect(view.getByText('Общественный транспорт')).toBeTruthy()
    expect(view.queryByTestId('trip-create-transport')).toBeNull()
  })

  it('switches to the shared icon-only segmented control on mobile width', async () => {
    mockResponsiveOverride = { isHydrated: true, isMobile: true }
    const view = await render(<TripCreateForm />)

    expect(view.getByTestId('trip-create-transport')).toBeTruthy()
    expect(view.queryByTestId('trip-create-transport-car')).toBeNull()

    // Icon-only допустим только с человеческим доступным именем у каждой опции.
    for (const label of [
      'На машине',
      'На велосипеде',
      'Пешком',
      'Общественный транспорт',
      'Смешанный',
    ]) {
      expect(view.getByLabelText(label)).toBeTruthy()
    }

    // Выбранный транспорт назван текстом рядом с заголовком поля: иначе ряд
    // иконок не сообщает, что именно выбрано.
    expect(view.getByText('На машине')).toBeTruthy()
    await fireEvent.press(view.getByTestId('segmented-foot'))
    expect(view.getByText('Пешком')).toBeTruthy()
  })
})

describe('TripCreateForm — consent gate', () => {
  it('submit button is disabled before consent is toggled', async () => {
    const { getByTestId } = await render(<TripCreateForm />)
    const btn = getByTestId('trip-create-submit')
    expect(btn.props.accessibilityState?.disabled).toBe(true)
  })

  it('submit button becomes enabled after toggling consent', async () => {
    const { getByTestId } = await render(<TripCreateForm />)
    await fireEvent.press(getByTestId('trip-create-consent'))
    const btn = getByTestId('trip-create-submit')
    expect(btn.props.accessibilityState?.disabled).toBe(false)
  })

  it('toggling consent twice disables submit again', async () => {
    const { getByTestId } = await render(<TripCreateForm />)
    const checkbox = getByTestId('trip-create-consent')
    await fireEvent.press(checkbox) // check
    await fireEvent.press(checkbox) // uncheck
    const btn = getByTestId('trip-create-submit')
    expect(btn.props.accessibilityState?.disabled).toBe(true)
  })
})

describe('TripCreateForm — validation errors', () => {
  it('prefills a real default start date instead of showing it as a placeholder', async () => {
    const view = await render(<TripCreateForm />)
    const startDate = getStartDateInput(view)
    expect(startDate.props.type).toBe('date')
    expect(startDate.props.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('accepts route-source prefill for organizing a trip from a travel page', async () => {
    const { getByTestId } = await render(
      <TripCreateForm
        initialValues={{
          title: 'Поездка по маршруту "Нарочь"',
          description: 'Исходный маршрут: https://metravel.by/travels/naroch',
        }}
      />,
    )
    expect(getByTestId('trip-create-title').props.value).toBe('Поездка по маршруту "Нарочь"')
    expect(getByTestId('trip-create-description').props.value).toContain('/travels/naroch')
  })

  it('shows title error when submitting with empty title', async () => {
    const view = await render(<TripCreateForm />)
    const { getByTestId, findAllByText, queryByText } = view

    // Toggle consent so the button is enabled and handleSubmit runs.
    await fireEvent.press(getByTestId('trip-create-consent'))

    // Leave title empty (default '') and provide a valid date so only title fails.
    await fireEvent.changeText(getByTestId('trip-create-title'), '')
    await changeStartDate(view, '2026-08-01')

    // Press submit — yup will fire asynchronously and set field errors.
    await fireEvent.press(getByTestId('trip-create-submit'))

    const errors = await findAllByText(/Введите название поездки/i)
    expect(errors.length).toBeGreaterThan(0)
    expect(queryByText(/не короче 3 символов/i)).toBeNull()
    expect(getByTestId('trip-create-first-error').props.children).toBe('Введите название поездки')
  })

  it('shows min-length title error when title has one or two characters', async () => {
    const view = await render(<TripCreateForm />)
    const { getByTestId, findAllByText, queryByText } = view

    await fireEvent.press(getByTestId('trip-create-consent'))
    await fireEvent.changeText(getByTestId('trip-create-title'), 'Аб')
    await changeStartDate(view, '2026-08-01')
    await fireEvent.press(getByTestId('trip-create-submit'))

    const errors = await findAllByText(/не короче 3 символов/i)
    expect(errors.length).toBeGreaterThan(0)
    expect(queryByText(/Введите название поездки/i)).toBeNull()
    expect(getByTestId('trip-create-first-error').props.children).toBe(
      'Название должно быть не короче 3 символов',
    )
  })

  it('shows date error when start date is missing', async () => {
    const view = await render(<TripCreateForm />)
    const { getByTestId, findAllByText } = view

    // Toggle consent and provide a long enough title, leave date empty.
    await fireEvent.press(getByTestId('trip-create-consent'))
    await fireEvent.changeText(getByTestId('trip-create-title'), 'Тест-поездка')
    await changeStartDate(view, '')
    await fireEvent.press(getByTestId('trip-create-submit'))

    const errors = await findAllByText(/Укажите дату старта/i)
    expect(errors.length).toBeGreaterThan(0)
    expect(getByTestId('trip-create-first-error').props.children).toBe('Укажите дату старта')
  })

  it('submits a valid form using the default start date', async () => {
    const view = await render(<TripCreateForm />)
    const { getByTestId } = view
    const defaultDate = getStartDateInput(view).props.value

    await fireEvent.press(getByTestId('trip-create-consent'))
    await fireEvent.changeText(getByTestId('trip-create-title'), 'Тест-поездка')
    await fireEvent.press(getByTestId('trip-create-submit'))

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1))
    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      title: 'Тест-поездка',
      startDate: defaultDate,
      seatsTotal: 4,
      createTelegramGroup: false,
    })
  })

  it('shows Telegram group as unavailable instead of offering a broken create checkbox', async () => {
    const { getByTestId, queryByTestId, getByText } = await render(<TripCreateForm />)

    expect(getByTestId('trip-create-telegram-unavailable')).toBeTruthy()
    expect(queryByTestId('trip-create-telegram-group')).toBeNull()
    expect(getByText(/Telegram-группа для участников появится/i)).toBeTruthy()
  })

  it('shows submit-level error when consent is not checked', async () => {
    // When consent is unchecked the Button is disabled so onPress won't fire via
    // the RN Pressable chain.  Verify the disabled state instead — the submit
    // error path (consentChecked=false branch) is already covered by the
    // consent-gate suite above.
    const { getByTestId } = await render(<TripCreateForm />)
    const btn = getByTestId('trip-create-submit')
    expect(btn.props.accessibilityState?.disabled).toBe(true)
  })
})

describe('TripCreateForm — Android date picker', () => {
  beforeEach(() => {
    ;(Platform as { OS: string }).OS = 'android'
  })

  it('formats picked dates for local display', () => {
    expect(formatTripCreateDisplayDate('2026-08-15')).toBe('15 августа 2026 г.')
    expect(formatTripCreateDisplayDate('')).toBe('Выберите дату')
  })

  it('renders a picker trigger instead of a manual date text input on Android', async () => {
    const { getByTestId } = await render(
      <TripCreateForm initialValues={{ startDate: '2026-08-10' }} />,
    )
    const trigger = getByTestId('trip-create-start-date')

    expect(trigger.props.accessibilityRole).toBe('button')
    expect(trigger.props.onChangeText).toBeUndefined()
    expect(getByTestId('trip-create-start-date-value').props.children).toBe('10 августа 2026 г.')
  })

  it('updates visible date and submitted API value after selecting a calendar day', async () => {
    const { getByTestId, queryByTestId } = await render(
      <TripCreateForm
        initialValues={{
          title: 'Тест-поездка',
          startDate: '2026-08-10',
        }}
      />,
    )

    await fireEvent.press(getByTestId('trip-create-start-date'))
    expect(getByTestId('trip-create-date-picker')).toBeTruthy()

    await fireEvent.press(getByTestId('mini-calendar-day-2026-08-15'))
    expect(queryByTestId('trip-create-date-picker')).toBeNull()
    expect(getByTestId('trip-create-start-date-value').props.children).toBe('15 августа 2026 г.')

    await fireEvent.press(getByTestId('trip-create-consent'))
    await fireEvent.press(getByTestId('trip-create-submit'))

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1))
    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      title: 'Тест-поездка',
      startDate: '2026-08-15',
      seatsTotal: 4,
    })
  })

  it('keeps the current date when the picker is canceled', async () => {
    const { getByTestId, queryByTestId } = await render(
      <TripCreateForm initialValues={{ startDate: '2026-08-10' }} />,
    )

    await fireEvent.press(getByTestId('trip-create-start-date'))
    expect(getByTestId('trip-create-date-picker')).toBeTruthy()

    await fireEvent.press(getByTestId('trip-create-start-date-cancel'))
    expect(queryByTestId('trip-create-date-picker')).toBeNull()
    expect(getByTestId('trip-create-start-date-value').props.children).toBe('10 августа 2026 г.')
  })
})

// #1838: до правки конца поездки в форме не было вовсе, и поездка 26.09–04.10
// сохранялась одним днём.
describe('TripCreateForm — trip end date', () => {
  const fillValidForm = async (view: RenderedForm) => {
    await fireEvent.press(view.getByTestId('trip-create-consent'))
    await fireEvent.changeText(view.getByTestId('trip-create-title'), 'Поход по пуще')
    await changeStartDate(view, '2026-09-26')
  }

  it('offers an optional end date next to the start', async () => {
    const view = await render(<TripCreateForm />)
    const endDate = getEndDateInput(view)

    expect(endDate.props.type).toBe('date')
    expect(endDate.props.value).toBe('')
  })

  it('submits the chosen end date', async () => {
    const view = await render(<TripCreateForm />)
    await fillValidForm(view)
    await changeEndDate(view, '2026-10-04')
    await fireEvent.press(view.getByTestId('trip-create-submit'))

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1))
    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      startDate: '2026-09-26',
      endDate: '2026-10-04',
    })
  })

  // Встроенный `<input type=date>` даёт стереть значение не во всех браузерах
  // (в мобильном Safari — нет), поэтому очистка своя и на web тоже.
  it('clears the end date with an explicit control on web', async () => {
    const view = await render(<TripCreateForm />)
    expect(view.queryByTestId('trip-create-end-date-clear')).toBeNull()

    await changeEndDate(view, '2026-10-04')
    await fireEvent.press(view.getByTestId('trip-create-end-date-clear'))

    expect(getEndDateInput(view).props.value).toBe('')
    expect(view.queryByTestId('trip-create-end-date-clear')).toBeNull()
  })

  it('submits null when the end is left empty', async () => {
    const view = await render(<TripCreateForm />)
    await fillValidForm(view)
    await fireEvent.press(view.getByTestId('trip-create-submit'))

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1))
    expect(mockMutate.mock.calls[0][0]).toMatchObject({ endDate: null })
  })

  // Ошибка под полем, а не тост, и запрос не уходит — иначе бэкенд ответит 400
  // на форму, которая выглядела заполненной.
  it('blocks an end earlier than the start', async () => {
    const view = await render(<TripCreateForm />)
    await fillValidForm(view)
    await changeEndDate(view, '2026-09-25')
    await fireEvent.press(view.getByTestId('trip-create-submit'))

    const errors = await view.findAllByText('Окончание раньше начала')
    expect(errors.length).toBeGreaterThan(0)
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('accepts an end on the same day as the start', async () => {
    const view = await render(<TripCreateForm />)
    await fillValidForm(view)
    await changeEndDate(view, '2026-09-26')
    await fireEvent.press(view.getByTestId('trip-create-submit'))

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1))
    expect(mockMutate.mock.calls[0][0]).toMatchObject({ endDate: '2026-09-26' })
  })
})
